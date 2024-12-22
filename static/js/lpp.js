const API_KEY = ""              // API key for the LPP API
const PROXY_URL = "https://cors.proxy.prometko.si/"      // URL for bypassing CORS rules
const BUS_DATA_URL = "/api/locations" // URL for getting the bus location data from own API
const BUS_DATA_SHA = "/api/routes"// URL for getting the shape of the route vector
const BUS_IMAGE_DATA = "json/busDetails.json"                       // URL for getting the filler and image information from local source
const BUS_IMAGE_LOCATION = "img/avtobusi/"                          // Location of the bus images on the storage

// Help for fetching errors :)
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// Global variables
let busObject = [];         // Stores the general bus data
let busMarker = [];         // Stores the bus markers
let stationObject = [];     // Stores a list of all the stations
let busLayer = L.layerGroup().addTo(map);               // Map layer on which all the bus markers are contained
let busStationLayer = L.layerGroup().addTo(map);        // Shows where the stations of the route are located
let busVectorLayer = L.layerGroup().addTo(map);         // Map layer which shows the route the line takes

let globalIndex;            // Global index of the selected bus 
let globalStationIndex;     // Global index of the selected station
let trackBus = false;       // Defines if the selected bus should be tracked.
var globalLPPShow = true;   // Defines if the markers should be shown.

let lineColors = [];       // Stores the line colors of the buses
// ... and their matching color code.

const VOCABULARY = {
    arrival: "Dolazak",
    detour: "Obilazak",
    stop_arrivals: "Dolasci na stanicu",
    route: "Linija",
    state: "Stanje",
    type: "Tip",
    on_line: "Na liniji",
    driving: "Vozi",
    inactive: "Neaktivan",
    close_tab: "Zatvori karticu",
    track_bus: "Prati autobus",
    recorded: "Viđen",
    line: "Linija",
    direction: "Smjer",
    from_centre: "iz centra",
    to_centre: "prema centru",
    no_line: "Vanlinijski prijevoz",
    garage: "Garaža",
}

// Start the whole thing
loop();

// Fill out the station data as well
getStationList();

/**
 * fetchData(url, apiKey, proxy)
 * Fetch the data from the server.
 * Entry params
 * @url - URL to be fetched (GET) [STRING]
 * @apiKey - apiKey for the authorization [STRING]
 * @proxy - boolean if a proxy should be used [BOOLEAN]
 */
async function fetchData(url, apiKey, proxy) {
    try {
        let myHeaders = new Headers();
        if (apiKey != undefined) myHeaders.append("apikey", apiKey);
        myHeaders.append("X-Requested-With", "application/json");

        if (proxy) url = PROXY_URL + url;

        let requestOptions = {
            method: 'GET',
            headers: myHeaders,
            redirect: 'follow'
        };

        let res;

        await fetch(url, requestOptions)
            .then(response => response.text())
            .then(result => res = result)
            .catch(error => console.log('error', error));

        res = JSON.parse(res);

        if (res.success) res = res.data;

        return res;

    } catch (e) {
        console.log("Error encountered during fetching: ", e);
        await delay(500);
        return fetchData(url, apiKey, proxy);
    }

}

/**
 * validateTimestamp(timestamp)
 * Checks if the bus location & dispatching information can be considered valid
 * @timestamp - ISO Date string of the buses timestamp [STRING]
 */
async function validateTimestamp(timestamp) {
    let compareTime = new Date(timestamp * 1000);

    let t = new Date().getTime();
    let ct = compareTime.getTime();

    let k = t - ct;
    if (t - ct > 300000) {
        return false;
    }
    return true;
}

/**
 * loop()
 * Do housekeeping tasks, which include
 * - updating the bus list
 * - updating the sidebar
 */
async function loop() {
    let tempBusObject = await fetchData(BUS_DATA_URL, undefined, false);
    let busImageData = await fetchData(BUS_IMAGE_DATA, undefined, false);
    for (i in tempBusObject) {
        tempBusObject[i].timeValidity = await validateTimestamp(tempBusObject[i].timestamp);

        if (tempBusObject[i].line_number !== "" && tempBusObject[i].timeValidity === true) tempBusObject[i].category = 1;
        else if (tempBusObject[i].engine == true && tempBusObject[i].timeValidity === true) tempBusObject[i].category = 2;
        else tempBusObject[i].category = 3;

        for (j in busImageData) {
            if (tempBusObject[i].bus_id.includes(busImageData[j].bus_id)) {
                tempBusObject[i] = { ...tempBusObject[i], ...busImageData[j] };
            }
        }
    }
    busObject = await tempBusObject;
    // go create the markers!
    displayMarkers();
    updateSidebar();
    getArrivalInfo();
    setTimeout(loop, 5000);
}

async function getStationList() {
    stationObject = await fetchData("/api/stops", "", false);
}

/**
 * displayMarkers()
 * loops through the bus data and displays it accordingly
 */
