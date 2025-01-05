import { createRequire } from 'module';

import fetch from 'node-fetch';
import GtfsRealtimeBindings from "gtfs-realtime-bindings";
import Papa from 'papaparse';
import WebSocket from 'ws';

const require = createRequire(import.meta.url);

const fs = require('fs');
const sqlite3 = require('better-sqlite3')('db.db3');
const express = require('express');
const apicache = require('apicache');
const luxon = require('luxon');
const AdmZip = require('adm-zip');
var polyline = require('@mapbox/polyline');

const app = express();

const PORT = 15000;

let cache = apicache.middleware;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// CORS 
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    next();
});

const createTables = () => {
    const createTables = fs.readFileSync('create_tables.sql', 'utf8');
    sqlite3.exec(createTables);
    // iterate over files in migrations folder and execute them
    const migrations = fs.readdirSync('migrations');
    for (let migration of migrations) {
        try {
            const sql = fs.readFileSync(`migrations/${migration}`, 'utf8');
            sqlite3.exec(sql);
        } catch (e) {
            console.error(e);
        }
    }
}

const API_URL = {
    SCHEDULE: ' http://e-usluge2.rijeka.hr/OpenData/ATvoznired.json',
    STOPS: 'http://e-usluge2.rijeka.hr/OpenData/ATstanice.json',
    LINES: 'http://e-usluge2.rijeka.hr/OpenData/ATlinije.json',
    API_BASE: 'https://api.autotrolej.hr/api/open/',
}



