-- stop Table
CREATE TABLE IF NOT EXISTS Stop (
    id TEXT PRIMARY KEY,
    name TEXT,
    lat REAL,
    lon REAL
);

CREATE TABLE IF NOT EXISTS Line (
    id TEXT PRIMARY KEY,
    name TEXT,
    color TEXT,
    text_color TEXT,
    operation_area TEXT
);

CREATE TABLE IF NOT EXISTS Route (
    id TEXT PRIMARY KEY,
    line_id INTEGER,
    name TEXT,
    stop_hash TEXT,
    direction TEXT,
    FOREIGN KEY(line_id) REFERENCES Line(id)
);

CREATE TABLE IF NOT EXISTS RouteShape (
    route_id TEXT,
    lat REAL,
    lon REAL,
    sequence INTEGER,
    FOREIGN KEY(route_id) REFERENCES Route(id)
);

CREATE TABLE IF NOT EXISTS Trip (
    id TEXT PRIMARY KEY,
    route_id INTEGER,
    headsign TEXT,
    active_today INTEGER,
    FOREIGN KEY(route_id) REFERENCES Route(id)
);

CREATE TABLE IF NOT EXISTS StopTime (
    trip_id TEXT,
    stop_id TEXT,
    stop_time INTEGER,
    stop_sequence INTEGER,
    PRIMARY KEY(trip_id, stop_id, stop_sequence),
    FOREIGN KEY(trip_id) REFERENCES Trip(id),
    FOREIGN KEY(stop_id) REFERENCES Stop(id)
);

CREATE TABLE IF NOT EXISTS VehicleModel (
    id TEXT PRIMARY KEY,
    name TEXT
);

CREATE TABLE IF NOT EXISTS Vehicle (
    id TEXT PRIMARY KEY,
    internal_id TEXT,
    plate TEXT,
    model_id TEXT,
    image TEXT,
    note TEXT,
    FOREIGN KEY(model_id) REFERENCES VehicleModel(id)
);

CREATE TABLE IF NOT EXISTS VehiclePosition (
    vehicle_id TEXT PRIMARY KEY,
    trip_id TEXT,
    lat REAL,
    lon REAL,
    bearing REAL DEFAULT 0,
    timestamp INTEGER,
    delay INTEGER DEFAULT 0,
    FOREIGN KEY(vehicle_id) REFERENCES Vehicle(id)
);

CREATE TABLE IF NOT EXISTS Realisation (
    trip_id TEXT,
    vehicle_id TEXT,
    date TEXT,
    PRIMARY KEY(trip_id, date),
    FOREIGN KEY(trip_id) REFERENCES Trip(id),
    FOREIGN KEY(vehicle_id) REFERENCES Vehicle(id)
);

