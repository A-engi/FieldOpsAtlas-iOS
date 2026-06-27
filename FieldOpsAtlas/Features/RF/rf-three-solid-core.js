/* ========================================================================== 
   FieldOps Atlas RF Three.js solid-core adapter
   File: FieldOpsAtlas/Features/RF/rf-three-solid-core.js
   Version: 1.1.242-builder-3-internal-colour-cap-13k

   Purpose:
   - Preserve the current Builder 3 exterior geometry and baked vertex colours.
   - Build an opaque horizontal cross-section just above the removed internal
     platform, latched to the live exterior mesh boundary.
   - Keep the generated internal cap out of both cyan wireframe passes.
   ========================================================================== */

import * as THREEBase from "https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js";
export * from "https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js";

const VERSION = "1.1.242-builder-3-internal-colour-cap-13k";
const CAP_HEIGHT_RATIO = 0.305;
const WELD_TOLERANCE_RATIO = 0.00012;
const MIN_LOOP_AREA_RATIO = 0.00008;
const PLANE_EPSILON_RATIO = 0.00002;

const OriginalMesh = THREEBase.Mesh;

function materialList(material) {
  return Array.isArray(material) ? material : [material];
}

function isBuilderSurface(geometry, material) {
  if (!geometry || geometry.userData?.rfInternalColourCapAttached) {
    return false;
  }

  const position = geometry.getAttribute?.("position");
  const colour = geometry.getAttribute?.("color");
  const materials = materialList(material);

  return Boolean(
    position &&
    colour &&
    geometry.index &&
    materials.length === 1 &&
    materials[0] &&
    materials[0].vertexColors === true &&
    materials[0].wireframe !== true &&
    materials[0].transparent === false
  );
}

function readVertex(position, index) {
  return new THREEBase.Vector3(
    position.getX(index),
    position.getY(index),
    position.getZ(index)
  );
}

function readColour(colour, index) {
  return new THREEBase.Color(
    colour.getX(index),
    colour.getY(index),
    colour.getZ(index)
  );
}

function edgeIntersection(position, colour, firstIndex, secondIndex, planeY, epsilon) {
  const first = readVertex(position, firstIndex);
  const second = readVertex(position, secondIndex);
  const firstDistance = first.y - planeY;
  const secondDistance = second.y - planeY;

  if (Math.abs(firstDistance) <= epsilon && Math.abs(secondDistance) <= epsilon) {
    return null;
  }

  if (
    (firstDistance > epsilon && secondDistance > epsilon) ||
    (firstDistance < -epsilon && secondDistance < -epsilon)
  ) {
    return null;
  }

  const denominator = second.y - first.y;
  const t = Math.abs(denominator) <= epsilon
    ? 0
    : THREEBase.MathUtils.clamp((planeY - first.y) / denominator, 0, 1);
  const point = first.clone().lerp(second, t);
  point.y = planeY;

  const firstColour = readColour(colour, firstIndex);
  const secondColour = readColour(colour, secondIndex);

  return {
    point,
    colour: firstColour.lerp(secondColour, t)
  };
}

function pointsMatch(first, second, epsilonSquared) {
  const dx = first.point.x - second.point.x;
  const dz = first.point.z - second.point.z;
  return dx * dx + dz * dz <= epsilonSquared;
}

function uniqueIntersections(intersections, epsilonSquared) {
  const unique = [];

  intersections.forEach((candidate) => {
    if (!candidate) return;
    if (unique.some((entry) => pointsMatch(entry, candidate, epsilonSquared))) return;
    unique.push(candidate);
  });

  return unique;
}

function farthestPair(points) {
  let pair = null;
  let greatestDistanceSquared = -1;

  for (let first = 0; first < points.length; first += 1) {
    for (let second = first + 1; second < points.length; second += 1) {
      const dx = points[first].point.x - points[second].point.x;
      const dz = points[first].point.z - points[second].point.z;
      const distanceSquared = dx * dx + dz * dz;

      if (distanceSquared > greatestDistanceSquared) {
        greatestDistanceSquared = distanceSquared;
        pair = [points[first], points[second]];
      }
    }
  }

  return pair;
}