const loadSchedule = async () => {
    try {
        console.log('Loading schedule');
        const schedule = await fetch(API_URL.SCHEDULE).then(res => res.json());
        let stops = {};
        let lines = {};
        let routes = {};
        let trips = {};
        let stoptimes = [];
        for (let line of schedule) {
            if (!stops[line.StanicaId]) {
                stops[line.StanicaId] = {
                    id: line.StanicaId,
                    name: line.Naziv,
                    lat: line.GpsY,
                    lon: line.GpsX,
                }
            }
            if (!lines.BrojLinije) {
                lines[line.BrojLinije] = {
                    id: line.BrojLinije,
                    name: line.BrojLinije,
                    color: '#F2571E',
                    text_color: '#FFFFFF',
                    operation_area: line.PodrucjePrometa,
                }
            }
            if (!routes[line.LinVarId]) {
                routes[line.LinVarId] = {
                    id: line.LinVarId,
                    line_id: line.BrojLinije,
                    name: line.NazivVarijanteLinije,
                    stop_hash: '',
                    direction: line.Smjer,
                }
            }
            if (!trips[line.PolazakId]) {
                trips[line.PolazakId] = {
                    id: line.PolazakId,
                    route_id: line.LinVarId,
                    headsign: line.NazivVarijanteLinije,
                    active_today: 1,
                }
            }
            let stop_time_int = line.Polazak.split(':').reduce((acc, val) => acc * 60 + parseInt(val), 0);
            stoptimes.push({
                trip_id: line.PolazakId,
                stop_id: line.StanicaId,
                stop_sequence: line.RedniBrojStanice,
                stop_time: stop_time_int,
            });
        }
        // Create stop hashes from stoptimes
        for (let stoptime of stoptimes) {
            if (!routes[trips[stoptime.trip_id].route_id].stop_hash.includes(stoptime.stop_id)) {
                routes[trips[stoptime.trip_id].route_id].stop_hash += stoptime.stop_id + ',';
            }
        }
        console.log('Loading stops');
        let stopsQuery = 'INSERT INTO stop (id, name, lat, lon) VALUES ';
        let stopsValues = [];
        for (let stop of Object.values(stops)) {
            stopsQuery += '(?, ?, ?, ?),';
            stopsValues.push(stop.id.toString(), stop.name, stop.lat, stop.lon);
        }
        stopsQuery = stopsQuery.slice(0, -1);
        stopsQuery += ' ON CONFLICT(id) DO UPDATE SET name=excluded.name, lat=excluded.lat, lon=excluded.lon';
        await sqlite3.prepare(stopsQuery).run(stopsValues);
        console.log('Inserting lines');
        let linesQuery = 'INSERT INTO line (id, name, color, text_color, operation_area) VALUES ';
        let linesValues = [];
        for (let line of Object.values(lines)) {
            linesQuery += '(?, ?, ?, ?, ?),';
            linesValues.push(line.id, line.name, line.color, line.text_color, line.operation_area);
        }
        linesQuery = linesQuery.slice(0, -1);
        linesQuery += ' ON CONFLICT(id) DO UPDATE SET name=excluded.name, operation_area=excluded.operation_area';
        sqlite3.prepare(linesQuery).run(linesValues);
        console.log('Inserting routes');
        // Get current routes, so we can check if we need to get new geometry
        let currentRoutes = sqlite3.prepare('SELECT * FROM route').all();
        let currentRouteIds = {};
        for (let route of currentRoutes) {
            currentRouteIds[route.id] = route.stop_hash;
        }
        let routeIdsNeeded = [];
        let routesQuery = 'INSERT INTO route (id, line_id, name, stop_hash, direction) VALUES ';
        let routesValues = [];
        for (let route of Object.values(routes)) {
            routesQuery += '(?, ?, ?, ?, ?),';
            routesValues.push(route.id, route.line_id, route.name, route.stop_hash, route.direction);
            if (currentRouteIds[route.id] !== route.stop_hash) {
                routeIdsNeeded.push([route.id, route.stop_hash]);
            }
        }
        routesQuery = routesQuery.slice(0, -1);
        routesQuery += ' ON CONFLICT(id) DO UPDATE SET line_id=excluded.line_id, name=excluded.name, stop_hash=excluded.stop_hash, direction=excluded.direction';
        sqlite3.prepare(routesQuery).run(routesValues);
        // Get new geometry for routes
        for (let pair of routeIdsNeeded) {
            let coords = pair[1].split(',').filter(x => x !== '').map(x => `${stops[x].lon},${stops[x].lat}`).join('|');
            let geometry = await fetch(`https://brouter.de/brouter?lonlats=${coords}&profile=car-fast&alternativeidx=0&format=geojson`).then(res => res.text());
            try {
                geometry = JSON.parse(geometry);
            } catch (e) {
                console.error(e, geometry);
                // Make the geometry just a line between the stops
                let coords = pair[1].split(',').filter(x => x !== '').map(x => [stops[x].lon, stops[x].lat]);
                geometry = {
                    type: 'FeatureCollection',
                    features: [
                        {
                            type: 'Feature',
                            geometry: {
                                type: 'LineString',
                                coordinates: coords,
                            }
                        }
                    ]
                }
            }
            sqlite3.prepare('DELETE FROM RouteShape WHERE route_id=?').run(pair[0]);
            let geometryQuery = 'INSERT INTO RouteShape (route_id, lat, lon, sequence) VALUES ';
            let geometryValues = [];
            let sequence = 1;
            for (let coord of geometry.features[0].geometry.coordinates) {
                geometryQuery += '(?, ?, ?, ?),';
                geometryValues.push(pair[0], coord[1], coord[0], sequence);
                sequence++;
            }
            geometryQuery = geometryQuery.slice(0, -1);
            sqlite3.prepare(geometryQuery).run(geometryValues);
        }
        console.log('Inserting trips');
        let tripsQuery = 'INSERT INTO trip (id, route_id, headsign, active_today) VALUES ';
        let tripsValues = [];
        for (let trip of Object.values(trips)) {
            tripsQuery += '(?, ?, ?, ?),';
            tripsValues.push(trip.id, trip.route_id, trip.headsign, trip.active_today);
        }
        tripsQuery = tripsQuery.slice(0, -1);
        tripsQuery += ' ON CONFLICT(id) DO UPDATE SET route_id=excluded.route_id, headsign=excluded.headsign, active_today=excluded.active_today';
        sqlite3.prepare(tripsQuery).run(tripsValues);
        // Update other trips to be inactive
        sqlite3.prepare('UPDATE trip SET active_today=0 WHERE id NOT IN (' + Object.values(trips).map(x => x.id).join(',') + ')').run();
        console.log('Inserting stoptimes');
        let stoptimesQuery = 'INSERT INTO StopTime (trip_id, stop_id, stop_sequence, stop_time) VALUES ';
        // batch stoptimes into 5000 row chunks
        for (let i = 0; i < stoptimes.length; i += 5000) {
            let stoptimesChunk = stoptimes.slice(i, i + 5000);
            let stoptimesQueryChunk = stoptimesQuery;
            let stoptimesValuesChunk = [];
            for (let stoptime of stoptimesChunk) {
                stoptimesQueryChunk += '(?, ?, ?, ?),';
                stoptimesValuesChunk.push(stoptime.trip_id, stoptime.stop_id.toString(), stoptime.stop_sequence, stoptime.stop_time);
                if (!stops[stoptime.stop_id]) {
                    console.error('Stop not found', stoptime.stop_id);
                }
            }
            stoptimesQueryChunk = stoptimesQueryChunk.slice(0, -1);
            stoptimesQueryChunk += ' ON CONFLICT(trip_id, stop_id, stop_sequence) DO UPDATE SET stop_time=excluded.stop_time';
            sqlite3.prepare(stoptimesQueryChunk).run(stoptimesValuesChunk);
        }
        // Create realisation entries for today
        let today = luxon.DateTime.local().setZone('Europe/Zagreb');
        let todayString = today.toISODate();
        let tripsToday = sqlite3.prepare('SELECT * FROM trip WHERE active_today=1').all();
        let realisationsQuery = 'INSERT INTO Realisation (trip_id, date) VALUES ';
        let realisationsValues = [];
        for (let trip of tripsToday) {
            realisationsQuery += '(?, ?),';
            realisationsValues.push(trip.id, todayString);
        }
        realisationsQuery = realisationsQuery.slice(0, -1);
        realisationsQuery += ' ON CONFLICT(trip_id, date) DO NOTHING';
        sqlite3.prepare(realisationsQuery).run(realisationsValues);
        console.log('Schedule loaded');
    } catch (e) {
        console.error(e);
    }
}

