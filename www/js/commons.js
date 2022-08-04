async function loadJSON(url, callback) {
  url = "/services" + url;
  console.log(url);
  let checker = new XMLHttpRequest();
  checker.overrideMimeType("application/json");
  checker.open('get', url, true);
  checker.onreadystatechange = function () {
    if ((checker.readyState === 4) && ((checker.status == 200) || (checker.status == 0)))
      callback(checker.responseText);
  }
  checker.send(null);
}

$.urlParam = function(name){
    var results = new RegExp('[\?&]' + name + '=([^&#]*)').exec(window.location.href);
    if (results==null) {
       return null;
    }
    return decodeURI(results[1]) || 0;
}

function fireEvent(id, etype){
  let el = document.getElementById(id);
  if (el.fireEvent) {
    el.fireEvent('on' + etype);
  } else {
    var evObj = document.createEvent('Events');
    evObj.initEvent(etype, true, false);
    el.dispatchEvent(evObj);
  }
}