async function displayMarkers() {
    for (i in busObject) {
        if (busMarker[i]) {
            // update the marker
            let latLng = [busObject[i].latitude, busObject[i].longitude];
            busMarker[i].setLatLng(latLng).bindTooltip(busObject[i].bus_id);
            switch (busObject[i].category) {
                case 1:
                    busMarker[i].setIcon(L.divIcon({
                        className: 'icon-active',
                        iconSize:     [25, 25],
                        iconAnchor:   [13, 13],
                        popupAnchor:  [0, 0],
                        html: `<p class="icon">${busObject[i].line_number ? busObject[i].line_number : "⬤"}</p>
                                <img class="icon-pointer" style="transform: rotate(${busObject[i].direction + 225}deg)" src="img/ico/rotIcoActive.svg"/>`
                    }));
                    break;
                case 2:
                    busMarker[i].setIcon(L.divIcon({
                        className: 'icon-hidden',
                        iconSize:     [25, 25],
                        iconAnchor:   [13, 13],
                        popupAnchor:  [0, 0],
                        html: `<p class="icon">${busObject[i].line_number ? busObject[i].line_number : "⬤"}</p>
                        <img class="icon-pointer" style="transform: rotate(${busObject[i].direction + 225}deg)" src="img/ico/rotIcoHidden.svg"/>`
                    }));
                    break;
                case 3:
                    busMarker[i].setIcon(L.divIcon({
                        className: 'icon-inactive',
                        iconSize:     [25, 25],
                        iconAnchor:   [13, 13],
                        popupAnchor:  [0, 0],
                        html: `<p class="icon">${busObject[i].line_number ? busObject[i].line_number : "⬤"}</p>
                        <img class="icon-pointer" style="transform: rotate(${busObject[i].direction + 225}deg)" src="img/ico/rotIcoInactive.svg"/>`
                    }));
                    break;
            }
            if (globalIndex === i) {
                busMarker[i].setIcon(L.divIcon({
                    className: 'icon-selected',
                    iconSize:     [25, 25],
                    iconAnchor:   [13, 13],
                    popupAnchor:  [0, 0],
                    html: `<p class="icon">${busObject[globalIndex].line_number ? busObject[globalIndex].line_number : "⬤"}</p>
                    <img class="icon-pointer" style="transform: rotate(${busObject[globalIndex].direction + 225}deg)" src="img/ico/rotIconSelect.svg"/>`
                }));
            }
        } else {
            // create the marker and append it to the layer
            let latLng = [busObject[i].latitude, busObject[i].longitude];
            busMarker[i] = L.marker(latLng, {
                rotationOrigin: "center center",
                title: busObject[i].bus_name,
                riseOnHover: true
            }).on('click', onClick).addTo(busLayer);
            switch (busObject[i].category) {
                case 1:
                    busMarker[i].setIcon(L.divIcon({
                        className: 'icon-active',
                        iconSize:     [25, 25],
                        iconAnchor:   [13, 13],
                        popupAnchor:  [0, 0],
                        html: `<p class="icon">${busObject[i].line_number ? busObject[i].line_number : "⬤"}</p>
                                <img class="icon-pointer" style="transform: rotate(${busObject[i].direction + 225}deg)" src="img/ico/rotIcoActive.svg"/>`
                    }));
                    break;
                case 2:
                    busMarker[i].setIcon(L.divIcon({
                        className: 'icon-hidden',
                        iconSize:     [25, 25],
                        iconAnchor:   [13, 13],
                        popupAnchor:  [0, 0],
                        html: `<p class="icon">${busObject[i].line_number ? busObject[i].line_number : "⬤"}</p>
                        <img class="icon-pointer" style="transform: rotate(${busObject[i].direction + 225}deg)" src="img/ico/rotIcoHidden.svg"/>`
                    }));
                    break;
                case 3:
                    busMarker[i].setIcon(L.divIcon({
                        className: 'icon-inactive',
                        iconSize:     [25, 25],
                        iconAnchor:   [13, 13],
                        popupAnchor:  [0, 0],
                        html: `<p class="icon">${busObject[i].line_number ? busObject[i].line_number : "⬤"}</p>
                        <img class="icon-pointer" style="transform: rotate(${busObject[i].direction + 225}deg)" src="img/ico/rotIcoInactive.svg"/>`
                    }));
                    break;
            }
            busMarker[i].index = i;
        }
    }
}

/**
 * onClick(e)
 * Describes what happens when an marker is clicked.
 * @e - event
 */
function onClick(e) {
    //closeSideNav();
    replaceOldGlobalMarker();
    removeContents();
    e.target.setIcon(L.divIcon({
        className: 'icon-selected',
        iconSize:     [25, 25],
        iconAnchor:   [13, 13],
        popupAnchor:  [0, 0],
        html: `<p class="icon">${busObject[e.target.index].line_number ? busObject[e.target.index].line_number : "⬤"}</p>
        <img class="icon-pointer" style="transform: rotate(${busObject[e.target.index].direction + 225}deg)" src="img/ico/rotIconSelect.svg"/>`
    }));
    globalIndex = e.target.index;
    map.setView(e.target.getLatLng());
    makeSidebar(e.target.index);
}

/**
 * replaceOldGlobalMarker()
 * Replaces the marker on the previous vehicle while being faster!
 */