const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3; // Earth radius in meters
    const toRad = (x) => (x * Math.PI) / 180;

    const φ1 = toRad(lat1);
    const φ2 = toRad(lat2);
    const Δφ = toRad(lat2 - lat1);
    const Δλ = toRad(lon2 - lon1);

    const a =
        Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
};

const calculateBearing = (lat1, lon1, lat2, lon2) => {
    const toRad = (x) => (x * Math.PI) / 180;
    const toDeg = (x) => (x * 180) / Math.PI;

    const φ1 = toRad(lat1);
    const φ2 = toRad(lat2);
    const λ1 = toRad(lon1);
    const λ2 = toRad(lon2);

    const y = Math.sin(λ2 - λ1) * Math.cos(φ2);
    const x =
        Math.cos(φ1) * Math.sin(φ2) -
        Math.sin(φ1) * Math.cos(φ2) * Math.cos(λ2 - λ1);
    return (toDeg(Math.atan2(y, x)) + 360) % 360;
};

const findClosestStops = (trip, vehicleLat, vehicleLon, tolerance = 100, startEndTolerance = 300) => {
    let closestPrevStop = null;
    let closestNextStop = null;
    let minDistancePrev = Infinity;
    let minDistanceNext = Infinity;

    for (let i = 0; i < trip.length; i++) {
        const stop = trip[i];
        const distanceToStop = calculateDistance(vehicleLat, vehicleLon, stop.lat, stop.lon);
        const isFirstStop = i === 0;
        const isLastStop = i === trip.length - 1;
        const radius = isFirstStop || isLastStop ? startEndTolerance : tolerance;

        if (distanceToStop <= radius && distanceToStop < minDistancePrev) {
            minDistancePrev = distanceToStop;
            closestPrevStop = stop;
        }

        if (distanceToStop <= radius && distanceToStop < minDistanceNext) {
            minDistanceNext = distanceToStop;
            closestNextStop = stop;
        }
    }

    return { closestPrevStop, closestNextStop };
};

