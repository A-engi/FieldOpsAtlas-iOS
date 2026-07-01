/* ==========================================================================
   FieldOps Atlas RF Three.js paired lean core
   File: FieldOpsAtlas/Features/RF/rf-three-solid-core.js
   Version: 1.1.253-builder-3-paired-lean-core

   Requires Builder 3 v1.1.301-builder-3-lean-runtime.
   Builder 3 supplies the visible exterior. This module supplies only the
   required Three.js exports and one smaller background-coloured closed core.
   ========================================================================== */

import {
  ACESFilmicToneMapping,
  Box3,
  BufferAttribute,
  BufferGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Fog,
  Mesh as ThreeMesh,
  MeshBasicMaterial,
  NoBlending,
  PerspectiveCamera,
  Scene,
  ShaderMaterial,
  SRGBColorSpace,
  Vector2,
  Vector3,
  WebGLRenderer
} from "https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.min.js";

export {
  ACESFilmicToneMapping,
  Box3,
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  Fog,
  MeshBasicMaterial,
  NoBlending,
  PerspectiveCamera,
  Scene,
  ShaderMaterial,
  SRGBColorSpace,
  Vector2,
  Vector3,
  WebGLRenderer
};

const VERSION = "1.1.253-builder-3-paired-lean-core";
const CORE_COLOUR = 0x06131a;
const CORE_XZ_SCALE = 0.78;
const CORE_HEIGHT = 0.84;
const CORE_BOTTOM = 0.02;

function createCore(sourceGeometry) {
  sourceGeometry.computeBoundingBox();
  const box = sourceGeometry.boundingBox;
  const width = box.max.x - box.min.x;
  const height = box.max.y - box.min.y;
  const depth = box.max.z - box.min.z;
  const geometry = new CylinderGeometry(0.08, 0.5, 1, 64, 8, false);
  const material = new MeshBasicMaterial({
    color: CORE_COLOUR,
    depthTest: true,
    depthWrite: true,
    blending: NoBlending,
    toneMapped: false
  });
  const core = new ThreeMesh(geometry, material);

  core.name = "rf-inset-background-core";
  core.scale.set(
    width * CORE_XZ_SCALE,
    height * CORE_HEIGHT,
    depth * CORE_XZ_SCALE
  );
  core.position.set(
    (box.min.x + box.max.x) * 0.5,
    box.min.y + height * (CORE_BOTTOM + CORE_HEIGHT * 0.5),
    (box.min.z + box.max.z) * 0.5
  );
  core.userData.rfInsetSolidCore = true;
  core.userData.rfInsetSolidCoreVersion = VERSION;
  core.userData.rfInsetSolidCoreColour = CORE_COLOUR;
  return core;
}

export class Mesh extends ThreeMesh {
  constructor(geometry, material) {
    super(geometry, material);

    if (geometry?.userData?.rfTwoLayerTopologyForks360Mesh !== true) return;

    material.transparent = false;
    material.opacity = 1;
    material.depthTest = true;
    material.depthWrite = true;
    material.blending = NoBlending;
    material.needsUpdate = true;

    this.add(createCore(geometry));
    this.name = "rf-builder-3-with-inset-background-core";
    this.userData.rfSolidCoreVersion = VERSION;
    this.userData.rfExteriorGeometryPreserved = true;
  }
}

globalThis.FieldOpsRFThreeSolidCore = Object.freeze({
  VERSION,
  coreColour: CORE_COLOUR,
  coreXZScale: CORE_XZ_SCALE,
  coreHeight: CORE_HEIGHT,
  exteriorGeometryPreserved: true
});
