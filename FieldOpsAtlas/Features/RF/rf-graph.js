/* ==========================================================================
   FieldOps Atlas RF 3D twin-tower renderer
   File: FieldOpsAtlas/Features/RF/rf-graph.js
   Version: 1.1.121-twin-tower-3d

   Purpose:
   - Render the RF hero as an interactive WebGL wireframe terrain scene.
   - Match the dark cyan mountain references with a glowing valley route.
   - Place a primary gold tower on the left peak and a smaller tower on the
     right peak without changing the surrounding RF page interface.
   - Preserve the existing mount selector, 360-degree drag interaction,
     public API, dataset markers, fallback behaviour, and rendered event.
   ========================================================================== */
(() => {
  "use strict";

  const VERSION = "1.1.121-twin-tower-3d";
  const MOUNT_SELECTOR = "[data-rf-graph]";
  const MAP_PAPER_SELECTOR = ".rf-map-paper";
  const LEGACY_KEY_SELECTOR = ".rf-graph-key";
  const RENDERED_EVENT = "fieldops:rf-graph-rendered";
  const SELECTED_PATH_ID = "site-1-to-site-2";
  const MODE = "webgl-360-twin-tower-terrain";

  const DEG = Math.PI / 180;
  const FRONT_AZIMUTH = 0;

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function smoothstep(value) {
    const t = clamp(value, 0, 1);
    return t * t * (3 - 2 * t);
  }

  function seededNoise(x, z) {
    const value = Math.sin(x * 127.1 + z * 311.7) * 43758.5453123;
    return value - Math.floor(value);
  }

  function vec3Normalize(out, vector) {
    const length = Math.hypot(vector[0], vector[1], vector[2]) || 1;
    out[0] = vector[0] / length;
    out[1] = vector[1] / length;
    out[2] = vector[2] / length;
    return out;
  }

  function vec3Cross(out, a, b) {
    out[0] = a[1] * b[2] - a[2] * b[1];
    out[1] = a[2] * b[0] - a[0] * b[2];
    out[2] = a[0] * b[1] - a[1] * b[0];
    return out;
  }

  function triangleNormal(a, b, c) {
    const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const ac = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const normal = [0, 0, 0];
    vec3Cross(normal, ab, ac);
    vec3Normalize(normal, normal);

    if (normal[1] < 0) {
      normal[0] *= -1;
      normal[1] *= -1;
      normal[2] *= -1;
    }

    return normal;
  }

  function mat4Perspective(out, fovy, aspect, near, far) {
    const f = 1 / Math.tan(fovy / 2);
    const nf = 1 / (near - far);

    out[0] = f / aspect;
    out[1] = 0;
    out[2] = 0;
    out[3] = 0;
    out[4] = 0;
    out[5] = f;
    out[6] = 0;
    out[7] = 0;
    out[8] = 0;
    out[9] = 0;
    out[10] = (far + near) * nf;
    out[11] = -1;
    out[12] = 0;
    out[13] = 0;
    out[14] = 2 * far * near * nf;
    out[15] = 0;
    return out;
  }

  function mat4LookAt(out, eye, target, up) {
    const z = [eye[0] - target[0], eye[1] - target[1], eye[2] - target[2]];
    vec3Normalize(z, z);

    const x = [0, 0, 0];
    vec3Cross(x, up, z);
    vec3Normalize(x, x);

    const y = [0, 0, 0];
    vec3Cross(y, z, x);

    out[0] = x[0];
    out[1] = y[0];
    out[2] = z[0];
    out[3] = 0;
    out[4] = x[1];
    out[5] = y[1];
    out[6] = z[1];
    out[7] = 0;
    out[8] = x[2];
    out[9] = y[2];
    out[10] = z[2];
    out[11] = 0;
    out[12] = -(x[0] * eye[0] + x[1] * eye[1] + x[2] * eye[2]);
    out[13] = -(y[0] * eye[0] + y[1] * eye[1] + y[2] * eye[2]);
    out[14] = -(z[0] * eye[0] + z[1] * eye[1] + z[2] * eye[2]);
    out[15] = 1;
    return out;
  }

  function valleyCentreX(z) {
    return 0.15 + 0.52 * Math.sin((z + 2.2) * 0.19);
  }

  function mountainHeight(x, z, spec) {
    const cos = Math.cos(spec.rotation);
    const sin = Math.sin(spec.rotation);
    const dx = x - spec.cx;
    const dz = z - spec.cz;
    const u = (dx * cos + dz * sin) / spec.radiusX;
    const v = (-dx * sin + dz * cos) / spec.radiusZ;
    const radial = Math.sqrt(u * u + v * v);

    if (radial >= 1.18) return 0;

    const inside = clamp((1.18 - radial) / 1.18, 0, 1);
    const core = radial < 1
      ? Math.pow(1 - smoothstep(radial), 0.72)
      : 0;
    const apron = Math.pow(inside, 2.6) * 0.14;
    const angle = Math.atan2(v, u);
    const slope = Math.sin(Math.PI * clamp(radial, 0, 1));
    const ridges =
      0.12 * Math.sin(angle * 5.0 + spec.phase + radial * 6.4) +
      0.06 * Math.cos(angle * 9.0 - radial * 10.5 + spec.phase * 0.7) +
      0.025 * Math.sin((u - v) * 18.0 + spec.phase);
    const shape = clamp(1 + ridges * slope, 0.72, 1.27);

    return spec.height * (core * shape + apron);
  }

  const LEFT_MOUNTAIN = {
    cx: -7.0,
    cz: 0.9,
    radiusX: 10.4,
    radiusZ: 11.5,
    height: 5.65,
    rotation: -0.11,
    phase: 0.45
  };

  const RIGHT_MOUNTAIN = {
    cx: 7.4,
    cz: -1.25,
    radiusX: 9.5,
    radiusZ: 10.8,
    height: 4.9,
    rotation: 0.14,
    phase: 1.55
  };

  function terrainHeight(x, z) {
    const left = mountainHeight(x, z, LEFT_MOUNTAIN);
    const right = mountainHeight(x, z, RIGHT_MOUNTAIN);
    const valleyX = valleyCentreX(z);
    const valleyWidth = 0.92 + clamp((z + 6) / 30, 0, 1) * 1.34;
    const valleyCut =
      -1.24 *
      Math.exp(-((x - valleyX) ** 2) / valleyWidth) *
      Math.exp(-((z - 1.1) ** 2) / 102);
    const ground =
      -0.48 +
      0.055 * Math.sin(x * 0.31 + z * 0.15) +
      0.042 * Math.cos(z * 0.37 - x * 0.10);

    return left + right + valleyCut + ground;
  }

  function emptyGeometry() {
    return {
      positions: [],
      normals: [],
      colors: []
    };
  }

  function pushVertex(geometry, point, normal, colour) {
    geometry.positions.push(point[0], point[1], point[2]);
    geometry.normals.push(normal[0], normal[1], normal[2]);
    geometry.colors.push(colour[0], colour[1], colour[2], colour[3]);
  }

  function pushLine(geometry, a, b, colourA, colourB = colourA) {
    const normal = [0, 1, 0];
    pushVertex(geometry, a, normal, colourA);
    pushVertex(geometry, b, normal, colourB);
  }

  function terrainBaseColour(a, b, c) {
    const averageY = (a[1] + b[1] + c[1]) / 3;
    const averageZ = (a[2] + b[2] + c[2]) / 3;
    const averageX = (a[0] + b[0] + c[0]) / 3;
    const altitude = clamp((averageY + 0.70) / 7.5, 0, 1);
    const rear = smoothstep(clamp((-averageZ - 1.0) / 7.0, 0, 1));
    const valleyDistance = Math.abs(averageX - valleyCentreX(averageZ));
    const valley =
      Math.exp(-(valleyDistance * valleyDistance) / 1.55) *
      Math.exp(-((averageZ - 0.8) ** 2) / 72);
    const noise = seededNoise(
      Math.floor((averageX + 24) * 4),
      Math.floor((averageZ + 24) * 4)
    );
    const facet = noise > 0.56 ? (noise - 0.56) * 0.13 : 0;
    const separation = 1 - rear * 0.27 - valley * 0.12;

    return [
      0.006,
      (0.19 + altitude * 0.18 + facet) * separation,
      (0.28 + altitude * 0.27 + facet * 1.22) * separation,
      0.98
    ];
  }

  function createTerrain() {
    const xMin = -18.8;
    const xMax = 19.0;
    const zMin = -9.3;
    const zMax = 21.7;
    const columns = 108;
    const rows = 92;
    const triangles = emptyGeometry();
    const lines = emptyGeometry();
    const points = emptyGeometry();
    const ridges = emptyGeometry();
    const grid = [];

    for (let row = 0; row <= rows; row += 1) {
      grid[row] = [];
      const rawZ = zMin + ((zMax - zMin) * row) / rows;

      for (let column = 0; column <= columns; column += 1) {
        const rawX = xMin + ((xMax - xMin) * column) / columns;
        const edge =
          row === 0 ||
          row === rows ||
          column === 0 ||
          column === columns;
        const jitterX = edge ? 0 : (seededNoise(column, row) - 0.5) * 0.16;
        const jitterZ = edge ? 0 : (seededNoise(row + 41, column + 17) - 0.5) * 0.16;
        const x = rawX + jitterX;
        const z = rawZ + jitterZ;
        const y = terrainHeight(x, z);
        const point = [x, y, z];

        grid[row][column] = point;

        if (row % 2 === 0 && column % 3 === 0 && y > -0.58) {
          const altitude = clamp((y + 0.58) / 7.3, 0, 1);
          const alpha = 0.20 + altitude * 0.40;
          pushVertex(
            points,
            [x, y + 0.038, z],
            [0, 1, 0],
            [0.03, 0.69 + altitude * 0.27, 0.78 + altitude * 0.20, alpha]
          );
        }
      }
    }

    function addTriangle(a, b, c) {
      const normal = triangleNormal(a, b, c);
      const colour = terrainBaseColour(a, b, c);
      pushVertex(triangles, a, normal, colour);
      pushVertex(triangles, b, normal, colour);
      pushVertex(triangles, c, normal, colour);
    }

    function addMeshLine(a, b, alpha) {
      const averageY = (a[1] + b[1]) * 0.5;
      const altitude = clamp((averageY + 0.58) / 7.3, 0, 1);
      const effectiveAlpha = alpha * (0.30 + altitude * 0.70);
      const colour = [
        0.02,
        0.74 + altitude * 0.24,
        0.82 + altitude * 0.17,
        effectiveAlpha
      ];

      pushLine(
        lines,
        [a[0], a[1] + 0.028, a[2]],
        [b[0], b[1] + 0.028, b[2]],
        colour
      );
    }

    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const a = grid[row][column];
        const b = grid[row][column + 1];
        const c = grid[row + 1][column];
        const d = grid[row + 1][column + 1];
        const diagonal = seededNoise(column + 13, row + 29) > 0.5;

        if (diagonal) {
          addTriangle(a, c, d);
          addTriangle(a, d, b);
        } else {
          addTriangle(a, c, b);
          addTriangle(b, c, d);
        }

        if (row % 2 === 0) addMeshLine(a, b, 0.20);
        if (column % 3 === 0) addMeshLine(a, c, 0.17);
      }
    }

    function addRidgePath(controlPoints, colour) {
      const sampled = [];

      for (let index = 0; index < controlPoints.length - 1; index += 1) {
        const start = controlPoints[index];
        const end = controlPoints[index + 1];
        const steps = 12;

        for (let step = 0; step < steps; step += 1) {
          const t = step / steps;
          const x = start[0] + (end[0] - start[0]) * t;
          const z = start[1] + (end[1] - start[1]) * t;
          sampled.push([x, terrainHeight(x, z) + 0.085, z]);
        }
      }

      const last = controlPoints[controlPoints.length - 1];
      sampled.push([last[0], terrainHeight(last[0], last[1]) + 0.085, last[1]]);

      for (let index = 1; index < sampled.length; index += 1) {
        pushLine(ridges, sampled[index - 1], sampled[index], colour);
      }
    }

    addRidgePath(
      [
        [-7.0, 0.9],
        [-8.8, 3.6],
        [-10.9, 7.1],
        [-12.8, 10.8]
      ],
      [0.46, 1.0, 0.94, 0.72]
    );

    addRidgePath(
      [
        [7.4, -1.25],
        [8.5, 2.2],
        [10.2, 5.7],
        [11.8, 9.0]
      ],
      [0.36, 0.96, 0.92, 0.66]
    );

    return { triangles, lines, points, ridges };
  }

  function createTower(origin, height, baseRadius, detailScale = 1, radarSide = 1) {
    const lines = emptyGeometry();
    const points = emptyGeometry();
    const glow = emptyGeometry();
    const levels = 12;
    const gold = [1.0, 0.72, 0.15, 0.99];
    const warmGold = [1.0, 0.48, 0.03, 0.92];
    const glowGold = [1.0, 0.38, 0.01, 0.62];

    function addSegment(a, b, colour = gold) {
      pushLine(lines, a, b, colour);
    }

    function addNode(point, colour = glowGold) {
      pushVertex(points, point, [0, 1, 0], colour);
    }

    function legPoint(leg, level) {
      const t = level / levels;
      const radius = baseRadius * (1 - t * 0.82);
      const angle = leg * Math.PI * 0.5 + Math.PI * 0.25;

      return [
        origin[0] + Math.cos(angle) * radius,
        origin[1] + t * height,
        origin[2] + Math.sin(angle) * radius
      ];
    }

    for (let level = 0; level < levels; level += 1) {
      for (let leg = 0; leg < 4; leg += 1) {
        const a = legPoint(leg, level);
        const b = legPoint(leg, level + 1);
        const c = legPoint((leg + 1) % 4, level);
        const d = legPoint((leg + 1) % 4, level + 1);

        addSegment(a, b);
        addSegment(a, c, warmGold);
        addSegment(a, d);
        addSegment(b, c, warmGold);
        addNode(a);
      }
    }

    const top = [
      origin[0],
      origin[1] + height + 0.34 * detailScale,
      origin[2]
    ];

    for (let leg = 0; leg < 4; leg += 1) {
      addSegment(legPoint(leg, levels), top);
    }

    const mastTip = [
      top[0],
      top[1] + 0.76 * detailScale,
      top[2]
    ];

    addSegment(top, mastTip);
    addNode(mastTip, [1.0, 0.76, 0.18, 0.95]);
    pushVertex(glow, mastTip, [0, 1, 0], [1.0, 0.48, 0.03, 0.32]);

    [0.43, 0.61, 0.78].forEach((fraction, index) => {
      const y = origin[1] + height * fraction;
      const reach = baseRadius * (1.22 - index * 0.10) * detailScale;
      const panelHeight = height * 0.09;

      for (let side = -1; side <= 1; side += 2) {
        const x = origin[0] + side * reach;
        const z = origin[2];
        const bottomLeft = [x - 0.055 * detailScale, y - panelHeight * 0.5, z];
        const topLeft = [x - 0.055 * detailScale, y + panelHeight * 0.5, z];
        const bottomRight = [x + 0.055 * detailScale, y - panelHeight * 0.5, z];
        const topRight = [x + 0.055 * detailScale, y + panelHeight * 0.5, z];

        addSegment(bottomLeft, topLeft);
        addSegment(topLeft, topRight, warmGold);
        addSegment(topRight, bottomRight);
        addSegment(bottomRight, bottomLeft, warmGold);
        addSegment([origin[0], y, origin[2]], [x, y, z], warmGold);
      }
    });

    const side = radarSide < 0 ? -1 : 1;
    const platformY = origin[1] + height * 0.70;
    const platformOuter = [
      origin[0] + side * baseRadius * 1.5,
      platformY,
      origin[2]
    ];
    const platformInner = [
      origin[0] + side * baseRadius * 0.16,
      platformY,
      origin[2]
    ];
    const centre = [
      platformOuter[0],
      platformY + 0.36 * detailScale,
      platformOuter[2]
    ];

    addSegment(platformInner, platformOuter, warmGold);
    addSegment(
      [origin[0], platformY - 0.38 * detailScale, origin[2]],
      platformOuter,
      warmGold
    );
    addSegment(platformOuter, centre, gold);

    const normal = [side * 0.34, 0.88, 0.32];
    vec3Normalize(normal, normal);

    const right = [0, 0, 0];
    vec3Cross(right, [0, 1, 0], normal);
    vec3Normalize(right, right);

    const up = [0, 0, 0];
    vec3Cross(up, normal, right);
    vec3Normalize(up, up);

    const dishRadius = 0.30 * detailScale;
    const dishDepth = 0.12 * detailScale;
    const dishSegments = 14;

    function dishPoint(fraction, angle) {
      const radial = dishRadius * fraction;
      const bowl = dishDepth * fraction * fraction;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);

      return [
        centre[0] + right[0] * cos * radial + up[0] * sin * radial - normal[0] * bowl,
        centre[1] + right[1] * cos * radial + up[1] * sin * radial - normal[1] * bowl,
        centre[2] + right[2] * cos * radial + up[2] * sin * radial - normal[2] * bowl
      ];
    }

    for (let ring = 1; ring <= 3; ring += 1) {
      const fraction = ring / 3;
      let previous = dishPoint(fraction, 0);

      for (let segment = 1; segment <= dishSegments; segment += 1) {
        const angle = (segment / dishSegments) * Math.PI * 2;
        const current = dishPoint(fraction, angle);
        addSegment(previous, current, ring === 3 ? gold : warmGold);
        previous = current;
      }
    }

    for (let segment = 0; segment < dishSegments; segment += 4) {
      const angle = (segment / dishSegments) * Math.PI * 2;
      addSegment(centre, dishPoint(1, angle), warmGold);
    }

    return { lines, points, glow, mastTip };
  }

  function createValleyPath() {
    const ribbon = emptyGeometry();
    const lines = emptyGeometry();
    const points = emptyGeometry();
    const steps = 126;
    const path = [];

    for (let index = 0; index < steps; index += 1) {
      const t = index / (steps - 1);
      const z = 21.8 - t * 29.0;
      const x =
        valleyCentreX(z) +
        Math.sin(t * Math.PI * 5.2) * (0.42 - t * 0.13) +
        Math.sin(t * Math.PI * 2.0 + 0.8) * 0.17 +
        Math.cos(t * Math.PI * 9.0) * 0.04;
      const y = terrainHeight(x, z) + 0.092;
      path.push([x, y, z]);
    }

    for (let index = 0; index < path.length; index += 1) {
      const point = path[index];
      pushVertex(points, point, [0, 1, 0], [0.0, 0.91, 0.98, 0.64]);

      if (index > 0) {
        pushLine(
          lines,
          path[index - 1],
          point,
          [0.0, 0.92, 0.99, 0.90]
        );
      }
    }

    for (let index = 0; index < path.length - 1; index += 1) {
      const a = path[index];
      const b = path[index + 1];
      const dx = b[0] - a[0];
      const dz = b[2] - a[2];
      const length = Math.hypot(dx, dz) || 1;
      const widthA = 0.23 - (index / (path.length - 1)) * 0.12;
      const widthB = 0.23 - ((index + 1) / (path.length - 1)) * 0.12;
      const nx = -dz / length;
      const nz = dx / length;
      const aLeft = [a[0] + nx * widthA, a[1] - 0.016, a[2] + nz * widthA];
      const aRight = [a[0] - nx * widthA, a[1] - 0.016, a[2] - nz * widthA];
      const bLeft = [b[0] + nx * widthB, b[1] - 0.016, b[2] + nz * widthB];
      const bRight = [b[0] - nx * widthB, b[1] - 0.016, b[2] - nz * widthB];
      const normal = [0, 1, 0];
      const colour = [0.0, 0.60, 0.72, 0.20];

      pushVertex(ribbon, aLeft, normal, colour);
      pushVertex(ribbon, bLeft, normal, colour);
      pushVertex(ribbon, aRight, normal, colour);
      pushVertex(ribbon, aRight, normal, colour);
      pushVertex(ribbon, bLeft, normal, colour);
      pushVertex(ribbon, bRight, normal, colour);
    }

    return { ribbon, lines, points };
  }

  function createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const error = gl.getShaderInfoLog(shader) || "Unknown shader error";
      gl.deleteShader(shader);
      throw new Error(error);
    }

    return shader;
  }

  function createProgram(gl) {
    const vertexSource = `
      attribute vec3 a_position;
      attribute vec3 a_normal;
      attribute vec4 a_color;
      uniform mat4 u_projection;
      uniform mat4 u_view;
      uniform float u_pointScale;
      varying vec3 v_normal;
      varying vec4 v_color;
      varying float v_depth;

      void main() {
        vec4 viewPosition = u_view * vec4(a_position, 1.0);
        gl_Position = u_projection * viewPosition;
        gl_PointSize = clamp(
          u_pointScale / max(1.0, -viewPosition.z),
          1.0,
          30.0
        );
        v_normal = a_normal;
        v_color = a_color;
        v_depth = -viewPosition.z;
      }
    `;

    const fragmentSource = `
      precision mediump float;
      uniform float u_points;
      uniform float u_lit;
      uniform float u_emission;
      varying vec3 v_normal;
      varying vec4 v_color;
      varying float v_depth;

      void main() {
        float alpha = v_color.a;

        if (u_points > 0.5) {
          vec2 centred = gl_PointCoord - vec2(0.5);
          float distanceFromCentre = length(centred);
          if (distanceFromCentre > 0.5) discard;
          alpha *= smoothstep(0.5, 0.04, distanceFromCentre);
        }

        vec3 colour = v_color.rgb;

        if (u_lit > 0.5) {
          vec3 normal = normalize(v_normal);
          vec3 keyLight = normalize(vec3(-0.72, 0.88, 0.38));
          vec3 coolBounce = normalize(vec3(0.58, 0.20, -0.62));
          float diffuse = max(dot(normal, keyLight), 0.0);
          float bounce = max(dot(normal, coolBounce), 0.0);
          float sidePlane = 1.0 - abs(normal.y);
          float shade = 0.20 + diffuse * 0.78 + bounce * 0.13;
          float edgeContrast = 1.0 + sidePlane * 0.09;
          colour *= shade * edgeContrast;
          colour += vec3(0.0, 0.025, 0.040) * (0.35 + normal.y * 0.65);
        }

        colour += v_color.rgb * u_emission;

        float fog = clamp((v_depth - 12.0) / 35.0, 0.0, 0.62);
        vec3 fogColour = vec3(0.003, 0.018, 0.035);
        colour = mix(colour, fogColour, fog);
        gl_FragColor = vec4(colour, alpha * (1.0 - fog * 0.42));
      }
    `;

    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexSource);
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
    const program = gl.createProgram();

    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const error = gl.getProgramInfoLog(program) || "Unknown program link error";
      gl.deleteProgram(program);
      throw new Error(error);
    }

    return program;
  }

  function createDrawBuffer(gl, program, geometry, mode, options = {}) {
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array(geometry.positions),
      gl.STATIC_DRAW
    );

    const normalBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array(geometry.normals),
      gl.STATIC_DRAW
    );

    const colorBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array(geometry.colors),
      gl.STATIC_DRAW
    );

    return {
      mode,
      count: geometry.positions.length / 3,
      pointScale: options.pointScale || 1,
      additive: Boolean(options.additive),
      lit: Boolean(options.lit),
      emission: options.emission || 0,
      depthWrite: options.depthWrite !== false,
      positionBuffer,
      normalBuffer,
      colorBuffer,
      positionLocation: gl.getAttribLocation(program, "a_position"),
      normalLocation: gl.getAttribLocation(program, "a_normal"),
      colorLocation: gl.getAttribLocation(program, "a_color")
    };
  }

  function removeLegacyKey(mount) {
    const mapPaper = mount.closest(MAP_PAPER_SELECTOR);
    if (!mapPaper) return;

    mapPaper
      .querySelectorAll(`:scope > ${LEGACY_KEY_SELECTOR}`)
      .forEach((node) => node.remove());

    mapPaper.dataset.rfGraphKeyInit = "false";
  }

  function buildFallback(mount) {
    const fallback = document.createElement("div");
    fallback.setAttribute("role", "img");
    fallback.setAttribute(
      "aria-label",
      "Static twin-mountain RF terrain with two transmitter towers."
    );
    fallback.style.cssText =
      "display:grid;place-items:center;width:100%;height:100%;min-height:300px;background:#010a12;overflow:hidden";
    fallback.innerHTML = `
      <svg viewBox="0 0 1000 620" width="100%" height="100%" aria-hidden="true">
        <defs>
          <linearGradient id="rfFallbackLeft" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="#0b7782"/>
            <stop offset="1" stop-color="#031522"/>
          </linearGradient>
          <linearGradient id="rfFallbackRight" x1="1" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#086b78"/>
            <stop offset="1" stop-color="#02121d"/>
          </linearGradient>
          <filter id="rfFallbackGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="5" result="blur"/>
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>
        <rect width="1000" height="620" fill="#010a12"/>
        <g opacity=".16" stroke="#16869a" stroke-width="1">
          <path d="M0 100H1000M0 200H1000M0 300H1000M0 400H1000M0 500H1000"/>
          <path d="M100 0V620M200 0V620M300 0V620M400 0V620M500 0V620M600 0V620M700 0V620M800 0V620M900 0V620"/>
        </g>
        <path d="M-70 570 L24 548 L112 510 L194 457 L270 385 L334 328 L396 346 L466 400 L542 470 L620 540 L690 570 Z" fill="url(#rfFallbackLeft)"/>
        <path d="M390 570 L490 526 L588 470 L674 414 L756 356 L826 336 L900 360 L972 414 L1045 492 L1110 570 Z" fill="url(#rfFallbackRight)"/>
        <path d="M495 566 C455 524 526 482 487 430 C452 382 525 342 492 294" fill="none" stroke="#55ecf8" stroke-width="5" filter="url(#rfFallbackGlow)"/>
        <g fill="none" stroke="#ffc15c" stroke-width="4" filter="url(#rfFallbackGlow)">
          <path d="M302 332 L326 218 L350 332 M311 294H341 M316 268H336 M321 242H331 M326 218V185"/>
          <path d="M793 356 L808 282 L823 356 M798 330H818 M803 307H813 M808 282V260"/>
        </g>
      </svg>
    `;
    mount.replaceChildren(fallback);
    mount.dataset.rfGraphLoaded = "fallback";
    mount.dataset.rfGraphVersion = VERSION;
    mount.dataset.rfGraphMode = "static-twin-tower-fallback";
    return fallback;
  }

  function buildFrame(mount) {
    const frame = document.createElement("div");
    frame.className = "rf-webgl-orbit-frame";
    frame.style.cssText = [
      "position:relative",
      "width:100%",
      "height:100%",
      "overflow:hidden",
      "background-color:#010a12",
      "background-image:linear-gradient(rgba(29,145,165,.065) 1px,transparent 1px),linear-gradient(90deg,rgba(29,145,165,.065) 1px,transparent 1px),radial-gradient(ellipse at 50% 73%,rgba(0,190,211,.18),transparent 54%)",
      "background-size:56px 56px,56px 56px,100% 100%",
      "touch-action:none",
      "user-select:none"
    ].join(";");

    const canvas = document.createElement("canvas");
    canvas.className = "rf-webgl-orbit-canvas";
    canvas.setAttribute("role", "img");
    canvas.setAttribute(
      "aria-label",
      "Interactive 3D RF terrain with cyan wireframe mountains, a glowing valley route and two gold transmitter towers. Drag left or right to orbit 360 degrees."
    );
    canvas.setAttribute("tabindex", "0");
    canvas.style.cssText =
      "display:block;width:100%;height:100%;touch-action:none;cursor:grab;outline:none";

    const hint = document.createElement("div");
    hint.className = "rf-webgl-orbit-hint";
    hint.textContent = "Drag to rotate 360°";
    hint.style.cssText = [
      "position:absolute",
      "left:50%",
      "bottom:10px",
      "transform:translateX(-50%)",
      "padding:5px 9px",
      "border:1px solid rgba(116,228,244,.35)",
      "border-radius:999px",
      "background:rgba(2,16,31,.72)",
      "color:rgba(218,249,255,.9)",
      "font:700 9px/1.1 -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif",
      "letter-spacing:.04em",
      "pointer-events:none",
      "transition:opacity .35s ease"
    ].join(";");

    frame.append(canvas, hint);
    mount.replaceChildren(frame);
    return { frame, canvas, hint };
  }

  function initialiseWebGL(mount) {
    removeLegacyKey(mount);

    const { frame, canvas, hint } = buildFrame(mount);
    const gl = canvas.getContext("webgl", {
      alpha: true,
      antialias: true,
      depth: true,
      premultipliedAlpha: false,
      powerPreference: "high-performance"
    });

    if (!gl) {
      buildFallback(mount);
      return { destroy() {} };
    }

    const program = createProgram(gl);
    gl.useProgram(program);

    const projectionLocation = gl.getUniformLocation(program, "u_projection");
    const viewLocation = gl.getUniformLocation(program, "u_view");
    const pointScaleLocation = gl.getUniformLocation(program, "u_pointScale");
    const pointsLocation = gl.getUniformLocation(program, "u_points");
    const litLocation = gl.getUniformLocation(program, "u_lit");
    const emissionLocation = gl.getUniformLocation(program, "u_emission");

    const terrain = createTerrain();
    const path = createValleyPath();

    const leftTowerOrigin = [
      LEFT_MOUNTAIN.cx,
      terrainHeight(LEFT_MOUNTAIN.cx, LEFT_MOUNTAIN.cz) + 0.04,
      LEFT_MOUNTAIN.cz
    ];
    const rightTowerOrigin = [
      RIGHT_MOUNTAIN.cx,
      terrainHeight(RIGHT_MOUNTAIN.cx, RIGHT_MOUNTAIN.cz) + 0.04,
      RIGHT_MOUNTAIN.cz
    ];
    const leftTower = createTower(leftTowerOrigin, 3.55, 0.54, 1.0, 1);
    const rightTower = createTower(rightTowerOrigin, 2.55, 0.40, 0.74, -1);

    const drawBuffers = [
      createDrawBuffer(gl, program, terrain.triangles, gl.TRIANGLES, {
        lit: true,
        depthWrite: true
      }),
      createDrawBuffer(gl, program, terrain.lines, gl.LINES, {
        additive: true,
        emission: 0.28,
        depthWrite: false
      }),
      createDrawBuffer(gl, program, terrain.ridges, gl.LINES, {
        additive: true,
        emission: 0.74,
        depthWrite: false
      }),
      createDrawBuffer(gl, program, terrain.points, gl.POINTS, {
        pointScale: 48,
        additive: true,
        emission: 0.50,
        depthWrite: false
      }),
      createDrawBuffer(gl, program, path.ribbon, gl.TRIANGLES, {
        additive: true,
        emission: 0.28,
        depthWrite: false
      }),
      createDrawBuffer(gl, program, path.lines, gl.LINES, {
        additive: true,
        emission: 0.92,
        depthWrite: false
      }),
      createDrawBuffer(gl, program, path.points, gl.POINTS, {
        pointScale: 46,
        additive: true,
        emission: 0.58,
        depthWrite: false
      }),
      createDrawBuffer(gl, program, leftTower.lines, gl.LINES, {
        additive: true,
        emission: 0.95,
        depthWrite: false
      }),
      createDrawBuffer(gl, program, leftTower.points, gl.POINTS, {
        pointScale: 72,
        additive: true,
        emission: 0.84,
        depthWrite: false
      }),
      createDrawBuffer(gl, program, leftTower.glow, gl.POINTS, {
        pointScale: 430,
        additive: true,
        emission: 1.20,
        depthWrite: false
      }),
      createDrawBuffer(gl, program, rightTower.lines, gl.LINES, {
        additive: true,
        emission: 0.82,
        depthWrite: false
      }),
      createDrawBuffer(gl, program, rightTower.points, gl.POINTS, {
        pointScale: 58,
        additive: true,
        emission: 0.72,
        depthWrite: false
      }),
      createDrawBuffer(gl, program, rightTower.glow, gl.POINTS, {
        pointScale: 320,
        additive: true,
        emission: 1.05,
        depthWrite: false
      })
    ];

    const projection = new Float32Array(16);
    const view = new Float32Array(16);
    const target = [0.0, 2.35, 0.65];
    const state = {
      azimuth: FRONT_AZIMUTH,
      velocity: 0,
      dragging: false,
      pointerId: null,
      lastX: 0,
      lastTime: 0,
      destroyed: false,
      width: 0,
      height: 0,
      animationFrame: 0,
      renderQueued: false
    };

    function resize() {
      const rect = frame.getBoundingClientRect();
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(1, Math.round(rect.width * pixelRatio));
      const height = Math.max(1, Math.round(rect.height * pixelRatio));

      if (width === state.width && height === state.height) return false;

      state.width = width;
      state.height = height;
      canvas.width = width;
      canvas.height = height;
      gl.viewport(0, 0, width, height);
      return true;
    }

    function bindAndDraw(buffer) {
      if (!buffer.count) return;

      gl.bindBuffer(gl.ARRAY_BUFFER, buffer.positionBuffer);
      gl.enableVertexAttribArray(buffer.positionLocation);
      gl.vertexAttribPointer(buffer.positionLocation, 3, gl.FLOAT, false, 0, 0);

      gl.bindBuffer(gl.ARRAY_BUFFER, buffer.normalBuffer);
      gl.enableVertexAttribArray(buffer.normalLocation);
      gl.vertexAttribPointer(buffer.normalLocation, 3, gl.FLOAT, false, 0, 0);

      gl.bindBuffer(gl.ARRAY_BUFFER, buffer.colorBuffer);
      gl.enableVertexAttribArray(buffer.colorLocation);
      gl.vertexAttribPointer(buffer.colorLocation, 4, gl.FLOAT, false, 0, 0);

      gl.uniform1f(
        pointScaleLocation,
        buffer.pointScale * Math.min(window.devicePixelRatio || 1, 2)
      );
      gl.uniform1f(pointsLocation, buffer.mode === gl.POINTS ? 1 : 0);
      gl.uniform1f(litLocation, buffer.lit ? 1 : 0);
      gl.uniform1f(emissionLocation, buffer.emission);
      gl.depthMask(buffer.depthWrite);

      if (buffer.additive) {
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
      } else {
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      }

      gl.drawArrays(buffer.mode, 0, buffer.count);
    }

    function render() {
      state.renderQueued = false;
      if (state.destroyed) return;

      resize();

      const angle = (state.azimuth % 360) * DEG;
      const aspect = state.width / state.height;
      const portraitBoost = clamp((1.05 - aspect) * 2.7, 0, 1.4);
      const distance = 28.9 + portraitBoost;
      const eye = [
        target[0] + Math.sin(angle) * distance,
        target[1] + 1.12,
        target[2] + Math.cos(angle) * distance
      ];
      const fov = aspect < 0.82 ? 52 : aspect < 1.12 ? 48 : 45;

      mat4Perspective(projection, fov * DEG, aspect, 0.1, 92);
      mat4LookAt(view, eye, target, [0, 1, 0]);
      gl.uniformMatrix4fv(projectionLocation, false, projection);
      gl.uniformMatrix4fv(viewLocation, false, view);

      gl.enable(gl.DEPTH_TEST);
      gl.depthFunc(gl.LEQUAL);
      gl.enable(gl.BLEND);
      gl.clearColor(0, 0, 0, 0);
      gl.depthMask(true);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      drawBuffers.forEach(bindAndDraw);
      gl.depthMask(true);
    }

    function requestRender() {
      if (state.destroyed || state.renderQueued) return;
      state.renderQueued = true;
      window.requestAnimationFrame(render);
    }

    function runInertia() {
      if (state.destroyed || state.dragging) return;

      if (Math.abs(state.velocity) <= 0.001) {
        state.velocity = 0;
        return;
      }

      state.azimuth += state.velocity;
      state.velocity *= 0.92;
      render();
      state.animationFrame = window.requestAnimationFrame(runInertia);
    }

    function hideHint() {
      hint.style.opacity = "0";
    }

    function onPointerDown(event) {
      hideHint();
      window.cancelAnimationFrame(state.animationFrame);
      state.dragging = true;
      state.pointerId = event.pointerId;
      state.lastX = event.clientX;
      state.lastTime = performance.now();
      state.velocity = 0;
      canvas.setPointerCapture(event.pointerId);
      canvas.style.cursor = "grabbing";
      event.preventDefault();
    }

    function onPointerMove(event) {
      if (!state.dragging || event.pointerId !== state.pointerId) return;

      const now = performance.now();
      const deltaX = event.clientX - state.lastX;
      const deltaTime = Math.max(1, now - state.lastTime);
      const deltaAngle = deltaX * 0.31;

      state.azimuth += deltaAngle;
      state.velocity = (deltaAngle / deltaTime) * 16;
      state.lastX = event.clientX;
      state.lastTime = now;
      render();
      event.preventDefault();
    }

    function onPointerUp(event) {
      if (event.pointerId !== state.pointerId) return;

      state.dragging = false;
      state.pointerId = null;
      canvas.style.cursor = "grab";

      if (canvas.hasPointerCapture(event.pointerId)) {
        canvas.releasePointerCapture(event.pointerId);
      }

      window.cancelAnimationFrame(state.animationFrame);
      state.animationFrame = window.requestAnimationFrame(runInertia);
    }

    function onKeyDown(event) {
      if (!["ArrowLeft", "ArrowRight", "Home"].includes(event.key)) return;

      hideHint();
      window.cancelAnimationFrame(state.animationFrame);

      if (event.key === "Home") {
        state.azimuth = FRONT_AZIMUTH;
        state.velocity = 0;
      } else {
        state.azimuth += event.key === "ArrowLeft" ? -8 : 8;
      }

      render();
      event.preventDefault();
    }

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);
    canvas.addEventListener("keydown", onKeyDown);
    canvas.addEventListener("dblclick", () => {
      hideHint();
      window.cancelAnimationFrame(state.animationFrame);
      state.azimuth = FRONT_AZIMUTH;
      state.velocity = 0;
      render();
    });

    const resizeObserver = typeof ResizeObserver === "function"
      ? new ResizeObserver(requestRender)
      : null;

    if (resizeObserver) {
      resizeObserver.observe(frame);
    } else {
      window.addEventListener("resize", requestRender, { passive: true });
    }

    render();
    window.setTimeout(hideHint, 2600);

    mount.dataset.rfGraphLoaded = "true";
    mount.dataset.rfGraphVersion = VERSION;
    mount.dataset.rfGraphMode = MODE;
    mount.dispatchEvent(
      new CustomEvent(RENDERED_EVENT, {
        bubbles: true,
        detail: {
          version: VERSION,
          selectedPathId: SELECTED_PATH_ID,
          mode: MODE
        }
      })
    );

    return {
      destroy() {
        state.destroyed = true;
        window.cancelAnimationFrame(state.animationFrame);

        if (resizeObserver) {
          resizeObserver.disconnect();
        } else {
          window.removeEventListener("resize", requestRender);
        }

        canvas.removeEventListener("pointerdown", onPointerDown);
        canvas.removeEventListener("pointermove", onPointerMove);
        canvas.removeEventListener("pointerup", onPointerUp);
        canvas.removeEventListener("pointercancel", onPointerUp);
        canvas.removeEventListener("keydown", onKeyDown);

        drawBuffers.forEach((buffer) => {
          gl.deleteBuffer(buffer.positionBuffer);
          gl.deleteBuffer(buffer.normalBuffer);
          gl.deleteBuffer(buffer.colorBuffer);
        });

        gl.deleteProgram(program);
      }
    };
  }

  function initMount(mount) {
    if (!mount || mount.dataset.rfGraphInit === VERSION) return;

    if (
      mount._rfGraphViewer &&
      typeof mount._rfGraphViewer.destroy === "function"
    ) {
      mount._rfGraphViewer.destroy();
    }

    mount.dataset.rfGraphInit = VERSION;

    try {
      mount._rfGraphViewer = initialiseWebGL(mount);
    } catch (error) {
      console.error("FieldOps RF twin-tower 3D viewer failed:", error);
      buildFallback(mount);
    }
  }

  function initAll(root = document) {
    root.querySelectorAll(MOUNT_SELECTOR).forEach(initMount);
  }

  window.FieldOpsRFGraph = {
    VERSION,
    init: initMount,
    initAll
  };

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      () => initAll(),
      { once: true }
    );
  } else {
    initAll();
  }
})();

/* Destination: FieldOpsAtlas/Features/RF/rf-graph.js */
/* End of file: FieldOpsAtlas/Features/RF/rf-graph.js */
