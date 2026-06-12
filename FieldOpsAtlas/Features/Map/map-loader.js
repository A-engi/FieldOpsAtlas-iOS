/*
  FieldOps Atlas
  File: FieldOpsAtlas/Features/Map/map-loader.js
  Version: 1.1.2-map-loader

  Purpose:
  Load the root shell, Leaflet, and Map fundamentals in a fixed order.

  Loads:
  - root theme/component/shell assets
  - Map page CSS
  - Leaflet
  - Map shell guard
  - Map controller and map UI bridge

  Notes:
  - Weather panels, walk markers, regions, and map state stay in map-app.js/map-ui.js.
  - This file does not create visual styling.
  - This file does not edit data or region JSON.
*/

(function loadFieldOpsMap() {
  "use strict";

  var version = "1.1.2-map-loader";
  var rootPath = "../../../";
  var mapPath = "./";
  var head = document.head || document.getElementsByTagName("head")[0];

  function withVersion(url) {
    return url + (url.indexOf("?") === -1 ? "?v=" : "&v=") + encodeURIComponent(version);
  }

  function hasAsset(tagName, attribute, value) {
    var nodes = document.getElementsByTagName(tagName);

    for (var index = 0; index < nodes.length; index += 1) {
      var current = nodes[index].getAttribute(attribute) || "";

      if (current.indexOf(value) !== -1) {
        return true;
      }
    }

    return false;
  }

  function loadStyle(url) {
    return new Promise(function resolveStyle(done) {
      if (hasAsset("link", "href", url)) {
        done();
        return;
      }

      var link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = withVersion(url);
      link.onload = done;
      link.onerror = done;
      head.appendChild(link);
    });
  }

  function loadScript(url) {
    return new Promise(function resolveScript(done) {
      if (hasAsset("script", "src", url)) {
        done();
        return;
      }

      var script = document.createElement("script");
      script.src = withVersion(url);
      script.defer = false;
      script.onload = done;
      script.onerror = done;
      document.body.appendChild(script);
    });
  }

  function installLeafletBridge() {
    window.FieldOpsAtlasBridge = window.FieldOpsAtlasBridge || {};

    if (!window.L || !window.L.map || window.L.__fieldOpsAtlasCapturedMap) {
      return;
    }

    window.L.__fieldOpsAtlasCapturedMap = true;
    window.FieldOpsAtlasBridge.originalMapFactory = window.L.map;

    window.L.map = function captureFieldOpsMap() {
      var map = window.FieldOpsAtlasBridge.originalMapFactory.apply(this, arguments);
      window.FieldOpsAtlasBridge.map = map;
      return map;
    };
  }

  Promise.resolve()
    .then(function loadRootStyles() {
      return Promise.all([
        loadStyle(rootPath + "theme.css"),
        loadStyle(rootPath + "components.css"),
        loadStyle(rootPath + "shell.css")
      ]);
    })
    .then(function loadMapStyles() {
      return Promise.all([
        loadStyle("https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"),
        loadStyle(mapPath + "map-page.css"),
        loadStyle(mapPath + "shell.css"),
        loadStyle(mapPath + "map-ui.css")
      ]);
    })
    .then(function loadRootShell() {
      return loadScript(rootPath + "shell.js");
    })
    .then(function loadLeaflet() {
      return loadScript("https://unpkg.com/leaflet@1.9.4/dist/leaflet.js");
    })
    .then(function bridgeLeaflet() {
      installLeafletBridge();
    })
    .then(function loadMapGuard() {
      return loadScript(mapPath + "map-shell-guard.js");
    })
    .then(function loadMapApp() {
      return loadScript(mapPath + "map-app.js");
    })
    .then(function loadMapUi() {
      return loadScript(mapPath + "map-ui.js");
    });
}());