async function replaceOldGlobalMarker() {
    if (globalIndex == undefined) return;
    switch (busObject[globalIndex].category) {
        case 1:
            busMarker[globalIndex].setIcon(L.divIcon({
                className: 'icon-active',
                iconSize:     [25, 25],
                iconAnchor:   [13, 13],
                popupAnchor:  [0, 0],
                html: `<p class="icon">${busObject[globalIndex].line_number ? busObject[globalIndex].line_number : "⬤"}</p>
                        <img class="icon-pointer" style="transform: rotate(${busObject[globalIndex].direction + 225}deg)" src="img/ico/rotIcoActive.svg"/>`
            }));
            break;
        case 2:
            busMarker[globalIndex].setIcon(L.divIcon({
                className: 'icon-hidden',
                iconSize:     [25, 25],
                iconAnchor:   [13, 13],
                popupAnchor:  [0, 0],
                html: `<p class="icon">${busObject[globalIndex].line_number ? busObject[globalIndex].line_number : "⬤"}</p>
                <img class="icon-pointer" style="transform: rotate(${busObject[globalIndex].direction + 225}deg)" src="img/ico/rotIcoHidden.svg"/>`
            }));
            break;
        case 3:
            busMarker[globalIndex].setIcon(L.divIcon({
                className: 'icon-inactive',
                iconSize:     [25, 25],
                iconAnchor:   [13, 13],
                popupAnchor:  [0, 0],
                html: `<p class="icon">${busObject[globalIndex].line_number ? busObject[globalIndex].line_number : "⬤"}</p>
                <img class="icon-pointer" style="transform: rotate(${busObject[globalIndex].direction + 225}deg)" src="img/ico/rotIcoInactive.svg"/>`
            }));
            break;
    }
}

/**
 * makeSidebar(id)
 * Makes the sidebar for the selected vehicle
 * @index - index of the bus in the array
 */
async function makeSidebar(index) {
    let sidebar = document.getElementById("sidebar");
    let data = document.createElement('div');
    data.className = "data";
    data.id = "data"
    let busImageData = document.createElement('div');
    busImageData.className = "busImageData";
    let image = document.createElement('img');
    let closeButton = document.createElement("button");
    closeButton.innerHTML = "<i class=\"bi bi-x\"></i>";
    closeButton.className = "close";
    closeButton.title = VOCABULARY.close_tab;
    image.className = "bus";
    if (busObject[index].author) {
        // check if the image exists
        let img = await fetch(BUS_IMAGE_LOCATION + busObject[index].bus_id + ".jpg", { method: 'HEAD' });
        if (img.ok) {
            image.src = BUS_IMAGE_LOCATION + busObject[index].bus_id + ".jpg";
            let author = document.createElement('div');
            author.className = "author";
            let small = document.createElement('small');
            small.innerHTML = "<i class=\"bi bi-camera\"></i> " + busObject[index].author;
            author.appendChild(small);
            busImageData.appendChild(image);
            busImageData.appendChild(author);
            busImageData.appendChild(closeButton);
        } else {
            image.src = BUS_IMAGE_LOCATION + "nima.jpg";
            busImageData.appendChild(image);
            busImageData.appendChild(closeButton);
        }
    } else {
        image.src = BUS_IMAGE_LOCATION + "nima.jpg";
        busImageData.appendChild(image);
        busImageData.appendChild(closeButton);
    }
    closeButton.addEventListener("click", removeContents);
    //create the whole thing
    let busSide = document.createElement('div');
    busSide.id = "busSide";
    busSide.style = "margin:1rem; padding-bottom: 1rem;"
    //create the top part
    let busName = document.createElement('div');
    busName.className = "busName";
    let h2 = document.createElement('h2');
    h2.innerHTML = busObject[index].bus_name;
    let p = document.createElement('p');
    let locateButton = document.createElement('button');
    locateButton.innerHTML = "<i class=\"bi bi-geo-alt-fill\"></i>";
    locateButton.index = await index;
    locateButton.className = "locateBus";
    locateButton.title = VOCABULARY.track_bus;
    locateButton.addEventListener("click", function () {
        if (trackBus) {
            trackBus = false;
            this.style.backgroundColor = "rgba(53, 53, 53, .0)";
            this.style.color = "black";
            if (darkMode) {
                this.style.color = "white";
            }
            return;
        } else {
            trackBus = true;
            this.style.color = "#1E7B4B";

        }
        let latLngA = [busObject[this.index].latitude, busObject[this.index].longitude];
        map.setView(latLngA, 17);
    });
    let hr = document.createElement('hr');
    let hr2 = document.createElement('hr');
    p.innerHTML = busObject[index].type;
    busName.appendChild(h2);
    busName.appendChild(locateButton);
    busName.appendChild(p);
    busName.appendChild(hr);
    //create the statistic table
    let table = document.createElement('table');
    table.style.width = "100%";
    for (let i = 0; i < 6; i++) {
        let tr = table.insertRow(table.rows.length);
        let td1 = tr.insertCell(0);
        td1.className = "leftTableBusDetailSide";
        let td2 = tr.insertCell(1);
        switch (i) {
            case 0:
                td1.innerHTML =`<b>${VOCABULARY.type}</b>`;
                td2.innerHTML = busObject[index].model + ` ${busObject[index].ramp ? `<i style="padding: .15rem; border-radius: .3rem; background-color: #005b8c; color:white" class="fa fa-wheelchair" title="Avtobus je prijazen osebam z invaliditetom."></i>` : ``}`;
                break;
            case 2:
                td1.innerHTML = `<b>${VOCABULARY.state}</b>`;
                td2.id = "stanje";
                switch (busObject[index].category) {
                    case 1:
                        td2.innerHTML = VOCABULARY.on_line;
                        break;
                    case 2:
                        td2.innerHTML = VOCABULARY.driving;
                        break;
                    case 3:
                        td2.innerHTML = VOCABULARY.inactive;
                        break;
                }
                break;
            case 3:
                td1.innerHTML = `<b>${VOCABULARY.route}</b>`;
                td2.id = "proga";
                td2.innerHTML = await getDestination(index);
                break;
            case 5:
                td1.innerHTML = `<b>${VOCABULARY.recorded}</b>`;
                td2.id = "zabeležen"
                td2.innerHTML = await reformatTime(index);
                break;
        }
        /**
         * 
         */
    }
    // append the existing data
    data.appendChild(busImageData);
    busSide.appendChild(busName);
    busSide.appendChild(table);
    busSide.appendChild(hr2);
    // if the bus is on a line - create the remaining station table
    addSidebarLineTable();
    // and finally append it to the bottom
    data.appendChild(busSide);
    sidebar.appendChild(data);

}