const kalmanFilter = (prevValue, measurement, errorCovariance, processVariance, measurementVariance) => {
    const kalmanGain = errorCovariance / (errorCovariance + measurementVariance);
    const currentValue = prevValue + kalmanGain * (measurement - prevValue);
    const updatedErrorCovariance = (1 - kalmanGain) * errorCovariance + processVariance;
    return { currentValue, updatedErrorCovariance };
};

const adjustVariances = (predictionError, processVariance, measurementVariance, adjustmentFactor) => {
    const newProcessVariance = processVariance * (1 + adjustmentFactor * Math.abs(predictionError));
    const newMeasurementVariance = measurementVariance * (1 + adjustmentFactor * Math.abs(predictionError));
    return { newProcessVariance, newMeasurementVariance };
};

let VEHICLE_LOCATION_MAP = {};

const processWebSocketData = (data) => {
    const db = sqlite3;

    const vehicleQuery = 'INSERT INTO Vehicle (id, internal_id) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET plate=excluded.internal_id';

    const vehicleLocationQuery =
        'INSERT INTO VehiclePosition (vehicle_id, trip_id, lat, lon, bearing, timestamp, delay) VALUES (?, ?, ?, ?, ?, ?, ?) ' +
        'ON CONFLICT(vehicle_id) DO UPDATE SET trip_id=excluded.trip_id, lat=excluded.lat, lon=excluded.lon, bearing=excluded.bearing, timestamp=excluded.timestamp, delay=excluded.delay';

    const realisationsQuery =
        'INSERT INTO Realisation (trip_id, date, vehicle_id) VALUES (?, ?, ?) ' +
        'ON CONFLICT(trip_id, date) DO UPDATE SET vehicle_id=excluded.vehicle_id';

    const now = luxon.DateTime.local().setZone('Europe/Zagreb').toSeconds();
    const midnight = luxon.DateTime.local().setZone('Europe/Zagreb').startOf('day').toSeconds();

    const [gbr, voznjaBusId, voznjaId, lat, lon] = data.split(';');
    const vehicleId = gbr.toString();
    const tripId = voznjaBusId.toString();
    const latitude = parseFloat(lat);
    const longitude = parseFloat(lon);

    // Get previous vehicle location if available
    const prevLocation = db.prepare('SELECT * FROM VehiclePosition WHERE vehicle_id = ?').get(vehicleId);

    // If the location hasn't changed, don't update the database
    if (prevLocation && prevLocation.lat === latitude && prevLocation.lon === longitude) return;

    let bearing = 0;
    if (prevLocation) {
        const distance = calculateDistance(prevLocation.lat, prevLocation.lon, latitude, longitude);
        if (distance > 10) {
            bearing = calculateBearing(prevLocation.lat, prevLocation.lon, latitude, longitude);
        } else {
            bearing = prevLocation.bearing;
        }
    }

    const tripStops = db.prepare('SELECT stop_id, stop_time, lat, lon FROM StopTime st JOIN Stop s ON st.stop_id = s.id WHERE st.trip_id = ? ORDER BY stop_sequence').all(tripId);
    if (!tripStops || tripStops.length === 0) return;

    const { closestPrevStop, closestNextStop } = findClosestStops(tripStops, latitude, longitude);

    if (!closestPrevStop || !closestNextStop) return;

    const isAtFirstStop = closestPrevStop.stop_id === tripStops[0].stop_id;
    const isAtLastStop = closestNextStop.stop_id === tripStops[tripStops.length - 1].stop_id;


    const totalStopDistance = calculateDistance(closestPrevStop.lat, closestPrevStop.lon, closestNextStop.lat, closestNextStop.lon);
    const distanceToPrevStop = calculateDistance(latitude, longitude, closestPrevStop.lat, closestPrevStop.lon);
    const progressBetweenStops = Math.min(distanceToPrevStop / totalStopDistance, 1); // Avoid overshooting

    const interpolatedTime = closestPrevStop.stop_time + (closestNextStop.stop_time - closestPrevStop.stop_time) * progressBetweenStops;
    let delay;
    if (isAtFirstStop || isAtLastStop) {
        delay = now - (midnight + closestPrevStop.stop_time);
        if (delay < 0 && isAtFirstStop) {
            delay = 0;
        }
    } else {
        // Otherwise, calculate delay normally
        delay = now - (midnight + interpolatedTime);
    }
    // Apply Kalman filter only if not at first or last stop
    if (!isAtFirstStop && !isAtLastStop) {
        let prevDelayTime = prevLocation?.delay || 0;
        let prevErrorCovariance = vehicleId in VEHICLE_LOCATION_MAP ? VEHICLE_LOCATION_MAP[vehicleId].errorCovariance : 1;
        let processVariance = 1; // Initial process variance
        let measurementVariance = 2; // Initial measurement variance

        // Apply Kalman filter
        const kalmanResult = kalmanFilter(prevDelayTime, delay, prevErrorCovariance, processVariance, measurementVariance);
        let filteredDelayTime = kalmanResult.currentValue;

        // Update covariance in memory for the next iteration
        VEHICLE_LOCATION_MAP[vehicleId] = {
            errorCovariance: kalmanResult.updatedErrorCovariance,
        };

        delay = filteredDelayTime;
    }


    // Update Vehicle table
    db.prepare(vehicleQuery).run(vehicleId, vehicleId);

    // Update VehiclePosition table
    db.prepare(vehicleLocationQuery).run(vehicleId, tripId, latitude, longitude, bearing, now, delay);

    // Update Realisation table
    const currentDate = luxon.DateTime.local().setZone('Europe/Zagreb').toISODate();
    db.prepare(realisationsQuery).run(tripId, currentDate, vehicleId);
};