function buildCrossSectionSegments(geometry, planeY, weldTolerance) {
  const position = geometry.getAttribute("position");
  const colour = geometry.getAttribute("color");
  const index = geometry.index;
  const epsilonSquared = weldTolerance * weldTolerance;
  const segments = [];

  for (let offset = 0; offset < index.count; offset += 3) {
    const a = index.getX(offset);
    const b = index.getX(offset + 1);
    const c = index.getX(offset + 2);
    const intersections = uniqueIntersections([
      edgeIntersection(position, colour, a, b, planeY, weldTolerance),
      edgeIntersection(position, colour, b, c, planeY, weldTolerance),
      edgeIntersection(position, colour, c, a, planeY, weldTolerance)
    ], epsilonSquared);

    if (intersections.length < 2) continue;

    const pair = intersections.length === 2
      ? intersections
      : farthestPair(intersections);

    if (!pair || pointsMatch(pair[0], pair[1], epsilonSquared)) continue;
    segments.push(pair);
  }

  return segments;
}

function weldKey(entry, tolerance) {
  return `${Math.round(entry.point.x / tolerance)}:${Math.round(entry.point.z / tolerance)}`;
}

function buildWeldedGraph(segments, tolerance) {
  const nodes = [];
  const nodeByKey = new Map();
  const edges = [];
  const edgeKeys = new Set();

  function nodeFor(entry) {
    const key = weldKey(entry, tolerance);
    const existing = nodeByKey.get(key);

    if (existing !== undefined) {
      const node = nodes[existing];
      node.point.add(entry.point);
      node.colour.add(entry.colour);
      node.samples += 1;
      return existing;
    }

    const index = nodes.length;
    nodes.push({
      point: entry.point.clone(),
      colour: entry.colour.clone(),
      samples: 1,
      neighbours: new Set()
    });
    nodeByKey.set(key, index);
    return index;
  }

  segments.forEach(([firstEntry, secondEntry]) => {
    const first = nodeFor(firstEntry);
    const second = nodeFor(secondEntry);
    if (first === second) return;

    const key = first < second ? `${first}:${second}` : `${second}:${first}`;
    if (edgeKeys.has(key)) return;
    edgeKeys.add(key);

    const edgeIndex = edges.length;
    edges.push({ first, second, used: false });
    nodes[first].neighbours.add(edgeIndex);
    nodes[second].neighbours.add(edgeIndex);
  });

  nodes.forEach((node) => {
    node.point.multiplyScalar(1 / node.samples);
    node.colour.multiplyScalar(1 / node.samples);
  });

  return { nodes, edges };
}

function otherNode(edge, nodeIndex) {
  return edge.first === nodeIndex ? edge.second : edge.first;
}

function chooseContinuation(graph, previousIndex, currentIndex, candidates) {
  if (candidates.length <= 1 || previousIndex === null) {
    return candidates[0] ?? null;
  }

  const previous = graph.nodes[previousIndex].point;
  const current = graph.nodes[currentIndex].point;
  const incomingX = current.x - previous.x;
  const incomingZ = current.z - previous.z;
  const incomingLength = Math.hypot(incomingX, incomingZ) || 1;

  let best = candidates[0];
  let bestScore = -Infinity;

  candidates.forEach((edgeIndex) => {
    const nextIndex = otherNode(graph.edges[edgeIndex], currentIndex);
    const next = graph.nodes[nextIndex].point;
    const outgoingX = next.x - current.x;
    const outgoingZ = next.z - current.z;
    const outgoingLength = Math.hypot(outgoingX, outgoingZ) || 1;
    const score = (
      incomingX * outgoingX + incomingZ * outgoingZ
    ) / (incomingLength * outgoingLength);

    if (score > bestScore) {
      bestScore = score;
      best = edgeIndex;
    }
  });

  return best;
}

function traceLoops(graph) {
  const loops = [];

  graph.edges.forEach((seedEdge, seedEdgeIndex) => {
    if (seedEdge.used) return;

    const loop = [];
    const startIndex = seedEdge.first;
    let previousIndex = null;
    let currentIndex = startIndex;
    let edgeIndex = seedEdgeIndex;
    let guard = 0;

    while (edgeIndex !== null && guard <= graph.edges.length + 2) {
      const edge = graph.edges[edgeIndex];
      if (edge.used) break;
      edge.used = true;

      if (loop.length === 0) loop.push(currentIndex);
      const nextIndex = otherNode(edge, currentIndex);
      loop.push(nextIndex);

      if (nextIndex === startIndex) break;

      const candidateEdges = [...graph.nodes[nextIndex].neighbours]
        .filter((candidateIndex) => !graph.edges[candidateIndex].used);

      previousIndex = currentIndex;
      currentIndex = nextIndex;
      edgeIndex = chooseContinuation(graph, previousIndex, currentIndex, candidateEdges);
      guard += 1;
    }

    if (loop.length >= 4 && loop[loop.length - 1] === startIndex) {
      loop.pop();
      loops.push(loop);
    }
  });

  return loops;
}

