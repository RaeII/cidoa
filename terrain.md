<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Three.js Terrain Procedural</title>
  <style>
    :root {
      --panel-bg: rgba(13, 15, 18, 0.82);
      --panel-border: rgba(255, 255, 255, 0.12);
      --text: #f3efe5;
      --muted: #b9b2a7;
      --accent: #d9b36c;
    }
    * { box-sizing: border-box; }
    html, body { margin: 0; width: 100%; height: 100%; overflow: hidden; background: #0d1014; color: var(--text); font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    #app { position: fixed; inset: 0; }
    canvas { display: block; width: 100%; height: 100%; }
    .panel {
      position: fixed;
      top: 18px;
      left: 18px;
      width: min(360px, calc(100vw - 36px));
      max-height: calc(100vh - 36px);
      overflow: auto;
      padding: 16px;
      border: 1px solid var(--panel-border);
      border-radius: 18px;
      background: var(--panel-bg);
      backdrop-filter: blur(16px);
      box-shadow: 0 24px 60px rgba(0, 0, 0, 0.35);
    }
    .panel h1 { margin: 0 0 6px; font-size: 18px; line-height: 1.2; letter-spacing: -0.02em; }
    .panel p { margin: 0 0 16px; color: var(--muted); font-size: 12px; line-height: 1.45; }
    .control { display: grid; grid-template-columns: 112px 1fr 54px; align-items: center; gap: 10px; margin: 9px 0; }
    .control label { color: var(--muted); font-size: 12px; }
    .control output { color: var(--text); font-variant-numeric: tabular-nums; text-align: right; font-size: 12px; }
    input[type="range"] { width: 100%; accent-color: var(--accent); }
    input[type="number"], select {
      width: 100%;
      border: 1px solid rgba(255,255,255,0.15);
      border-radius: 10px;
      background: rgba(255,255,255,0.07);
      color: var(--text);
      padding: 7px 8px;
    }
    .row { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 14px; }
    button {
      border: 0;
      border-radius: 12px;
      padding: 10px 10px;
      background: rgba(217, 179, 108, 0.16);
      color: #ffe0a4;
      cursor: pointer;
      font-weight: 700;
      font-size: 12px;
      letter-spacing: 0.01em;
    }
    button:hover { background: rgba(217, 179, 108, 0.24); }
    .checks { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 12px; color: var(--muted); font-size: 12px; }
    .checks label { display: flex; gap: 7px; align-items: center; }
    .stats { margin-top: 13px; color: var(--muted); font-size: 11px; line-height: 1.5; }
    .hint {
      position: fixed;
      right: 18px;
      bottom: 18px;
      padding: 10px 12px;
      color: rgba(255,255,255,0.72);
      background: rgba(0,0,0,0.42);
      border: 1px solid rgba(255,255,255,0.10);
      border-radius: 12px;
      font-size: 12px;
      backdrop-filter: blur(12px);
    }
    @media (max-width: 720px) {
      .panel { top: 10px; left: 10px; width: calc(100vw - 20px); max-height: 48vh; }
      .hint { display: none; }
    }
  </style>
</head>
<body>
  <div id="app"></div>

  <section class="panel" aria-label="Controles do terreno">
    <h1>Terreno procedural Three.js</h1>
    <p>Heightmap procedural inspirado no fluxo do THREE.Terrain: geração + filtros + suavização. Sem objetos decorativos, apenas o chão, com coloração em tons de verde.</p>

    <div class="control">
      <label for="seed">Seed</label>
      <input id="seed" type="number" min="1" max="999999" value="4690" />
      <output id="seedOut">4690</output>
    </div>

    <div class="control">
      <label for="segments">Resolução</label>
      <select id="segments">
        <option value="64" selected>64 x 64</option>
        <option value="96">96 x 96</option>
        <option value="128">128 x 128</option>
        <option value="192">192 x 192</option>
        <option value="256">256 x 256</option>
      </select>
      <output id="segmentsOut">64</output>
    </div>

    <div class="control"><label for="size">Tamanho</label><input id="size" type="range" min="80" max="520" step="10" value="310"><output id="sizeOut">310</output></div>
    <div class="control"><label for="height">Altura</label><input id="height" type="range" min="4" max="120" step="1" value="35"><output id="heightOut">35</output></div>
    <div class="control"><label for="frequency">Frequência</label><input id="frequency" type="range" min="0.4" max="7" step="0.1" value="2"><output id="frequencyOut">2</output></div>
    <div class="control"><label for="octaves">Octaves</label><input id="octaves" type="range" min="1" max="8" step="1" value="6"><output id="octavesOut">6</output></div>
    <div class="control"><label for="persistence">Persistência</label><input id="persistence" type="range" min="0.15" max="0.9" step="0.01" value="0.74"><output id="persistenceOut">0.74</output></div>
    <div class="control"><label for="lacunarity">Lacunarity</label><input id="lacunarity" type="range" min="1.4" max="3.8" step="0.05" value="2.5"><output id="lacunarityOut">2.5</output></div>
    <div class="control"><label for="ridge">Ridge</label><input id="ridge" type="range" min="0" max="2" step="0.01" value="1.51"><output id="ridgeOut">1.51</output></div>
    <div class="control"><label for="faults">Falhas</label><input id="faults" type="range" min="0" max="48" step="1" value="6"><output id="faultsOut">6</output></div>
    <div class="control"><label for="faultStrength">Força falha</label><input id="faultStrength" type="range" min="0" max="12" step="0.1" value="8.4"><output id="faultStrengthOut">8.4</output></div>
    <div class="control"><label for="smooth">Suavização</label><input id="smooth" type="range" min="0" max="8" step="1" value="6"><output id="smoothOut">6</output></div>
    <div class="control"><label for="terrace">Terraços</label><input id="terrace" type="range" min="0" max="18" step="1" value="11"><output id="terraceOut">11</output></div>
    <div class="control"><label for="edge">Borda baixa</label><input id="edge" type="range" min="0" max="1" step="0.01" value="0.18"><output id="edgeOut">0.18</output></div>

    <div class="checks">
      <label><input id="wireframe" type="checkbox"> wireframe</label>
      <label><input id="autorotate" type="checkbox"> auto rotate</label>
    </div>

    <div class="row">
      <button id="randomSeed">Nova seed</button>
      <button id="exportMap">Exportar heightmap</button>
    </div>

    <div id="stats" class="stats"></div>
  </section>

  <div class="hint">Arraste para orbitar · Scroll para zoom</div>

  <script type="module">
    import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.184.0/build/three.module.js';

    const app = document.getElementById('app');

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0d1014);
    scene.fog = new THREE.Fog(0x0d1014, 240, 720);

    const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.1, 1600);

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setSize(innerWidth, innerHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    app.appendChild(renderer.domElement);

    const hemi = new THREE.HemisphereLight(0xe8f0ff, 0x2b251d, 1.65);
    scene.add(hemi);

    const sun = new THREE.DirectionalLight(0xffe0aa, 2.7);
    sun.position.set(-130, 210, 95);
    scene.add(sun);

    const fill = new THREE.DirectionalLight(0x91a8c9, 0.55);
    fill.position.set(150, 80, -160);
    scene.add(fill);

    let terrain;
    let heightValues = [];
    let minH = 0;
    let maxH = 0;

    const controls = {
      seed: document.getElementById('seed'),
      segments: document.getElementById('segments'),
      size: document.getElementById('size'),
      height: document.getElementById('height'),
      frequency: document.getElementById('frequency'),
      octaves: document.getElementById('octaves'),
      persistence: document.getElementById('persistence'),
      lacunarity: document.getElementById('lacunarity'),
      ridge: document.getElementById('ridge'),
      faults: document.getElementById('faults'),
      faultStrength: document.getElementById('faultStrength'),
      smooth: document.getElementById('smooth'),
      terrace: document.getElementById('terrace'),
      edge: document.getElementById('edge'),
      wireframe: document.getElementById('wireframe'),
      autorotate: document.getElementById('autorotate')
    };

    const stats = document.getElementById('stats');

    function params() {
      return {
        seed: Number(controls.seed.value) || 1,
        segments: Number(controls.segments.value),
        size: Number(controls.size.value),
        height: Number(controls.height.value),
        frequency: Number(controls.frequency.value),
        octaves: Number(controls.octaves.value),
        persistence: Number(controls.persistence.value),
        lacunarity: Number(controls.lacunarity.value),
        ridge: Number(controls.ridge.value),
        faults: Number(controls.faults.value),
        faultStrength: Number(controls.faultStrength.value),
        smooth: Number(controls.smooth.value),
        terrace: Number(controls.terrace.value),
        edge: Number(controls.edge.value),
        wireframe: controls.wireframe.checked
      };
    }

    function syncOutputs() {
      for (const [key, el] of Object.entries(controls)) {
        const out = document.getElementById(`${key}Out`);
        if (out) out.textContent = el.value;
      }
    }

    function mulberry32(seed) {
      return function() {
        let t = seed += 0x6D2B79F5;
        t = Math.imul(t ^ t >>> 15, t | 1);
        t ^= t + Math.imul(t ^ t >>> 7, t | 61);
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
      };
    }

    function hashNoise(ix, iz, seed) {
      let n = ix * 374761393 + iz * 668265263 + seed * 1442695041;
      n = (n ^ (n >> 13)) * 1274126177;
      return ((n ^ (n >> 16)) >>> 0) / 4294967295;
    }

    function fade(t) {
      return t * t * t * (t * (t * 6 - 15) + 10);
    }

    function lerp(a, b, t) {
      return a + (b - a) * t;
    }

    function valueNoise(x, z, seed) {
      const ix = Math.floor(x);
      const iz = Math.floor(z);
      const fx = fade(x - ix);
      const fz = fade(z - iz);
      const a = hashNoise(ix, iz, seed);
      const b = hashNoise(ix + 1, iz, seed);
      const c = hashNoise(ix, iz + 1, seed);
      const d = hashNoise(ix + 1, iz + 1, seed);
      return lerp(lerp(a, b, fx), lerp(c, d, fx), fz);
    }

    function fbm(x, z, p) {
      let sum = 0;
      let amp = 1;
      let freq = p.frequency;
      let norm = 0;
      for (let i = 0; i < p.octaves; i++) {
        sum += valueNoise(x * freq, z * freq, p.seed + i * 1013) * amp;
        norm += amp;
        amp *= p.persistence;
        freq *= p.lacunarity;
      }
      return sum / norm;
    }

    function smoothHeightField(data, side, iterations) {
      let source = data;
      for (let it = 0; it < iterations; it++) {
        const target = source.slice();
        for (let z = 1; z < side - 1; z++) {
          for (let x = 1; x < side - 1; x++) {
            const i = z * side + x;
            target[i] = (
              source[i] * 4 +
              source[i - 1] + source[i + 1] + source[i - side] + source[i + side] +
              source[i - side - 1] * 0.5 + source[i - side + 1] * 0.5 +
              source[i + side - 1] * 0.5 + source[i + side + 1] * 0.5
            ) / 10;
          }
        }
        source = target;
      }
      return source;
    }

    function generateHeights(p) {
      const side = p.segments + 1;
      const data = new Array(side * side).fill(0);
      const rng = mulberry32(p.seed);
      const faultLines = [];

      for (let i = 0; i < p.faults; i++) {
        const angle = rng() * Math.PI * 2;
        faultLines.push({
          nx: Math.cos(angle),
          nz: Math.sin(angle),
          offset: (rng() - 0.5) * 1.3,
          power: (1 - i / Math.max(1, p.faults)) * p.faultStrength
        });
      }

      minH = Infinity;
      maxH = -Infinity;

      for (let z = 0; z < side; z++) {
        for (let x = 0; x < side; x++) {
          const u = x / p.segments;
          const v = z / p.segments;
          const px = u - 0.5;
          const pz = v - 0.5;

          const n = fbm(u, v, p);
          const broad = fbm(u * 0.32 + 91.7, v * 0.32 - 17.2, { ...p, frequency: Math.max(0.35, p.frequency * 0.48), octaves: 3 });
          const ridge = Math.pow(1 - Math.abs(n * 2 - 1), 1.65);

          let h = (n - 0.5) * p.height * 0.82;
          h += (broad - 0.48) * p.height * 0.72;
          h += ridge * p.ridge * p.height * 0.48;

          for (const f of faultLines) {
            const sideOfLine = px * f.nx + pz * f.nz + f.offset;
            h += Math.tanh(sideOfLine * 18) * f.power;
          }

          const dist = Math.sqrt(px * px + pz * pz) * 2;
          const edgeFalloff = THREE.MathUtils.smoothstep(dist, 0.62, 1.18);
          h *= (1 - edgeFalloff * p.edge);

          if (p.terrace > 0) {
            const step = p.height / p.terrace;
            const terraced = Math.round(h / step) * step;
            h = lerp(h, terraced, 0.58);
          }

          const i = z * side + x;
          data[i] = h;
        }
      }

      const smoothed = smoothHeightField(data, side, p.smooth);
      for (const h of smoothed) {
        minH = Math.min(minH, h);
        maxH = Math.max(maxH, h);
      }
      return smoothed;
    }

    function colorForHeight(h) {
      const t = THREE.MathUtils.clamp((h - minH) / Math.max(0.001, maxH - minH), 0, 1);
      const low = new THREE.Color(0x3f5f32);
      const mid = new THREE.Color(0x5f8447);
      const high = new THREE.Color(0x86a95e);
      const peak = new THREE.Color(0xaeca7b);
      if (t < 0.42) return low.clone().lerp(mid, t / 0.42);
      if (t < 0.78) return mid.clone().lerp(high, (t - 0.42) / 0.36);
      return high.clone().lerp(peak, (t - 0.78) / 0.22);
    }

    function buildTerrain() {
      const p = params();
      syncOutputs();

      if (terrain) {
        terrain.geometry.dispose();
        terrain.material.dispose();
        scene.remove(terrain);
      }

      const side = p.segments + 1;
      const positions = new Float32Array(side * side * 3);
      const colors = new Float32Array(side * side * 3);
      const indices = [];

      heightValues = generateHeights(p);
      const half = p.size / 2;

      for (let z = 0; z < side; z++) {
        for (let x = 0; x < side; x++) {
          const i = z * side + x;
          const k = i * 3;
          positions[k] = (x / p.segments) * p.size - half;
          positions[k + 1] = heightValues[i];
          positions[k + 2] = (z / p.segments) * p.size - half;

          const c = colorForHeight(heightValues[i]);
          colors[k] = c.r;
          colors[k + 1] = c.g;
          colors[k + 2] = c.b;
        }
      }

      for (let z = 0; z < p.segments; z++) {
        for (let x = 0; x < p.segments; x++) {
          const a = z * side + x;
          const b = a + 1;
          const c = a + side;
          const d = c + 1;
          indices.push(a, c, b, b, c, d);
        }
      }

      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      geo.setIndex(indices);
      geo.computeVertexNormals();
      geo.computeBoundingSphere();

      const mat = new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.92,
        metalness: 0,
        flatShading: false,
        wireframe: p.wireframe
      });

      terrain = new THREE.Mesh(geo, mat);
      scene.add(terrain);

      stats.innerHTML = `Vértices: <strong>${(side * side).toLocaleString('pt-BR')}</strong> · Triângulos: <strong>${(p.segments * p.segments * 2).toLocaleString('pt-BR')}</strong><br>Altura real: ${minH.toFixed(1)} até ${maxH.toFixed(1)} unidades`;
    }

    function debounce(fn, delay = 70) {
      let timer;
      return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), delay);
      };
    }

    const rebuild = debounce(buildTerrain, 70);
    Object.entries(controls).forEach(([key, el]) => {
      const eventName = el.type === 'checkbox' || el.tagName === 'SELECT' || el.type === 'number' ? 'change' : 'input';
      el.addEventListener(eventName, rebuild);
    });

    document.getElementById('randomSeed').addEventListener('click', () => {
      controls.seed.value = Math.floor(Math.random() * 999999) + 1;
      buildTerrain();
    });

    document.getElementById('exportMap').addEventListener('click', () => {
      const p = params();
      const side = p.segments + 1;
      const canvas = document.createElement('canvas');
      canvas.width = side;
      canvas.height = side;
      const ctx = canvas.getContext('2d');
      const img = ctx.createImageData(side, side);
      for (let i = 0; i < heightValues.length; i++) {
        const v = Math.round(THREE.MathUtils.clamp((heightValues[i] - minH) / Math.max(0.001, maxH - minH), 0, 1) * 255);
        img.data[i * 4] = v;
        img.data[i * 4 + 1] = v;
        img.data[i * 4 + 2] = v;
        img.data[i * 4 + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
      const link = document.createElement('a');
      link.download = `heightmap-seed-${p.seed}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    });

    const orbit = {
      radius: 390,
      theta: -0.72,
      phi: 1.03,
      target: new THREE.Vector3(0, 6, 0),
      dragging: false,
      lastX: 0,
      lastY: 0
    };

    function updateCamera() {
      const sinPhi = Math.sin(orbit.phi);
      camera.position.set(
        orbit.target.x + orbit.radius * sinPhi * Math.sin(orbit.theta),
        orbit.target.y + orbit.radius * Math.cos(orbit.phi),
        orbit.target.z + orbit.radius * sinPhi * Math.cos(orbit.theta)
      );
      camera.lookAt(orbit.target);
    }

    renderer.domElement.addEventListener('pointerdown', (e) => {
      orbit.dragging = true;
      orbit.lastX = e.clientX;
      orbit.lastY = e.clientY;
      renderer.domElement.setPointerCapture(e.pointerId);
    });

    renderer.domElement.addEventListener('pointermove', (e) => {
      if (!orbit.dragging) return;
      const dx = e.clientX - orbit.lastX;
      const dy = e.clientY - orbit.lastY;
      orbit.theta -= dx * 0.006;
      orbit.phi = THREE.MathUtils.clamp(orbit.phi + dy * 0.006, 0.18, Math.PI / 2.05);
      orbit.lastX = e.clientX;
      orbit.lastY = e.clientY;
      updateCamera();
    });

    renderer.domElement.addEventListener('pointerup', (e) => {
      orbit.dragging = false;
      try { renderer.domElement.releasePointerCapture(e.pointerId); } catch (_) {}
    });

    renderer.domElement.addEventListener('wheel', (e) => {
      e.preventDefault();
      orbit.radius = THREE.MathUtils.clamp(orbit.radius + e.deltaY * 0.35, 80, 850);
      updateCamera();
    }, { passive: false });

    addEventListener('resize', () => {
      camera.aspect = innerWidth / innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(innerWidth, innerHeight);
    });

    buildTerrain();
    updateCamera();

    renderer.setAnimationLoop(() => {
      if (controls.autorotate.checked && !orbit.dragging) {
        orbit.theta += 0.0018;
        updateCamera();
      }
      renderer.render(scene, camera);
    });
  </script>
</body>
</html>