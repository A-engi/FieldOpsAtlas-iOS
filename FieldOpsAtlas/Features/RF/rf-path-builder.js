/* ==========================================================================
   FieldOps Atlas RF path builder
   File: FieldOpsAtlas/Features/RF/rf-path-builder.js
   Version: 1.1.86-data-only

   Purpose:
   - Keep the RF selected-path data/model builder active.
   - Fetch and normalise RF graph/path data for future visible path sections.
   - Expose a stable FieldOpsRFPathBuilder API for the RF page.
   - Create no path pane, hidden toggle, drawer handle, icon placeholder, or
     temporary UI.

   Notes:
   - The previous visual Path details pane renderer has been archived.
   - This file deliberately does not render DOM. It only builds data.
   ========================================================================== */

(() => {
  "use strict";

  const VERSION = "1.1.86-data-only";
  const GRAPH_URL = "../../../data/rf-network-map.json";
  const PATH_DATA_READY_EVENT = "fieldops:rf-path-data-ready";
  const GRAPH_RENDERED_EVENT = "fieldops:rf-graph-rendered";

  const DEFAULT_PATH_DETAILS = {
    frequency: "6.725 GHz",
    polarisation: "Horizontal",
    service: "DTT 1",
    band: "28 MHz",
    mode: "64QAM",
    power: "18 dBm",
    availability: "99.98%",
    status: "Online"
  };

  const FALLBACK_GRAPH = {
    selectedPathId: "london-hilltop",
    nodes: [
      { id: "glasgow", name: "Glasgow", type: "core" },
      { id: "edinburgh", name: "Edinburgh", type: "core" },
      { id: "manchester", name: "Manchester", type: "main" },
      { id: "birmingham", name: "Birmingham", type: "main" },
      { id: "london", name: "London", type: "core", size: "large" },
      { id: "hilltop", name: "Hilltop", type: "relay" },
      { id: "ridgeway", name: "Ridgeway", type: "relay" },
      { id: "valley", name: "Valley", type: "remote" },
      { id: "pinewood", name: "Pinewood", type: "remote" }
    ],
    links: [
      { id: "glasgow-manchester", from: "glasgow", to: "manchester", type: "main" },
      { id: "edinburgh-manchester", from: "edinburgh", to: "manchester", type: "main" },
      { id: "manchester-birmingham", from: "manchester", to: "birmingham", type: "main" },
      { id: "birmingham-london", from: "birmingham", to: "london", type: "main" },
      { id: "london-valley", from: "london", to: "valley", type: "backup" },
      { id: "london-pinewood", from: "london", to: "pinewood", type: "backup" },
      {
        id: "london-hilltop",
        from: "london",
        to: "hilltop",
        type: "alert",
        frequency: "6.725 GHz",
        polarisation: "Horizontal",
        service: "DTT 1",
        band: "28 MHz",
        mode: "64QAM",
        power: "18 dBm",
        availability: "99.98%",
        status: "Online"
      },
      { id: "hilltop-ridgeway", from: "hilltop", to: "ridgeway", type: "backup" },
      { id: "ridgeway-pinewood", from: "ridgeway", to: "pinewood", type: "backup" }
    ]
  };

  const state = {
    graph: null,
    path: null,
    selectedPathId: null,
    source: "unloaded",
    refreshPromise: null
  };

  function clone(value) {
    if (value === null || value === undefined) {
      return value;
    }

    return JSON.parse(JSON.stringify(value));
  }

  function isObject(value) {
    return Boolean(value && typeof value === "object" && !Array.isArray(value));
  }

  function isUsableGraph(data) {
    return Boolean(
      data &&
      Array.isArray(data.nodes) &&
      data.nodes.length > 0 &&
      Array.isArray(data.links)
    );
  }

  function firstText(values, fallback = "") {
    const match = values.find((value) => (
      value !== null &&
      value !== undefined &&
      String(value).trim().length > 0
    ));

    return match === undefined ? fallback : String(match).trim();
  }

  function normaliseAvailability(value) {
    if (value === null || value === undefined || value === "") {
      return DEFAULT_PATH_DETAILS.availability;
    }

    if (typeof value === "number" && Number.isFinite(value)) {
      return `${value}%`;
    }

    return String(value).trim();
  }

  function getNodeIdFromLink(link, side) {
    if (!link) {
      return "";
    }

    if (side === "from") {
      return firstText([link.from, link.source, link.sourceId, link.a, link.start], "");
    }

    return firstText([link.to, link.target, link.targetId, link.b, link.end], "");
  }

  function findNode(graph, nodeId) {
    if (!graph || !Array.isArray(graph.nodes) || !nodeId) {
      return null;
    }

    return graph.nodes.find((node) => String(node.id) === String(nodeId)) || null;
  }

  function findLink(graph, pathId) {
    if (!graph || !Array.isArray(graph.links) || graph.links.length === 0) {
      return null;
    }

    if (pathId) {
      const requested = graph.links.find((link) => String(link.id) === String(pathId));
      if (requested) {
        return requested;
      }
    }

    if (graph.selectedPathId) {
      const selected = graph.links.find((link) => String(link.id) === String(graph.selectedPathId));
      if (selected) {
        return selected;
      }
    }

    return (
      graph.links.find((link) => link.selected === true) ||
      graph.links.find((link) => link.type === "alert" || link.status === "selected") ||
      graph.links[0]
    );
  }

  function buildSiteModel(node, fallbackId, fallbackName) {
    const id = firstText([node?.id, fallbackId], "unknown-site");
    const name = firstText([node?.name, node?.title, fallbackName, id], "Unknown site");

    return {
      id,
      name,
      type: firstText([node?.type, node?.role], "site"),
      size: firstText([node?.size], "")
    };
  }

  function buildPathModel(graph, requestedPathId) {
    if (!isUsableGraph(graph)) {
      return null;
    }

    const link = findLink(graph, requestedPathId);
    if (!link) {
      return null;
    }

    const fromId = getNodeIdFromLink(link, "from");
    const toId = getNodeIdFromLink(link, "to");
    const fromNode = findNode(graph, fromId);
    const toNode = findNode(graph, toId);
    const pathId = firstText([link.id, requestedPathId, `${fromId}-${toId}`], "selected-path");
    const service = isObject(link.service) ? link.service : null;
    const technical = isObject(link.technical) ? link.technical : null;

    return {
      id: pathId,
      label: firstText([
        link.label,
        link.name,
        `${fromNode?.name || fromId || "Source"} to ${toNode?.name || toId || "Destination"}`
      ], "Selected path"),
      type: firstText([link.type, link.pathType], "path"),
      status: firstText([link.status, service?.status], DEFAULT_PATH_DETAILS.status),
      from: buildSiteModel(fromNode, fromId, "Source"),
      to: buildSiteModel(toNode, toId, "Destination"),
      details: {
        frequency: firstText([
          link.frequency,
          link.frequencyLabel,
          technical?.frequency,
          technical?.frequencyLabel
        ], DEFAULT_PATH_DETAILS.frequency),
        polarisation: firstText([
          link.polarisation,
          link.polarization,
          technical?.polarisation,
          technical?.polarization
        ], DEFAULT_PATH_DETAILS.polarisation),
        service: firstText([
          service?.name,
          service?.id,
          link.serviceName,
          link.service,
          link.mux
        ], DEFAULT_PATH_DETAILS.service),
        band: firstText([
          link.band,
          link.bandwidth,
          technical?.band,
          technical?.bandwidth
        ], DEFAULT_PATH_DETAILS.band),
        mode: firstText([
          link.mode,
          link.modulation,
          technical?.mode,
          technical?.modulation
        ], DEFAULT_PATH_DETAILS.mode),
        power: firstText([
          link.power,
          link.txPower,
          technical?.power,
          technical?.txPower
        ], DEFAULT_PATH_DETAILS.power),
        availability: normaliseAvailability(
          link.availability ??
          link.availabilityPct ??
          link.availabilityPercent ??
          technical?.availability ??
          service?.availability
        )
      }
    };
  }

  function graphFromWindow() {
    const candidates = [
      ["ATLAS_PRIVATE_GRAPH", window.ATLAS_PRIVATE_GRAPH],
      ["ATLAS_NETWORK_GRAPH", window.ATLAS_NETWORK_GRAPH],
      ["ATLAS_RF_GRAPH", window.ATLAS_RF_GRAPH],
      ["ATLAS_RF_PATH_DATA", window.ATLAS_RF_PATH_DATA]
    ];

    const match = candidates.find(([, value]) => isUsableGraph(value));
    if (!match) {
      return null;
    }

    return {
      graph: match[1],
      source: `window.${match[0]}`
    };
  }

  async function loadGraph(options = {}) {
    if (state.graph && options.force !== true) {
      return {
        graph: state.graph,
        source: state.source
      };
    }

    const windowGraph = graphFromWindow();
    if (windowGraph) {
      return windowGraph;
    }

    try {
      const response = await fetch(GRAPH_URL, { cache: "no-store" });
      if (response.ok) {
        const json = await response.json();
        if (isUsableGraph(json)) {
          return {
            graph: json,
            source: GRAPH_URL
          };
        }
      }
    } catch {
      // Local/offline previews can still use the safe demo fallback below.
    }

    return {
      graph: FALLBACK_GRAPH,
      source: "fallback"
    };
  }

  function dispatchPathDataReady() {
    const detail = {
      version: VERSION,
      selectedPathId: state.selectedPathId,
      source: state.source,
      path: clone(state.path)
    };

    document.dispatchEvent(new CustomEvent(PATH_DATA_READY_EVENT, { detail }));
  }

  async function refreshPathData(options = {}) {
    if (state.refreshPromise && options.force !== true) {
      return state.refreshPromise;
    }

    state.refreshPromise = loadGraph(options)
      .then(({ graph, source }) => {
        state.graph = graph;
        state.source = source;
        state.path = buildPathModel(graph, options.selectedPathId);
        state.selectedPathId = state.path ? state.path.id : null;
        dispatchPathDataReady();
        return clone(state.path);
      })
      .finally(() => {
        state.refreshPromise = null;
      });

    return state.refreshPromise;
  }

  function selectPath(pathId) {
    return refreshPathData({ selectedPathId: pathId, force: true });
  }

  function getCurrentPath() {
    return clone(state.path);
  }

  function getState() {
    return clone({
      selectedPathId: state.selectedPathId,
      source: state.source,
      path: state.path
    });
  }

  function renderPathBuilder() {
    refreshPathData().catch(() => {
      // Keep the page stable even if a future data file is malformed.
    });

    return false;
  }

  function removeLegacyPathBuilderDom(root = document) {
    root
      .querySelectorAll("[data-rf-path-builder-mount], [data-rf-path-builder-body], .rf-path-pane-body")
      .forEach((node) => node.remove());
  }

  function bindGraphRenderedEvent() {
    document.addEventListener(GRAPH_RENDERED_EVENT, (event) => {
      const selectedPathId = event?.detail?.selectedPathId;
      if (!selectedPathId || selectedPathId === state.selectedPathId) {
        return;
      }

      selectPath(selectedPathId).catch(() => {
        // The graph remains visible even if the path model cannot update.
      });
    });
  }

  function init() {
    removeLegacyPathBuilderDom();
    bindGraphRenderedEvent();
    renderPathBuilder();
  }

  window.FieldOpsRFPathBuilder = {
    VERSION,
    buildPathModel,
    getCurrentPath,
    getState,
    refreshPathData,
    renderPathBuilder,
    selectPath
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();

/* End of FieldOpsAtlas/Features/RF/rf-path-builder.js | bottom/end of file */
