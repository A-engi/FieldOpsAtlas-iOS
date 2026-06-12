/* ==========================================================================
   FieldOps Atlas map-ui.js
   Root file: FieldOpsAtlas/Features/Map/map-ui.js
   Version: 1.1.6-force-retire-legacy-map-shell

   Purpose:
   - Keep map-app.js as the owner of map creation, region loading, markers,
     search data, selected-walk state, and GitHub write workflows.
   - Load the shared root shell from the map page.
   - Load the bridge-only map shell guard after the root shell request.
   - Hide duplicate legacy Map chrome immediately, then let the guard keep it
     retired after shell injection/mutations.
   - Keep essential late UI bridge behaviours alive while the map shell is
     handed over.
   - Do not inject fallback top/bottom shell UI.
   - Do not preload Weather Mode panel markup.
   ========================================================================== */

(function fieldOpsMapUi() {
  "use strict";

  var UI_VERSION = "1.1.6-force-retire-legacy-map-shell";
  var SHARED_SHELL_VERSION = "1.1.15-rf-width-root-shell";
  var MAP_SHELL_GUARD_VERSION = "1.1.3-force-retire-map-legacy-shell";
  var WEATHER_PANEL_VERSION = "1.1.1-lazy-weather-v1";

  var loadedAssets = Object.create(null);
  var weatherPanelReadyPromise = null;

  var LEGACY_SHELL_SELECTORS = [
    ".top-bar",
    "#topBarFade",
    "#topFilterMenu",
    "#topRegionTree",
    "#menuOverlay",
    "#sideMenu",
    ".side-rail",
    "#railToolsMenu"
  ];

  function byId(id) {
    return document.getElementById(id);
  }

  function qs(selector, root) {
    return (root || document).querySelector(selector);
  }

  function qsa(selector, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(selector));
  }

  function onReady(callback) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", callback, { once: true });
      return;
    }

    callback();
  }

  function on(target, eventName, callback, options) {
    if (!target) {
      return;
    }

    target.addEventListener(eventName, callback, options || false);
  }

  function safe(label, callback) {
    try {
      callback();
    } catch (error) {
      if (window.console && typeof window.console.warn === "function") {
        window.console.warn("FieldOps Atlas map UI skipped: " + label, error);
      }
    }
  }

  function assetUrl(path) {
    return new URL(path, window.location.href).href;
  }

  function cacheBust(url, version) {
    var nextUrl = new URL(url, window.location.href);
    nextUrl.searchParams.set("v", version);
    return nextUrl.href;
  }

  function sameAsset(left, right) {
    return (
      new URL(left, window.location.href).href.split("?")[0] ===
      new URL(right, window.location.href).href.split("?")[0]
    );
  }

  function existingStylesheet(href) {
    return qsa('link[rel="stylesheet"][href]').find(function findExistingStylesheet(link) {
      return sameAsset(link.href, href);
    }) || null;
  }

  function existingScript(src) {
    return qsa("script[src]").find(function findExistingScript(script) {
      return sameAsset(script.src, src);
    }) || null;
  }

  function loadStylesheet(path, version) {
    var href = assetUrl(path);
    var existing = existingStylesheet(href);

    if (existing) {
      existing.href = cacheBust(href, version);
      existing.dataset.fieldopsMapUiLoader = UI_VERSION;
      existing.dataset.fieldopsMapUiRequestedVersion = version;
      return Promise.resolve("updated-existing");
    }

    if (loadedAssets[href]) {
      return Promise.resolve("already-requested");
    }

    loadedAssets[href] = true;

    return new Promise(function createStylesheet(resolve) {
      var link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = cacheBust(href, version);
      link.dataset.fieldopsMapUiLoader = UI_VERSION;
      link.dataset.fieldopsMapUiRequestedVersion = version;

      link.addEventListener("load", function onLoad() {
        resolve("loaded");
      }, { once: true });

      link.addEventListener("error", function onError() {
        resolve("error");
      }, { once: true });

      document.head.appendChild(link);
    });
  }

  function loadScript(path, version) {
    var src = assetUrl(path);
    var existing = existingScript(src);

    if (existing && existing.dataset.fieldopsMapUiRequestedVersion === version) {
      return Promise.resolve("already-loaded");
    }

    if (loadedAssets[src]) {
      return Promise.resolve("already-requested");
    }

    loadedAssets[src] = true;

    return new Promise(function createScript(resolve) {
      var script = document.createElement("script");
      script.src = cacheBust(src, version);
      script.defer = true;
      script.dataset.fieldopsMapUiLoader = UI_VERSION;
      script.dataset.fieldopsMapUiRequestedVersion = version;

      script.addEventListener("load", function onLoad() {
        resolve("loaded");
      }, { once: true });

      script.addEventListener("error", function onError() {
        resolve("error");
      }, { once: true });

      document.body.appendChild(script);
    });
  }

  function removeDiagnosticBadge() {
    var badge = byId("fieldopsMapShellDiagnostics");

    if (badge && badge.parentNode) {
      badge.parentNode.removeChild(badge);
    }

    delete document.documentElement.dataset.mapUiDiagnostic;
    delete document.documentElement.dataset.mapUiDiagnostics;
  }

  function forceHideLegacyElement(element) {
    if (!element) {
      return;
    }

    element.dataset.fieldopsMapUiRetired = UI_VERSION;
    element.setAttribute("aria-hidden", "true");
    element.hidden = true;
    element.classList.remove("is-open", "open", "active", "is-active");
    element.style.setProperty("display", "none", "important");
    element.style.setProperty("visibility", "hidden", "important");
    element.style.setProperty("pointer-events", "none", "important");
  }

  function injectLegacyRetireStyle() {
    if (byId("fieldopsMapUiLegacyRetireStyle")) {
      return;
    }

    var style = document.createElement("style");
    style.id = "fieldopsMapUiLegacyRetireStyle";
    style.textContent = [
      'html[data-map-ui-legacy-shell-retired="true"] .top-bar',
      'html[data-map-ui-legacy-shell-retired="true"] #topBarFade',
      'html[data-map-ui-legacy-shell-retired="true"] #topFilterMenu',
      'html[data-map-ui-legacy-shell-retired="true"] #topRegionTree',
      'html[data-map-ui-legacy-shell-retired="true"] #menuOverlay',
      'html[data-map-ui-legacy-shell-retired="true"] #sideMenu',
      'html[data-map-ui-legacy-shell-retired="true"] .side-rail',
      'html[data-map-ui-legacy-shell-retired="true"] #railToolsMenu',
      '.top-bar[data-fieldops-map-ui-retired]',
      '#topBarFade[data-fieldops-map-ui-retired]',
      '#topFilterMenu[data-fieldops-map-ui-retired]',
      '#topRegionTree[data-fieldops-map-ui-retired]',
      '#menuOverlay[data-fieldops-map-ui-retired]',
      '#sideMenu[data-fieldops-map-ui-retired]',
      '.side-rail[data-fieldops-map-ui-retired]',
      '#railToolsMenu[data-fieldops-map-ui-retired]',
      '{',
      '  display: none !important;',
      '  visibility: hidden !important;',
      '  pointer-events: none !important;',
      '}'
    ].join("\n");

    document.head.appendChild(style);
  }

  function retireLegacyShell() {
    injectLegacyRetireStyle();
    document.documentElement.dataset.mapUiLegacyShellRetired = "true";

    LEGACY_SHELL_SELECTORS.forEach(function retireSelector(selector) {
      qsa(selector).forEach(forceHideLegacyElement);
    });
  }

  function observeLegacyShell() {
    if (!("MutationObserver" in window)) {
      return;
    }

    var observer = new MutationObserver(function onMutation() {
      retireLegacyShell();
    });

    observer.observe(document.documentElement, {
      attributes: true,
      childList: true,
      subtree: true
    });
  }

  function showToast(message) {
    var toast = byId("statusToast");

    if (!toast) {
      return;
    }

    toast.textContent = message;
    toast.classList.add("show", "is-visible");

    window.clearTimeout(showToast._timer);
    showToast._timer = window.setTimeout(function hideToast() {
      toast.classList.remove("show", "is-visible");
    }, 1800);
  }

  function getBridge() {
    window.FieldOpsAtlasBridge = window.FieldOpsAtlasBridge || {};
    return window.FieldOpsAtlasBridge;
  }

  function getSelectedWalk() {
    var bridge = getBridge();

    if (bridge && typeof bridge.getSelectedWalk === "function") {
      return bridge.getSelectedWalk();
    }

    return null;
  }

  function getVisibleWalks() {
    var bridge = getBridge();

    if (bridge && typeof bridge.getVisibleWalks === "function") {
      return bridge.getVisibleWalks() || [];
    }

    return [];
  }

  function setPanelVisible(panel, visible) {
    if (!panel) {
      return;
    }

    panel.hidden = false;
    panel.classList.toggle("is-hidden", !visible);
    panel.classList.toggle("is-open", Boolean(visible));
    panel.setAttribute("aria-hidden", visible ? "false" : "true");
  }

  function isPanelVisible(panel) {
    return Boolean(panel) &&
      !panel.classList.contains("is-hidden") &&
      panel.getAttribute("aria-hidden") !== "true";
  }

  function closeOtherPanels(exceptId) {
    ["weatherModePanel", "fieldNotesPanel"].forEach(function closePanel(id) {
      if (id !== exceptId) {
        setPanelVisible(byId(id), false);
      }
    });
  }

  function setText(id, value) {
    var element = byId(id);

    if (element) {
      element.textContent = value;
    }
  }

  function setSelectedWeatherPending() {
    setText("selectedSitePressureMemo", "Weather is paused. Use Weather Mode > Refresh forecasts.");
    setText("selectedSiteWindMemo", "No automatic forecast fetch on marker/detail open.");
    setText("selectedSiteLightningMemo", "Open Weather Mode for manual strike links.");
  }

  function wireWeatherModePanel(panel) {
    if (!panel || panel.dataset.fieldopsWeatherPanelWired === UI_VERSION) {
      return;
    }

    panel.dataset.fieldopsWeatherPanelWired = UI_VERSION;

    on(byId("closeWeatherModePanelButton") || byId("closeWeatherModeButton"), "click", closeWeatherMode);
    on(byId("weatherSitesRefreshButton") || byId("refreshVisibleWeatherButton"), "click", refreshWeatherMode);

    [
      "weatherOverlayAllButton",
      "weatherOverlayWatchButton",
      "weatherOverlayHighButton",
      "weatherOverlayClearButton",
      "weatherOverlayFitButton",
      "saveMetOfficeWarningsButton",
      "checkMetOfficeWarningsButton",
      "clearMetOfficeWarningsButton",
      "metOfficeWarningsSaveButton",
      "metOfficeWarningsCheckButton",
      "metOfficeWarningsClearButton",
      "saveDnoPowerButton",
      "openDnoPowerButton",
      "clearDnoPowerButton",
      "dnoPowerSaveButton",
      "dnoPowerOpenButton",
      "dnoPowerClearButton"
    ].forEach(function bindToastButton(id) {
      on(byId(id), "click", function handleUtilityClick() {
        showToast("Map UI active");
      });
    });
  }

  function ensureWeatherModePanel() {
    var existingPanel = byId("weatherModePanel");

    if (existingPanel) {
      wireWeatherModePanel(existingPanel);
      return Promise.resolve(existingPanel);
    }

    if (weatherPanelReadyPromise) {
      return weatherPanelReadyPromise;
    }

    weatherPanelReadyPromise = loadScript("./weather-mode-panel.js", WEATHER_PANEL_VERSION)
      .then(function initialiseWeatherPanel() {
        var weatherMode = window.FieldOpsAtlasWeatherMode;

        if (!weatherMode || typeof weatherMode.ensurePanel !== "function") {
          throw new Error("weather-mode-panel.js loaded but did not expose FieldOpsAtlasWeatherMode.ensurePanel");
        }

        return weatherMode.ensurePanel();
      })
      .then(function wirePanel(panel) {
        wireWeatherModePanel(panel);
        return panel;
      })
      .catch(function handleWeatherPanelError(error) {
        weatherPanelReadyPromise = null;

        if (window.console && typeof window.console.warn === "function") {
          window.console.warn("FieldOps Atlas Weather Mode failed to initialise", error);
        }

        showToast("Weather Mode failed to load");
        return null;
      });

    return weatherPanelReadyPromise;
  }

  function openWeatherMode() {
    var weatherButton = byId("weatherModeButton");

    if (weatherButton) {
      weatherButton.setAttribute("aria-busy", "true");
    }

    ensureWeatherModePanel().then(function showWeatherPanel(panel) {
      if (!panel) {
        if (weatherButton) {
          weatherButton.setAttribute("aria-busy", "false");
        }
        return;
      }

      closeOtherPanels("weatherModePanel");
      setPanelVisible(panel, true);

      if (weatherButton) {
        weatherButton.setAttribute("aria-pressed", "true");
        weatherButton.setAttribute("aria-busy", "false");
      }

      if (getSelectedWalk()) {
        setSelectedWeatherPending();
      }

      refreshWeatherMode();
    });
  }

  function closeWeatherMode() {
    var weatherButton = byId("weatherModeButton");

    setPanelVisible(byId("weatherModePanel"), false);

    if (weatherButton) {
      weatherButton.setAttribute("aria-pressed", "false");
      weatherButton.setAttribute("aria-busy", "false");
    }
  }

  function refreshWeatherMode() {
    var walks = getVisibleWalks();
    var list = byId("visibleWeatherSiteList");
    var message = walks.length
      ? "Weather refresh is parked during shell handoff. Visible walks: " + walks.length + "."
      : "No visible walks are loaded yet.";

    if (list) {
      list.innerHTML = "";
      var item = document.createElement("p");
      item.className = "visible-weather-empty";
      item.textContent = message;
      list.appendChild(item);
    }

    setText("weatherOverlayStatus", message);
  }

  function openFieldNotesPanel() {
    closeOtherPanels("fieldNotesPanel");
    setPanelVisible(byId("fieldNotesPanel"), true);
  }

  function closeFieldNotesPanel() {
    setPanelVisible(byId("fieldNotesPanel"), false);
  }

  function setInfoPanelExpanded(expanded) {
    var panel = byId("infoPanel");
    var button = byId("expandInfoButton");

    if (!panel) {
      return;
    }

    panel.style.transform = "";
    panel.classList.remove("is-hidden", "is-dragging", "dragging", "is-collapsed");
    panel.classList.add("is-open");
    panel.setAttribute("aria-hidden", "false");

    if (expanded) {
      panel.classList.remove("collapsed");
      panel.classList.add("is-expanded");
    } else {
      panel.classList.remove("is-expanded");
      panel.classList.add("collapsed");
    }

    if (button) {
      button.textContent = expanded ? "Minimise" : "Expand";
      button.setAttribute("aria-expanded", expanded ? "true" : "false");
    }
  }

  function wireDetailsPanelDrag() {
    var panel = byId("infoPanel");
    var handle = byId("infoPanelDragTarget");

    if (!panel || !handle || !window.PointerEvent || handle.dataset.fieldopsMapUiDrag === UI_VERSION) {
      return;
    }

    handle.dataset.fieldopsMapUiDrag = UI_VERSION;

    var drag = null;

    function finishDrag(event) {
      if (!drag || event.pointerId !== drag.pointerId) {
        return;
      }

      var deltaY = drag.lastY - drag.startY;
      var moved = drag.moved || Math.abs(deltaY) > 10;

      try {
        handle.releasePointerCapture(drag.pointerId);
      } catch (error) {
        /* Pointer capture can already be released by the browser. */
      }

      drag = null;
      panel.classList.remove("is-dragging", "dragging");

      if (!moved) {
        return;
      }

      if (deltaY <= -28) {
        setInfoPanelExpanded(true);
      } else if (deltaY >= 28) {
        setInfoPanelExpanded(false);
      }
    }

    on(handle, "pointerdown", function handlePointerDown(event) {
      if (!isPanelVisible(panel)) {
        return;
      }

      drag = {
        pointerId: event.pointerId,
        startY: event.clientY,
        lastY: event.clientY,
        moved: false
      };

      panel.classList.add("is-dragging");
      handle.setPointerCapture(event.pointerId);
    });

    on(handle, "pointermove", function handlePointerMove(event) {
      if (!drag || event.pointerId !== drag.pointerId) {
        return;
      }

      drag.lastY = event.clientY;

      if (Math.abs(drag.lastY - drag.startY) > 10) {
        drag.moved = true;
      }
    });

    on(handle, "pointerup", finishDrag);
    on(handle, "pointercancel", finishDrag);
  }

  function closeGuardMapToolsPanel() {
    var panel = byId("mapToolsPanel");

    if (panel) {
      panel.hidden = true;
    }
  }

  function wireShellEvents() {
    if (window.__fieldopsMapUiShellEventsVersion === UI_VERSION) {
      return;
    }

    window.__fieldopsMapUiShellEventsVersion = UI_VERSION;

    window.addEventListener("fieldops:shell-search-open", closeGuardMapToolsPanel);
    window.addEventListener("fieldops:shell-filter-region", closeGuardMapToolsPanel);
    window.addEventListener("fieldops:map-shell-guard-ready", retireLegacyShell);
  }

  function wireButtons() {
    on(byId("weatherModeButton"), "click", function handleWeatherModeClick() {
      var panel = byId("weatherModePanel");

      if (isPanelVisible(panel)) {
        closeWeatherMode();
      } else {
        openWeatherMode();
      }
    });

    on(byId("openFieldNotesButton"), "click", openFieldNotesPanel);
    on(byId("closeFieldNotesButton"), "click", closeFieldNotesPanel);

    on(byId("expandInfoButton"), "click", function handleExpandClick() {
      var panel = byId("infoPanel");
      var isExpanded = Boolean(panel && panel.classList.contains("is-expanded"));
      setInfoPanelExpanded(!isExpanded);
    });

    [
      "saveFieldNoteButton",
      "clearFieldNoteButton",
      "clearAllFieldNotesButton"
    ].forEach(function bindToast(id) {
      on(byId(id), "click", function handleUtilityClick() {
        showToast("Map UI active");
      });
    });
  }

  function updateBridge() {
    var bridge = getBridge();

    bridge.mapUiVersion = UI_VERSION;
    bridge.refreshWeatherMode = refreshWeatherMode;
    bridge.openWeatherMode = openWeatherMode;
    bridge.closeWeatherMode = closeWeatherMode;
    bridge.openFieldNotes = openFieldNotesPanel;
    bridge.closeFieldNotes = closeFieldNotesPanel;
    bridge.retireLegacyShell = retireLegacyShell;
  }

  function loadShellAssets() {
    return loadStylesheet("../../../shell.css", SHARED_SHELL_VERSION)
      .then(function loadSharedShellScript() {
        return loadScript("../../../shell.js", SHARED_SHELL_VERSION);
      })
      .then(function loadMapGuard() {
        return loadScript("./map-shell-guard.js", MAP_SHELL_GUARD_VERSION);
      })
      .then(function notifyShellLoaderReady() {
        retireLegacyShell();

        window.dispatchEvent(new CustomEvent("fieldops:map-ui-shell-loader-ready", {
          detail: {
            version: UI_VERSION,
            shellVersion: SHARED_SHELL_VERSION,
            guardVersion: MAP_SHELL_GUARD_VERSION
          }
        }));
      });
  }

  function markBody() {
    document.documentElement.dataset.mapUiVersion = UI_VERSION;
    document.documentElement.dataset.mapUiShellLoader = "true";
    document.documentElement.dataset.mapUiShellVersion = SHARED_SHELL_VERSION;
    document.documentElement.dataset.mapUiGuardVersion = MAP_SHELL_GUARD_VERSION;
    document.documentElement.dataset.mapUiDiagnostics = "false";
  }

  function boot() {
    markBody();
    removeDiagnosticBadge();
    retireLegacyShell();
    updateBridge();

    safe("legacy shell observer", observeLegacyShell);
    safe("shared shell loader", function loadShell() {
      loadShellAssets();
    });
    safe("button wiring", wireButtons);
    safe("shell event bridge", wireShellEvents);
    safe("details panel drag", wireDetailsPanelDrag);

    window.setTimeout(retireLegacyShell, 0);
    window.setTimeout(retireLegacyShell, 100);
    window.setTimeout(retireLegacyShell, 500);
    window.setTimeout(retireLegacyShell, 1200);
  }

  onReady(boot);
}());
