readCookieStart();

var activeBaseLayer = "";

function readCookieStart() {
    setTimeout(readCookie, 300);
}

async function readCookie() {
    if (document.cookie) {
        console.log(document.cookie);       
        var cookieArray = document.cookie.split("=");
        var jsonArray = await JSON.parse(cookieArray[1]);
        console.log(jsonArray);
        var lppToggle = jsonArray.LPP;
        var bicikeljToggle = jsonArray.Bicikelj;
        if (bicikeljToggle) {
            $('#bicikeljToggle').bootstrapToggle('toggle');
        }
        if (jsonArray.dark) {
            $('#darkModeToggle').bootstrapToggle('toggle');
        }
        if (!lppToggle) {
            $('#lppToggle').bootstrapToggle('toggle');
        }
        if (jsonArray.urbanomati) {
            $('#urbanomatToggle').bootstrapToggle('toggle');
        }
        if (jsonArray.ppr) {
            $('#pprToggle').bootstrapToggle('toggle');
        }
        if (jsonArray.parking) {
            $('#parkingToggle').bootstrapToggle('toggle');
        }
        if (jsonArray.garage) {
            $('#garageToggle').bootstrapToggle('toggle');
        }
        if (jsonArray.avant) {
            $('#avantToggle').bootstrapToggle('toggle');
        }
        if (jsonArray.charger) {
            $('#chargerToggle').bootstrapToggle('toggle');
        }
        if (jsonArray.sz) {
            $('#szToggle').bootstrapToggle('toggle');
        }
        if (jsonArray.mapSettings) {
            map.setView(jsonArray.mapSettings.coordinates, jsonArray.mapSettings.zoomLevel);
        }
    }
}

async function updateCookie() {
    document.cookie = "contents=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    var d = new Date();
    d.setTime(d.getTime() + (1825*24*60*60*1000));
    var contents = {LPP: globalLPPShow, 
        Bicikelj: globalBicikeljShow, 
        urbanomati: globalMOLShow[0],
        ppr: globalMOLShow[1],
        parking: globalMOLShow[2],
        garage: globalMOLShow[3],
        avant: globalMOLShow[4],
        charger:globalMOLShow[5],
        dark: darkMode,
        sz: showSZBool,
        mapSettings: await getMapInformation(),
        };
    document.cookie = "contents="+JSON.stringify(contents)+"; expires="+d.toUTCString()+"; path=/;";
}

async function getMapInformation() {
    return obj = {
        coordinates: await map.getCenter(),
        zoomLevel: await map.getZoom()
    }
}

async function updateMapInformation() {
    if (document.cookie) {
        let cookieArray = document.cookie.split("=");
        let jsonArray = await JSON.parse(cookieArray[1]);
        document.cookie = "contents=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
        let d = new Date();
        d.setTime(d.getTime() + (1825*24*60*60*1000));
        jsonArray.mapSettings = await getMapInformation();
        document.cookie = "contents="+JSON.stringify(jsonArray)+"; expires="+d.toUTCString()+"; path=/;";
    }      
}