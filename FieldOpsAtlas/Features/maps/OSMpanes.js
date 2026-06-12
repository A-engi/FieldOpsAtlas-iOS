/* ==========================================================================
   FieldOps Atlas OSM panes
   File: FieldOpsAtlas/Features/maps/OSMpanes.js
   Version: 1.0.3
   Purpose:
   - Own Leaflet popup markup.
   - Own collapsed, expanded, and edit selected-walk pane markup.
   - Own temporary region-loaded toast markup.
   - Own details copy buttons.
   ========================================================================== */

(function fieldOpsOSMpanes() {
  "use strict";

  var copySvg = [
    '<span class="osmpanes-copy-icon" aria-hidden="true">',
    '<svg viewBox="0 0 24 24" focusable="false">',
    '<rect x="8" y="8" width="11" height="11" rx="2"></rect>',
    '<path d="M5 15H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1"></path>',
    '</svg>',
    '</span>'
  ].join("");

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

  function valueOrFallback(value, fallback) {
    var text = String(value == null ? "" : value).trim();
    return text || fallback;
  }

  function asList(value) {
    if (Array.isArray(value)) {
      return value
        .map(function mapItem(item) {
          if (typeof item === "string") {
            return item.trim();
          }

          if (item && typeof item === "object") {
            return String(item.name || item.label || item.title || item.service || item.id || "").trim();
          }

          return "";
        })
        .filter(Boolean);
    }

    if (typeof value === "string" && value.trim()) {
      return value.split(/[,;\n]/).map(function splitLine(item) {
        return item.trim();
      }).filter(Boolean);
    }

    return [];
  }

  function editMode() {
    if (window.FieldOpsEditor && typeof window.FieldOpsEditor.getMode === "function") {
      return window.FieldOpsEditor.getMode();
    }

    return "offline";
  }

  function modePillHtml() {
    var mode = editMode();
    return '<span class="osmpanes-mode-pill" data-mode="' + escapeHtml(mode) + '">' + escapeHtml(mode) + '</span>';
  }

  function formatCoordinates(walk) {
    var lat = Number(walk && walk.lat);
    var lng = Number(walk && walk.lng);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return "No coordinates recorded.";
    }

    return "(" + lat.toFixed(7) + ", " + lng.toFixed(7) + ")";
  }

  function listHtml(items, fallback) {
    var list = asList(items);

    if (!list.length) {
      return '<p class="osmpanes-line">' + escapeHtml(fallback) + '</p>';
    }

    return '<ul class="osmpanes-list">' + list.map(function renderItem(item) {
      return '<li>' + escapeHtml(item) + '</li>';
    }).join("") + '</ul>';
  }

  function sectionHtml(title, bodyHtml) {
    return [
      '<section class="osmpanes-section">',
      '<h3 class="osmpanes-section-title">',
      escapeHtml(title),
      '</h3>',
      bodyHtml,
      '</section>'
    ].join("");
  }

  function copyRowHtml(label, value) {
    return sectionHtml(label, [
      '<div class="osmpanes-copy-row">',
      '<span class="osmpanes-value">',
      escapeHtml(value),
      '</span>',
      '<button class="osmpanes-icon-button" type="button" data-copy-value="',
      escapeHtml(value),
      '" aria-label="Copy ',
      escapeHtml(label),
      '">',
      copySvg,
      '</button>',
      '</div>'
    ].join(""));
  }

  function popupHtml(walk) {
    return [
      '<article class="osmpanes-popup">',
      '<h2 class="osmpanes-popup-title">',
      escapeHtml(walk.name),
      '</h2>',
      '<div class="osmpanes-popup-actions">',
      '<button class="osmpanes-popup-button" type="button" data-open-details="',
      escapeHtml(walk.id),
      '">Details</button>',
      '<button class="osmpanes-popup-button" type="button" data-edit-walk="',
      escapeHtml(walk.id),
      '">Edit</button>',
      '</div>',
      '</article>'
    ].join("");
  }

  function emptyPaneHtml() {
    return [
      '<div class="osmpanes-title-row">',
      '<p class="osmpanes-empty">Pick a region to load walks.</p>',
      '<button class="osmpanes-button" type="button" data-region-open>Region</button>',
      '</div>'
    ].join("");
  }

  function regionToastHtml(region, walkCount) {
    return [
      '<div class="osmpanes-title-row">',
      '<div>',
      '<h2 class="osmpanes-title">',
      escapeHtml(region.name),
      '</h2>',
      '<p class="osmpanes-subtitle">',
      Number(walkCount || 0),
      ' walks loaded',
      '</p>',
      '</div>',
      modePillHtml(),
      '</div>'
    ].join("");
  }

  function collapsedWalkHtml(walk) {
    return [
      '<div class="osmpanes-title-row osmpanes-title-row--three">',
      '<h2 class="osmpanes-title">',
      escapeHtml(walk.name),
      '</h2>',
      '<button class="osmpanes-button" type="button" data-expand-details="',
      escapeHtml(walk.id),
      '">Expand</button>',
      '<button class="osmpanes-button osmpanes-button--quiet" type="button" data-close-pane>Close</button>',
      '</div>'
    ].join("");
  }

  function regionSectionHtml(region) {
    if (!region) {
      return sectionHtml("Region", '<p class="osmpanes-line">No region recorded.</p>');
    }

    return sectionHtml("Region", [
      '<p class="osmpanes-line">',
      escapeHtml(region.name),
      '</p>',
      region.notes ? '<p class="osmpanes-line">' + escapeHtml(region.notes) + '</p>' : "",
      region.id ? '<p class="osmpanes-line">ID: ' + escapeHtml(region.id) + '</p>' : ""
    ].join(""));
  }

  function hasWalkthrough(walkthrough) {
    if (!walkthrough || typeof walkthrough !== "object") {
      return false;
    }

    return Boolean(
      String(walkthrough.type || "").trim() ||
      String(walkthrough.url || "").trim() ||
      String(walkthrough.notes || "").trim()
    );
  }

  function optionalExtraSections(walk) {
    var sections = [];

    if (asList(walk.inputs).length) {
      sections.push(sectionHtml("Inputs", listHtml(walk.inputs, "No inputs recorded.")));
    }

    if (asList(walk.equipment).length) {
      sections.push(sectionHtml("Equipment", listHtml(walk.equipment, "No equipment recorded.")));
    }

    if (hasWalkthrough(walk.walkthrough)) {
      sections.push(sectionHtml("Walkthrough", [
        walk.walkthrough.type ? '<p class="osmpanes-line">Type: ' + escapeHtml(walk.walkthrough.type) + '</p>' : "",
        walk.walkthrough.url ? '<p class="osmpanes-line">URL: ' + escapeHtml(walk.walkthrough.url) + '</p>' : "",
        walk.walkthrough.notes ? '<p class="osmpanes-line">' + escapeHtml(walk.walkthrough.notes) + '</p>' : ""
      ].join("")));
    }

    return sections.join("");
  }

  function detailsPaneHtml(walk, region, options) {
    var coordinates = formatCoordinates(walk);
    var what3words = valueOrFallback(walk.what3words, "No w3w recorded.");
    var accessLines = [
      walk.accessNotes,
      walk.address,
      walk.gridRef ? "Grid: " + walk.gridRef : ""
    ].filter(function onlyText(item) {
      return String(item || "").trim();
    });
    var notes = valueOrFallback(walk.notes || walk.description, "No notes recorded.");
    var weatherText = valueOrFallback(options && options.weatherText, "Weather not loaded.");
    var alerts = walk.alerts && walk.alerts.length ? walk.alerts : [];

    return [
      '<article>',
      '<div class="osmpanes-title-row osmpanes-title-row--three">',
      '<h2 class="osmpanes-title">',
      escapeHtml(walk.name),
      '</h2>',
      modePillHtml(),
      '<button class="osmpanes-button osmpanes-button--quiet" type="button" data-close-pane>Close</button>',
      '</div>',
      '<div class="osmpanes-grid">',
      regionSectionHtml(region),
      copyRowHtml("Coordinates", coordinates),
      copyRowHtml("w3w", what3words),
      sectionHtml("Access info", accessLines.length ? listHtml(accessLines, "No access info recorded.") : '<p class="osmpanes-line">No access info recorded.</p>'),
      sectionHtml("Services", listHtml(walk.services, "No services recorded.")),
      optionalExtraSections(walk),
      sectionHtml("Weather", [
        '<div class="osmpanes-actions">',
        '<button class="osmpanes-button" type="button" data-load-weather="',
        escapeHtml(walk.id),
        '">Weather</button>',
        '<p class="osmpanes-weather-output" data-weather-output>',
        escapeHtml(weatherText),
        '</p>',
        '</div>'
      ].join("")),
      sectionHtml("Alerts", listHtml(alerts, "No active alerts.")),
      sectionHtml("Notes", '<p class="osmpanes-line">' + escapeHtml(notes) + '</p>'),
      '<div class="osmpanes-actions">',
      '<button class="osmpanes-button" type="button" data-collapse-details="',
      escapeHtml(walk.id),
      '">Collapse</button>',
      '<button class="osmpanes-button" type="button" data-edit-walk="',
      escapeHtml(walk.id),
      '">Edit</button>',
      '</div>',
      '</div>',
      '</article>'
    ].join("");
  }

  function fieldHtml(name, label, value, full, textarea) {
    var tag = textarea ? "textarea" : "input";
    var fullClass = full ? " osmpanes-edit-field--full" : "";
    var attrs = textarea ? "" : ' type="text"';

    return [
      '<label class="osmpanes-edit-field',
      fullClass,
      '">',
      '<span>',
      escapeHtml(label),
      '</span>',
      '<',
      tag,
      attrs,
      ' name="',
      escapeHtml(name),
      '">',
      textarea ? escapeHtml(value || "") + '</textarea>' : escapeHtml(value || "") + '</input>',
      '</label>'
    ].join("").replace(/<input([^>]*)>(.*?)<\/input>/g, '<input$1 value="$2">');
  }

  function editPaneHtml(walk, region, statusText) {
    var walkthrough = walk.walkthrough || {};
    return [
      '<article>',
      '<div class="osmpanes-title-row osmpanes-title-row--three">',
      '<h2 class="osmpanes-title">Edit ',
      escapeHtml(walk.name),
      '</h2>',
      modePillHtml(),
      '<button class="osmpanes-button osmpanes-button--quiet" type="button" data-edit-cancel="',
      escapeHtml(walk.id),
      '">Close</button>',
      '</div>',
      '<form class="osmpanes-edit-form" data-edit-form data-walk-id="',
      escapeHtml(walk.id),
      '" data-region-id="',
      escapeHtml(region ? region.id : walk.regionId),
      '">',
      '<p class="osmpanes-edit-note" data-edit-status>',
      escapeHtml(statusText || ""),
      '</p>',
      '<div class="osmpanes-edit-grid">',
      fieldHtml("name", "Name", walk.name, true, false),
      fieldHtml("siteType", "Type", walk.siteType, false, false),
      fieldHtml("status", "Status", walk.status, false, false),
      fieldHtml("lat", "Latitude", walk.lat, false, false),
      fieldHtml("lng", "Longitude", walk.lng, false, false),
      fieldHtml("what3words", "w3w", walk.what3words, true, false),
      fieldHtml("gridRef", "Grid ref", walk.gridRef, true, false),
      fieldHtml("address", "Address", walk.address, true, true),
      fieldHtml("accessNotes", "Access info", walk.accessNotes, true, true),
      fieldHtml("services", "Services", asList(walk.services).join("\\n"), true, true),
      fieldHtml("alerts", "Alerts", asList(walk.alerts).join("\\n"), true, true),
      fieldHtml("inputs", "Inputs", asList(walk.inputs).join("\\n"), true, true),
      fieldHtml("equipment", "Equipment", asList(walk.equipment).join("\\n"), true, true),
      fieldHtml("walkthroughType", "Walkthrough type", walkthrough.type, false, false),
      fieldHtml("walkthroughUrl", "Walkthrough URL", walkthrough.url, false, false),
      fieldHtml("walkthroughNotes", "Walkthrough notes", walkthrough.notes, true, true),
      fieldHtml("description", "Description", walk.description, true, true),
      fieldHtml("notes", "Notes", walk.notes, true, true),
      '</div>',
      '<div class="osmpanes-edit-actions">',
      '<button class="osmpanes-button" type="submit" data-edit-save>Save</button>',
      '<button class="osmpanes-button osmpanes-button--danger" type="button" data-edit-delete="',
      escapeHtml(walk.id),
      '">Delete</button>',
      '<button class="osmpanes-button osmpanes-button--quiet" type="button" data-edit-cancel="',
      escapeHtml(walk.id),
      '">Cancel</button>',
      '</div>',
      '</form>',
      '</article>'
    ].join("");
  }

  function render(panel, mode, html) {
    if (!panel) {
      return;
    }

    panel.hidden = false;
    panel.dataset.paneMode = mode;
    panel.innerHTML = html;
  }

  function hide(panel) {
    if (!panel) {
      return;
    }

    panel.hidden = true;
    panel.removeAttribute("data-pane-mode");
    panel.innerHTML = "";
  }

  function renderEmpty(panel) {
    render(panel, "empty", emptyPaneHtml());
  }

  function renderRegionToast(panel, region, walkCount) {
    if (!region) {
      renderEmpty(panel);
      return;
    }

    render(panel, "toast", regionToastHtml(region, walkCount));
  }

  function renderCollapsed(panel, walk) {
    if (!walk) {
      renderEmpty(panel);
      return;
    }

    render(panel, "collapsed", collapsedWalkHtml(walk));
  }

  function renderDetails(panel, walk, region, options) {
    if (!walk) {
      renderEmpty(panel);
      return;
    }

    render(panel, "details", detailsPaneHtml(walk, region, options || {}));
  }

  function renderEdit(panel, walk, region, statusText) {
    if (!walk) {
      renderEmpty(panel);
      return;
    }

    render(panel, "edit", editPaneHtml(walk, region, statusText));
  }

  function setWeatherText(message) {
    var output = document.querySelector("[data-weather-output]");
    if (output) {
      output.textContent = message;
    }
  }

  function setEditStatus(message) {
    var output = document.querySelector("[data-edit-status]");
    if (output) {
      output.textContent = message;
    }
  }

  function copyText(value) {
    var text = String(value || "");

    if (!text) {
      return Promise.resolve(false);
    }

    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(function copied() {
        return true;
      });
    }

    var input = document.createElement("textarea");
    input.value = text;
    input.setAttribute("readonly", "");
    input.style.position = "fixed";
    input.style.top = "-1000px";
    document.body.appendChild(input);
    input.select();

    try {
      document.execCommand("copy");
      return Promise.resolve(true);
    } catch (error) {
      return Promise.resolve(false);
    } finally {
      input.remove();
    }
  }

  document.addEventListener("click", function onDocumentClick(event) {
    var copyButton = event.target.closest("[data-copy-value]");

    if (!copyButton) {
      return;
    }

    copyText(copyButton.getAttribute("data-copy-value")).then(function copied() {
      copyButton.setAttribute("aria-label", copied ? "Copied" : "Copy failed");
      copyButton.dataset.copied = copied ? "true" : "false";

      window.setTimeout(function resetCopyLabel() {
        copyButton.removeAttribute("data-copied");
      }, 900);
    });
  });

  window.FieldOpsOSMpanes = {
    popupHtml: popupHtml,
    renderEmpty: renderEmpty,
    renderRegionToast: renderRegionToast,
    renderCollapsed: renderCollapsed,
    renderDetails: renderDetails,
    renderEdit: renderEdit,
    setWeatherText: setWeatherText,
    setEditStatus: setEditStatus,
    formatCoordinates: formatCoordinates,
    hide: hide
  };
}());