async function updateSidebar() {
    if (globalIndex == undefined) return;
    let index = globalIndex;
    switch (busObject[index].category) {
        case 1:
            document.getElementById("stanje").innerHTML = VOCABULARY.on_line;
            break;
        case 2:
            document.getElementById("stanje").innerHTML = VOCABULARY.driving;
            break;
        case 3:
            document.getElementById("stanje").innerHTML = VOCABULARY.inactive;
            break;
    }
    document.getElementById("proga").innerHTML = await getDestination(index);
    document.getElementById("zabeležen").innerHTML = await reformatTime(index);
    if (trackBus) {
        map.setView(busMarker[index].getLatLng());
    }
    addSidebarLineTable();
}

/**
 * addSidebarLineTable()
 *  Generates the station arrival table for the vehicle.
 */
async function addSidebarLineTable() {
    if (globalIndex == undefined || busObject[globalIndex].trip_id == undefined || document.getElementById("stationName")) return;
    let index = globalIndex;
    let data = await fetchData(`/api/trips/` + busObject[index].trip_id, API_KEY, false);
    let sidebar = document.getElementById("busSide");
    let table = document.createElement('table');
    let now_since_midnight = new luxon.DateTime.now().toMillis() - new luxon.DateTime.now().startOf('day').toMillis();
    now_since_midnight = Math.floor(now_since_midnight / 1000);
    for (let i = 0; i < data.length; i++) {
        for (let j = 0; j < data[i].arrivals.length; j++) {
            //console.log(data[i].arrivals[j], busObject[index].bus_id);
            if (await data[i].arrivals[j].vehicle_id.toUpperCase() === busObject[index].bus_id) {
                if (data[i].arrivals[j].depot == 1 && !document.getElementById("proga").innerHTML.includes("garaža")) document.getElementById("proga").innerHTML += " <small>(garaža)</small>"
                let tr = document.createElement('tr');
                let td = document.createElement('td');
                let stop_passed = now_since_midnight > data[i].arrivals[j].scheduled + data[i].arrivals[j].delay;
                td.className = "image";
                if (i === 0) {
                    // if passed make the image b/w
                    td.innerHTML = "<img style=\"filter: grayscale(" + (stop_passed ? "100%" : "0%") + ")\" src=\"img/ico/verticalStartStation.png\"/>";                    
                } else if (i === data.length - 1) {
                    td.innerHTML = "<img style=\"filter: grayscale(" + (stop_passed ? "100%" : "0%") + ")\" src=\"img/ico/verticalFinalStation.png\"/>";
                } else if (data[i].arrivals[j].type == 3) {
                    td.innerHTML = "<img style=\"filter: grayscale(" + (stop_passed ? "100%" : "0%") + ")\" src=\"img/ico/verticalGreenDetourStation.png\"/>";
                } else {
                    td.innerHTML = "<img style=\"filter: grayscale(" + (stop_passed ? "100%" : "0%") + ")\" src=\"img/ico/verticalGreenStation.png\"/>";
                }
                tr.appendChild(td);
                let atd = document.createElement('td');
                atd.className = stop_passed ? "passed" : "";
                atd.innerHTML = "<b>" + data[i].name + "</b>";
                tr.appendChild(atd);
                let btd = document.createElement('td');
                btd.className = "time" + (stop_passed ? " passed" : "");
                function zeroPad(num) {
                    return num.toString().padStart(2, "0");
                }
                let base_time = zeroPad(parseInt(data[i].arrivals[j].scheduled / 3600)) + ':' + zeroPad(parseInt(data[i].arrivals[j].scheduled % 3600 / 60));
                let delay_time = zeroPad(parseInt((data[i].arrivals[j].scheduled + data[i].arrivals[j].delay) / 3600)) + ':' + zeroPad(parseInt((data[i].arrivals[j].scheduled + data[i].arrivals[j].delay) % 3600 / 60));
                let delay_str = base_time != delay_time && !stop_passed ? `${delay_time} <small style="text-decoration: line-through;">${base_time}</small>` : base_time;
                switch (data[i].arrivals[j].type) {
                    case 0:
                        btd.innerHTML = delay_str;
                        break;
                    case 1:
                        btd.innerHTML = '∗' + data[i].arrivals[j].eta_min + " min";
                        break;
                    case 2:
                        btd.innerHTML = `<span class="badge bg-success">${VOCABULARY.arrival.toUpperCase()}</span>`;
                        break;
                    case 3:
                        btd.innerHTML = `<span class="badge bg-danger">${VOCABULARY.detour.toUpperCase()}</span>`;
                        break;
                }

                tr.appendChild(btd);
                tr.dataID = data[i].station_code;
                tr.onclick = function trclick(e) { e.stopPropagation(); e.preventDefault(); generateStationSidebar(this.dataID) };
                table.appendChild(tr);
                break;
            }
        }
    }
    let div = document.createElement('div');
    div.className = "line"
    div.id = "arrivalsTable";
    div.innerHTML = `<p>${VOCABULARY.stop_arrivals}:</p>`
    table.cellPadding = 0;
    table.style.cursor = "pointer";
    if (document.getElementById("arrivalsTable")) {
        document.getElementById("arrivalsTable").remove();
    }
    if (document.getElementById("stationName")) return;
    div.appendChild(table);
    sidebar.appendChild(div);
    generateRouteVector(data, busObject[index].trip_id, busObject[index].line_number);
}

