/* ==========================================================================
   FieldOps Atlas RF interface
   File: FieldOpsAtlas/Features/RF/rf-interface.js
   Version: 1.1.85-snipsnip-checked

   Purpose:
   - Own the visible RF interface shell and static RF UI.
   - Create the RF title, RF/IP/MW/All graph filter controls, map holder,
     recent cards, Services panel, and Equipment panel.
   - Leave graph drawing to rf-graph.js.
   - Do not create the archived path-details pane, hidden toggle, or handle.
   ========================================================================== */

(() => {
  "use strict";

  const VERSION = "1.1.85-snipsnip-checked";
  const HOME_SELECTOR = ".rf-home";

  const MAIN_INTERFACE_TEMPLATE = String.raw`
<section class="rf-network" aria-labelledby="rfNetworkTitle" data-rf-interface-main>
  <div class="rf-network-head">
    <h1 class="rf-title" id="rfNetworkTitle">RF network map</h1>
    <div class="rf-tabs" aria-label="Network layer filter">
      <button class="rf-tab is-active" type="button">RF</button>
      <button class="rf-tab" type="button">IP</button>
      <button class="rf-tab" type="button">MW</button>
      <button class="rf-tab" type="button">All</button>
    </div>
  </div>

  <div class="rf-map-recent">
    <div class="rf-map-paper">
      <div
        class="rf-map-stage"
        id="rfMapStage"
        data-rf-graph
        role="img"
        aria-label="RF graph"
      ></div>
    </div>

    <section class="rf-recent" aria-labelledby="rfRecentTitle">
      <div class="rf-recent-head">
        <h2 class="rf-recent-title" id="rfRecentTitle">
          <span class="rf-clock" aria-hidden="true"></span>
          <span>Recently opened</span>
        </h2>
        <a class="rf-viewall" href="../RFPages/sites.html">View all</a>
      </div>

      <div class="rf-recent-grid">
        <a class="rf-recent-card" href="../RFPages/sites.html">
          <img src="../../../data/icons/sites.svg" alt="" aria-hidden="true" loading="lazy" decoding="async">
          <span>
            <span class="rf-recent-name">Hilltop<br>Relay</span>
            <span class="rf-status">Online</span>
          </span>
        </a>

        <a class="rf-recent-card" href="../RFPages/sites.html">
          <img src="../../../data/icons/sites.svg" alt="" aria-hidden="true" loading="lazy" decoding="async">
          <span>
            <span class="rf-recent-name">Ridgeway<br>Relay</span>
            <span class="rf-status">Online</span>
          </span>
        </a>

        <a class="rf-recent-card" href="../RFPages/sites.html">
          <img src="../../../data/icons/atlas-transmitter-gold.svg" alt="" aria-hidden="true" loading="lazy" decoding="async">
          <span>
            <span class="rf-recent-name">London<br>Core</span>
            <span class="rf-status">Online</span>
          </span>
        </a>

        <a class="rf-recent-card" href="../RFPages/sites.html">
          <img src="../../../data/icons/sites.svg" alt="" aria-hidden="true" loading="lazy" decoding="async">
          <span>
            <span class="rf-recent-name">Pinewood<br>Remote</span>
            <span class="rf-status">Online</span>
          </span>
        </a>
      </div>
    </section>
  </div>

  <section class="rf-interface-panels" aria-label="RF services and equipment panels" data-rf-interface-panels>
    <section class="rf-panel rf-services-panel" aria-labelledby="rfServicesPanelTitle">
      <h3 class="rf-panel-title" id="rfServicesPanelTitle">Services</h3>
      <div class="rf-services-table" role="table" aria-label="Service status">
        <div class="rf-services-table-head" role="row">
          <span role="columnheader">Service</span>
          <span role="columnheader">Type</span>
          <span role="columnheader">Status</span>
        </div>

        <a class="rf-service-row" href="../RFPages/dtt.html" role="row">
          <span role="cell">DTT MUX 1</span>
          <span role="cell">DTT</span>
          <b role="cell">Online</b>
        </a>

        <a class="rf-service-row" href="../RFPages/dab.html" role="row">
          <span role="cell">DAB National</span>
          <span role="cell">DAB</span>
          <b role="cell">Online</b>
        </a>

        <a class="rf-service-row" href="../RFPages/fm.html" role="row">
          <span role="cell">FM Service</span>
          <span role="cell">FM</span>
          <b role="cell">Online</b>
        </a>
      </div>
    </section>

    <section class="rf-panel rf-equipment-panel" aria-labelledby="rfEquipmentPanelTitle">
      <h3 class="rf-panel-title" id="rfEquipmentPanelTitle">Equipment</h3>
      <div class="rf-equipment-grid">
        <a class="rf-equipment-card" href="../RFPages/equipment.html">
          <strong>2</strong>
          <span>TX</span>
        </a>
        <a class="rf-equipment-card" href="../RFPages/sites.html">
          <strong>3</strong>
          <span>ANT</span>
        </a>
        <a class="rf-equipment-card" href="../RFPages/paths.html">
          <strong>2</strong>
          <span>Links</span>
        </a>
      </div>
    </section>
  </section>
</section>
`;

  function makeFragment(html) {
    const template = document.createElement("template");
    template.innerHTML = html.trim();
    return template.content.cloneNode(true);
  }

  function resetHome(root = document) {
    const home = root.querySelector(HOME_SELECTOR);
    if (!home) {
      return null;
    }

    home.replaceChildren();
    delete home.dataset.rfInterfaceInit;
    return home;
  }

  function attachMainInterface(root = document) {
    const home = root.querySelector(HOME_SELECTOR);
    if (!home || home.dataset.rfInterfaceInit === "true") {
      return;
    }

    home.appendChild(makeFragment(MAIN_INTERFACE_TEMPLATE));
    home.dataset.rfInterfaceInit = "true";
  }

  function initAll(root = document) {
    resetHome(root);
    attachMainInterface(root);
  }

  window.FieldOpsRFInterface = {
    VERSION,
    initAll
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => initAll(), { once: true });
  } else {
    initAll();
  }
})();

/* End of FieldOpsAtlas/Features/RF/rf-interface.js | bottom/end of file */
