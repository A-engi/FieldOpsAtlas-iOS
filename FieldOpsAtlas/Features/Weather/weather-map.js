/* FieldOps Atlas Weather map v0.3.5
   Destination: FieldOpsAtlas/Features/Weather/weather-map.js

   Purpose:
   - Load a lightweight Weather-only Leaflet map.
   - Use Stadia Alidade Smooth as the preferred basemap.
   - Apply the base colour filter before weather APIs/overlays arrive.
   - Keep future weather overlay panes unfiltered.
   - Do not load Atlas Maps region/site/editor modules.
*/

(() => {
  "use strict";

  const VERSION = "0.3.5";
  const STORAGE_KEY = "fieldops-weather-stadia-api-key-v1";
  const UK_BOUNDS = [[49.75, -8.7], [60.95, 1.95]];
  const UK_CENTER = [54.55, -3.15];

  const STADIA_TILE_URL = "https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png";
  const OSM_FALLBACK_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

  const state = {
    map: null,
    baseLayer: null,
    tileErrors: 0,
    usingFallback: false
  };

  const els = {
    map: document.getElementById("weatherMap"),
    status: document.getElementById("weatherMapStatus"),
    apiKey: document.getElementById("stadiaApiKey"),
    saveKey: document.getElementById("saveStadiaKey"),
    clearKey: document.getElementById("clearStadiaKey")
  };

  init();

  function init() {
    if (!window.L) {
      setStatus("Map library failed to load.");
      return;
    }

    if (!els.map) {
      setStatus("Weather map container missing.");
      return;
    }

    restoreKeyField();
    bindEvents();
    initMap();
    loadSmoothBase();
  }

  function bindEvents() {
    els.saveKey?.addEventListener("click", () => {
      const key = getInputKey();
      if (key) {
        localStorage.setItem(STORAGE_KEY, key);
        setStatus("Stadia key saved locally. Reloading smooth basemap...");
      } else {
        localStorage.removeItem(STORAGE_KEY);
        setStatus("No Stadia key set. Trying domain-auth smooth basemap...");
      }

      loadSmoothBase();
    });

    els.clearKey?.addEventListener("click", () => {
      localStorage.removeItem(STORAGE_KEY);
      if (els.apiKey) els.apiKey.value = "";
      setStatus("Stadia key cleared. Trying domain-auth smooth basemap...");
      loadSmoothBase();
    });
  }

  function initMap() {
    const L = window.L;

    state.map = L.map(els.map, {
      center: UK_CENTER,
      zoom: 6,
      minZoom: 5,
      maxZoom: 11,
      maxBounds: UK_BOUNDS,
      maxBoundsViscosity: 0.9,
      zoomControl: true,
      attributionControl: true,
      preferCanvas: true,
      worldCopyJump: false
    });

    createPane("weatherBasePane", 200, "auto", "weather-base-pane");
    createPane("weatherLayerPane", 430, "none", "weather-layer-pane");
    createPane("weatherMarkerPane", 600, "auto", "weather-marker-pane");
    createPane("weatherControlPane", 650, "auto", "weather-control-pane");

    window.setTimeout(() => state.map.invalidateSize(), 120);
  }

  function createPane(name, zIndex, pointerEvents, className) {
    const pane = state.map.getPane(name) || state.map.createPane(name);
    pane.style.zIndex = String(zIndex);
    pane.style.pointerEvents = pointerEvents;
    if (className) pane.classList.add(className);
    return pane;
  }

  function loadSmoothBase() {
    const key = getStoredKey();
    const url = key ? `${STADIA_TILE_URL}?api_key=${encodeURIComponent(key)}` : STADIA_TILE_URL;

    state.usingFallback = false;
    state.tileErrors = 0;
    replaceBaseLayer(makeStadiaLayer(url));

    setStatus(key
      ? "Loading Stadia Alidade Smooth with saved local key..."
      : "Loading Stadia Alidade Smooth. If domain auth is not configured, fallback will load.");
  }

  function makeStadiaLayer(url) {
    const L = window.L;

    const layer = L.tileLayer(url, {
      pane: "weatherBasePane",
      minZoom: 5,
      maxZoom: 11,
      keepBuffer: 1,
      noWrap: true,
      updateWhenIdle: true,
      updateWhenZooming: false,
      detectRetina: true,
      attribution: '&copy; <a href="https://stadiamaps.com/" target="_blank" rel="noopener">Stadia Maps</a> &copy; <a href="https://openmaptiles.org/" target="_blank" rel="noopener">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>'
    });

    layer.on("tileload", () => {
      if (!state.usingFallback) {
        setStatus("Stadia Alidade Smooth loaded. Base filter is active; weather pane is unfiltered.");
      }
    });

    layer.on("tileerror", () => {
      state.tileErrors += 1;
      if (!state.usingFallback && state.tileErrors >= 3) {
        loadOsmFallback();
      }
    });

    return layer;
  }

  function loadOsmFallback() {
    state.usingFallback = true;
    state.tileErrors = 0;
    replaceBaseLayer(makeOsmFallbackLayer());
    setStatus("Stadia tiles did not load. Showing filtered OSM fallback; add a Stadia key or configure domain auth for Smooth.");
  }

  function makeOsmFallbackLayer() {
    const L = window.L;

    return L.tileLayer(OSM_FALLBACK_URL, {
      pane: "weatherBasePane",
      minZoom: 5,
      maxZoom: 11,
      keepBuffer: 1,
      noWrap: true,
      updateWhenIdle: true,
      updateWhenZooming: false,
      detectRetina: false,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>'
    });
  }

  function replaceBaseLayer(layer) {
    if (state.baseLayer && state.map) {
      state.map.removeLayer(state.baseLayer);
    }

    state.baseLayer = layer;
    state.baseLayer.addTo(state.map);
  }

  function restoreKeyField() {
    if (els.apiKey) {
      els.apiKey.value = getStoredKey();
    }
  }

  function getStoredKey() {
    try {
      return localStorage.getItem(STORAGE_KEY) || "";
    } catch {
      return "";
    }
  }

  function getInputKey() {
    return String(els.apiKey?.value || "").trim();
  }

  function setStatus(message) {
    if (els.status) els.status.textContent = message;
  }

  window.FieldOpsWeatherMap = {
    VERSION,
    getMap: () => state.map,
    getBaseLayer: () => state.baseLayer,
    getWeatherPaneName: () => "weatherLayerPane",
    reloadSmoothBase: loadSmoothBase
  };
})();

/* End of file: FieldOpsAtlas/Features/Weather/weather-map.js */
