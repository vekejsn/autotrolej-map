var darkMode = false;


function setDarkMode() {
    if (darkMode) {
        darkMode = false;
        document.getElementById('styleStylesheet').href="css/style.css";
        document.getElementById('sidenavStylesheet').href="css/sidenav.css";
        document.getElementById('bootstrapStylesheet').href="css/bootstrap.css";
        document.getElementById('logoSidenav').src = "img/logo.svg";
    } else {
        darkMode = true;
        document.getElementById('styleStylesheet').href="css/styleDark.css";
        document.getElementById('sidenavStylesheet').href="css/sidenavDark.css";
        document.getElementById('bootstrapStylesheet').href="css/bootstrapDark.css";
        document.getElementById('logoSidenav').src = "img/logoDark.svg";
    }
    updateCookie();
}

function cookieSetDarkMode() {
    darkMode = true;
    document.getElementById('styleStylesheet').href="css/styleDark.css";
    document.getElementById('sidenavStylesheet').href="css/sidenavDark.css";
    document.getElementById('bootstrapStylesheet').href="css/bootstrapDark.css";
    document.getElementById('logoSidenav').src = "img/logoDark.svg";
}