/**
 * generateRouteVector(data)
 * Generates a vector to be shown on the map as the bus route
 * @param {data} - station data
 * @param {trip} - trip ID
 * @param {lno} - line number
 */
async function generateRouteVector(data, trip_id, lno) {
    if (trip_id == undefined) return;
    if (busVectorLayer.trip == trip_id) return;
    let coordinates = await fetchData(`/api/trips/${trip_id}/shape`, "", false);
    //console.log('coords:', coordinates);
    if (coordinates.error && !coordinates.success) return;
    if (coordinates.length == 0) {
        let coords = "";
        for (i in data) {
            coords += data[i].longitude + "," + data[i].latitude + ";"
        }
        coordinates = await fetchData("https://router.project-osrm.org/route/v1/driving/" + coords.substring(0, coords.length-2) + "?overview=full&geometries=geojson", "", true);
        coordinates = coordinates.routes[0].geometry.coordinates;
    } else {
        //console.log(coordinates);
        coordinates = coordinates[0].geojson_shape.coordinates;
    }
    if (coordinates[0][0] < coordinates[0][1]) {
        for (i in coordinates)  {
            coordinates[i].reverse();
        }
    }
    //console.log(typeof coordinates, coordinates);
    let tempStationLayer = L.layerGroup();
    let tempRouteLayer = L.layerGroup();
    for (let i = 0; i < data.length; i++) {
        let stationIcon = L.marker([data[i].latitude, data[i].longitude], { icon: middleStopIcon }).addTo(tempStationLayer).bindTooltip(data[i].order_no + ". <b>" + data[i].name + "</b> (" + data[i].station_code + ")", { className: 'labelstyle' })
            .on('click', generateStationSidebar);
        stationIcon.id = data[i].station_code;
        if (i == 0 || i == data.length - 1) {
            stationIcon.setIcon(startEndStopIcon);
        }
    }
    if (coordinates[0].length > 2) {
        for (i in coordinates) {
            for (j in coordinates[i]) {
                coordinates[i][j].reverse();
            }
            let polyLine = await L.polyline.antPath(coordinates[i], { "delay": 4000, color: "#33CCFF", weight: 6, opacity: 0.5, smoothFactor: 1 }).addTo(tempRouteLayer);
        }
    } else {
        let polyLine = await L.polyline.antPath(coordinates, { "delay": 4000, color: "#33CCFF", weight: 6, opacity: 0.5, smoothFactor: 1 }).addTo(tempRouteLayer);
    }
    if (busStationLayer) {
        busStationLayer.remove();
        busStationLayer = tempStationLayer;
        busStationLayer.addTo(map);
    }
    if (busVectorLayer) {
        busVectorLayer.remove();
        busVectorLayer = tempRouteLayer;
        busVectorLayer.addTo(map);
        busVectorLayer.trip = trip_id;
    }
}