function polygonArea(loop, nodes) {
  let area = 0;

  for (let index = 0; index < loop.length; index += 1) {
    const current = nodes[loop[index]].point;
    const next = nodes[loop[(index + 1) % loop.length]].point;
    area += current.x * next.z - next.x * current.z;
  }

  return area * 0.5;
}

function createInternalCapGeometry(geometry) {
  geometry.computeBoundingBox();
  const bounds = geometry.boundingBox;
  if (!bounds) return null;

  const size = bounds.getSize(new THREEBase.Vector3());
  const span = Math.max(size.x, size.z, 1e-6);
  const height = Math.max(size.y, 1e-6);
  const planeY = bounds.min.y + height * CAP_HEIGHT_RATIO;
  const weldTolerance = span * WELD_TOLERANCE_RATIO;
  const planeEpsilon = height * PLANE_EPSILON_RATIO;
  const minimumLoopArea = size.x * size.z * MIN_LOOP_AREA_RATIO;
  const segments = buildCrossSectionSegments(
    geometry,
    planeY + planeEpsilon,
    weldTolerance
  );

  if (segments.length < 3) return null;

  const graph = buildWeldedGraph(segments, weldTolerance);
  const loops = traceLoops(graph)
    .filter((loop) => Math.abs(polygonArea(loop, graph.nodes)) >= minimumLoopArea);

  if (loops.length === 0) return null;

  const positions = [];
  const colours = [];
  const indices = [];

  loops.forEach((loop) => {
    const contour = loop.map((nodeIndex) => {
      const point = graph.nodes[nodeIndex].point;
      return new THREEBase.Vector2(point.x, point.z);
    });
    const faces = THREEBase.ShapeUtils.triangulateShape(contour, []);
    const vertexOffset = positions.length / 3;

    loop.forEach((nodeIndex) => {
      const node = graph.nodes[nodeIndex];
      positions.push(node.point.x, planeY + planeEpsilon, node.point.z);
      colours.push(node.colour.r, node.colour.g, node.colour.b);
    });

    faces.forEach((face) => {
      indices.push(
        vertexOffset + face[0],
        vertexOffset + face[1],
        vertexOffset + face[2]
      );
    });
  });

  if (indices.length === 0) return null;

  const capGeometry = new THREEBase.BufferGeometry();
  capGeometry.setAttribute(
    "position",
    new THREEBase.Float32BufferAttribute(positions, 3)
  );
  capGeometry.setAttribute(
    "color",
    new THREEBase.Float32BufferAttribute(colours, 3)
  );
  capGeometry.setIndex(indices);
  capGeometry.computeVertexNormals();
  capGeometry.computeBoundingBox();
  capGeometry.computeBoundingSphere();
  capGeometry.userData.rfInternalColourCap = true;
  capGeometry.userData.rfInternalColourCapVersion = VERSION;
  capGeometry.userData.rfInternalColourCapPlaneY = planeY + planeEpsilon;
  capGeometry.userData.rfInternalColourCapLoopCount = loops.length;
  return capGeometry;
}

function attachInternalColourCap(surface, geometry) {
  const capGeometry = createInternalCapGeometry(geometry);
  if (!capGeometry) return;

  const capMaterial = new THREEBase.MeshBasicMaterial({
    vertexColors: true,
    side: THREEBase.DoubleSide,
    transparent: false,
    opacity: 1,
    depthWrite: true,
    depthTest: true,
    toneMapped: false,
    dithering: true,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1
  });

  const cap = new OriginalMesh(capGeometry, capMaterial);
  cap.name = "rf-internal-colour-cap";
  cap.renderOrder = -1;
  cap.frustumCulled = true;
  cap.userData.rfInternalColourCap = true;
  cap.userData.rfInternalColourCapVersion = VERSION;
  surface.add(cap);

  geometry.userData.rfInternalColourCapAttached = true;
  geometry.userData.rfInternalColourCapVersion = VERSION;
}

export class Mesh extends OriginalMesh {
  constructor(geometry, material) {
    super(geometry, material);

    if (isBuilderSurface(geometry, material)) {
      try {
        attachInternalColourCap(this, geometry);
      } catch (error) {
        console.error("FieldOps RF internal colour cap failed:", error);
      }
    }
  }
}

window.FieldOpsRFThreeSolidCore = Object.freeze({ VERSION });

/* Destination: FieldOpsAtlas/Features/RF/rf-three-solid-core.js */
/* End of file: FieldOpsAtlas/Features/RF/rf-three-solid-core.js */
