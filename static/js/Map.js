var map = L.map('mapid', {zoomControl: false}).setView([45.3476046,14.3917947], 13);
var baselayers = {
  "Voyager": L.tileLayer('https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png', {
		attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, &copy; <a href="https://carto.com/attribution">CARTO</a>'
	}),
  "Svetli zemljevid": L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png', {
		attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, &copy; <a href="https://carto.com/attribution">CARTO</a>'
	}),
  "Temni zemljevid": L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png', {
		attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, &copy; <a href="https://carto.com/attribution">CARTO</a>'
	}),
  "OpenStreetMap": L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
	attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
	maxZoom: 23,
	crossOrigin: 'anonymous',
	id: 'osm'
  }),
  "Novi temni zemljevid": L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
	attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, &copy; <a href="https://carto.com/attributions">CARTO</a>',
	maxZoom: 23,
	crossOrigin: 'anonymous',
	id: 'darkMatter'
 })
};
var overlays = {};
// BICIKELJ ICONS
// ACTIVE ICON
// Has free bikes 
var activeBicikeljStation = L.icon({
  iconUrl: 'img/ico/bicikeljStation.png',
  shadowUrl: '',
  className: 'startEndStopIcon',

  iconSize:     [20, 23],
  iconAnchor:   [10, 12],
  popupAnchor:  [0, 0],
  tooltipAnchor: [0, 0]
});
// INACTIVE ICON
// Does not have free bikes
var inactiveBicikeljStation = L.icon({
  iconUrl: 'img/ico/bicikeljStationInactive.png',
  shadowUrl: '',
  className: 'startEndStopIcon',

  iconSize:     [20, 23],
  iconAnchor:   [10, 12],
  popupAnchor:  [0, 0],
  tooltipAnchor: [0, 0]
});


// LPP ICONS
// ACTIVE ICON
// Buses which have line data

let ANCHOR_X = 0;
let ANCHOR_Y = 0;

var szIcon = L.divIcon({
  className: 'szIcon',
  iconSize:     [120, 39],
  iconAnchor:   [60, 19],
  popupAnchor:  [0, 0],
  tooltipAnchor: [ANCHOR_X, ANCHOR_Y]
})

var activeIcon = L.icon({
  iconUrl: 'img/ico/markerActive.png',
  shadowUrl: '',
  className: 'activeBusIcon',

  iconSize:     [25, 25],
  iconAnchor:   [13, 13],
  popupAnchor:  [0, 0],
  tooltipAnchor: [ANCHOR_X, ANCHOR_Y]
});
// HIDDEN ICON
// Buses which do not have line data, but have electric (and/or engine) on
var hiddenIcon = L.icon({
  iconUrl: 'img/ico/markerHidden.png',
  shadowUrl: '',
  className: 'hiddenBusIcon',

  iconSize:     [25, 25],
  iconAnchor:   [13, 13],
  popupAnchor:  [0, 0],
  tooltipAnchor: [ANCHOR_X, ANCHOR_Y]
});
// INACTIVE ICON
// Buses which are inactive
var inactiveIcon = L.icon({
  iconUrl: 'img/ico/markerInactive.png',
  shadowUrl: '',
  className: 'inactiveBusIcon',

  iconSize:     [25, 25],
  iconAnchor:   [13, 13],
  popupAnchor:  [0, 0],
  tooltipAnchor: [ANCHOR_X, ANCHOR_Y]
});
// SELECTED ICON
// Bus which is selected
var selectedIcon = L.icon({
  iconUrl: 'img/ico/markerSelect.png',
  shadowUrl: '',
  className: 'inactiveBusIcon',

  iconSize:     [25, 25],
  iconAnchor:   [13, 13],
  popupAnchor:  [0, 0],
  tooltipAnchor: [ANCHOR_X, ANCHOR_Y]
});
// ACTIVE STATION

// ACTIVE END/START STATION

// INACTIVE STATION

// INACTIVE START STATION