async function generateStationSidebar(e) {
    let code = ((typeof e) == "string") ? e : e.target.id;
    globalStationIndex == undefined
    for (let i = 0; i < stationObject.length; i++) {
        if (stationObject[i].station_code == code) {
            globalStationIndex = i;
            code = i;
        }
    }
    //console.log(stationObject, code);
    if (globalStationIndex == undefined) return;
    code = globalStationIndex;
    removeContents();
    globalStationIndex = code;
    map.setView(await [stationObject[globalStationIndex].latitude, stationObject[globalStationIndex].longitude], 17);
    let data = document.createElement('div');
    data.className = "data";
    data.id = "data";
    let stationName = document.createElement('div');
    stationName.className = "stationName";
    stationName.style.textAlign = "center";
    stationName.style.backgroundColor = "#1e7b4b";
    stationName.id = "stationName"
    stationName.innerHTML = "<h5>" + stationObject[globalStationIndex].name + "</h5>";
    if (stationObject[globalStationIndex].ref_id % 2 === 0) {
        stationName.innerHTML += " <small> " + stationObject[globalStationIndex].station_code + ` (${VOCABULARY.from_centre})</small>`
    } else {
        stationName.innerHTML += " <small> " + stationObject[globalStationIndex].station_code + ` (${VOCABULARY.to_centre})</small>`
    }
    // close button
    let closeButton = document.createElement("button");
    closeButton.innerHTML = "<i class=\"bi bi-x\"></i>";
    closeButton.className = "close";
    closeButton.title = "Zapri okno";
    closeButton.addEventListener("click", function () {
        removeContents();
    });
    let oppositeButton = document.createElement("button");
    oppositeButton.innerHTML = "<i class=\"bi bi-arrow-down-up\"></i>";
    oppositeButton.className = "switch";
    oppositeButton.code = stationObject[globalStationIndex].station_code;
    oppositeButton.addEventListener("click", async function () {
        if (this.code % 2 === 0) {
            await generateStationSidebar(await String(parseInt(this.code) - 1));
        } else {
            await generateStationSidebar(String(parseInt(this.code) + 1));
        }
    });
    oppositeButton.title = "Poišči postajo v nasprotni smeri";
    stationName.appendChild(closeButton);
    stationName.appendChild(oppositeButton);
    //add padding
    let stationSide = document.createElement('div');
    stationSide.id = "busSide";
    stationSide.style = "margin:1rem; padding-bottom: 1rem;"
    // list the routes that pass through there
    let busLines = document.createElement('div');
    busLines.style.flexWrap = "wrap";
    busLines.style.textAlign = "center";
    busLines.style.display = "flex";
    busLines.style.alignItems = "center";
    busLines.style.justifyContent = "center";
    busLines.style.gap = "5px";
    for (let i = 0; i < stationObject[globalStationIndex].route_groups_on_station.length; i++) {
        busLines.innerHTML += await findColor(stationObject[globalStationIndex].route_groups_on_station[i]) + " ";
    }
    let hr = document.createElement('hr');


    stationSide.appendChild(busLines);
    stationSide.appendChild(hr);

    data.appendChild(stationName);
    data.appendChild(stationSide);
    document.getElementById("sidebar").appendChild(data);
    let marker = L.marker([stationObject[globalStationIndex].latitude, stationObject[globalStationIndex].longitude], { icon: middleStopIcon }).addTo(busStationLayer).bindTooltip("<b>" + stationObject[globalStationIndex].name + "</b> (" + stationObject[globalStationIndex].station_code + ")", { className: 'labelstyle' });
    /*let messages = await fetchData("https://api-rijeka.tracking.party/api/station/messages?station-code=" + stationObject[globalStationIndex].ref_id, "", true);
    let div2 = document.createElement('div');
    // scroll these messages and fix any unicode characters"
    let marquee = document.createElement('marquee');
    marquee.behavior = "scroll";
    marquee.direction = "left";
    marquee.innerHTML = messages.join("<br>").replaceAll('%26#269;','č').replaceAll("%26#268;", "Č").replaceAll("%26#353;", "š").replaceAll("%26#352;", "Š").replaceAll("%26#382;", "ž").replaceAll("%26#381;", "Ž");
    div2.appendChild(marquee);
    div2.innerHTML += "<hr>";
    div2.id = "stop-message";
    document.getElementById("busSide").appendChild(div2);*/
    let busSideArrivals = document.createElement('div');
    busSideArrivals.id = "busSideArrivals";
    document.getElementById("busSide").appendChild(busSideArrivals);
    await getArrivalInfo(globalStationIndex);

}

