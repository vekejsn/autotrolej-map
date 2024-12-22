listenToSearchbar();


function listenToSearchbar() {
    var input = document.getElementById("searchBar");
    input.addEventListener("keydown", function (event) {
        if (event.key === 'Enter' || event.key === 'NumpadEnter') {
            event.preventDefault();
            searchBarSearch();
        }
    });
}


async function searchBarSearch() {
    removeContents();
    var term = document.getElementById("searchBar").value;
    var div = document.createElement('div');
    div.className="searchResults";
    var liObj = document.createElement('ul');
    liObj.className="list-group";
    div.id="searchResults";
    var liItem = [];
    var counter = 0;
    if (term.length===0) {
        return;
    }
    
    if (map.hasLayer(busLayer)) {
        // bus details  
        for (var i = 0; i < busObject.length; i++) {
            if (checkSearchForBuses(term, i)) {
                var search = busObject[i].bus_name;
                if (busObject[i].line_name!=="") {
                    search += " " + await findColor(busObject[i].line_number);
                }
                liItem[counter] = document.createElement('li');
                liItem[counter].className="list-group-item";
                liItem[counter].innerHTML = search;
                liItem[counter].id = i;
                liItem[counter].onclick = function(){
                    map.setView([busObject[this.id].latitude, busObject[this.id].longitude], 17);
                    busMarker[this.id].fire('click');};
                liObj.appendChild(liItem[counter]);
                counter++;
            }
        }
        // station details
        for (var i = 0; i < stationObject.length; i++) {
            if (removeLocalCharacters(stationObject[i].name.toUpperCase()).includes((removeLocalCharacters(term.toUpperCase()))) || stationObject[i].station_code.toString().includes(term)) {
                var search = stationObject[i].name;
                /*if (stationObject[i].ref_id%2==0) {
                    search +=  <small>(iz centra)</small>"
                } else {
                    search += " <small>(proti centru)</small>"
                }*/
                liItem[counter] = document.createElement('li');
                liItem[counter].className="list-group-item";
                liItem[counter].innerHTML = search;
                liItem[counter].number = stationObject[i].station_code.toString();
                liItem[counter].onclick = function(){generateStationSidebar(this.number)};
                liObj.appendChild(liItem[counter]);
                counter++;
            }
        }    
    }
    //bicikelj

    var sidebar = document.getElementById("sidebar");
    div.appendChild(liObj);
    sidebar.appendChild(div);
}



function checkSearchForBuses(term, index) {
    let b = removeLocalCharacters(busObject[index].line_name);
    let t =removeLocalCharacters(term);
    if (busObject[index].bus_name.includes(term.toUpperCase())) return true;
    if (b.includes(t)) return true;
    if (busObject[index].model !== undefined && busObject[index].model.toUpperCase().includes(t)) return true;
    return false;
}

function removeLocalCharacters(input) {
    return input.toUpperCase().replace("Č","C").replace("Š","S").replace("Ž","Z") ;
}

async function showLPP() {
    if (globalLPPShow) {
        busStationLayer.remove();
        if (document.getElementById('busSide') || document.getElementById('arrivalTable')) {
            removeContents();
        }
        busLayer.remove();
        globalLPPShow = false;
        updateCookie();
    } else {
        globalLPPShow = true;
        busLayer.addTo(map);
        updateCookie();
    }

}


function cookieShowLPP() {
    if (map.hasLayer(busLayer)) {
        busLayer.remove();
        busStationLayer.remove();
    }

}