/* ============================================================================
 FieldOps Atlas map shell guard
 Root file: FieldOpsAtlas/Features/Map/map-shell-guard.js
 Version: 1.1.1-map-shell-bridge-v11
 Purpose:
 - Bridge shared root shell events to map-owned UI/state.
 - Register visible walks with the shared shell search registry.
 - Keep old map chrome archived and inert without injecting a fallback shell.
 - Do not load shell assets, inject replacement shell markup, or touch map data.
 ============================================================================ */
(function () {
  "use strict";

  const VERSION = "1.1.1-map-shell-bridge-v11";
  const WORK_ONLINE_KEY = "fieldops-atlas-work-online";
  const MAP_SEARCH_PROVIDER_ID = "map-visible-walks";
  const LEGACY_CHROME_SELECTORS = [
    ".top-bar",
    ".top-filter-menu",
    ".top-region-tree",
    ".site-search-results",
    ".side-menu",
    ".menu-overlay",
    ".side-rail"
  ].join(",");

  function byId(id) {
    return document.getElementById(id);
  }

  function qs(selector, root) {
    return (root || document).querySelector(selector);
  }

  function isElement(value) {
    return value instanceof Element;
  }

  function shellRoot() {
    return qs(".app-shell") || qs(".phone") || document.body;
  }

  function mapBridge() {
    return window.FieldOpsAtlasBridge || null;
  }

  function safe(label, callback) {
    try {
      return callback();
    } catch (error) {
      if (window.console && typeof window.console.warn === "function") {
        window.console.warn("FieldOps map shell bridge skipped: " + label, error);
      }
      return null;
    }
  }

  function setExpanded(element, isExpanded) {
    if (element) element.setAttribute("aria-expanded", isExpanded ? "true" : "false");
  }

  function openHiddenMenu(menu) {
    if (!menu) return false;
    menu.hidden = false;
    menu.classList.add("is-open");
    menu.setAttribute("aria-hidden", "false");
    return true;
  }

  function closeHiddenMenu(menu) {
    if (!menu) return;
    menu.hidden = true;
    menu.classList.remove("is-open");
    menu.setAttribute("aria-hidden", "true");
  }

  function openPanel(panel) {
    if (!panel) return false;
    panel.hidden = false;
    panel.classList.remove("is-hidden");
    panel.classList.add("is-open");
    panel.setAttribute("aria-hidden", "false");
    return true;
  }

  function closeMapTools() {
    closeHiddenMenu(byId("railToolsMenu"));
    setExpanded(byId("railToolsButton"), false);
    setExpanded(byId("railMapButton"), false);
    shellRoot().dataset.mapToolsOpen = "false";
  }

  function setMapToolsOpen(isOpen) {
    const nextState = Boolean(isOpen);
    const menu = byId("railToolsMenu");
    if (!menu) return false;

    if (nextState) {
      openHiddenMenu(menu);
    } else {
      closeHiddenMenu(menu);
    }

    setExpanded(byId("railToolsButton"), nextState);
    setExpanded(byId("railMapButton"), nextState);
    shellRoot().dataset.mapToolsOpen = nextState ? "true" : "false";
    return true;
  }

  function closeOldFloatingMenus() {
    closeHiddenMenu(byId("topFilterMenu"));
    closeHiddenMenu(byId("topRegionTree"));
    closeMapTools();
    setExpanded(byId("fitMapBtn"), false);
    setExpanded(byId("topSelectRegionButton"), false);
  }

  function openOldTopRegionFilter() {
    const openedFilter = openHiddenMenu(byId("topFilterMenu"));
    const openedTree = openHiddenMenu(byId("topRegionTree"));
    setExpanded(byId("fitMapBtn"), openedFilter);
    setExpanded(byId("topSelectRegionButton"), openedTree);
    return openedFilter || openedTree;
  }

  function openMapRegionFilter() {
    closeMapTools();
    if (openPanel(byId("filterPanel"))) return;
    openOldTopRegionFilter();
  }

  function openMapSettings() {
    closeOldFloatingMenus();
    if (openPanel(byId("settingsPanel"))) return;
    const legacyButton = byId("menuSettingsButton");
    if (legacyButton) legacyButton.click();
  }

  function visibleWalks() {
    const bridge = mapBridge();
    if (!bridge || typeof bridge.getVisibleWalks !== "function") return [];
    const walks = bridge.getVisibleWalks();
    return Array.isArray(walks) ? walks : [];
  }

  function walkSubtitle(walk) {
    return [
      walk.regionName || walk.region || walk.regionId || "",
      walk.gridRef || walk.grid || "",
      walk.siteType || walk.type || "Walk"
    ].filter(Boolean).join(" Â· ");
  }

  function registerMapSearchProvider() {
    const walks = visibleWalks();
    const provider = {
      page: "map",
      id: MAP_SEARCH_PROVIDER_ID,
      label: "Map",
      placeholder: "Find walk",
      emptyText: walks.length ? "No matching walks." : "Pick a region to load walks.",
      items: walks.map(function (walk) {
        return {
          id: String(walk.id || walk.slug || walk.name || ""),
          title: String(walk.name || walk.title || "Unnamed walk"),
          subtitle: walkSubtitle(walk),
          keywords: [
            walk.id,
            walk.slug,
            walk.regionId,
            walk.region,
            walk.regionName,
            walk.gridRef,
            walk.grid,
            walk.what3words,
            walk.w3w,
            walk.notes,
            walk.siteType,
            walk.type
          ].filter(Boolean)
        };
      }).filter(function (item) {
        return item.id && item.title;
      })
    };

    if (window.FieldOpsSearch && typeof window.FieldOpsSearch.registerPage === "function") {
      window.FieldOpsSearch.registerPage(provider);
      return;
    }

    window.FieldOpsSearchQueue = window.FieldOpsSearchQueue || [];
    if (Array.isArray(window.FieldOpsSearchQueue)) window.FieldOpsSearchQueue.push(provider);
  }

  function scheduleMapSearchProviderRefresh() {
    window.requestAnimationFrame(registerMapSearchProvider);
  }

  function handleShellSearchSelect(event) {
    const detail = event.detail || {};
    const item = detail.item || {};
    const bridge = mapBridge();
    if (detail.page !== "map" || !item.id || !bridge || typeof bridge.selectWalk !== "function") return;
    bridge.selectWalk(item.id, true);
  }

  function currentWorkOnlineState() {
    const toggle = byId("workOnlineToggle") || byId("writeToggle");
    if (toggle) return Boolean(toggle.checked);
    return localStorage.getItem(WORK_ONLINE_KEY) === "true";
  }

  function publishWorkOnlineState() {
    window.dispatchEvent(new CustomEvent("fieldops:shell-work-online-state", {
      detail: { page: "map", online: currentWorkOnlineState(), version: VERSION }
    }));
  }

  function setMapWorkOnline(isOnline) {
    const nextState = Boolean(isOnline);
    const toggles = [byId("workOnlineToggle"), byId("writeToggle")].filter(Boolean);

    if (!toggles.length) {
      localStorage.setItem(WORK_ONLINE_KEY, String(nextState));
      publishWorkOnlineState();
      return;
    }

    toggles.forEach(function (toggle) {
      toggle.checked = nextState;
    });
    toggles[0].dispatchEvent(new Event("change", { bubbles: true }));
    publishWorkOnlineState();
  }

  function injectLegacyArchiveStyle() {
    if (byId("fieldops-map-legacy-shell-archive-style")) return;
    const style = document.createElement("style");
    style.id = "fieldops-map-legacy-shell-archive-style";
    style.textContent = LEGACY_CHROME_SELECTORS + " { display: none !important; }";
    document.head.appendChild(style);
  }

  function bindSharedShellBridge() {
    window.addEventListener("fieldops:shell-map-tools-toggle", function (event) {
      const detail = event.detail || {};
      if (detail.page !== "map") return;
      setMapToolsOpen(Boolean(detail.open));
    });

    window.addEventListener("fieldops:shell-filter-region", function (event) {
      const detail = event.detail || {};
      if (detail.page && detail.page !== "map") return;
      openMapRegionFilter();
    });

    window.addEventListener("fieldops:open-region-filter", openMapRegionFilter);
    window.addEventListener("fieldops:shell-search-select", handleShellSearchSelect);

    window.addEventListener("fieldops:shell-settings", function (event) {
      const detail = event.detail || {};
      if (detail.page && detail.page !== "map") return;
      openMapSettings();
    });

    window.addEventListener("fieldops:shell-work-online-toggle", function (event) {
      const detail = event.detail || {};
      if (detail.page !== "map") return;
      setMapWorkOnline(Boolean(detail.online));
    });

    window.addEventListener("fieldops-atlas-ready", scheduleMapSearchProviderRefresh);
    window.addEventListener("fieldops-atlas-walks-changed", scheduleMapSearchProviderRefresh);
    window.addEventListener("fieldops:map-shell-guard-refresh-search", scheduleMapSearchProviderRefresh);
    window.addEventListener("fieldops:shell-ready", function (event) {
      const detail = event.detail || {};
      if (detail.page === "map") {
        scheduleMapSearchProviderRefresh();
        publishWorkOnlineState();
      }
    });

    window.addEventListener("storage", function (event) {
      if (event.key === WORK_ONLINE_KEY) publishWorkOnlineState();
    });

    document.addEventListener("click", function (event) {
      const target = event.target;
      if (!isElement(target)) return;
      const shellClicked = target.closest(".top-shell, .bottom-shell, .drawer, .fieldops-shell-panel");
      const toolsClicked = target.closest("#railToolsMenu");
      if (!shellClicked && !toolsClicked) closeMapTools();
    }, true);
  }

  function boot() {
    const root = shellRoot();
    root.dataset.page = "map";
    root.dataset.currentPage = "map";
    document.documentElement.dataset.mapShellGuard = VERSION;

    injectLegacyArchiveStyle();
    bindSharedShellBridge();
    scheduleMapSearchProviderRefresh();
    window.setTimeout(registerMapSearchProvider, 250);
    window.setTimeout(registerMapSearchProvider, 900);
    window.setTimeout(registerMapSearchProvider, 1800);
    publishWorkOnlineState();

    window.dispatchEvent(new CustomEvent("fieldops:map-shell-guard-ready", {
      detail: { version: VERSION, mode: "bridge-only" }
    }));
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    safe("boot", boot);
  }
})();