const setupWebSocket = () => {
    const ws = new WebSocket('wss://api.autotrolej.hr/api/Hub/location');

    ws.on('open', () => {
        console.log('WebSocket connection established.');
    });

    ws.on('message', (message) => {
        const data = message.toString();
        try {
            processWebSocketData(data);
        } catch (e) {
            console.error('Error processing WebSocket data:', e);
        }
    });

    ws.on('close', () => {
        console.log('WebSocket connection closed. Reconnecting in 5 seconds...');
        setTimeout(setupWebSocket, 5000);
    });

    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        ws.close();
    });
};


app.get('/api/stops', cache('1 hour'), (req, res) => {
    let stopDetails = sqlite3.prepare(`
        SELECT 
            stop.id AS int_id, 
            stop.lat AS latitude, 
            stop.lon AS longitude, 
            stop.name, 
            stop.id AS ref_id,
            (
                SELECT GROUP_CONCAT(DISTINCT route.line_id) 
                FROM stoptime 
                JOIN trip ON stoptime.trip_id = trip.id 
                JOIN route ON trip.route_id = route.id 
                WHERE stoptime.stop_id = stop.id
                ORDER BY route.line_id ASC
            ) AS route_groups_on_station
        FROM stop
    `).all();    
    let stops = [];
    for (let stop of stopDetails) {
        stops.push({
            "name": stop.name,
            "station_code": stop.int_id,
            "latitude": stop.latitude,
            "longitude": stop.longitude,
            "station_int_id": stop.int_id,
            "route_groups_on_station": stop.route_groups_on_station.split(','),
        });
    }
    res.json({
        'success': true,
        'data': stops,
    });
});

