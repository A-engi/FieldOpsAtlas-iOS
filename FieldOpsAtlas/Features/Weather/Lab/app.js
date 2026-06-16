/* ==========================================================================
   FieldOps Atlas Weather Lab copy
   File: FieldOpsAtlas/Features/Weather/Lab/app.js
   Version: 1.0.0-weather-lab-copy
   Purpose:
   - Local copy of provider checks from BeezelBun/atlas-weather-lab.
   - Keep API keys browser-session only; do not store or commit them.
   ========================================================================== */

(function fieldOpsWeatherLabCopy() {
  "use strict";

  var VERSION = "1.0.0-weather-lab-copy";

  var sites = [
    { id: "preseli", name: "Preseli", lat: 51.946, lon: -4.735 },
    { id: "blaenplwyf", name: "Blaenplwyf", lat: 52.386, lon: -4.075 },
    { id: "llanddona", name: "Llanddona", lat: 53.294, lon: -4.126 },
    { id: "moel-y-parc", name: "Moel-y-Parc", lat: 53.217, lon: -3.255 },
    { id: "wenvoe", name: "Wenvoe", lat: 51.456, lon: -3.284 },
    { id: "swansea", name: "Swansea", lat: 51.621, lon: -3.944 }
  ];

  function qs(selector, root) {
    return (root || document).querySelector(selector);
  }

  function qsa(selector, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(selector));
  }

  function output(name, value) {
    var element = qs('[data-output="' + name + '"]');
    if (element) {
      element.textContent = typeof value === "string" ? value : JSON.stringify(value, null, 2);
    }
  }

  function selectedSite(selector) {
    var select = qs(selector);
    var site = sites.find(function findSite(item) {
      return item.id === (select && select.value);
    });
    return site || sites[0];
  }

  function populateSites() {
    qsa("[data-openmeteo-site], [data-ea-site]").forEach(function populate(select) {
      select.innerHTML = sites.map(function option(site) {
        return '<option value="' + site.id + '">' + site.name + '</option>';
      }).join("");
    });
  }

  function fetchJson(url, options) {
    return fetch(url, Object.assign({ cache: "no-store" }, options || {})).then(function handleResponse(response) {
      if (!response.ok) {
        throw new Error("HTTP " + response.status + " from " + url);
      }
      return response.json();
    });
  }

  function checkRainViewer() {
    output("rainviewer", "Loading RainViewer metadata...");
    fetchJson("https://api.rainviewer.com/public/weather-maps.json")
      .then(function handleRainViewer(payload) {
        var frames = payload && payload.radar && Array.isArray(payload.radar.past) ? payload.radar.past : [];
        var latest = frames[frames.length - 1];
        if (!latest || !payload.host) {
          throw new Error("No radar frames returned.");
        }

        output("rainviewer", {
          provider: "RainViewer",
          version: VERSION,
          latestFrameTime: new Date(latest.time * 1000).toLocaleString("en-GB"),
          host: payload.host,
          path: latest.path,
          ukTileTemplate: payload.host + latest.path + "/7/{x}/{y}/2/1_1.png",
          note: "Use this as the rain/blob overlay candidate. Native max zoom should stay conservative for mobile."
        });
      })
      .catch(function handleError(error) {
        output("rainviewer", "RainViewer failed: " + error.message);
      });
  }

  function checkOpenMeteo() {
    var site = selectedSite("[data-openmeteo-site]");
    var params = new URLSearchParams({
      latitude: site.lat,
      longitude: site.lon,
      current: "temperature_2m,precipitation,weather_code,wind_speed_10m,wind_gusts_10m",
      hourly: "precipitation_probability,visibility,wind_speed_10m,wind_gusts_10m",
      forecast_days: "1",
      timezone: "auto"
    });

    output("openmeteo", "Loading Open-Meteo forecast for " + site.name + "...");
    fetchJson("https://api.open-meteo.com/v1/forecast?" + params.toString())
      .then(function handleOpenMeteo(payload) {
        var current = payload.current || {};
        output("openmeteo", {
          provider: "Open-Meteo",
          site: site.name,
          coordinates: [site.lat, site.lon],
          temperatureC: current.temperature_2m,
          precipitationMm: current.precipitation,
          windKmh: current.wind_speed_10m,
          gustKmh: current.wind_gusts_10m,
          weatherCode: current.weather_code,
          note: "Use this for site-risk numbers and visible-region batching."
        });
      })
      .catch(function handleError(error) {
        output("openmeteo", "Open-Meteo failed: " + error.message);
      });
  }

  function checkMetOffice() {
    var key = (qs("[data-metoffice-key]") || {}).value || "";
    var order = (qs("[data-metoffice-order]") || {}).value || "";

    key = key.trim();
    order = order.trim();

    if (!key || !order) {
      output("metoffice", "Enter a DataHub API key and Map Images order name. Nothing is stored.");
      return;
    }

    var url = "https://data.hub.api.metoffice.gov.uk/map-images/1.0.0/orders/" +
      encodeURIComponent(order) +
      "/latest?detail=MINIMAL";

    output("metoffice", "Testing Met Office DataHub latest image list...");
    fetchJson(url, {
      headers: {
        "apikey": key,
        "Accept": "application/json"
      }
    })
      .then(function handleMetOffice(payload) {
        output("metoffice", {
          provider: "Met Office DataHub Map Images",
          order: order,
          response: payload,
          note: "If this fails on GitHub Pages due to CORS, Atlas needs a proxy or native iOS networking."
        });
      })
      .catch(function handleError(error) {
        output("metoffice", "Met Office request failed: " + error.message + "\nLikely causes: bad key/order, no active order, or browser CORS.");
      });
  }

  function checkEaRainfall() {
    var site = selectedSite("[data-ea-site]");
    var params = new URLSearchParams({
      parameter: "rainfall",
      lat: site.lat,
      long: site.lon,
      dist: "25",
      _limit: "10"
    });

    output("ea", "Loading Environment Agency rainfall stations near " + site.name + "...");
    fetchJson("https://environment.data.gov.uk/flood-monitoring/id/stations?" + params.toString())
      .then(function handleEa(payload) {
        var items = Array.isArray(payload.items) ? payload.items : [];
        output("ea", {
          provider: "Environment Agency rainfall gauges",
          site: site.name,
          stations: items.map(function mapStation(station) {
            return {
              label: station.label || station.notation || station["@id"],
              river: station.riverName || "",
              town: station.town || "",
              id: station["@id"]
            };
          }),
          note: "Use measured rainfall stations as a field verification source."
        });
      })
      .catch(function handleError(error) {
        output("ea", "EA rainfall request failed: " + error.message);
      });
  }

  function wireButtons() {
    document.addEventListener("click", function onClick(event) {
      var button = event.target.closest("[data-action]");
      if (!button) {
        return;
      }

      var action = button.getAttribute("data-action");
      if (action === "rainviewer") {
        checkRainViewer();
      } else if (action === "openmeteo") {
        checkOpenMeteo();
      } else if (action === "metoffice") {
        checkMetOffice();
      } else if (action === "ea") {
        checkEaRainfall();
      }
    });
  }

  function init() {
    populateSites();
    wireButtons();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();

// End of file: FieldOpsAtlas/Features/Weather/Lab/app.js
