/* ============================================================================
 FieldOps Atlas shared shell
 Root file: shell.js
 Version: 1.1.1-shell-v2.6-map-event-bridge
 Purpose:
 - Own shared shell state: top controls, drawer, search, work-online toggle, and bottom nav.
 - Keep map state owned by the Map feature and communicate through custom events.
 - Let active Map bottom-nav presses open/toggle map tools through the bridge event.
 ============================================================================ */
(function () {
  "use strict";

  const VERSION = "1.1.1-shell-v2.6-map-event-bridge";
  const SHELL_ROOT_SELECTOR = ".app-shell, .phone";
  const DEFAULT_PAGE = "map";
  const MAX_SEARCH_RESULTS = 12;
  const WORK_ONLINE_KEY = "fieldops-atlas-work-online";

  const pages = {
    map: {
      label: "Map",
      navLabel: "Map",
      icon: "icon--map",
      href: "FieldOpsAtlas/Features/Map/index.html",
    },
    rf: {
      label: "RF",
      navLabel: "RF",
      icon: "icon--rf",
      href: "FieldOpsAtlas/Features/RF/index.html",
    },
    network: {
      label: "Network",
      navLabel: "Net",
      icon: "icon--network",
      href: "FieldOpsAtlas/Features/Network/index.html",
    },
    docs: {
      label: "Docs",
      navLabel: "Docs",
      icon: "icon--docs",
      href: "FieldOpsAtlas/Features/Docs/index.html",
    },
    tools: {
      label: "Tools",
      navLabel: "Tool",
      icon: "icon--tools",
      href: "FieldOpsAtlas/Features/Tools/index.html",
    },
  };

  const pageOrder = ["map", "rf", "network", "docs", "tools"];
  const searchProviders = Object.create(null);

  function normaliseSearchItem(item) {
    const title = String(item && item.title ? item.title : "").trim();
    return {
      id: String((item && (item.id || item.href)) || title).trim(),
      title,
      subtitle: String((item && item.subtitle) || "").trim(),
      href: item && item.href ? String(item.href) : "",
      keywords: Array.isArray(item && item.keywords) ? item.keywords.map(String) : [],
    };
  }

  function normaliseSearchProvider(provider) {
    const page = String(provider && provider.page ? provider.page : "").trim();
    if (!page) return null;

    const pageConfig = pages[page] || null;
    return {
      page,
      id: String(provider.id || page),
      label: String(provider.label || (pageConfig && pageConfig.label) || page.toUpperCase()),
      placeholder: String(provider.placeholder || `Search ${(pageConfig && pageConfig.label) || page}...`),
      emptyText: String(provider.emptyText || "No matches found."),
      items: Array.isArray(provider.items)
        ? provider.items.map(normaliseSearchItem).filter(function (item) {
            return item.id && item.title;
          })
        : [],
    };
  }

  function registerSearchProvider(provider) {
    const normalised = normaliseSearchProvider(provider);
    if (!normalised) return;
    searchProviders[normalised.page] = normalised;
    window.dispatchEvent(new CustomEvent("fieldops:shell-search-provider-updated", {
      detail: { page: normalised.page, provider: normalised, version: VERSION },
    }));
  }

  window.FieldOpsSearch = window.FieldOpsSearch || {};
  window.FieldOpsSearch.register = registerSearchProvider;
  window.FieldOpsSearch.registerPage = registerSearchProvider;
  window.FieldOpsSearch.providers = searchProviders;

  if (Array.isArray(window.FieldOpsSearchQueue)) {
    window.FieldOpsSearchQueue.forEach(registerSearchProvider);
  }

  window.FieldOpsSearchQueue = {
    push(provider) {
      registerSearchProvider(provider);
      return Object.keys(searchProviders).length;
    },
  };

  function onReady(callback) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", callback, { once: true });
      return;
    }
    callback();
  }

  function qs(selector, root) {
    return (root || document).querySelector(selector);
  }

  function qsa(selector, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(selector));
  }

  function isElement(value) {
    return value instanceof Element;
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (character) {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      }[character];
    });
  }

  function normalisePageKey(pageKey) {
    return pages[pageKey] ? pageKey : DEFAULT_PAGE;
  }

  function inferPageFromLocation() {
    const path = window.location.pathname.toLowerCase();
    if (path.includes("/features/map/")) return "map";
    if (path.includes("/features/rf/")) return "rf";
    if (path.includes("/features/network/")) return "network";
    if (path.includes("/features/docs/")) return "docs";
    if (path.includes("/features/tools/")) return "tools";
    return DEFAULT_PAGE;
  }

  function getScriptRoot() {
    const scripts = qsa("script[src]");
    const shellScript = scripts.reverse().find(function (script) {
      return /(^|\/)shell\.js(\?|$)/.test(script.getAttribute("src") || "");
    });
    if (!shellScript) return new URL("./", window.location.href).href;
    return new URL("./", shellScript.src).href;
  }

  const rootPath = getScriptRoot();

  function asset(path) {
    return new URL(path, rootPath).href;
  }

  function pageHref(pageKey) {
    return asset(pages[normalisePageKey(pageKey)].href);
  }

  function iconMarkup(iconClass, extraClass) {
    const classes = ["repo-icon", iconClass];
    if (extraClass) classes.push(extraClass);
    return `<span class="${classes.join(" ")}" aria-hidden="true"></span>`;
  }

  function chevronMarkup() {
    return '<span class="chevron-mark" aria-hidden="true"></span>';
  }

  function pageOptionMarkup(pageKey) {
    const page = pages[pageKey];
    return `
      <button class="button-surface drawer-row drawer-page-option" type="button" hidden data-page-button data-page="${pageKey}">
        ${iconMarkup(page.icon)}
        <span class="drawer-row__label">${page.label}</span>
        <span class="drawer-row__chevron">${chevronMarkup()}</span>
      </button>`;
  }

  function navButtonMarkup(pageKey) {
    const page = pages[pageKey];
    return `
      <button class="button-surface nav-button" type="button" data-page-button data-nav-button data-page="${pageKey}">
        ${iconMarkup(page.icon)}
        <span>${page.navLabel}</span>
      </button>`;
  }

  function shellMarkup(activePage) {
    const active = normalisePageKey(activePage);
    const activeConfig = pages[active];

    return `
      <header class="top-shell" aria-label="FieldOps Atlas controls">
        <button class="button-surface icon-button" type="button" aria-label="Open menu" aria-expanded="false" data-menu-open>
          ${iconMarkup("icon--menu")}
        </button>

        <button class="button-surface search-button" type="button" aria-label="Search this page" aria-expanded="false" data-search-open>
          <span class="search-lead">
            ${iconMarkup("icon--search", "search-icon")}
            <span class="search-query" data-search-placeholder>Find walk</span>
          </span>
          <span class="search-brand" aria-hidden="true">
            <span class="search-divider"></span>
            <span class="atlas-logo">
              ${iconMarkup("icon--atlas")}
              <span class="atlas-word">ATLAS</span>
            </span>
          </span>
        </button>

        <button class="button-surface icon-button" type="button" aria-label="Filter map regions" data-filter-region>
          ${iconMarkup("icon--filter")}
        </button>
      </header>

      <div class="shell-dim" aria-hidden="true" data-shell-dim></div>

      <section class="fieldops-shell-panel search-panel" aria-label="Search" aria-hidden="true" data-search-panel>
        <div class="panel-shell-header">
          <div>
            <p class="panel-shell-kicker">Search</p>
            <h2 data-search-panel-title>Find walk</h2>
          </div>
          <button class="button-surface panel-shell-close" type="button" aria-label="Close search" data-search-close>
            <span class="css-close" aria-hidden="true"></span>
          </button>
        </div>
        <label class="sr-only" for="fieldopsShellSearchInput">Search this page</label>
        <input id="fieldopsShellSearchInput" class="shell-search-input" type="search" autocomplete="off" spellcheck="false" placeholder="Find walk" data-search-input>
        <div class="shell-search-results" role="listbox" aria-label="Search results" data-search-results></div>
      </section>

      <aside class="drawer" aria-label="Main navigation menu" aria-hidden="true" data-drawer>
        <header class="drawer-header">
          <div class="brand-mark" aria-hidden="true">
            <img class="brand-logo" src="${asset("data/icons/logo-atlas.svg")}" alt="">
          </div>
          <div class="brand-copy">
            <h1 class="brand-title"><span class="brand-title__fieldops">FieldOps</span><span class="atlas-word">ATLAS</span></h1>
            <p class="brand-subtitle">UK Network Toolkit</p>
          </div>
          <button class="button-surface drawer-close" type="button" aria-label="Close menu" data-menu-close>
            <span class="css-close" aria-hidden="true"></span>
          </button>
        </header>

        <section class="section-card" aria-label="Page selector">
          <div class="section-toggle">
            <p class="section-label">Pages</p>
            <button class="section-toggle__button" type="button" aria-expanded="false" data-pages-toggle>
              <span class="section-toggle__text">All</span>
              <span class="section-toggle__chevron">${chevronMarkup()}</span>
            </button>
          </div>

          <nav class="drawer-pages" aria-label="Pages">
            <button class="button-surface current-page-card" type="button" aria-current="page" data-current-page-card>
              ${iconMarkup(activeConfig.icon)}
              <span class="current-page-card__copy">
                <span class="current-page-card__eyebrow">Current page</span>
                <span class="current-page-card__title" data-current-page-title>${activeConfig.label}</span>
              </span>
              <span class="current-page-card__chevron">${chevronMarkup()}</span>
            </button>
            ${pageOrder.map(pageOptionMarkup).join("")}
          </nav>
        </section>

        <section class="section-card section-card--map-tools" aria-label="Map actions" data-drawer-map-actions hidden>
          <p class="section-label">Map</p>
          <div class="drawer-action-grid">
            <button class="button-surface drawer-row" type="button" data-map-action="tools">
              ${iconMarkup("icon--tools")}
              <span class="drawer-row__label">Map tools</span>
              <span class="drawer-row__chevron">${chevronMarkup()}</span>
            </button>
            <button class="button-surface drawer-row" type="button" data-map-action="filter">
              ${iconMarkup("icon--filter")}
              <span class="drawer-row__label">Filter regions</span>
              <span class="drawer-row__chevron">${chevronMarkup()}</span>
            </button>
          </div>
        </section>

        <div class="drawer-spacer" aria-hidden="true"></div>

        <p class="section-label">User</p>
        <div class="account-menu" aria-label="User menu">
          <button class="button-surface account-button" type="button" aria-label="Profile placeholder" data-profile>
            ${iconMarkup("icon--profile")}
          </button>
          <button class="button-surface account-button" type="button" aria-label="Open settings" data-settings>
            ${iconMarkup("icon--settings")}
          </button>
        </div>

        <button class="button-surface online-row" type="button" aria-pressed="false" data-work-online>
          <span class="checkbox" aria-hidden="true"></span>
          <span>Work online</span>
        </button>

        <div class="button-surface version-row">
          ${iconMarkup("icon--info")}
          <span>FieldOps Atlas v1.1.1</span>
        </div>
      </aside>

      <footer class="bottom-shell">
        <nav class="bottom-nav" aria-label="Primary navigation">
          ${pageOrder.map(navButtonMarkup).join("")}
        </nav>
      </footer>`;
  }

  function bootFieldOpsShell() {
    const shell = qs(SHELL_ROOT_SELECTOR);
    if (!shell) return;

    if (shell.dataset.shellReady === "true" && shell.dataset.shellVersion === VERSION) {
      return;
    }

    qsa(".top-shell, .shell-dim, .fieldops-shell-panel, .drawer, .bottom-shell", shell).forEach(function (node) {
      if (node.dataset && node.dataset.keepShell === "true") return;
      node.remove();
    });

    let activePage = shell.dataset.currentPage || shell.dataset.page || inferPageFromLocation();
    activePage = normalisePageKey(activePage);

    shell.classList.add("fieldops-shell-root");
    shell.dataset.page = activePage;
    shell.dataset.currentPage = activePage;
    shell.dataset.shellReady = "true";
    shell.dataset.shellVersion = VERSION;
    shell.dataset.drawerOpen = "false";
    shell.dataset.searchOpen = "false";
    shell.dataset.pagesExpanded = "false";
    shell.dataset.mapToolsOpen = "false";

    shell.insertAdjacentHTML("afterbegin", shellMarkup(activePage));

    const menuButton = qs("[data-menu-open]", shell);
    const closeButton = qs("[data-menu-close]", shell);
    const drawer = qs("[data-drawer]", shell);
    const dim = qs("[data-shell-dim]", shell);
    const pagesButton = qs("[data-pages-toggle]", shell);
    const pagesButtonText = pagesButton ? qs(".section-toggle__text", pagesButton) : null;
    const pageOptions = qsa(".drawer-page-option", shell);
    const pageButtons = qsa("[data-page-button]", shell);
    const navButtons = qsa("[data-nav-button]", shell);
    const currentPageCard = qs("[data-current-page-card]", shell);
    const currentPageIcon = qs("[data-current-page-card] .repo-icon", shell);
    const currentPageTitle = qs("[data-current-page-title]", shell);
    const searchOpenButton = qs("[data-search-open]", shell);
    const searchCloseButton = qs("[data-search-close]", shell);
    const searchPanel = qs("[data-search-panel]", shell);
    const searchInput = qs("[data-search-input]", shell);
    const searchResults = qs("[data-search-results]", shell);
    const searchPlaceholder = qs("[data-search-placeholder]", shell);
    const searchPanelTitle = qs("[data-search-panel-title]", shell);
    const filterButton = qs("[data-filter-region]", shell);
    const settingsButton = qs("[data-settings]", shell);
    const workOnlineButton = qs("[data-work-online]", shell);
    const drawerMapActions = qs("[data-drawer-map-actions]", shell);
    let mapToolsOpen = false;

    function currentPageConfig() {
      return pages[activePage] || pages[DEFAULT_PAGE];
    }

    function dispatchShellEvent(eventName, detail) {
      window.dispatchEvent(new CustomEvent(eventName, {
        detail: Object.assign({ page: activePage, version: VERSION }, detail || {}),
      }));
    }

    function setDrawerOpen(isOpen) {
      shell.dataset.drawerOpen = isOpen ? "true" : "false";
      if (drawer) drawer.setAttribute("aria-hidden", isOpen ? "false" : "true");
      if (menuButton) menuButton.setAttribute("aria-expanded", isOpen ? "true" : "false");
      if (isOpen) closeSearch();
    }

    function setSearchOpen(isOpen) {
      shell.dataset.searchOpen = isOpen ? "true" : "false";
      if (searchPanel) searchPanel.setAttribute("aria-hidden", isOpen ? "false" : "true");
      if (searchOpenButton) searchOpenButton.setAttribute("aria-expanded", isOpen ? "true" : "false");
      if (isOpen) {
        setDrawerOpen(false);
        renderSearchResults();
        window.requestAnimationFrame(function () {
          if (searchInput) searchInput.focus({ preventScroll: true });
        });
      }
    }

    function closeSearch() {
      setSearchOpen(false);
    }

    function setPagesExpanded(isExpanded) {
      shell.dataset.pagesExpanded = isExpanded ? "true" : "false";
      if (pagesButton) pagesButton.setAttribute("aria-expanded", isExpanded ? "true" : "false");
      if (pagesButtonText) pagesButtonText.textContent = isExpanded ? "Hide" : "All";
      updatePageOptionVisibility();
    }

    function setMapToolsOpen(isOpen, source) {
      mapToolsOpen = activePage === "map" && Boolean(isOpen);
      shell.dataset.mapToolsOpen = mapToolsOpen ? "true" : "false";
      dispatchShellEvent("fieldops:shell-map-tools-toggle", {
        open: mapToolsOpen,
        source: source || "shell",
      });
    }

    function updateCurrentPagePill() {
      const page = currentPageConfig();
      if (currentPageTitle) currentPageTitle.textContent = page.label;
      if (currentPageIcon) {
        currentPageIcon.className = "repo-icon " + page.icon;
        currentPageIcon.setAttribute("aria-hidden", "true");
      }
      if (drawerMapActions) drawerMapActions.hidden = activePage !== "map";
    }

    function updateSearchCopy() {
      const provider = searchProviders[activePage];
      const placeholder = provider ? provider.placeholder : `Search ${currentPageConfig().label}`;
      if (searchPlaceholder) searchPlaceholder.textContent = activePage === "map" ? "Find walk" : placeholder;
      if (searchPanelTitle) searchPanelTitle.textContent = activePage === "map" ? "Find walk" : placeholder;
      if (searchInput) searchInput.placeholder = activePage === "map" ? "Find walk" : placeholder;
    }

    function updateBottomNav() {
      const activeIndex = Math.max(0, navButtons.findIndex(function (button) {
        return button.getAttribute("data-page") === activePage;
      }));

      navButtons.forEach(function (button, index) {
        const pageKey = button.getAttribute("data-page");
        const isActive = pageKey === activePage;
        button.classList.toggle("is-active", isActive);
        button.classList.toggle("is-group-end", index === activeIndex - 1);
        button.classList.toggle("is-group-start", index === activeIndex + 1);
        button.setAttribute("aria-pressed", isActive ? "true" : "false");
        if (isActive) button.setAttribute("aria-current", "page");
        else button.removeAttribute("aria-current");
      });
    }

    function updatePageOptionVisibility() {
      const expanded = shell.dataset.pagesExpanded === "true";
      pageOptions.forEach(function (row) {
        const isCurrent = row.getAttribute("data-page") === activePage;
        row.hidden = !expanded || isCurrent;
        row.classList.toggle("is-active", isCurrent);
      });
    }

    function setActivePage(pageName) {
      if (!pages[pageName]) return;
      activePage = pageName;
      shell.dataset.page = pageName;
      shell.dataset.currentPage = pageName;
      updateCurrentPagePill();
      updateSearchCopy();
      updateBottomNav();
      updatePageOptionVisibility();
      if (pageName !== "map") {
        shell.dataset.mapToolsOpen = "false";
        mapToolsOpen = false;
      }
    }

    function handlePageRequest(pageName, source) {
      const pageKey = normalisePageKey(pageName);

      if (pageKey === activePage) {
        if (pageKey === "map") setMapToolsOpen(!mapToolsOpen, source || "active-nav");
        else setDrawerOpen(false);
        return;
      }

      window.location.href = pageHref(pageKey);
    }

    function providerForActivePage() {
      return searchProviders[activePage] || {
        page: activePage,
        label: currentPageConfig().label,
        placeholder: `Search ${currentPageConfig().label}`,
        emptyText: "No searchable items registered for this page yet.",
        items: [],
      };
    }

    function itemMatches(item, query) {
      if (!query) return true;
      const haystack = [item.title, item.subtitle, item.id].concat(item.keywords || []).join(" ").toLowerCase();
      return haystack.includes(query.toLowerCase());
    }

    function renderSearchResults() {
      if (!searchResults) return;
      const provider = providerForActivePage();
      const query = searchInput ? searchInput.value.trim() : "";
      const matches = provider.items.filter(function (item) {
        return itemMatches(item, query);
      }).slice(0, MAX_SEARCH_RESULTS);

      if (!matches.length) {
        searchResults.innerHTML = `<p class="shell-empty-state">${escapeHtml(provider.emptyText)}</p>`;
        return;
      }

      searchResults.innerHTML = matches.map(function (item) {
        return `
          <button class="button-surface shell-search-result" type="button" role="option" data-search-select="${escapeHtml(item.id)}">
            <span class="shell-search-result__title">${escapeHtml(item.title)}</span>
            <span class="shell-search-result__subtitle">${escapeHtml(item.subtitle || provider.label)}</span>
          </button>`;
      }).join("");
    }

    function selectedSearchItem(itemId) {
      const provider = providerForActivePage();
      return provider.items.find(function (item) {
        return item.id === itemId;
      }) || null;
    }

    function selectSearchItem(itemId) {
      const provider = providerForActivePage();
      const item = selectedSearchItem(itemId);
      if (!item) return;
      closeSearch();
      dispatchShellEvent("fieldops:shell-search-select", { item, provider, page: provider.page });
      if (item.href && provider.page !== "map") window.location.href = item.href;
    }

    function currentWorkOnlineState() {
      return localStorage.getItem(WORK_ONLINE_KEY) === "true";
    }

    function setWorkOnlineState(isOnline, publish) {
      const nextState = Boolean(isOnline);
      localStorage.setItem(WORK_ONLINE_KEY, String(nextState));
      if (workOnlineButton) {
        workOnlineButton.setAttribute("aria-pressed", nextState ? "true" : "false");
        workOnlineButton.classList.toggle("is-on", nextState);
      }
      if (publish !== false) {
        dispatchShellEvent("fieldops:shell-work-online-toggle", { online: nextState });
      }
    }

    if (menuButton) {
      menuButton.addEventListener("click", function () {
        setDrawerOpen(shell.dataset.drawerOpen !== "true");
      });
    }

    if (closeButton) closeButton.addEventListener("click", function () { setDrawerOpen(false); });
    if (dim) dim.addEventListener("click", function () { setDrawerOpen(false); closeSearch(); setMapToolsOpen(false, "dim"); });
    if (pagesButton) pagesButton.addEventListener("click", function () { setPagesExpanded(shell.dataset.pagesExpanded !== "true"); });
    if (currentPageCard) currentPageCard.addEventListener("click", function () { setPagesExpanded(shell.dataset.pagesExpanded !== "true"); });

    pageButtons.forEach(function (button) {
      button.addEventListener("click", function () {
        handlePageRequest(button.getAttribute("data-page"), button.hasAttribute("data-nav-button") ? "bottom-nav" : "drawer");
      });
    });

    if (searchOpenButton) {
      searchOpenButton.addEventListener("click", function () {
        setSearchOpen(shell.dataset.searchOpen !== "true");
      });
    }

    if (searchCloseButton) searchCloseButton.addEventListener("click", closeSearch);
    if (searchInput) searchInput.addEventListener("input", renderSearchResults);

    if (searchResults) {
      searchResults.addEventListener("click", function (event) {
        const target = event.target;
        if (!isElement(target)) return;
        const row = target.closest("[data-search-select]");
        if (!row) return;
        selectSearchItem(row.getAttribute("data-search-select"));
      });
    }

    if (filterButton) {
      filterButton.addEventListener("click", function () {
        closeSearch();
        setDrawerOpen(false);
        setMapToolsOpen(false, "filter");
        dispatchShellEvent("fieldops:shell-filter-region", { open: true, source: "top-filter" });
      });
    }

    if (settingsButton) {
      settingsButton.addEventListener("click", function () {
        setDrawerOpen(false);
        dispatchShellEvent("fieldops:shell-settings", { open: true, source: "drawer" });
      });
    }

    qsa("[data-map-action]", shell).forEach(function (button) {
      button.addEventListener("click", function () {
        const action = button.getAttribute("data-map-action");
        setDrawerOpen(false);
        if (action === "tools") setMapToolsOpen(true, "drawer");
        if (action === "filter") dispatchShellEvent("fieldops:shell-filter-region", { open: true, source: "drawer" });
      });
    });

    if (workOnlineButton) {
      workOnlineButton.addEventListener("click", function () {
        setWorkOnlineState(!currentWorkOnlineState(), true);
      });
    }

    window.addEventListener("fieldops:shell-work-online-state", function (event) {
      const detail = event.detail || {};
      if (detail.page && detail.page !== activePage) return;
      setWorkOnlineState(Boolean(detail.online), false);
    });

    window.addEventListener("fieldops:shell-search-provider-updated", function (event) {
      const detail = event.detail || {};
      if (detail.page !== activePage) return;
      updateSearchCopy();
      if (shell.dataset.searchOpen === "true") renderSearchResults();
    });

    window.addEventListener("storage", function (event) {
      if (event.key === WORK_ONLINE_KEY) setWorkOnlineState(event.newValue === "true", false);
    });

    document.addEventListener("keydown", function (event) {
      if (event.key !== "Escape") return;
      if (shell.dataset.searchOpen === "true") closeSearch();
      else if (shell.dataset.drawerOpen === "true") setDrawerOpen(false);
      else if (mapToolsOpen) setMapToolsOpen(false, "escape");
    });

    setActivePage(activePage);
    setDrawerOpen(false);
    setSearchOpen(false);
    setPagesExpanded(false);
    setWorkOnlineState(currentWorkOnlineState(), false);

    window.dispatchEvent(new CustomEvent("fieldops:shell-ready", {
      detail: { page: activePage, version: VERSION },
    }));
  }

  onReady(bootFieldOpsShell);
})();