async function getArrivalInfo() {
    if (globalStationIndex == undefined) return;
    if (!document.getElementById("stationName")) {
        return;
    }
    let arrivalUnfiltered = await fetchData(`/api/stops/${stationObject[globalStationIndex].station_code}/arrivals`, "", false);
    arrivalUnfiltered = arrivalUnfiltered.arrivals;
    let arrivalInfo = [];
    //console.log(arrivalUnfiltered);
    // iterate through all arrivals and group them by arrivalUnfiltered[i].route_name and arrivalUnfiltered[i].stations.arrival
    // so we have datastructure
    // [{route_name: "", arrival: "", vehicles:[...]}]
    for (let i = 0; i < arrivalUnfiltered.length; i++) {
        let arrival = arrivalUnfiltered[i];
        let found = false;
        for (let j = 0; j < arrivalInfo.length; j++) {
            if (arrival.route_name == arrivalInfo[j].route_name && arrival.stations.arrival == arrivalInfo[j].arrival) {
                found = true;
                arrivalInfo[j].vehicles.push({
                    vehicle_id: arrival.vehicle_id,
                    eta_min: arrival.eta_min,
                    scheduled: arrival.scheduled,
                    delay: arrival.delay,
                    depot: arrival.depot,
                    type: arrival.type
                });
                break;
            }
        }
        if (!found) {
            arrivalInfo.push({ route_name: arrival.route_name, arrival: arrival.stations.arrival, vehicles: [{
                vehicle_id: arrival.vehicle_id,
                eta_min: arrival.eta_min,
                scheduled: arrival.scheduled,
                delay: arrival.delay,
                depot: arrival.depot,
                type: arrival.type
            }] });
        }
    }
    // sort arrivalInfo by route_name then by arrival
    arrivalInfo.sort(function (a, b) {
        if (parseInt(a.route_name.replace(/[^\d-]/g, '')) < parseInt(b.route_name.replace(/[^\d-]/g, ''))) {
            return -1;
        }
        if (parseInt(a.route_name.replace(/[^\d-]/g, '')) > parseInt(b.route_name.replace(/[^\d-]/g, ''))) {
            return 1;
        }
        if (a.arrival < b.arrival) {
            return -1;
        }
        if (a.arrival > b.arrival) {
            return 1;
        }
        return 0;
    });
    // create a table
    let table = document.createElement('table');
    table.id = "arrivalTable";
    table.style.textAlign = "left";
    table.style = "width:100%";
    table.style = "table-layout:fixed";
    table.style = "overflow-wrap:break-word";
    // iterate through arrivalInfo
    for (let i = 0; i < arrivalInfo.length; i++) {
        let tr1 = table.insertRow();
        tr1.style.borderBottom = "1px solid #E0E0E0";
        let td0 = tr1.insertCell();
        td0.style.width = "auto";
        td0.innerHTML = await findColor(await arrivalInfo[i].route_name);
        let td1 = tr1.insertCell();
        td1.style.textAlign = "left";
        td1.style.width = "100%";
        td1.style.wordBreak = "break-all";
        td1.innerHTML = await "<b>" + arrivalInfo[i].arrival.toUpperCase() + "</b>";
        let tr2 = table.insertRow();
        let td2 = tr2.insertCell();
        td2.colSpan = "2";
        let div = document.createElement('div');
        div.style.display = "flex";
        div.style.flexWrap = "wrap";
        div.style.flexDirection = "row";
        td2.appendChild(div);
        for (let j = 0; j < arrivalInfo[i].vehicles.length; j++) {
            // create A element
            let a = await document.createElement('a');
            a.className = "timeSelect"
            a.id = arrivalInfo[i].vehicles[j].vehicle_id;
            a.onclick = (e) => {
                generateSidebarFromTimetableForBusDisplay(e.target.id);
            }
            // type 0 - predicted, type 1 - scheduled, 2 - prihod, 3 - obvoz
            // if arrivalInfo[i].vehicles[j].type == 1 && arrivalInfo[i].vehicles[j].eta_min < 2 ==> change to type 2
            if (arrivalInfo[i].vehicles[j].type == 0 && arrivalInfo[i].vehicles[j].eta_min < 2) {
                arrivalInfo[i].vehicles[j].type = 2;
            }

            function zeroPad(num) {
                return num.toString().padStart(2, "0");
            }
            //console.log(arrivalInfo[i].vehicles[j]);
            let base_time = zeroPad(parseInt(arrivalInfo[i].vehicles[j].scheduled / 3600)) + ':' + zeroPad(parseInt(arrivalInfo[i].vehicles[j].scheduled % 3600 / 60));
            let delay_time = zeroPad(parseInt((arrivalInfo[i].vehicles[j].scheduled + arrivalInfo[i].vehicles[j].delay) / 3600)) + ':' + zeroPad(parseInt((arrivalInfo[i].vehicles[j].scheduled + arrivalInfo[i].vehicles[j].delay) % 3600 / 60));    
            let delay_str = base_time != delay_time ? `${delay_time} <small style="text-decoration: line-through;">${base_time}</small>` : delay_time;
            switch (arrivalInfo[i].vehicles[j].type) {
                case 0:
                    a.innerHTML = delay_str;
                    break;
                case 1:
                    a.innerHTML = `∗${delay_str}`;
                    break;
                case 2:
                    a.innerHTML = `${VOCABULARY.arrival}`;
                    break;
                case 3:
                    a.innerHTML = `${arrivalInfo[i].vehicles[j].eta_min} min  <small>${VOCABULARY.detour}</small>`;
                    break;
            } 
            // if vehicle has depot == 1, add a small tag
            if (arrivalInfo[i].vehicles[j].depot == 1) {
                a.innerHTML += ` <small>(${VOCABULARY.garage})</small>`;
            }
            // add the element to td2
            div.appendChild(a);
        }
    }
    if (document.getElementById("arrivalTable")) {
        document.getElementById("arrivalTable").remove();
    }
    if (document.getElementById("arrivalsTable")) return;
    document.getElementById("busSideArrivals").appendChild(table);
    //console.log(arrivalInfo);
}

async function generateSidebarFromTimetableForBusDisplay(id) {
    id = id.toUpperCase().replace(' ', '');
    for (var i = 0; i < busObject.length; i++) {
        if (id === busObject[i].bus_id) {
            busMarker[i].fire('click');
            break;
        }
    }
}

/**
 * removeContents() 
 * Removes any clutter before moving on.
 */
