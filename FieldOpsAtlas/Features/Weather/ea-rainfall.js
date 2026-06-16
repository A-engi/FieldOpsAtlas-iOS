/* Environment Agency rainfall gauge API tester v0.3.0
   Data-only screen. No OSM/Leaflet map and no markers.
*/

(() => {
  "use strict";

  const Lab = window.AtlasWeatherLab;
  const EA_ROOT = "https://environment.data.gov.uk/flood-monitoring";

  const state = {
    regions: [],
    sites: []
  };

  const els = {
    statusText: document.getElementById("statusText"),
    siteSelect: document.getElementById("siteSelect"),
    distanceRange: document.getElementById("distanceRange"),
    distanceLabel: document.getElementById("distanceLabel"),
    loadGaugesButton: document.getElementById("loadGaugesButton"),
    clearGaugesButton: document.getElementById("clearGaugesButton"),
    gaugeList: document.getElementById("gaugeList")
  };

  init();

  async function init() {
    state.regions = await Lab.loadRegions();
    state.sites = Lab.allSites(state.regions);
    populateSites();
    bindEvents();
    setStatus("Ready. Pick a sample site and load nearby Environment Agency rainfall gauges.");
  }

  function populateSites() {
    if (!els.siteSelect) return;
    els.siteSelect.innerHTML = state.sites.map((site) => `
      <option value="${Lab.escapeHtml(site.id)}">${Lab.escapeHtml(site.name)} · ${Lab.escapeHtml(site.region)}</option>
    `).join("");
    const preseli = state.sites.find((site) => site.name.toLowerCase() === "preseli");
    if (preseli) els.siteSelect.value = preseli.id;
  }

  function bindEvents() {
    els.distanceRange?.addEventListener("input", () => {
      els.distanceLabel.textContent = `${els.distanceRange.value} km`;
    });
    els.loadGaugesButton?.addEventListener("click", loadNearbyGauges);
    els.clearGaugesButton?.addEventListener("click", clearGauges);
  }

  async function loadNearbyGauges() {
    const site = currentSite();
    if (!site) {
      setStatus("No site selected.");
      return;
    }

    const radiusKm = Number(els.distanceRange?.value || 40);
    setBusy(true);
    setStatus(`Loading EA rainfall stations within ${radiusKm} km of ${site.name}...`);

    try {
      const url = `${EA_ROOT}/id/stations?parameter=rainfall&lat=${site.lat}&long=${site.lon}&dist=${radiusKm}`;
      const response = await fetch(url, { headers: { Accept: "application/json" }, cache: "no-store" });
      if (!response.ok) throw new Error(`EA rainfall station request returned HTTP ${response.status}`);
      const data = await response.json();
      const stations = Array.isArray(data?.items) ? data.items : [];
      const gauges = stations.map((station) => normaliseGauge(station, site)).filter(Boolean).sort((a, b) => a.distanceKm - b.distanceKm);
      renderGauges(gauges);
      setStatus(`${gauges.length} rainfall gauge(s) found. No map or marker layer was created.`);
    } catch (error) {
      setStatus(error?.message || "EA rainfall gauge request failed.");
    } finally {
      setBusy(false);
    }
  }

  function normaliseGauge(station, site) {
    const lat = Number(station.lat);
    const lon = Number(station.long ?? station.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    return {
      id: String(station.stationReference || station.notation || station["@id"] || station.label || "unknown"),
      label: String(station.label || station.stationReference || "Unnamed gauge"),
      lat,
      lon,
      distanceKm: Lab.haversineKm(site, { lat, lon }),
      riverName: station.riverName || "",
      town: station.town || ""
    };
  }

  function renderGauges(gauges) {
    if (!els.gaugeList) return;
    if (!gauges.length) {
      els.gaugeList.innerHTML = `<p class="status-text">No rainfall gauges found in this radius.</p>`;
      return;
    }

    els.gaugeList.innerHTML = gauges.slice(0, 30).map((gauge) => `
      <article class="list-row gauge-row">
        <span>${Lab.escapeHtml(gauge.label)}</span>
        <code>${gauge.distanceKm.toFixed(1)} km</code>
        <small>${Lab.escapeHtml([gauge.town, gauge.riverName].filter(Boolean).join(" · "))}</small>
      </article>
    `).join("");
  }

  function clearGauges() {
    if (els.gaugeList) els.gaugeList.innerHTML = "";
    setStatus("Gauge list cleared. No API request was made.");
  }

  function currentSite() {
    const id = els.siteSelect?.value;
    return state.sites.find((site) => site.id === id) || state.sites[0] || null;
  }

  function setBusy(isBusy) {
    if (els.loadGaugesButton) els.loadGaugesButton.disabled = isBusy;
  }

  function setStatus(message) {
    if (els.statusText) els.statusText.textContent = message;
  }
})();

/* End of file: FieldOpsAtlas/Features/Weather/ea-rainfall.js */
