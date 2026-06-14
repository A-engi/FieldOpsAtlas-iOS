/* ==========================================================================
   FieldOps Atlas RF path builder
   File: FieldOpsAtlas/Features/RF/rf-path-builder.js
   Version: 1.1.102-path-pane-rewrite

   Purpose:
   - Build the selected RF path model from topology, site, service, and path data.
   - Render the full Path Details card into the empty slot created by rf-interface.js.
   - Keep pane shell, controls, and styling in rf-interface.js / rf-interface.css.
   - This rewrite replaces the archived legacy pane/body renderer.
   ========================================================================== */

(() => {
  "use strict";

  const VERSION = "1.1.102-path-pane-rewrite";
  const SLOT_SELECTOR = "[data-rf-path-details]";
  const PANE_READY_EVENT = "fieldops:rf-pane-shell-ready";

  const ICON_ROOT = "../../../data/icons/";

  const SELECTED_PATH = {
    id: "north-ridge-to-hilltop",
    from: {
      eyebrow: "From",
      name: "North Ridge",
      role: "TX Site",
      icon: "rf-mast.svg"
    },
    to: {
      eyebrow: "To",
      name: "Hilltop",
      role: "Relay Site",
      icon: "rf-mast.svg"
    },
    link: {
      art: "path-signal-glow.svg",
      frequency: "6.725 GHz",
      polarity: "Horizontal",
      service: "DTT 1",
      band: "28 MHz",
      mode: "64QAM",
      power: "18 dBm",
      availability: "99.98%",
      status: "Online"
    }
  };

  function iconPath(name) {
    return `${ICON_ROOT}${name}`;
  }

  function escapeHTML(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function renderEndpoint(endpoint, modifier) {
    const eyebrow = escapeHTML(endpoint.eyebrow);
    const name = escapeHTML(endpoint.name);
    const role = escapeHTML(endpoint.role);
    const icon = escapeHTML(iconPath(endpoint.icon));

    return `
      <section class="rf-path-endpoint ${modifier}">
        <span class="rf-path-endpoint-icon" aria-hidden="true">
          <img src="${icon}" alt="" loading="lazy" decoding="async">
        </span>
        <span class="rf-path-endpoint-copy">
          <small class="rf-path-label">${eyebrow}</small>
          <b class="rf-path-site-name">${name}</b>
          <b class="rf-path-site-role">${role}</b>
        </span>
      </section>
    `;
  }

  function renderSpecRows(link) {
    const rows = [
      ["Service", link.service],
      ["Band", link.band],
      ["Mode", link.mode],
      ["Power", link.power],
      ["Avail", link.availability],
      ["Status", `<span class="rf-path-status-dot" aria-hidden="true"></span>${escapeHTML(link.status)}`]
    ];

    return rows
      .map(([label, value]) => `
        <div>
          <dt>${escapeHTML(label)}</dt>
          <dd>${label === "Status" ? value : escapeHTML(value)}</dd>
        </div>
      `)
      .join("");
  }

  function renderPathCard(path) {
    const link = path.link;

    return `
      <article class="rf-path-card" data-rf-path-builder-body data-rf-path-id="${escapeHTML(path.id)}">
        <header class="rf-path-card-head">
          <img
            class="rf-path-card-wave"
            src="${escapeHTML(iconPath("path-wave.svg"))}"
            alt=""
            aria-hidden="true"
            loading="lazy"
            decoding="async"
          >
          <span class="rf-path-card-title">Path Details</span>
        </header>

        ${renderEndpoint(path.from, "is-from")}

        <section class="rf-path-link-box" aria-label="Selected RF path values">
          <img
            class="rf-path-link-art"
            src="${escapeHTML(iconPath(link.art))}"
            alt=""
            aria-hidden="true"
            loading="lazy"
            decoding="async"
          >
          <div class="rf-path-link-copy">
            <strong class="rf-path-frequency">${escapeHTML(link.frequency)}</strong>
            <span class="rf-path-polarity">${escapeHTML(link.polarity)}</span>
            <dl class="rf-path-specs">${renderSpecRows(link)}</dl>
          </div>
        </section>

        ${renderEndpoint(path.to, "is-to")}
      </article>
    `;
  }

  function renderSelectedPath() {
    const slot = document.querySelector(SLOT_SELECTOR);

    if (!slot) {
      return false;
    }

    slot.replaceChildren();
    slot.insertAdjacentHTML("beforeend", renderPathCard(SELECTED_PATH));
    slot.dataset.rfPathBuilderLoaded = "true";

    document.dispatchEvent(new CustomEvent("fieldops:rf-path-details-rendered", {
      detail: {
        version: VERSION,
        pathId: SELECTED_PATH.id
      }
    }));

    return true;
  }

  function initialise() {
    renderSelectedPath();
  }

  document.addEventListener(PANE_READY_EVENT, initialise);
  document.addEventListener("DOMContentLoaded", initialise);

  window.FieldOpsRFPathBuilder = {
    version: VERSION,
    renderSelectedPath
  };
})();

/* End of FieldOpsAtlas/Features/RF/rf-path-builder.js | bottom/end of file */
