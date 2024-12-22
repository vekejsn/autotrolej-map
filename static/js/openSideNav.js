async function openSideNav() {
    document.getElementById("mySidenav").style.textIndent = await "0em";
    var width = "24.5rem";
    if (navigator.userAgent.includes("Android") || navigator.userAgent.includes("iPhone") || navigator.userAgent.includes("iPad")) {
      width = "20.75rem"
    }
    document.getElementById("mySidenav").style.width = width;
  }
  
  async function closeSideNav() {
    document.getElementById("mySidenav").style.width = "0";
  }