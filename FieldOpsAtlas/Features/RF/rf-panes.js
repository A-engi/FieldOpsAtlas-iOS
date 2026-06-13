/* ==========================================================================
   FieldOps Atlas RF panes
   File: FieldOpsAtlas/Features/RF/rf-panes.js
   Version: 1.1.30-pane-shell-first-details-after-map

   Purpose:
   - Own RF pane markup that should not live in index.html.
   - Attach the path details pane shell directly inside .rf-map-paper before the
     dynamic network map renders.
   - Load path details content only after the dynamic network map has rendered.
   - Keep the pane out of normal layout flow so it never pushes the map down.
   - Leave pane styling and open/close behaviour in rf-pane.css.
   ========================================================================== */

(() => {
  "use strict";

  const VERSION = "1.1.30-pane-shell-first-details-after-map";

  const PATH_TOGGLE_TEMPLATE = String.raw`
<input
                class="rf-path-toggle"
                id="rfPathPaneToggle"
                type="checkbox"
                checked
                aria-label="Toggle path details"
              >
`;

  const PATH_PANE_SHELL_TEMPLATE = String.raw`
<aside class="rf-path-pane" aria-label="Selected RF path details">
                <label class="rf-path-handle" for="rfPathPaneToggle" aria-label="Collapse path details">
                  <img
                    class="rf-path-handle-icon"
                    src="../../../data/icons/path-pane-chevron-gold.svg"
                    alt=""
                    aria-hidden="true"
                    loading="lazy"
                    decoding="async"
                  >
                </label>

                <div class="rf-path-pane-body" data-rf-path-details-body hidden></div>
              </aside>
`;

  const PATH_DETAILS_BODY_TEMPLATE = String.raw`
<div class="rf-path-pane-body">
                  <header class="rf-path-pane-title">
                    <img
                      class="rf-path-title-wave"
                      src="../../../data/icons/path-details-wave.svg"
                      alt=""
                      aria-hidden="true"
                      loading="lazy"
                      decoding="async"
                    >
                    <span>Path details</span>
                  </header>

                  <section class="rf-path-site is-from" aria-label="Source site">
                    <span class="rf-path-mast" aria-hidden="true">
                      <img
                        src="../../../data/icons/atlas-transmitter-gold.svg"
                        alt=""
                        loading="lazy"
                        decoding="async"
                      >
                    </span>
                    <span class="rf-path-site-copy">
                      <small>From</small>
                      <b>North Ridge</b>
                      <b>TX Site</b>
                    </span>
                  </section>

                  <section class="rf-path-mid" aria-label="Selected RF path">
                    <img
                      class="rf-path-signal-vertical"
                      src="../../../data/icons/path-signal-glow.svg"
                      alt=""
                      aria-hidden="true"
                      loading="lazy"
                      decoding="async"
                    >

                    <div class="rf-path-frequency">
                      <strong>6.725 GHz</strong>
                      <span>Horizontal</span>
                      <dl class="rf-path-data">
                        <div>
                          <dt>Service</dt>
                          <dd>DTT 1</dd>
                        </div>
                        <div>
                          <dt>Band</dt>
                          <dd>28 MHz</dd>
                        </div>
                        <div>
                          <dt>Mode</dt>
                          <dd>64QAM</dd>
                        </div>
                        <div>
                          <dt>Power</dt>
                          <dd>18 dBm</dd>
                        </div>
                        <div>
                          <dt>Avail</dt>
                          <dd>99.98%</dd>
                        </div>
                        <div>
                          <dt>Status</dt>
                          <dd><i aria-hidden="true"></i>Online</dd>
                        </div>
                      </dl>
                    </div>
                  </section>

                  <section class="rf-path-site is-to" aria-label="Destination site">
                    <span class="rf-path-mast" aria-hidden="true">
                      <img
                        src="../../../data/icons/atlas-transmitter-gold.svg"
                        alt=""
                        loading="lazy"
                        decoding="async"
                      >
                    </span>
                    <span class="rf-path-site-copy">
                      <small>To</small>
                      <b>Hilltop</b>
                      <b>Relay Site</b>
                    </span>
                  </section>
                </div>
`;

  function makeFragment(html) {
    const template = document.createElement("template");
    template.innerHTML = html.trim();
    return template.content.cloneNode(true);
  }

  function removePlaceholderMounts(root) {
    root
      .querySelectorAll("[data-rf-path-pane-mount]")
      .forEach((mount) => mount.remove());
  }

  function loadPathDetailsBody(mapPaper) {
    const bodyMount = mapPaper.querySelector("[data-rf-path-details-body]");
    if (!bodyMount || bodyMount.dataset.rfDetailsLoaded === "true") {
      return;
    }

    const fragment = makeFragment(PATH_DETAILS_BODY_TEMPLATE);
    const body = fragment.querySelector(".rf-path-pane-body");

    if (!body) {
      return;
    }

    body.removeAttribute("hidden");
    body.dataset.rfDetailsLoaded = "true";
    bodyMount.replaceWith(body);

    mapPaper.dispatchEvent(new CustomEvent("fieldops:rf-path-details-ready", {
      bubbles: true,
      detail: {
        version: VERSION,
        pane: "path-details"
      }
    }));
  }

  function bindDetailsAfterMap(mapPaper) {
    const mapStage = mapPaper.querySelector(".rf-map-stage");

    if (mapStage?.dataset.rfNetworkMapLoaded === "true") {
      window.requestAnimationFrame(() => loadPathDetailsBody(mapPaper));
      return;
    }

    mapPaper.addEventListener("fieldops:rf-network-map-rendered", () => {
      window.requestAnimationFrame(() => loadPathDetailsBody(mapPaper));
    }, { once: true });

    window.setTimeout(() => loadPathDetailsBody(mapPaper), 1200);
  }

  function initPathPane(mapPaper) {
    if (!mapPaper || mapPaper.dataset.rfPaneInit === "true") {
      return;
    }

    const mapStage = mapPaper.querySelector(".rf-map-stage");
    if (!mapStage) {
      return;
    }

    mapPaper.dataset.rfPaneInit = "true";

    const toggleFragment = makeFragment(PATH_TOGGLE_TEMPLATE);
    const shellFragment = makeFragment(PATH_PANE_SHELL_TEMPLATE);

    const toggle = toggleFragment.querySelector(".rf-path-toggle");
    const pane = shellFragment.querySelector(".rf-path-pane");

    if (!toggle || !pane) {
      return;
    }

    mapPaper.insertBefore(toggle, mapStage);
    mapStage.insertAdjacentElement("afterend", pane);

    mapPaper.dispatchEvent(new CustomEvent("fieldops:rf-pane-shell-ready", {
      bubbles: true,
      detail: {
        version: VERSION,
        pane: "path-details"
      }
    }));

    bindDetailsAfterMap(mapPaper);
  }

  function initAll(root = document) {
    removePlaceholderMounts(root);

    root
      .querySelectorAll(".rf-map-paper")
      .forEach(initPathPane);
  }

  window.FieldOpsRFPanes = {
    VERSION,
    initAll,
    loadPathDetailsBody
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => initAll(), { once: true });
  } else {
    initAll();
  }
})();
