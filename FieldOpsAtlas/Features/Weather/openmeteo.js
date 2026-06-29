/* Open-Meteo site-risk API tester v0.3.1
   Data-only screen. No OSM/Leaflet map, no markers, no local colour palette.
*/

(() => {
  "use strict";

  const Lab = window.AtlasWeatherLab;
  const Style = window.FIELDOPS_WEATHER_DISPLAY_STYLE;
  const OPEN_METEO_API = "https://api.open-meteo.com/v1/forecast";
  const MAX_SITES_PER_BATCH = 12;
  const HOURS_TO_SHOW = 12;

  const CURRENT_FIELDS = [
    "temperature_2m",
    "relative_humidity_2m",
    "apparent_temperature",
    "is_day",
    "precipitation",
    "rain",
    "showers",
    "snowfall",
    "weather_code",
    "cloud_cover",
    "pressure_msl",
    "surface_pressure",
    "wind_speed_10m",
    "wind_direction_10m",
    "wind_gusts_10m"
  ];

  const HOURLY_FIELDS = [
    "precipitation_probability",
    "precipitation",
    "rain",
    "showers",
    "snowfall",
    "weather_code",
    "wind_speed_10m",
    "wind_gusts_10m",
    "visibility"
  ];

  const state = {
    regions: [],
    sites: [],
    selectedSites: [],
    riskBySite: new Map(),
    fetchSequence: 0
  };

  const els = {
    statusText: document.getElementById("statusText"),
    regionCount: document.getElementById("regionCount"),
    siteCount: document.getElementById("siteCount"),
    loadSitesButton: document.getElementById("loadSitesButton"),
    fetchRiskButton: document.getElementById("fetchRiskButton"),
    riskList: document.getElementById("riskList"),
    siteSearch: document.getElementById("siteSearch")
  };

  init();

  async function init() {
    bindEvents();
    await loadSites();
    await fetchRisk({ auto: true });
  }

  function bindEvents() {
    els.loadSitesButton?.addEventListener("click", loadSites);
    els.fetchRiskButton?.addEventListener("click", () => fetchRisk({ auto: false }));
    els.siteSearch?.addEventListener("input", updateSelectedSites);
  }

  async function loadSites() {
    setBusy(true);
    try {
      state.regions = await Lab.loadRegions();
      state.sites = Lab.allSites(state.regions);
      updateSelectedSites();
      setStatus(`Loaded.`);
    } catch (error) {
      setStatus(error?.message || "Site list failed to load.");
    } finally {
      setBusy(false);
    }
  }

  function updateSelectedSites() {
    const query = String(els.siteSearch?.value || "").trim().toLowerCase();
    const source = query
      ? state.sites.filter((site) => site.name.toLowerCase().includes(query) || site.region.toLowerCase().includes(query))
      : preferDemoBatch(state.sites);

    state.selectedSites = source.slice(0, MAX_SITES_PER_BATCH);
    if (els.regionCount) els.regionCount.textContent = String(state.regions.length);
    if (els.siteCount) els.siteCount.textContent = String(state.selectedSites.length);
    renderRisks();
  }

  function preferDemoBatch(sites) {
    return sites;
  }

  async function fetchRisk({ auto }) {
    if (!state.selectedSites.length) {
      setStatus("No sites available for Open-Meteo risk fetch.");
      return;
    }

    const fetchId = ++state.fetchSequence;
    setBusy(true);
    setStatus(`${auto ? "Auto" : "Manual"} Open-Meteo request for ${state.selectedSites.length} site(s)...`);

    try {
      const url = buildForecastUrl(state.selectedSites);
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) throw new Error(`Open-Meteo HTTP ${response.status}`);
      const payload = await response.json();
      if (fetchId !== state.fetchSequence) return;

      const forecasts = Array.isArray(payload) ? payload : [payload];
      forecasts.forEach((forecast, index) => {
        const site = state.selectedSites[index];
        if (!site) return;
        state.riskBySite.set(site.id, buildRisk(site, forecast));
      });

      renderRisks();
      setStatus(`Loaded.`);
    } catch (error) {
      setStatus(error?.message || "Open-Meteo request failed.");
    } finally {
      setBusy(false);
    }
  }

  function buildForecastUrl(sites) {
    const params = new URLSearchParams();
    params.set("latitude", sites.map((site) => site.lat.toFixed(5)).join(","));
    params.set("longitude", sites.map((site) => site.lon.toFixed(5)).join(","));
    params.set("current", CURRENT_FIELDS.join(","));
    params.set("hourly", HOURLY_FIELDS.join(","));
    params.set("forecast_days", "2");
    params.set("timezone", "Europe/London");
    return `${OPEN_METEO_API}?${params.toString()}`;
  }

  function buildRisk(site, forecast) {
    const current = forecast?.current || {};
    const hourly = forecast?.hourly || {};
    const hours = collectHours(hourly);
    const maxRain = Math.max(Number(current.rain || 0), ...hours.map((hour) => Number(hour.rain || hour.precipitation || 0)));
    const maxWind = Math.max(Number(current.wind_gusts_10m || 0), ...hours.map((hour) => Number(hour.wind_gusts_10m || 0)));
    const maxProb = Math.max(0, ...hours.map((hour) => Number(hour.precipitation_probability || 0)));
    const weatherCode = Number(current.weather_code || 0);
    const visual = makeVisualState({ weatherCode, maxRain, maxWind, maxProb, isDay: Number(current.is_day) === 1 });

    return {
      site,
      visual,
      score: scoreRisk({ weatherCode, maxRain, maxWind, maxProb }),
      current,
      hours,
      summary: [
        `${Number(current.temperature_2m ?? 0).toFixed(1)} C`,
        `${Number(current.wind_speed_10m ?? 0).toFixed(0)} km/h wind`,
        `${Number(current.precipitation ?? 0).toFixed(1)} mm now`,
        `${maxProb.toFixed(0)}% precip risk`
      ].join(" · ")
    };
  }

  function collectHours(hourly) {
    const times = hourly?.time || [];
    return times.slice(0, HOURS_TO_SHOW).map((time, index) => ({
      time,
      precipitation_probability: readHourly(hourly, "precipitation_probability", index),
      precipitation: readHourly(hourly, "precipitation", index),
      rain: readHourly(hourly, "rain", index),
      wind_gusts_10m: readHourly(hourly, "wind_gusts_10m", index),
      weather_code: readHourly(hourly, "weather_code", index)
    }));
  }

  function readHourly(hourly, field, index) {
    const list = hourly?.[field];
    return Array.isArray(list) ? list[index] : null;
  }

  function makeVisualState(values) {
    const riskStates = Style?.riskStates || {};
    if (isThunderCode(values.weatherCode)) {
      return { state: "lightning", label: riskStates.lightning?.label || "Lightning / thunder", colour: riskStates.lightning?.colour || "currentColor" };
    }
    if (values.maxWind >= 55 || values.weatherCode >= 95) {
      return { state: "storm", label: riskStates.storm?.label || "Storm / wind", colour: riskStates.storm?.colour || "currentColor" };
    }
    if (values.maxRain >= 0.5 || values.maxProb >= 45) {
      return { state: "rain", label: riskStates.rain?.label || "Rain", colour: riskStates.rain?.colour || "currentColor" };
    }
    return { state: "normal", label: values.isDay ? "Normal / sunny" : "Normal / night", colour: riskStates.normal?.colour || "currentColor" };
  }

  function isThunderCode(code) {
    return code === 95 || code === 96 || code === 99;
  }

  function scoreRisk(values) {
    let score = 0;
    if (isThunderCode(values.weatherCode)) score += 90;
    if (values.maxWind >= 55) score += 45;
    if (values.maxRain >= 2) score += 35;
    if (values.maxRain >= 0.5) score += 20;
    if (values.maxProb >= 70) score += 15;
    return Math.min(100, score);
  }

  function renderRisks() {
    if (!els.riskList) return;
    if (!state.selectedSites.length) {
      els.riskList.innerHTML = `<p class="status-text">No matching sites.</p>`;
      return;
    }

    els.riskList.innerHTML = state.selectedSites.map((site) => {
      const risk = state.riskBySite.get(site.id) || makeEmptyRisk(site);
      const visual = risk.visual;
      return `
        <article class="risk-card" style="--risk-colour:${Lab.escapeHtml(visual.colour)}">
          <div class="risk-card-top">
            <div>
              <h3>${Lab.escapeHtml(site.name)}</h3>
              <p>${Lab.escapeHtml(site.region)} · ${site.lat.toFixed(3)}, ${site.lon.toFixed(3)}</p>
            </div>
            <span class="risk-pill">${Lab.escapeHtml(visual.label)}</span>
          </div>
          <p>${Lab.escapeHtml(risk.summary)}</p>
        </article>
      `;
    }).join("");
  }

  function makeEmptyRisk(site) {
    const unloaded = Style?.riskStates?.unloaded || { label: "Not loaded", colour: "currentColor" };
    return {
      site,
      visual: { state: "unloaded", label: unloaded.label, colour: unloaded.colour },
      score: 0,
      current: {},
      hours: [],
      summary: "Not loaded."
    };
  }

  function setBusy(isBusy) {
    if (els.loadSitesButton) els.loadSitesButton.disabled = isBusy;
    if (els.fetchRiskButton) els.fetchRiskButton.disabled = isBusy;
  }

  function setStatus(message) {
    if (els.statusText) els.statusText.textContent = message;
  }
})();