app.get('/api/stops/:stop_id/arrivals', cache('15 seconds'), (req, res) => {
    let arrivals = sqlite3.prepare(`SELECT
        st.stop_time as arrival_time,
        st.trip_id as trip_id,
        s.id as stop_id,
        s.name as stop_name,
        s.lat as latitude,
        s.lon as longitude,
        st.stop_sequence as stop_sequence,
        r.id as route_id,
        r.name as route_name,
        l.name as line_name,
        re.vehicle_id as vehicle_id,
        vp.delay as delay
        FROM StopTime st
        JOIN stop s ON st.stop_id=s.id
        JOIN trip t ON st.trip_id=t.id
        JOIN route r ON t.route_id=r.id
        JOIN line l ON r.line_id=l.id
        LEFT JOIN realisation re ON t.id=re.trip_id AND re.date=?
        LEFT JOIN vehicleposition vp ON re.vehicle_id=vp.vehicle_id
        WHERE st.stop_id=? AND t.active_today=1
        ORDER BY st.stop_sequence
    `).all(luxon.DateTime.local().setZone('Europe/Zagreb').toISODate(), req.params.stop_id);
    let stop_details = sqlite3.prepare('SELECT * FROM stop WHERE id=?').get(req.params.stop_id);
    let resp = [];
    let midnightSeconds = luxon.DateTime.local().setZone('Europe/Zagreb').startOf('day').toSeconds();
    let now = luxon.DateTime.local().setZone('Europe/Zagreb').toSeconds();
    for (let arrival of arrivals) {
        if (arrival.arrival_time + arrival.delay + midnightSeconds < now) {
            continue;
        }
        resp.push({
            "route_id": arrival.route_id,
            "trip_id": arrival.trip_id,
            "vehicle_id": arrival.vehicle_id,
            "type": arrival.vehicle_id ? 0 : 1,
            "eta_min": Math.floor((arrival.arrival_time + arrival.delay + midnightSeconds - luxon.DateTime.local().setZone('Europe/Zagreb').toSeconds()) / 60),
            "scheduled": arrival.arrival_time,
            "delay": arrival.delay || 0,
            "route_name": arrival.line_name,
            "trip_name": arrival.route_name,
            "stations": {
                "departure": arrival.route_name,
                "arrival": arrival.route_name,
            }
        });
    }
    // Sort by eta
    resp.sort((a, b) => a.eta_min - b.eta_min);
    res.json({
        'success': true,
        'data': {
            "station": {
                "ref_id": stop_details.id,
                "name": stop_details.name,
                "code_id": stop_details.id,
            },
            "arrivals": resp,
        },
    });
});

app.get('/api/locations', cache('5 seconds'), (req, res) => {
    let vehicleLocations = sqlite3.prepare(`
        SELECT
            vp.lat as latitude,
            vp.lon as longitude,
            vp.bearing as direction,
            vp.timestamp as timestamp,
            vp.trip_id as trip_id,
            v.id as bus_id,
            COALESCE(v.plate, v.id) as bus_name,
            COALESCE(l.name, '') as line_number,
            COALESCE(r.name, '') as line_name,
            COALESCE(t.headsign, '') as line_destination
        FROM VehiclePosition vp
        JOIN vehicle v ON vp.vehicle_id=v.id
        LEFT JOIN trip t ON vp.trip_id=t.id
        LEFT JOIN route r ON t.route_id=r.id
        LEFT JOIN line l ON r.line_id=l.id
        `).all();
    res.json({
        'success': true,
        'data': vehicleLocations,
    });
});

app.get('/api/trips/:trip_id', cache('5 seconds'), (req, res) => {
    let tripDetails = sqlite3.prepare(`
        SELECT
            st.stop_time as arrival_time,
            s.id as stop_id,
            s.name as stop_name,
            s.lat as latitude,
            s.lon as longitude,
            st.stop_sequence as stop_sequence,
            r.id as route_id,
            re.vehicle_id as vehicle_id,
            vp.delay as delay
        FROM StopTime st
        JOIN stop s ON st.stop_id=s.id
        JOIN trip t ON st.trip_id=t.id
        JOIN route r ON t.route_id=r.id
        LEFT JOIN realisation re ON t.id=re.trip_id AND re.date=?
        LEFT JOIN vehicleposition vp ON re.vehicle_id=vp.vehicle_id
        WHERE st.trip_id=?
        ORDER BY st.stop_sequence
        `).all(luxon.DateTime.local().setZone('Europe/Zagreb').toISODate(), req.params.trip_id);
    let resp = [];
    let midnightSeconds = luxon.DateTime.local().setZone('Europe/Zagreb').startOf('day').toSeconds();
    for (let stop of tripDetails) {
        resp.push( {
            "name": stop.stop_name,
            "station_code": stop.stop_id,
            "order_no": stop.stop_sequence,
            "latitude": stop.latitude,
            "longitude": stop.longitude,
            "station_int_id": stop.stop_id,
            "arrivals": [{
                "route_id": stop.route_id,
                "vehicle_id": stop.vehicle_id,
                "type": stop.vehicle_id ? 0 : 1, 
                "eta_min": Math.floor((stop.arrival_time + stop.delay + midnightSeconds - luxon.DateTime.local().setZone('Europe/Zagreb').toSeconds()) / 60),
                "scheduled": stop.arrival_time,
                "delay": stop.delay,
            }]
        });
    }
    res.json({
        'success': true,
        'data': resp,
    });
});