async function removeContents() {
    if (document.getElementById("searchResults")) {
        document.getElementById("searchResults").remove();
    }
    if (document.getElementById("data")) {
        globalIndex = undefined;
        globalStationIndex = undefined;
        document.getElementById("data").remove();
        busStationLayer.remove();
        busStationLayer = L.layerGroup().addTo(map);
        for (let index = 0; index < busObject.length; index++) {
            switch (busObject[index].category) {
                case 1:
                    busMarker[index].setIcon(L.divIcon({
                        className: 'icon-active',
                        iconSize:     [25, 25],
                        iconAnchor:   [13, 13],
                        popupAnchor:  [0, 0],
                        html: `<p class="icon">${busObject[index].line_number ? busObject[index].line_number : "⬤"}</p>
                                <img class="icon-pointer" style="transform: rotate(${busObject[index].direction + 225}deg)" src="img/ico/rotIcoActive.svg"/>`
                    }));
                    break;
                case 2:
                    busMarker[index].setIcon(L.divIcon({
                        className: 'icon-hidden',
                        iconSize:     [25, 25],
                        iconAnchor:   [13, 13],
                        popupAnchor:  [0, 0],
                        html: `<p class="icon">${busObject[index].line_number ? busObject[index].line_number : "⬤"}</p>
                        <img class="icon-pointer" style="transform: rotate(${busObject[index].direction + 225}deg)" src="img/ico/rotIcoHidden.svg"/>`
                    }));
                    break;
                case 3:
                    busMarker[index].setIcon(L.divIcon({
                        className: 'icon-inactive',
                        iconSize:     [25, 25],
                        iconAnchor:   [13, 13],
                        popupAnchor:  [0, 0],
                        html: `<p class="icon">${busObject[index].line_number ? busObject[index].line_number : "⬤"}</p>
                        <img class="icon-pointer" style="transform: rotate(${busObject[index].direction + 225}deg)" src="img/ico/rotIcoInactive.svg"/>`
                    }));
                    break;
            }
        }
    }
    trackBus = false;
    busVectorLayer.remove();
    busVectorLayer = L.layerGroup().addTo(map);
}

// LEGACY FUNCTIONS - too lazy to rewrite them

/**
 * Legacy function - carried over from the original code
 * @param {*} index 
 * @returns 
 */
async function getDestination(index) {
    if (busObject[index].line_number === "") {
        return VOCABULARY.no_line;
    } else if (!busObject[index].timeValidity && !busObject[index].line_number === "") {
        return "-";
    }
    dest = await findColor(busObject[index].line_number) + await Destination(busObject[index].line_destination, busObject[index].line_name);

    return dest;
}


/**
 * Legacy function - carried over from the original code
 * @param {*} lineName 
 * @returns 
 */
async function findColor(lineName) {
    if (lineColors.length === 0) {
        await fetchColors();
    }
    let lineColor = await lineColors.find(x => x.id === lineName);
    if (!lineColor) {
        return "<span class=\"lineSpan\" style=\"color:white; background-color:black;\"> <b>&nbsp;" + cleanLine + "&nbsp;</b></span> ";
    } else {
        let returnString = "<span class=\"lineSpan\" style=\"color:white; background-color:" + lineColor.color + ";\"><b>&nbsp;" + lineName + "&nbsp;</b></span>";
        return returnString;
    }
}

/**
 * Legacy function - carried over from the original code
 * @param {*} lineName 
 * @returns 
 */
async function findJustColor(lineName) {
    if (lineColors.length === 0) {
        await fetchColors();
    }
    let lineColor = await lineColors.find(x => x.id === lineName);
    if (!lineColor) {
        return "#1e7b4b";
    } else {
        return lineColor.color;
    }
}

async function fetchColors() {
    let data = await fetchData("/api/colors", "", false);
    lineColors = data;
}

/**
 * Legacy function - carried over from the original code
 * @param {} destination 
 * @param {*} routeName 
 * @returns 
 */
async function Destination(destination, routeName) {
    //returns line number + valid combination of data for the other segment
    let returnString;
    if (destination != "") {
        returnString = " " + destination;
    } else {
        let splitter = await routeName.split(" - ");
        if (splitter[splitter.length - 1].search("-") === -1) {
            // there is a case where the terminuses are not seperated as " - ", but as "-", therefor a check needs to be in place if that is the case here
            returnString = " " + splitter[splitter.length - 1].toUpperCase();
        } else {
            splitter = await routeName.split("-");
            returnString = " " + splitter[splitter.length - 1].toUpperCase();
        }
    }
    if (document.getElementById("proga") && document.getElementById("proga").innerHTML.includes("garaža")) {
        returnString += " <small>(garaža)</small>"
    }

    return returnString;
}

/**
 * Legacy function - carried over from the original code
 * @param {*} index 
 * @returns 
 */
async function reformatTime(index) {
    let t = new Date(busObject[index].timestamp * 1000);
    let h = []
    h[0] = String(t.getHours());
    h[1] = String(t.getMinutes());
    h[2] = String(t.getSeconds());
    for (let i = 0; i < 3; i++) {
        if (h[i].length === 1) {
            h[i] = "0" + h[i];
        }
    }
    let ret = h[0] + ":" + h[1] + ":" + h[2] + ", " + t.getDate() + "." + (t.getMonth() + 1) + "." + t.getFullYear();
    return ret;

}
