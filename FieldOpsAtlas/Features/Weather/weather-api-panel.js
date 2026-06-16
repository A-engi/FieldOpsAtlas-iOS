/* ==========================================================================
   FieldOps Atlas Weather
   File: FieldOpsAtlas/Features/Weather/weather-api-panel.js
   Version: v1.0.6-weather-pages-recovery
   Purpose:
   - Keep Weather as separated pages: History, Forecast, Rain, Sources.
   - Reuse only a small OSM map context, not the full Maps page.
   - Keep the maps-page weather button as a lightweight preview + Activate link.
   ========================================================================== */

(function fieldOpsWeather() {
  "use strict";

  var VERSION = "v1.0.6-weather-pages-recovery";
  var OPEN_METEO_API = "https://api.open-meteo.com/v1/forecast";
  var PRESELI = {
    name: "Preseli area",
    latitude: 51.946,
    longitude: -4.735
  };

  var forecastLoaded = false;
  var forecastLoading = false;
  var mapLoaded = false;

  function qs(selector, root) {
    return (root || document).querySelector(selector);
  }

  function qsa(selector, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(selector));
  }

  function status(message) {
    qsa("[data-weather-output], [data-weather-source-output]").forEach(function update(element) {
      element.textContent = message;
    });
  }

  function updatedLabel(message) {
    qsa("[data-weather-forecast-updated]").forEach(function update(element) {
      element.textContent = message;
    });
  }

  function openPanel() {
    var panel = qs(".weather-api-panel");
    var icon = qs("[data-weather-panel-open]");

    if (panel) {
      panel.hidden = false;
    }

    if (icon) {
      icon.setAttribute("aria-expanded", "true");
    }

    loadPreseliForecast();
  }

  function closePanel() {
    var panel = qs(".weather-api-panel");
    var icon = qs("[data-weather-panel-open]");

    if (panel) {
      panel.hidden = true;
    }

    if (icon) {
      icon.setAttribute("aria-expanded", "false");
    }
  }

  function togglePanel() {
    var panel = qs(".weather-api-panel");

    if (!panel || panel.hidden) {
      openPanel();
    } else {
      closePanel();
    }
  }

  function setWeatherPage(route) {
    var page = qs("[data-weather-page]");
    var nextRoute = route || "history";
    var title = qs("[data-weather-page-title]");
    var labels = {
      history: "History",
      forecast: "Forecast",
      rain: "Rain",
      sources: "Sources"
    };

    if (!page || !labels[nextRoute]) {
      nextRoute = "history";
    }

    if (page) {
      page.setAttribute("data-weather-page-state", nextRoute);
    }

    if (title) {
      title.textContent = labels[nextRoute];
    }

    qsa("[data-weather-section]").forEach(function updateSection(section) {
      section.hidden = section.getAttribute("data-weather-section") !== nextRoute;
    });

    qsa("[data-weather-route]").forEach(function updateRoute(link) {
      if (link.getAttribute("data-weather-route") === nextRoute) {
        link.setAttribute("aria-current", "page");
      } else {
        link.removeAttribute("aria-current");
      }
    });

    if (nextRoute === "forecast") {
      loadPreseliForecast(true);
    }
  }

  function routeFromHash() {
    return (window.location.hash || "#history").replace("#", "") || "history";
  }

  function weatherIcon(code) {
    if (code === 0) {
      return "☀";
    }

    if (code === 1 || code === 2) {
      return "🌤";
    }

    if (code === 3 || code === 45 || code === 48) {
      return "☁";
    }

    if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) {
      return "🌧";
    }

    if (code >= 71 && code <= 77) {
      return "❄";
    }

    if (code >= 95) {
      return "⛈";
    }

    return "☁";
  }

  function formatDay(value) {
    var date = new Date(value + "T12:00:00");
    return date.toLocaleDateString("en-GB", {
      weekday: "short",
      day: "2-digit"
    });
  }

  function round(value) {
    var number = Number(value);
    return Number.isFinite(number) ? Math.round(number) : "—";
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function replaceCharacter(character) {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      }[character];
    });
  }

  function renderForecast(payload) {
    var daily = payload && payload.daily ? payload.daily : {};
    var dates = Array.isArray(daily.time) ? daily.time : [];
    var max = Array.isArray(daily.temperature_2m_max) ? daily.temperature_2m_max : [];
    var min = Array.isArray(daily.temperature_2m_min) ? daily.temperature_2m_min : [];
    var rain = Array.isArray(daily.precipitation_probability_max) ? daily.precipitation_probability_max : [];
    var gusts = Array.isArray(daily.wind_gusts_10m_max) ? daily.wind_gusts_10m_max : [];
    var codes = Array.isArray(daily.weather_code) ? daily.weather_code : [];

    qsa("[data-weather-forecast-track]").forEach(function updateTrack(track) {
      if (!dates.length) {
        track.innerHTML = '<article class="weather-forecast-card weather-forecast-card-placeholder" role="listitem">No forecast returned.</article>';
        return;
      }

      track.innerHTML = dates.slice(0, 7).map(function mapDay(date, index) {
        var code = Number(codes[index] || 0);

        return [
          '<article class="weather-forecast-card" role="listitem">',
          '<p class="weather-forecast-day">' + escapeHtml(formatDay(date)) + '</p>',
          '<p class="weather-forecast-icon" aria-hidden="true">' + escapeHtml(weatherIcon(code)) + '</p>',
          '<p class="weather-forecast-temp">' + escapeHtml(round(min[index])) + '–' + escapeHtml(round(max[index])) + '°C</p>',
          '<p class="weather-forecast-meta">Rain ' + escapeHtml(round(rain[index])) + '%</p>',
          '<p class="weather-forecast-meta">Gust ' + escapeHtml(round(gusts[index])) + ' mph</p>',
          '</article>'
        ].join("");
      }).join("");
    });

    forecastLoaded = true;
    updatedLabel("Updated " + new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }));
    status("Forecast loaded. " + VERSION);
  }

  function fetchJson(url) {
    return fetch(url, {
      cache: "no-store",
      headers: {
        Accept: "application/json"
      }
    }).then(function handleResponse(response) {
      if (!response.ok) {
        throw new Error("HTTP " + response.status);
      }

      return response.json();
    });
  }

  function loadPreseliForecast(force) {
    var params;

    if ((forecastLoaded && !force) || forecastLoading) {
      return;
    }

    forecastLoading = true;
    status("Loading Preseli forecast...");

    params = new URLSearchParams({
      latitude: PRESELI.latitude,
      longitude: PRESELI.longitude,
      daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_gusts_10m_max",
      forecast_days: "7",
      timezone: "Europe/London",
      wind_speed_unit: "mph"
    });

    fetchJson(OPEN_METEO_API + "?" + params.toString())
      .then(renderForecast)
      .catch(function handleError(error) {
        status("Forecast failed: " + error.message);
      })
      .finally(function clearLoading() {
        forecastLoading = false;
      });
  }

  function initMiniMap() {
    var element = qs("[data-weather-mini-map]");

    if (!element || mapLoaded) {
      return;
    }

    if (!window.L) {
      element.textContent = "Map unavailable.";
      return;
    }

    mapLoaded = true;

    var map = window.L.map(element, {
      zoomControl: false,
      attributionControl: false
    }).setView([PRESELI.latitude, PRESELI.longitude], 10);

    window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19
    }).addTo(map);

    window.L.marker([PRESELI.latitude, PRESELI.longitude]).addTo(map).bindPopup(PRESELI.name);

    setTimeout(function resizeMap() {
      map.invalidateSize();
    }, 250);
  }

  function checkSource(source) {
    if (source === "openmeteo") {
      loadPreseliForecast(true);
      return;
    }

    if (source === "rainviewer") {
      status("RainViewer metadata check placeholder. No provider map is loaded on this page.");
      return;
    }

    if (source === "ea") {
      status("EA rain gauge check placeholder. Wire station lookup here later.");
      return;
    }

    if (source === "metoffice") {
      status("Met Office source placeholder. Add DataHub order/key flow here later.");
    }
  }

  function wireControls() {
    document.addEventListener("click", function onClick(event) {
      var route = event.target.closest("[data-weather-route]");
      var source = event.target.closest("[data-weather-source]");

      if (event.target.closest("[data-weather-panel-open]")) {
        togglePanel();
        return;
      }

      if (event.target.closest("[data-weather-panel-close]")) {
        closePanel();
        return;
      }

      if (event.target.closest("[data-weather-refresh]")) {
        loadPreseliForecast(true);
        return;
      }

      if (route) {
        setWeatherPage(route.getAttribute("data-weather-route"));
        return;
      }

      if (source) {
        checkSource(source.getAttribute("data-weather-source"));
      }
    });

    window.addEventListener("hashchange", function onHashChange() {
      setWeatherPage(routeFromHash());
    });
  }

  function init() {
    wireControls();
    closePanel();
    setWeatherPage(routeFromHash());
    initMiniMap();
    loadPreseliForecast();
    status(VERSION);

    window.FieldOpsWeather = {
      version: VERSION,
      openPreview: openPanel,
      closePreview: closePanel,
      loadPreseliForecast: loadPreseliForecast
    };
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();

// End of file: FieldOpsAtlas/Features/Weather/weather-api-panel.js