app.get('/api/lines', cache('1 hour'), (req, res) => {
    let lines = sqlite3.prepare('SELECT * FROM line').all();
    res.json({
        'success': true,
        'data': lines,
    });
});

app.get('/api/colors', cache('1 hour'), (req, res) => {
    let colors = sqlite3.prepare('SELECT id, color, text_color FROM line;').all();
    res.json({
        'success': true,
        'data': colors,
    });
});

app.get('/api/trips/:trip_id/shape', cache('60 seconds'), (req, res) => {
    let routeShape = sqlite3.prepare(`
        SELECT
            lat as latitude,
            lon as longitude
        FROM RouteShape rs
        JOIN trip t ON rs.route_id=t.route_id
        WHERE t.id=?
        ORDER BY sequence
        `).all(req.params.trip_id);
    res.json({
        'success': true,
        'data': [
            {
                'geojson_shape': {
                    'type': 'LineString',
                    'coordinates': routeShape.map(x => [x.longitude, x.latitude]),
                }
            }
        ],
    });
});

// Helper function to get the current date in YYYY-MM-DD format
function getCurrentDate() {
    const today = new Date();
    return today.toISOString().split('T')[0];
}

// Helper function to get the current time in seconds from midnight
function getSecondsFromMidnight() {
    const now = luxon.DateTime.local().setZone('Europe/Zagreb');
    return now.toSeconds() - now.startOf('day').toSeconds();
}

// Endpoint to get the realisation status count
app.get('/api/report/realisation', cache('1 minute'), (req, res) => {
    const today = getCurrentDate();
    const currentSeconds = getSecondsFromMidnight();

    const result = sqlite3.prepare(`
        SELECT status, COUNT(*) AS count FROM (
            SELECT 
                t.id AS trip_id,
                CASE 
                    WHEN r.vehicle_id IS NOT NULL THEN 'realized'
                    WHEN r.vehicle_id IS NULL AND t.active_today = 1 AND st.stop_time <= ? THEN 'not_realized'
                    WHEN st.stop_time > ? THEN 'in_future'
                    ELSE 'unknown'
                END AS status
            FROM Trip t
            LEFT JOIN Realisation r ON t.id = r.trip_id AND r.date = ?
            LEFT JOIN StopTime st ON t.id = st.trip_id
            WHERE t.active_today = 1
            GROUP BY t.id
        ) AS subquery
        GROUP BY status
    `).all(currentSeconds, currentSeconds, today);
    res.json({
        'success': true,
        'data': result,
    });
});

app.get('/api/report/vehicle', cache('1 minute'), (req, res) => {
    const result = sqlite3.prepare(`
        SELECT 
            vp.vehicle_id,
            v.internal_id,
            v.plate,
            vp.trip_id,
            r.name AS route_name,
            l.name AS line_name,
            (
                SELECT stop_time FROM StopTime st WHERE st.trip_id = vp.trip_id ORDER BY stop_sequence ASC LIMIT 1
            ) AS first_stop_time
        FROM VehiclePosition vp
        JOIN Vehicle v ON vp.vehicle_id = v.id
        JOIN Trip t ON vp.trip_id = t.id
        JOIN Route r ON t.route_id = r.id
        JOIN Line l ON r.line_id = l.id
        WHERE vp.timestamp >= ? 
        ORDER BY vp.vehicle_id ASC
    `).all(luxon.DateTime.local().setZone('Europe/Zagreb').toSeconds() - 60);
    res.json({
        'success': true,
        'data': result,
    });
});

// mount static files in folder static to endpoint /web
app.use('/web', express.static('static'));

// Redirect root to /web
app.get('/', (req, res) => {
    res.redirect('/web/index.html');
});

app.listen(PORT, async () => {
    try {
        await createTables();
    } catch (e) {
        console.error(e);
    }
    await loadSchedule();
    setupWebSocket();
    console.log(`Server running on port ${PORT}`);
});