var startEndStopIcon = L.icon({
  iconUrl: 'img/ico/endStation.png',
  shadowUrl: '',
  className: 'startEndStopIcon',

  iconSize:     [20, 23],
  iconAnchor:   [10, 12],
  popupAnchor:  [0, 0],
  tooltipAnchor: [0, 0]
});
var middleStopIcon = L.icon({
  iconUrl: 'img/ico/midStation.png',
  shadowUrl: '',
  className: 'middleStopIcon',

  iconSize:     [20, 23],
  iconAnchor:   [10, 12],
  popupAnchor:  [0, 0],
  tooltipAnchor: [0, 0]
});
var endStopIconPassed = L.icon({
  iconUrl: 'img/ico/endStationPassed.png',
  shadowUrl: '',
  className: 'endStopIconPassed',

  iconSize:     [20, 23],
  iconAnchor:   [10, 12],
  popupAnchor:  [0, 0],
  tooltipAnchor: [0, 0]
});
var middleStopIconPassed = L.icon({
  iconUrl: 'img/ico/midStationPassed.png',
  shadowUrl: '',
  className: 'middleStopIconPassed',

  iconSize:     [20, 23],
  iconAnchor:   [10, 12],
  popupAnchor:  [0, 0],
  tooltipAnchor: [0, 0]
});
//P+R ICON
var pprIcon = L.icon({
  iconUrl: 'img/ico/parkPlusRide.png',
  shadowUrl: '',
  className: 'middleStopIconPassed',

  iconSize:     [20, 23],
  iconAnchor:   [10, 12],
  popupAnchor:  [0, 0],
  tooltipAnchor: [0, 0]
});
var inactivePprIcon = L.icon({
  iconUrl: 'img/ico/parkPlusRideInactive.png',
  shadowUrl: '',
  className: 'middleStopIconPassed',

  iconSize:     [20, 23],
  iconAnchor:   [10, 12],
  popupAnchor:  [0, 0],
  tooltipAnchor: [0, 0]
});
//AVANT2GO ICON
var avantIcon = L.icon({
  iconUrl: 'img/ico/avant2Go.png',
  shadowUrl: '',
  className: 'middleStopIconPassed',

  iconSize:     [20, 23],
  iconAnchor:   [10, 12],
  popupAnchor:  [0, 0],
  tooltipAnchor: [0, 0]
});
var inactiveAvantIcon = L.icon({
  iconUrl: 'img/ico/avant2GoInactive.png',
  shadowUrl: '',
  className: 'middleStopIconPassed',

  iconSize:     [20, 23],
  iconAnchor:   [10, 12],
  popupAnchor:  [0, 0],
  tooltipAnchor: [0, 0]
});
//ELECTRIC CHARGER ICON
var chargerIcon = L.icon({
  iconUrl: 'img/ico/electricCharger.png',
  shadowUrl: '',
  className: 'middleStopIconPassed',

  iconSize:     [20, 23],
  iconAnchor:   [10, 12],
  popupAnchor:  [0, 0],
  tooltipAnchor: [0, 0]
});
var inactiveChargerIcon = L.icon({
  iconUrl: 'img/ico/electricChargerInactive.png',
  shadowUrl: '',
  className: 'middleStopIconPassed',

  iconSize:     [20, 23],
  iconAnchor:   [10, 12],
  popupAnchor:  [0, 0],
  tooltipAnchor: [0, 0]
});
//URBANOMAT ICON
var urbanomatIcon = L.icon({
  iconUrl: 'img/ico/urbanomat.png',
  shadowUrl: '',
  className: 'middleStopIconPassed',

  iconSize:     [20, 23],
  iconAnchor:   [10, 12],
  popupAnchor:  [0, 0],
  tooltipAnchor: [0, 0]
});
//PARKING ICON
var parkingIcon = L.icon({
  iconUrl: 'img/ico/parking.png',
  shadowUrl: '',
  className: 'middleStopIconPassed',

  iconSize:     [20, 23],
  iconAnchor:   [10, 12],
  popupAnchor:  [0, 0],
  tooltipAnchor: [0, 0]
});
var inactiveParkingIcon = L.icon({
  iconUrl: 'img/ico/parkingInactive.png',
  shadowUrl: '',
  className: 'middleStopIconPassed',

  iconSize:     [20, 23],
  iconAnchor:   [10, 12],
  popupAnchor:  [0, 0],
  tooltipAnchor: [0, 0]
});
var parkingGarageIcon = L.icon({
  iconUrl: 'img/ico/parkingGarage.png',
  shadowUrl: '',
  className: 'middleStopIconPassed',

  iconSize:     [20, 23],
  iconAnchor:   [10, 12],
  popupAnchor:  [0, 0],
  tooltipAnchor: [0, 0]
});
var inactiveParkingGarageIcon = L.icon({
  iconUrl: 'img/ico/parkingGarageInactive.png',
  shadowUrl: '',
  className: 'middleStopIconPassed',

  iconSize:     [20, 23],
  iconAnchor:   [10, 12],
  popupAnchor:  [0, 0],
  tooltipAnchor: [0, 0]
});
//RAILWAY ICON
var szStation = L.icon({
  iconUrl: 'img/ico/sz.png',
  shadowUrl: '',
  className: 'middleStopIconPassed',

  iconSize:     [20, 23],
  iconAnchor:   [20, 12],
  popupAnchor:  [0, 0],
  tooltipAnchor: [0, 0]
});
// layers
baselayers["Voyager"].addTo(map);  
L.control.zoom({
  position:'topright'
}).addTo(map);
L.control.layers(baselayers, overlays, {position: 'topright', class: 'labelstyle'}).addTo(map);
var popup = L.popup();
if (navigator.userAgent.includes("Android") || navigator.userAgent.includes("iPhone") || navigator.userAgent.includes("iPad")) {
  var k = L.control.locate({position: 'topright'}).addTo(map);
}

map.on('zoomend', function() {
  updateMapInformation();
})

map.on('dragend', function() {
  updateMapInformation();
})