/* ==========================================================================
   FieldOps Atlas RF 3D orbit renderer
   File: FieldOpsAtlas/Features/RF/rf-graph.js
   Version: 1.1.104-front-radar

   Purpose:
   - Render a genuine WebGL 3D mountain-and-radar scene.
   - Present the twin peaks from a stronger front-facing perspective.
   - Keep the radar arrays inside the WebGL geometry, never as image overlays.
   - Orbit the camera through a continuous 360 degrees using drag or touch.
   - Preserve the existing [data-rf-graph] mount contract.
   ========================================================================== */
(() => {
  "use strict";

  const VERSION = "1.1.104-front-radar";
  const MOUNT_SELECTOR = "[data-rf-graph]";
  const MAP_PAPER_SELECTOR = ".rf-map-paper";
  const LEGACY_KEY_SELECTOR = ".rf-graph-key";
  const RENDERED_EVENT = "fieldops:rf-graph-rendered";
  const SELECTED_PATH_ID = "site-1-to-site-2";

  const DEG = Math.PI / 180;
  const INTRO = Object.freeze({ from: 0, to: 360, delay: 650, duration: 12000 });

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function smoothstep(value) {
    const t = clamp(value, 0, 1);
    return t * t * (3 - 2 * t);
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
    return 0.72 + 0.42 * Math.sin((z + 1.25) * 0.56);
  }

  function terrainHeight(x, z) {
    function ruggedPeak(cx, cz, radius, height, ridgeAngle, plateau = 0.07) {
      const dx = (x - cx) / radius;
      const dz = (z - cz) / radius;
      const radialDistance = Math.sqrt(dx * dx + dz * dz);
      if (radialDistance >= 1) return 0;

      const t = clamp((radialDistance - plateau) / (1 - plateau), 0, 1);
      const smooth = t * t * (3 - 2 * t);
      const profile = 1 - smooth;
      const angle = Math.atan2(dz, dx);
      const slopeWeight = Math.sin(Math.PI * clamp(t, 0, 1));

      const majorRidges =
        0.20 * Math.sin(angle * 5 + ridgeAngle) +
        0.11 * Math.sin(angle * 9 - radialDistance * 9 + ridgeAngle * 0.8);

      const brokenFaces =
        0.070 * Math.sin(angle * 17 + radialDistance * 24 + ridgeAngle * 1.7) +
        0.048 * Math.cos((dx - dz) * 18 - ridgeAngle) +
        0.034 * Math.sin((dx + dz) * 31 + ridgeAngle * 2.3);

      const radialCuts =
        0.066 * Math.sin(radialDistance * 30 + angle * 3.0 + ridgeAngle) +
        0.038 * Math.sin(radialDistance * 47 - angle * 4.0);

      const jaggedScale = clamp(
        1 + (majorRidges + brokenFaces + radialCuts) * slopeWeight,
        0.68,
        1.37
      );

      return height * profile * jaggedScale;
    }

    const leftPeak = ruggedPeak(-4.35, -0.25, 4.85, 6.15, 0.38, 0.062);
    const rightPeak = ruggedPeak(5.75, -0.95, 5.10, 6.45, 1.18, 0.058);

    const leftFrontShoulder = ruggedPeak(-6.20, 3.05, 3.25, 1.85, 0.82, 0.04);
    const leftRearShoulder = ruggedPeak(-6.45, -3.15, 2.75, 1.42, 1.72, 0.04);
    const rightFrontShoulder = ruggedPeak(7.45, 2.70, 3.45, 1.95, 1.92, 0.04);
    const rightRearShoulder = ruggedPeak(8.15, -4.00, 2.70, 1.48, 2.48, 0.04);

    const saddle = 0.56 * Math.exp(
      -((((x - 0.70) / 5.1) ** 2) + (((z + 0.55) / 3.4) ** 2))
    );
    const valleyX = valleyCentreX(z);
    const valley =
      -1.03 *
      Math.exp(-((x - valleyX) ** 2) / 0.54) *
      Math.exp(-((z - 0.55) ** 2) / 49);
    const broadFloor = -0.032 * Math.sqrt(x * x + z * z);

    return (
      leftPeak +
      rightPeak +
      leftFrontShoulder +
      leftRearShoulder +
      rightFrontShoulder +
      rightRearShoulder +
      saddle +
      valley +
      broadFloor -
      0.86
    );
  }

  function createTerrain() {
    const xMin = -10.8;
    const xMax = 12.8;
    const zMin = -7.8;
    const zMax = 7.6;
    const columns = 86;
    const rows = 62;
    const baseY = -1.42;
    const vertices = [];
    const vertexColors = [];
    const lineVertices = [];
    const lineColors = [];
    const points = [];
    const pointColors = [];
    const grid = [];

    function surfaceColour(y, alpha) {
      const glow = clamp((y - baseY) / 7.9, 0, 1);
      return [0.003, 0.034 + glow * 0.068, 0.070 + glow * 0.145, alpha];
    }

    function lineColour(y, alpha) {
      const glow = clamp((y - baseY) / 7.9, 0, 1);
      return [0.0, 0.54 + glow * 0.30, 0.66 + glow * 0.30, alpha];
    }

    function pushVertex(point, colour) {
      vertices.push(point[0], point[1], point[2]);
      vertexColors.push(...colour);
    }

    function pushTriangle(a, b, c) {
      pushVertex(a, surfaceColour(a[1], 0.76));
      pushVertex(b, surfaceColour(b[1], 0.76));
      pushVertex(c, surfaceColour(c[1], 0.76));
    }

    function pushLine(a, b, alpha = 0.72) {
      const lift = 0.018;
      lineVertices.push(
        a[0], a[1] + lift, a[2],
        b[0], b[1] + lift, b[2]
      );
      lineColors.push(...lineColour(a[1], alpha), ...lineColour(b[1], alpha));
    }

    for (let row = 0; row <= rows; row += 1) {
      const z = zMin + ((zMax - zMin) * row) / rows;
      grid[row] = [];

      for (let column = 0; column <= columns; column += 1) {
        const x = xMin + ((xMax - xMin) * column) / columns;
        const y = Math.max(baseY, terrainHeight(x, z));
        const point = [x, y, z];
        grid[row][column] = point;

        if ((row + column) % 2 === 0) {
          points.push(x, y + 0.026, z);
          pointColors.push(...lineColour(y, 0.50));
        }
      }
    }

    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const a = grid[row][column];
        const b = grid[row][column + 1];
        const c = grid[row + 1][column];
        const d = grid[row + 1][column + 1];

        pushTriangle(a, c, b);
        pushTriangle(b, c, d);

        if ((row + column) % 2 === 0) {
          pushLine(b, c, 0.39);
        } else {
          pushLine(a, d, 0.39);
        }
      }
    }

    for (let row = 0; row <= rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        pushLine(
          grid[row][column],
          grid[row][column + 1],
          row % 4 === 0 ? 0.86 : 0.60
        );
      }
    }

    for (let column = 0; column <= columns; column += 1) {
      for (let row = 0; row < rows; row += 1) {
        pushLine(
          grid[row][column],
          grid[row + 1][column],
          column % 4 === 0 ? 0.86 : 0.60
        );
      }
    }

    return {
      triangles: { positions: vertices, colors: vertexColors },
      lines: { positions: lineVertices, colors: lineColors },
      points: { positions: points, colors: pointColors }
    };
  }

  function createTower(origin, height, baseRadius, detailScale = 1, radarYaw = 0) {
    const positions = [];
    const colors = [];
    const points = [];
    const pointColors = [];
    const levels = 12;
    const gold = [1.0, 0.64, 0.10, 0.98];
    const warmGold = [1.0, 0.46, 0.025, 0.88];
    const glowGold = [1.0, 0.36, 0.015, 0.48];

    function legPoint(leg, level) {
      const t = level / levels;
      const radius = baseRadius * (1 - t * 0.78);
      const angle = leg * Math.PI * 0.5 + Math.PI * 0.25;
      return [
        origin[0] + Math.cos(angle) * radius,
        origin[1] + t * height,
        origin[2] + Math.sin(angle) * radius
      ];
    }

    function pushSegment(a, b, colour = gold) {
      positions.push(a[0], a[1], a[2], b[0], b[1], b[2]);
      colors.push(...colour, ...colour);
    }

    function pushNode(point, colour = glowGold) {
      points.push(point[0], point[1], point[2]);
      pointColors.push(...colour);
    }

    for (let leg = 0; leg < 4; leg += 1) {
      for (let level = 0; level < levels; level += 1) {
        const a = legPoint(leg, level);
        const b = legPoint(leg, level + 1);
        const c = legPoint((leg + 1) % 4, level);
        const d = legPoint((leg + 1) % 4, level + 1);
        pushSegment(a, b);
        pushSegment(a, c);
        pushSegment(a, d);
        pushSegment(b, c, warmGold);
        pushNode(a);
      }
    }

    const topRing = [];
    for (let leg = 0; leg < 4; leg += 1) {
      topRing.push(legPoint(leg, levels));
    }

    const crown = [
      origin[0],
      origin[1] + height + 0.30 * detailScale,
      origin[2]
    ];

    topRing.forEach((upper, index) => {
      pushSegment(upper, crown);
      pushSegment(upper, topRing[(index + 1) % topRing.length], warmGold);
    });
    pushNode(crown);

    const antennaLevels = [0.34, 0.50, 0.66, 0.80];
    antennaLevels.forEach((fraction, index) => {
      const y = origin[1] + height * fraction;
      const reach = baseRadius * (1.00 - index * 0.07) * detailScale;
      const panelHeight = height * 0.10;

      for (let side = 0; side < 2; side += 1) {
        const direction = side === 0 ? -1 : 1;
        const x = origin[0] + direction * reach;
        const z = origin[2] + (index % 2 === 0 ? 0.05 : -0.05) * detailScale;
        const bottom = [x, y - panelHeight * 0.5, z];
        const topPanel = [x, y + panelHeight * 0.5, z];

        pushSegment(bottom, topPanel);
        pushSegment([origin[0], y, origin[2]], [x, y, z], warmGold);
        pushSegment(
          [x - 0.055 * detailScale, y - panelHeight * 0.5, z],
          [x - 0.055 * detailScale, y + panelHeight * 0.5, z]
        );
        pushSegment(
          [x + 0.055 * detailScale, y - panelHeight * 0.5, z],
          [x + 0.055 * detailScale, y + panelHeight * 0.5, z]
        );
      }
    });

    function addIntegratedRadar() {
      const tilt = 8 * DEG;
      const forward = [
        Math.sin(radarYaw) * Math.cos(tilt),
        Math.sin(tilt),
        Math.cos(radarYaw) * Math.cos(tilt)
      ];
      vec3Normalize(forward, forward);

      const right = [0, 0, 0];
      vec3Cross(right, [0, 1, 0], forward);
      vec3Normalize(right, right);

      const dishUp = [0, 0, 0];
      vec3Cross(dishUp, forward, right);
      vec3Normalize(dishUp, dishUp);

      const pivot = [
        crown[0],
        crown[1] + 0.16 * detailScale,
        crown[2]
      ];
      const radius = 0.72 * detailScale;
      const depth = radius * 0.46;
      const ringCount = 4;
      const segmentCount = 24;

      const dishPoint = (fraction, angle) => {
        const radial = radius * fraction;
        const bowlDepth = depth * fraction * fraction;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);

        return [
          pivot[0] + right[0] * cos * radial + dishUp[0] * sin * radial - forward[0] * bowlDepth,
          pivot[1] + right[1] * cos * radial + dishUp[1] * sin * radial - forward[1] * bowlDepth,
          pivot[2] + right[2] * cos * radial + dishUp[2] * sin * radial - forward[2] * bowlDepth
        ];
      };

      const yokeLeft = [
        crown[0] - right[0] * 0.24 * detailScale,
        crown[1] - right[1] * 0.24 * detailScale,
        crown[2] - right[2] * 0.24 * detailScale
      ];
      const yokeRight = [
        crown[0] + right[0] * 0.24 * detailScale,
        crown[1] + right[1] * 0.24 * detailScale,
        crown[2] + right[2] * 0.24 * detailScale
      ];

      pushSegment(crown, pivot, warmGold);
      pushSegment(yokeLeft, pivot, gold);
      pushSegment(yokeRight, pivot, gold);
      pushSegment(yokeLeft, yokeRight, warmGold);

      for (let ring = 1; ring <= ringCount; ring += 1) {
        const fraction = ring / ringCount;
        let previous = dishPoint(fraction, 0);

        for (let segment = 1; segment <= segmentCount; segment += 1) {
          const angle = (segment / segmentCount) * Math.PI * 2;
          const current = dishPoint(fraction, angle);
          pushSegment(previous, current, ring === ringCount ? gold : warmGold);
          previous = current;
        }
      }

      for (let segment = 0; segment < segmentCount; segment += 3) {
        const angle = (segment / segmentCount) * Math.PI * 2;
        let previous = pivot;

        for (let ring = 1; ring <= ringCount; ring += 1) {
          const current = dishPoint(ring / ringCount, angle);
          pushSegment(previous, current, warmGold);
          previous = current;
        }
      }

      const feed = [
        pivot[0] + forward[0] * radius * 0.50,
        pivot[1] + forward[1] * radius * 0.50,
        pivot[2] + forward[2] * radius * 0.50
      ];
      const rimA = dishPoint(1, Math.PI * 0.33);
      const rimB = dishPoint(1, Math.PI * 1.67);

      pushSegment(pivot, feed, gold);
      pushSegment(rimA, feed, warmGold);
      pushSegment(rimB, feed, warmGold);
      pushNode(feed, [1.0, 0.55, 0.04, 0.62]);
      pushNode(pivot, [1.0, 0.45, 0.02, 0.60]);
    }

    addIntegratedRadar();

    return {
      lines: { positions, colors },
      points: { positions: points, colors: pointColors }
    };
  }

  function createValleyPath() {
    const positions = [];
    const colors = [];
    const points = [];
    const pointColors = [];
    const steps = 94;
    let previous = null;

    for (let index = 0; index < steps; index += 1) {
      const t = index / (steps - 1);
      const z = 6.75 - t * 11.25;
      const x =
        valleyCentreX(z) +
        Math.sin(t * Math.PI * 5.2) * (0.22 - t * 0.08);
      const y = Math.max(-1.34, terrainHeight(x, z)) + 0.075;
      const point = [x, y, z];

      if (previous) {
        positions.push(...previous, ...point);
        colors.push(
          0.0, 0.96, 1.0, 0.94,
          0.0, 0.96, 1.0, 0.94
        );
      }

      points.push(x, y, z);
      pointColors.push(0.0, 0.94, 1.0, 0.72);
      previous = point;
    }

    return {
      lines: { positions, colors },
      points: { positions: points, colors: pointColors }
    };
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
      attribute vec4 a_color;
      uniform mat4 u_projection;
      uniform mat4 u_view;
      uniform float u_pointScale;
      varying vec4 v_color;
      varying float v_depth;

      void main() {
        vec4 viewPosition = u_view * vec4(a_position, 1.0);
        gl_Position = u_projection * viewPosition;
        gl_PointSize = clamp(u_pointScale / max(1.0, -viewPosition.z), 1.0, 18.0);
        v_color = a_color;
        v_depth = -viewPosition.z;
      }
    `;

    const fragmentSource = `
      precision mediump float;
      uniform float u_points;
      varying vec4 v_color;
      varying float v_depth;

      void main() {
        float alpha = v_color.a;

        if (u_points > 0.5) {
          vec2 centred = gl_PointCoord - vec2(0.5);
          float distanceFromCentre = length(centred);
          if (distanceFromCentre > 0.5) discard;
          alpha *= smoothstep(0.5, 0.05, distanceFromCentre);
        }

        float fog = clamp((v_depth - 8.0) / 27.0, 0.0, 0.72);
        vec3 fogColour = vec3(0.004, 0.025, 0.050);
        vec3 colour = mix(v_color.rgb, fogColour, fog);
        gl_FragColor = vec4(colour, alpha * (1.0 - fog * 0.55));
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

  function createDrawBuffer(gl, program, geometry, mode, pointScale = 1, additive = false) {
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array(geometry.positions),
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
      pointScale,
      additive,
      count: geometry.positions.length / 3,
      positionBuffer,
      colorBuffer,
      positionLocation: gl.getAttribLocation(program, "a_position"),
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

  function buildFrame(mount) {
    const frame = document.createElement("div");
    frame.className = "rf-webgl-orbit-frame";
    frame.style.cssText = [
      "position:relative",
      "width:100%",
      "height:100%",
      "overflow:hidden",
      "background-color:#020a14",
      "background-image:linear-gradient(rgba(30,150,171,.065) 1px,transparent 1px),linear-gradient(90deg,rgba(30,150,171,.065) 1px,transparent 1px),radial-gradient(circle at 50% 70%,rgba(0,190,214,.15),transparent 48%)",
      "background-size:28px 28px,28px 28px,100% 100%",
      "touch-action:none",
      "user-select:none"
    ].join(";");

    const canvas = document.createElement("canvas");
    canvas.className = "rf-webgl-orbit-canvas";
    canvas.setAttribute("role", "img");
    canvas.setAttribute(
      "aria-label",
      "Interactive 3D RF mountain scene with integrated radar arrays. Drag left or right to orbit 360 degrees."
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
      hint.textContent = "3D view is not supported on this device";
      hint.style.opacity = "1";
      mount.dataset.rfGraphLoaded = "false";
      mount.dataset.rfGraphVersion = VERSION;
      return null;
    }

    const program = createProgram(gl);
    gl.useProgram(program);

    const projectionLocation = gl.getUniformLocation(program, "u_projection");
    const viewLocation = gl.getUniformLocation(program, "u_view");
    const pointScaleLocation = gl.getUniformLocation(program, "u_pointScale");
    const pointsLocation = gl.getUniformLocation(program, "u_points");

    const terrain = createTerrain();
    const nearTowerOrigin = [
      -4.35,
      terrainHeight(-4.35, -0.25) + 0.025,
      -0.25
    ];
    const farTowerOrigin = [
      5.75,
      terrainHeight(5.75, -0.95) + 0.025,
      -0.95
    ];
    const nearTower = createTower(
      nearTowerOrigin,
      3.30,
      0.49,
      1.0,
      22 * DEG
    );
    const farTower = createTower(
      farTowerOrigin,
      3.08,
      0.46,
      0.94,
      -22 * DEG
    );
    const path = createValleyPath();

    const drawBuffers = [
      createDrawBuffer(gl, program, terrain.triangles, gl.TRIANGLES, 1, false),
      createDrawBuffer(gl, program, terrain.lines, gl.LINES, 1, true),
      createDrawBuffer(gl, program, terrain.points, gl.POINTS, 19, true),
      createDrawBuffer(gl, program, path.lines, gl.LINES, 1, true),
      createDrawBuffer(gl, program, path.points, gl.POINTS, 25, true),
      createDrawBuffer(gl, program, nearTower.lines, gl.LINES, 1, true),
      createDrawBuffer(gl, program, nearTower.points, gl.POINTS, 60, true),
      createDrawBuffer(gl, program, farTower.lines, gl.LINES, 1, true),
      createDrawBuffer(gl, program, farTower.points, gl.POINTS, 54, true)
    ];

    const projection = new Float32Array(16);
    const view = new Float32Array(16);
    const target = [
      (nearTowerOrigin[0] + farTowerOrigin[0]) * 0.5,
      (nearTowerOrigin[1] + farTowerOrigin[1]) * 0.5 - 0.52,
      (nearTowerOrigin[2] + farTowerOrigin[2]) * 0.5 + 0.15
    ];

    const state = {
      azimuth: INTRO.from,
      velocity: 0,
      dragging: false,
      pointerId: null,
      lastX: 0,
      lastTime: 0,
      introStartedAt: null,
      introCancelled: false,
      destroyed: false,
      width: 0,
      height: 0
    };

    function resize() {
      const rect = frame.getBoundingClientRect();
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(1, Math.round(rect.width * pixelRatio));
      const height = Math.max(1, Math.round(rect.height * pixelRatio));

      if (width === state.width && height === state.height) return;

      state.width = width;
      state.height = height;
      canvas.width = width;
      canvas.height = height;
      gl.viewport(0, 0, width, height);
    }

    function bindAndDraw(buffer) {
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer.positionBuffer);
      gl.enableVertexAttribArray(buffer.positionLocation);
      gl.vertexAttribPointer(
        buffer.positionLocation,
        3,
        gl.FLOAT,
        false,
        0,
        0
      );

      gl.bindBuffer(gl.ARRAY_BUFFER, buffer.colorBuffer);
      gl.enableVertexAttribArray(buffer.colorLocation);
      gl.vertexAttribPointer(
        buffer.colorLocation,
        4,
        gl.FLOAT,
        false,
        0,
        0
      );

      gl.uniform1f(
        pointScaleLocation,
        buffer.pointScale * Math.min(window.devicePixelRatio || 1, 2)
      );
      gl.uniform1f(pointsLocation, buffer.mode === gl.POINTS ? 1 : 0);

      if (buffer.additive) {
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
      } else {
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      }

      gl.drawArrays(buffer.mode, 0, buffer.count);
    }

    function render(now) {
      if (state.destroyed) return;

      resize();

      if (!state.introCancelled) {
        if (state.introStartedAt === null) {
          state.introStartedAt = now + INTRO.delay;
        }

        if (now >= state.introStartedAt) {
          const progress = (now - state.introStartedAt) / INTRO.duration;
          state.azimuth =
            INTRO.from + (INTRO.to - INTRO.from) * smoothstep(progress);

          if (progress >= 1) {
            state.introCancelled = true;
          }
        }
      } else if (!state.dragging && Math.abs(state.velocity) > 0.001) {
        state.azimuth += state.velocity;
        state.velocity *= 0.92;
      }

      const angle = (state.azimuth % 360) * DEG;
      const aspect = state.width / state.height;
      const portraitDistance = clamp((0.95 - aspect) * 7.0, 0, 4.6);
      const distance = 25.5 + portraitDistance;
      const eye = [
        target[0] + Math.sin(angle) * distance,
        target[1] + 2.55,
        target[2] + Math.cos(angle) * distance
      ];
      const fov = aspect < 0.80 ? 58 : aspect < 1.05 ? 54 : 50;

      mat4Perspective(projection, fov * DEG, aspect, 0.1, 90);
      mat4LookAt(view, eye, target, [0, 1, 0]);
      gl.uniformMatrix4fv(projectionLocation, false, projection);
      gl.uniformMatrix4fv(viewLocation, false, view);

      gl.enable(gl.DEPTH_TEST);
      gl.depthFunc(gl.LEQUAL);
      gl.enable(gl.BLEND);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      drawBuffers.forEach(bindAndDraw);
      window.requestAnimationFrame(render);
    }

    function cancelIntro() {
      state.introCancelled = true;
      hint.style.opacity = "0";
    }

    function onPointerDown(event) {
      cancelIntro();
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
      const deltaTime = Math.max(8, now - state.lastTime);
      const deltaAngle = -deltaX * 0.22;

      state.azimuth += deltaAngle;
      state.velocity = (deltaAngle * 16) / deltaTime;
      state.lastX = event.clientX;
      state.lastTime = now;
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
    }

    function onKeyDown(event) {
      if (
        event.key !== "ArrowLeft" &&
        event.key !== "ArrowRight" &&
        event.key !== "Home"
      ) {
        return;
      }

      cancelIntro();

      if (event.key === "Home") {
        state.azimuth = INTRO.from;
        state.velocity = 0;
      } else {
        state.azimuth += event.key === "ArrowLeft" ? -8 : 8;
      }

      event.preventDefault();
    }

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);
    canvas.addEventListener("keydown", onKeyDown);
    canvas.addEventListener("dblclick", () => {
      cancelIntro();
      state.azimuth = INTRO.from;
      state.velocity = 0;
    });

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(frame);
    window.requestAnimationFrame(render);

    mount.dataset.rfGraphLoaded = "true";
    mount.dataset.rfGraphVersion = VERSION;
    mount.dataset.rfGraphMode = "webgl-front-radar";
    mount.dispatchEvent(
      new CustomEvent(RENDERED_EVENT, {
        bubbles: true,
        detail: {
          version: VERSION,
          selectedPathId: SELECTED_PATH_ID,
          mode: "webgl-front-radar"
        }
      })
    );

    return {
      destroy() {
        state.destroyed = true;
        resizeObserver.disconnect();
        canvas.removeEventListener("pointerdown", onPointerDown);
        canvas.removeEventListener("pointermove", onPointerMove);
        canvas.removeEventListener("pointerup", onPointerUp);
        canvas.removeEventListener("pointercancel", onPointerUp);
        canvas.removeEventListener("keydown", onKeyDown);

        drawBuffers.forEach((buffer) => {
          gl.deleteBuffer(buffer.positionBuffer);
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
      console.error("FieldOps RF 3D viewer failed:", error);

      const fallback = document.createElement("div");
      fallback.textContent = "The 3D RF view could not start.";
      fallback.style.cssText =
        "display:grid;place-items:center;width:100%;height:100%;padding:16px;color:#dffbff;background:#031329;font:700 12px/1.4 system-ui;text-align:center";

      mount.replaceChildren(fallback);
      mount.dataset.rfGraphLoaded = "false";
      mount.dataset.rfGraphVersion = VERSION;
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
