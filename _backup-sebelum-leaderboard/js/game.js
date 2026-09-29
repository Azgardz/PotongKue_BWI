/*
 * Tantangan Potong Kue — 3 cuts, 8 equal pieces.
 *
 * Loaded as a classic script so index.html also works when opened straight
 * from disk; Three.js is pulled in with a dynamic import from the CDN.
 *
 * Geometry model: every cake piece is a convex polyhedron (the cake cylinder
 * intersected with half-spaces) stored in canonical cake-local coordinates.
 * Visual separation / explode only moves the piece meshes; cutting, volume and
 * decoration ownership always use the canonical polygons.
 */
(async function () {
  'use strict';

  const $ = (sel) => document.querySelector(sel);
  const loader = $('#loader');

  const CDNS = [
    'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js',
    'https://unpkg.com/three@0.160.0/build/three.module.js',
  ];
  let THREE = null;
  for (const url of CDNS) {
    try { THREE = await import(url); break; } catch (err) { console.warn('Three.js gagal dimuat dari', url, err); }
  }
  if (!THREE) {
    loader.querySelector('.loader-text').textContent =
      'Mesin 3D gagal dimuat. Periksa koneksi internet, lalu muat ulang halaman.';
    return;
  }

  const V3 = THREE.Vector3;
  const DEG = Math.PI / 180;

  // ---------------------------------------------------------------------------
  // Dimensions & rules
  // ---------------------------------------------------------------------------
  const R = 1.35;               // cake radius
  const H = 0.95;               // cake height
  const SEG = 112;              // cylinder facets
  const STAND_TOP = 0.46;       // cake sits on the stand plate at this height
  const MAX_CUTS = 3;
  const TARGET_PIECES = 8;
  const SUCCESS_MAX_DEV = 10;   // percent
  const MIN_PIECE_FRAC = 0.006; // slivers below this fraction of the cake are not created
  const EPS = 1e-7;

  const CAKE_CENTER_W = new V3(0, STAND_TOP + H / 2, 0);
  const CAM_TARGET = new V3(0, STAND_TOP + H * 0.3, 0);
  const EL_MIN = 4 * DEG;
  const EL_MAX = 80 * DEG;
  const EL_DEFAULT = 22 * DEG;
  const HORIZONTAL_SNAP = 12 * DEG;
  const VERTICAL_SNAP = 10 * DEG;
  const TOP_PROJECTION_MIN_EL = 16 * DEG;

  // ---------------------------------------------------------------------------
  // Renderer / scene
  // ---------------------------------------------------------------------------
  const canvas = $('#scene');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.94;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.localClippingEnabled = true;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xe8dac5);
  const camera = new THREE.PerspectiveCamera(38, 1, 0.05, 120);

  const rng = mulberry32(20260929);
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ---------------------------------------------------------------------------
  // Kitchen (js/kitchen.js) + lighting
  // ---------------------------------------------------------------------------
  if (typeof window.buildKitchen !== 'function') {
    loader.querySelector('.loader-text').textContent = 'File js/kitchen.js tidak ditemukan.';
    return;
  }
  const kitchen = window.buildKitchen(THREE, renderer, rng);
  scene.add(kitchen.root);

  scene.add(new THREE.HemisphereLight(0xfff1de, 0x8c6a4c, 0.5));
  // Golden sun through the left window: the key light, and the only shadow caster.
  const sun = new THREE.DirectionalLight(0xffd29a, 3.1);
  sun.position.set(-15, 13, 5);
  sun.target.position.set(0, 0, -0.3);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -6.5; sun.shadow.camera.right = 6.5;
  sun.shadow.camera.top = 6.5; sun.shadow.camera.bottom = -6.5;
  sun.shadow.camera.near = 4; sun.shadow.camera.far = 45;
  sun.shadow.bias = -0.0003;
  sun.shadow.normalBias = 0.02;
  scene.add(sun, sun.target);
  const fill = new THREE.DirectionalLight(0xffe9d6, 0.6);
  fill.position.set(9, 7, 11);
  scene.add(fill);
  const rim = new THREE.DirectionalLight(0xffc88a, 0.8);
  rim.position.set(2, 7, -12);
  scene.add(rim);
  const windowGlow = new THREE.PointLight(0xffe0a8, 40, 34, 2);
  windowGlow.position.set(-15.5, 7, -1);
  scene.add(windowGlow);

  // Reflections come from the kitchen itself, captured once from above the island.
  {
    const pm = new THREE.PMREMGenerator(renderer);
    kitchen.root.position.y = -1.4;
    kitchen.root.updateMatrixWorld(true);
    scene.environment = pm.fromScene(scene, 0.02, 0.1, 100).texture;
    kitchen.root.position.y = 0;
    kitchen.root.updateMatrixWorld(true);
    pm.dispose();
  }
  scene.add(kitchen.props);

  // ---------------------------------------------------------------------------
  // Small canvas textures
  // ---------------------------------------------------------------------------
  function canvasTex(size, draw, srgb = true) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    draw(c.getContext('2d'), size);
    const t = new THREE.CanvasTexture(c);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  const blobTex = canvasTex(256, (g, s) => {
    const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    gr.addColorStop(0, 'rgba(0,0,0,0.75)');
    gr.addColorStop(0.45, 'rgba(0,0,0,0.45)');
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, s, s);
  }, false);

  const planeTex = canvasTex(256, (g, s) => {
    g.fillStyle = 'rgba(255,248,236,0.5)';
    g.fillRect(0, 0, s, s);
    for (let i = 0; i < 14; i++) {
      const a = (1 - i / 14) * 0.9;
      g.strokeStyle = `rgba(255,${214 + i * 2},${160 + i * 5},${a * a})`;
      g.lineWidth = 2;
      g.strokeRect(i + 1, i + 1, s - 2 * (i + 1), s - 2 * (i + 1));
    }
  });

  // ---------------------------------------------------------------------------
  // Cake stand
  // ---------------------------------------------------------------------------
  const contact = new THREE.Mesh(
    new THREE.PlaneGeometry(3.8, 3.8),
    new THREE.MeshBasicMaterial({ color: 0x3a1f10, alphaMap: blobTex, transparent: true, opacity: 0.5, depthWrite: false })
  );
  contact.rotation.x = -Math.PI / 2;
  contact.position.y = 0.004;
  scene.add(contact);

  const standMat = new THREE.MeshPhysicalMaterial({
    color: 0xfff6ea, map: kitchen.marbleTex, roughness: 0.3, clearcoat: 0.9, clearcoatRoughness: 0.1, envMapIntensity: 0.8,
  });
  const standProfile = [
    [0.0, 0.0], [0.92, 0.0], [0.97, 0.018], [0.95, 0.05], [0.78, 0.085], [0.5, 0.12], [0.3, 0.16],
    [0.21, 0.22], [0.2, 0.3], [0.26, 0.345], [0.55, 0.375], [1.45, 0.4], [1.62, 0.415], [1.66, 0.44],
    [1.645, 0.462], [1.6, 0.468], [1.52, 0.46], [0.0, STAND_TOP],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const stand = new THREE.Mesh(new THREE.LatheGeometry(standProfile, 128), standMat);
  stand.castShadow = true;
  stand.receiveShadow = true;
  scene.add(stand);

  // ---------------------------------------------------------------------------
  // Cake material: layered interior computed from canonical position, so every
  // new cut face shows sponge / buttercream / ganache without UV stretching.
  // ---------------------------------------------------------------------------
  const CAKE_GLSL = /* glsl */`
    uniform float uR;
    uniform float uH;
    varying vec3 vCakePos;
    struct CakeSurf { vec3 col; float rough; float h; };
    float ck_hash(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.yzx + 33.33); return fract((p.x + p.y) * p.z); }
    float ck_noise(vec3 p) {
      vec3 i = floor(p); vec3 f = fract(p); f = f * f * (3.0 - 2.0 * f);
      float a = ck_hash(i), b = ck_hash(i + vec3(1,0,0)), c = ck_hash(i + vec3(0,1,0)), d = ck_hash(i + vec3(1,1,0));
      float e = ck_hash(i + vec3(0,0,1)), f1 = ck_hash(i + vec3(1,0,1)), g = ck_hash(i + vec3(0,1,1)), h = ck_hash(i + vec3(1,1,1));
      return mix(mix(mix(a, b, f.x), mix(c, d, f.x), f.y), mix(mix(e, f1, f.x), mix(g, h, f.x), f.y), f.z);
    }
    float ck_fbm(vec3 p) {
      float s = 0.0, a = 0.5;
      for (int i = 0; i < 4; i++) { s += a * ck_noise(p); p = p * 2.07 + vec3(1.7, 9.2, 3.1); a *= 0.5; }
      return s;
    }
    vec3 ck_srgb(vec3 c) { return pow(c, vec3(2.2)); }
    CakeSurf cakeSurface(vec3 p) {
      CakeSurf s;
      float r = length(p.xz);
      float ang = atan(p.z, p.x);
      float edge = uR - r;
      float yr = p.y / uH;
      float wav = 0.012 * sin(ang * 3.0 + 1.3) + 0.012 * (ck_noise(vec3(p.x * 2.5, 0.0, p.z * 2.5)) - 0.5);
      float y = yr + wav;

      // chocolate sponge with pores
      float pores = ck_noise(p * 120.0);
      float pores2 = ck_noise(p * 52.0 + 3.1);
      float grain = ck_fbm(p * 20.0);
      float pit = clamp(smoothstep(0.62, 0.84, pores) * 0.85 + smoothstep(0.72, 0.9, pores2) * 0.6, 0.0, 1.0);
      vec3 sponge = mix(ck_srgb(vec3(0.25, 0.12, 0.075)), ck_srgb(vec3(0.37, 0.2, 0.125)), grain);
      sponge *= 1.0 - 0.6 * pit;
      vec3 col = sponge;
      float rough = 0.93;
      float h = -0.004 * pit + 0.0015 * grain;

      // buttercream fillings (lighter, smoother)
      float c1 = smoothstep(0.293, 0.307, y) * (1.0 - smoothstep(0.393, 0.407, y));
      float c2 = smoothstep(0.623, 0.637, y) * (1.0 - smoothstep(0.723, 0.737, y));
      float cream = max(c1, c2);
      float streak = ck_fbm(vec3(p.x * 3.0, y * 44.0, p.z * 3.0));
      vec3 creamC = mix(ck_srgb(vec3(0.55, 0.335, 0.22)), ck_srgb(vec3(0.67, 0.44, 0.3)), streak);
      col = mix(col, creamC, cream);
      rough = mix(rough, 0.58, cream);
      h = mix(h, 0.0012 * streak, cream);

      // glossy ganache top layer (the rim lip and drips are separate geometry)
      float ganAll = smoothstep(0.925, 0.937, y);
      vec3 ganC = ck_srgb(vec3(0.25, 0.1, 0.05)) * (0.9 + 0.2 * ck_noise(p * 5.0));
      col = mix(col, ganC, ganAll);
      rough = mix(rough, 0.1, ganAll);
      h = mix(h, 0.0, ganAll);
      float topFace = step(0.997, yr);
      h += topFace * 0.0001 * sin(r * 30.0 + ck_noise(p * 2.0) * 2.5);

      // chocolate crumb coating around the base
      float crumbTop = 0.25 + 0.07 * ck_noise(vec3(p.x * 6.0, 0.5, p.z * 6.0));
      float zone = (1.0 - smoothstep(0.02, 0.045, edge)) * (1.0 - smoothstep(crumbTop - 0.03, crumbTop + 0.02, yr));
      float cb = ck_fbm(p * 26.0);
      float dens = clamp(1.0 - yr / crumbTop, 0.0, 1.0);
      float crumb = zone * smoothstep(0.3, 0.46, cb + dens * 0.3);
      float lumps = ck_noise(p * 34.0);
      float lumps2 = ck_noise(p * 71.0 + 5.0);
      vec3 crumbC = mix(ck_srgb(vec3(0.16, 0.07, 0.04)), ck_srgb(vec3(0.42, 0.22, 0.13)), smoothstep(0.35, 0.85, lumps * 0.7 + lumps2 * 0.3));
      col = mix(col, crumbC, crumb);
      rough = mix(rough, 0.8, crumb);
      h = mix(h, 0.03 * lumps + 0.012 * lumps2, crumb);

      s.col = col; s.rough = rough; s.h = h;
      return s;
    }
    vec3 ck_perturb(vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDir) {
      vec3 sx = dFdx(surf_pos); vec3 sy = dFdy(surf_pos);
      vec3 r1 = cross(sy, surf_norm); vec3 r2 = cross(surf_norm, sx);
      float det = dot(sx, r1) * faceDir;
      vec3 grad = sign(det) * (dHdxy.x * r1 + dHdxy.y * r2);
      return normalize(abs(det) * surf_norm - grad);
    }
  `;

  const cakeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, metalness: 0, envMapIntensity: 0.55 });
  cakeMat.onBeforeCompile = (shader) => {
    shader.uniforms.uR = { value: R };
    shader.uniforms.uH = { value: H };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vCakePos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvCakePos = position;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\n' + CAKE_GLSL)
      .replace('#include <color_fragment>', '#include <color_fragment>\nCakeSurf cs = cakeSurface(vCakePos);\ndiffuseColor.rgb = cs.col;')
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = cs.rough;')
      .replace('#include <normal_fragment_maps>',
        '#include <normal_fragment_maps>\nnormal = ck_perturb(-vViewPosition, normal, vec2(dFdx(cs.h), dFdy(cs.h)), faceDirection);');
  };
  cakeMat.customProgramCacheKey = () => 'cake-layers-v2';

  const rosetteMat = new THREE.MeshPhysicalMaterial({
    color: 0x5c2915, roughness: 0.3, clearcoat: 0.5, clearcoatRoughness: 0.2, envMapIntensity: 0.9,
  });
  // Same look as the ganache top in the cake shader so the lip blends in.
  const ganacheMat = new THREE.MeshPhysicalMaterial({
    color: 0x401a0d, roughness: 0.1, clearcoat: 0.35, clearcoatRoughness: 0.1, envMapIntensity: 0.55, side: THREE.DoubleSide,
  });
  const crumbMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.82, flatShading: true, envMapIntensity: 0.4 });

  // ---------------------------------------------------------------------------
  // Convex polyhedron utilities
  // ---------------------------------------------------------------------------
  function newellNormal(pts) {
    const n = new V3();
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      n.x += (a.y - b.y) * (a.z + b.z);
      n.y += (a.z - b.z) * (a.x + b.x);
      n.z += (a.x - b.x) * (a.y + b.y);
    }
    return n;
  }

  function orient(poly, outward) {
    if (newellNormal(poly.pts).dot(outward) < 0) poly.pts.reverse();
    return poly;
  }

  function makeCakeSolid() {
    const top = [], bottom = [];
    for (let i = 0; i < SEG; i++) {
      const a = (i / SEG) * Math.PI * 2;
      top.push(new V3(Math.cos(a) * R, H, Math.sin(a) * R));
      bottom.push(new V3(Math.cos(a) * R, 0, Math.sin(a) * R));
    }
    const polys = [
      orient({ pts: top.map((p) => p.clone()), kind: 'flat' }, new V3(0, 1, 0)),
      orient({ pts: bottom.map((p) => p.clone()), kind: 'flat' }, new V3(0, -1, 0)),
    ];
    for (let i = 0; i < SEG; i++) {
      const j = (i + 1) % SEG;
      const quad = [bottom[i].clone(), bottom[j].clone(), top[j].clone(), top[i].clone()];
      const mid = bottom[i].clone().add(bottom[j]).setY(0);
      polys.push(orient({ pts: quad, kind: 'side' }, mid));
    }
    return polys;
  }

  // Keep the part of a polygon with n·p - d >= 0.
  function clipPoly(poly, n, d) {
    const src = poly.pts;
    const out = [];
    for (let i = 0; i < src.length; i++) {
      const a = src[i], b = src[(i + 1) % src.length];
      const da = n.dot(a) - d, db = n.dot(b) - d;
      if (da >= -EPS) out.push(a);
      if ((da > EPS && db < -EPS) || (da < -EPS && db > EPS)) out.push(a.clone().lerp(b, da / (da - db)));
    }
    const clean = [];
    for (const p of out) if (!clean.length || clean[clean.length - 1].distanceToSquared(p) > 1e-14) clean.push(p);
    if (clean.length > 1 && clean[0].distanceToSquared(clean[clean.length - 1]) < 1e-14) clean.pop();
    return clean.length >= 3 ? { pts: clean, kind: poly.kind } : null;
  }

  function clipSolid(polys, n, d) {
    const out = [];
    const onPlane = [];
    for (const poly of polys) {
      const c = clipPoly(poly, n, d);
      if (!c) continue;
      out.push(c);
      for (const p of c.pts) if (Math.abs(n.dot(p) - d) < 1e-6) onPlane.push(p);
    }
    const cap = buildCap(onPlane, n.clone().negate());
    if (cap) out.push(cap);
    return out;
  }

  function buildCap(points, outward) {
    const uniq = [];
    for (const p of points) if (!uniq.some((q) => q.distanceToSquared(p) < 1e-12)) uniq.push(p.clone());
    if (uniq.length < 3) return null;
    const c = new V3();
    uniq.forEach((p) => c.add(p));
    c.divideScalar(uniq.length);
    const u = Math.abs(outward.y) < 0.9 ? new V3(0, 1, 0).cross(outward).normalize() : new V3(1, 0, 0).cross(outward).normalize();
    const v = new V3().crossVectors(outward, u);
    const tmp = new V3();
    uniq.sort((a, b) => {
      tmp.subVectors(a, c); const aa = Math.atan2(tmp.dot(v), tmp.dot(u));
      tmp.subVectors(b, c); const bb = Math.atan2(tmp.dot(v), tmp.dot(u));
      return aa - bb;
    });
    return orient({ pts: uniq, kind: 'cut' }, outward);
  }

  function massProps(polys) {
    let vol = 0;
    const cen = new V3();
    const cr = new V3(), sum = new V3();
    for (const { pts } of polys) {
      const a = pts[0];
      for (let k = 1; k < pts.length - 1; k++) {
        const b = pts[k], c = pts[k + 1];
        const v = a.dot(cr.crossVectors(b, c)) / 6;
        vol += v;
        cen.addScaledVector(sum.copy(a).add(b).add(c), v / 4);
      }
    }
    if (Math.abs(vol) > 1e-12) cen.divideScalar(vol);
    return { vol, centroid: cen };
  }

  function buildGeometry(polys) {
    let tris = 0;
    for (const p of polys) tris += p.pts.length - 2;
    const pos = new Float32Array(tris * 9);
    const nor = new Float32Array(tris * 9);
    let o = 0;
    const fn = new V3();
    const put = (p, n) => {
      pos[o] = p.x; pos[o + 1] = p.y; pos[o + 2] = p.z;
      nor[o] = n.x; nor[o + 1] = n.y; nor[o + 2] = n.z;
      o += 3;
    };
    const radial = (p) => new V3(p.x, 0, p.z).normalize();
    for (const poly of polys) {
      const pts = poly.pts;
      fn.copy(newellNormal(pts)).normalize();
      const side = poly.kind === 'side';
      for (let k = 1; k < pts.length - 1; k++) {
        for (const p of [pts[0], pts[k], pts[k + 1]]) put(p, side ? radial(p) : fn);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    g.computeBoundingSphere();
    return g;
  }

  // ---------------------------------------------------------------------------
  // Cake group, rosettes
  // ---------------------------------------------------------------------------
  const cakeGroup = new THREE.Group();
  cakeGroup.position.y = STAND_TOP;
  scene.add(cakeGroup);

  // Piped star-tip rosette: 8 sharp ridges twisting up to a curled tip.
  function rosetteGeometry() {
    const rings = 48, segs = 128, height = 0.25, base = 0.17;
    const pos = [], idx = [];
    for (let i = 0; i <= rings; i++) {
      const t = i / rings;
      // full swirl body that rounds over into a short soft peak
      const body = Math.pow(Math.max(0, 1 - Math.pow(t, 1.8)), 0.7);
      const prof = body * (0.9 + 0.18 * Math.sin(Math.PI * Math.min(1, t * 1.6))) + (t > 0.8 ? 0.05 * (1 - t) : 0);
      const lean = 0.035 * t * t * t;
      for (let j = 0; j <= segs; j++) {
        const th = (j / segs) * Math.PI * 2;
        const ridge = Math.pow(Math.abs(Math.cos((th + t * 3.4) * 4)), 0.55);
        const rr = base * prof * (0.74 + 0.28 * ridge * (1 - 0.5 * t));
        pos.push(Math.cos(th) * rr + lean, t * height, Math.sin(th) * rr);
      }
    }
    for (let i = 0; i < rings; i++) {
      for (let j = 0; j < segs; j++) {
        const a = i * (segs + 1) + j, b = a + segs + 1;
        idx.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }

  function mergeGeos(geos) {
    const parts = geos.map((g) => (g.index ? g.toNonIndexed() : g));
    let n = 0;
    for (const g of parts) n += g.attributes.position.count;
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3);
    let o = 0;
    for (const g of parts) {
      pos.set(g.attributes.position.array, o * 3);
      nor.set(g.attributes.normal.array, o * 3);
      o += g.attributes.position.count;
    }
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    out.computeBoundingSphere();
    return out;
  }

  // Ganache shell: rounded lip over the rim + real drips running down the side.
  function ganacheShellGeometry() {
    const parts = [];
    const lip = [
      [R - 0.004, H - 0.082], [R + 0.008, H - 0.078], [R + 0.02, H - 0.066], [R + 0.027, H - 0.045],
      [R + 0.029, H - 0.015], [R + 0.026, H + 0.008], [R + 0.014, H + 0.024], [R - 0.006, H + 0.031],
      [R - 0.04, H + 0.022], [R - 0.1, H + 0.009], [R - 0.2, H + 0.0015],
    ];
    parts.push(new THREE.LatheGeometry(lip.map(([x, y]) => new THREE.Vector2(x, y)), 320));
    const N = 22;
    for (let i = 0; i < N; i++) {
      const a = ((i + (rng() - 0.5) * 0.4) / N) * Math.PI * 2;
      const len = 0.08 + Math.pow(rng(), 1.3) * 0.36;
      const rad = 0.034 + rng() * 0.016;
      const cap = new THREE.CapsuleGeometry(rad, len, 6, 14);
      cap.scale(0.62, 1, 1);
      const bulb = new THREE.SphereGeometry(rad * 1.2, 14, 10);
      bulb.scale(0.66, 1.05, 1);
      bulb.translate(0, -len / 2 + rad * 0.15, 0);
      const y = H - 0.06 - len / 2;
      for (const g of [cap, bulb]) {
        g.rotateY(-a);
        g.translate(Math.cos(a) * (R + 0.004), y, Math.sin(a) * (R + 0.004));
        parts.push(g);
      }
    }
    return mergeGeos(parts);
  }

  // Chocolate crumb coating pressed around the base of the cake.
  const CRUMB_N = 1100;
  const crumbGeo = new THREE.DodecahedronGeometry(1, 0);
  const crumbTemplate = new THREE.InstancedMesh(crumbGeo, crumbMat, CRUMB_N);
  {
    const d = new THREE.Object3D();
    const c = new THREE.Color();
    const dark = new THREE.Color(0x2a1209), light = new THREE.Color(0x6a3a22);
    for (let i = 0; i < CRUMB_N; i++) {
      const a = rng() * Math.PI * 2;
      const t = Math.pow(rng(), 1.7);
      const sz = 0.012 + (1 - t) * 0.024 * (0.4 + rng() * 0.6);
      const y = Math.max(sz * 0.7, t * H * 0.3);
      const r = R + sz * 0.3;
      d.position.set(Math.cos(a) * r, y, Math.sin(a) * r);
      d.rotation.set(rng() * 3, rng() * 3, rng() * 3);
      d.scale.set(sz * (0.8 + rng() * 0.5), sz * (0.6 + rng() * 0.5), sz * (0.8 + rng() * 0.5));
      d.updateMatrix();
      crumbTemplate.setMatrixAt(i, d.matrix);
      crumbTemplate.setColorAt(i, c.copy(dark).lerp(light, Math.pow(rng(), 1.6)));
    }
  }
  const shellGeo = ganacheShellGeometry();

  const rosetteGeo = rosetteGeometry();
  const ROSETTE_COUNT = 8;
  const rosettes = [];
  for (let k = 0; k < ROSETTE_COUNT; k++) {
    const a = (k + 0.5) * (Math.PI * 2 / ROSETTE_COUNT);
    const base = new V3(Math.cos(a) * (R - 0.23), H - 0.004, Math.sin(a) * (R - 0.23));
    const m = new THREE.Mesh(rosetteGeo, rosetteMat);
    m.rotation.y = rng() * Math.PI * 2;
    m.castShadow = true;
    m.receiveShadow = true;
    cakeGroup.add(m);
    rosettes.push({ base, mesh: m, owner: 1 });
  }

  // ---------------------------------------------------------------------------
  // Game state
  // ---------------------------------------------------------------------------
  let nextPieceId = 1;
  const INITIAL_POLYS = makeCakeSolid();
  const INITIAL_MASS = massProps(INITIAL_POLYS);
  const TOTAL_VOLUME = INITIAL_MASS.vol;

  function initialPiece() {
    return {
      id: nextPieceId++,
      parentId: null,
      polys: INITIAL_POLYS,
      volume: INITIAL_MASS.vol,
      centroid: INITIAL_MASS.centroid.clone(),
      planes: [],
      rosettes: rosettes.map((_, i) => i),
    };
  }

  const state = {
    started: false,
    gameOver: false,
    evaluating: false,
    cutsUsed: 0,
    maxCuts: MAX_CUTS,
    pieces: [initialPiece()],
    history: [],
    cuts: [],
    exploded: false,
    interactionMode: 'cut',
    elapsedMs: 0,
    camera: { theta: 0, phi: EL_DEFAULT, radius: 6.2 },
  };
  let timerStart = 0;
  let timerRunning = false;
  let resultData = null;

  // Visual layer: pieceId -> { mesh, piece, cur, target }
  const visuals = new Map();

  function syncVisuals() {
    const alive = new Set(state.pieces.map((p) => p.id));
    for (const p of state.pieces) {
      if (visuals.has(p.id)) { visuals.get(p.id).piece = p; continue; }
      const mesh = new THREE.Mesh(buildGeometry(p.polys), cakeMat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      // New pieces start where their parent (split) or children (undo) currently are.
      const start = new V3();
      const parent = p.parentId != null ? visuals.get(p.parentId) : null;
      if (parent) start.copy(parent.cur);
      else {
        let n = 0;
        for (const vis of visuals.values()) if (vis.piece.parentId === p.id) { start.add(vis.cur); n++; }
        if (n) start.divideScalar(n);
      }
      mesh.position.copy(start);
      cakeGroup.add(mesh);
      // The shared ganache shell and crumbs are clipped to this piece's region,
      // so decorations split exactly where the cake does.
      const planes = p.planes.map(() => new THREE.Plane());
      const gMat = ganacheMat.clone();
      const cMat = crumbMat.clone();
      for (const m of [gMat, cMat]) { m.clippingPlanes = planes; m.clipShadows = true; }
      const deco = new THREE.Group();
      const shell = new THREE.Mesh(shellGeo, gMat);
      shell.castShadow = true;
      shell.receiveShadow = true;
      const crumbsMesh = new THREE.InstancedMesh(crumbGeo, cMat, CRUMB_N);
      crumbsMesh.instanceMatrix = crumbTemplate.instanceMatrix;
      crumbsMesh.instanceColor = crumbTemplate.instanceColor;
      crumbsMesh.receiveShadow = true;
      crumbsMesh.frustumCulled = false;
      deco.add(shell, crumbsMesh);
      deco.position.copy(start);
      cakeGroup.add(deco);
      visuals.set(p.id, { mesh, deco, planes, mats: [gMat, cMat], piece: p, cur: start, target: new V3() });
    }
    for (const [id, vis] of visuals) {
      if (alive.has(id)) continue;
      disposeVisual(vis);
      visuals.delete(id);
    }
    for (const p of state.pieces) for (const r of p.rosettes) rosettes[r].owner = p.id;
    updateTargets();
  }

  function disposeVisual(vis) {
    cakeGroup.remove(vis.mesh, vis.deco);
    vis.mesh.geometry.dispose();
    for (const m of vis.mats) m.dispose();
  }

  // Clip planes live in world space, so they follow each piece's visual offset.
  const tmpV = new V3();
  function updateClipPlanes(vis) {
    const pl = vis.piece.planes;
    tmpV.copy(cakeGroup.position).add(vis.cur);
    for (let i = 0; i < pl.length; i++) {
      vis.planes[i].normal.copy(pl[i].n);
      vis.planes[i].constant = -(pl[i].d + pl[i].n.dot(tmpV));
    }
  }

  function updateTargets() {
    const s = state.exploded ? 0.56 : 0.13;
    const sy = state.exploded ? 1.05 : 0.4;
    for (const vis of visuals.values()) {
      const c = vis.piece.centroid;
      vis.target.set(c.x * s, Math.max(0, c.y - H / 2) * sy, c.z * s);
    }
  }

  // Cut every piece crossed by the plane (cake-local). Returns new piece list or null.
  function applyCut(n, d) {
    const minVol = TOTAL_VOLUME * MIN_PIECE_FRAC;
    const next = [];
    let splits = 0;
    const neg = n.clone().negate();
    for (const piece of state.pieces) {
      let hasPos = false, hasNeg = false;
      for (const poly of piece.polys) {
        for (const p of poly.pts) {
          const s = n.dot(p) - d;
          if (s > 1e-5) hasPos = true; else if (s < -1e-5) hasNeg = true;
        }
        if (hasPos && hasNeg) break;
      }
      if (!(hasPos && hasNeg)) { next.push(piece); continue; }
      const A = clipSolid(piece.polys, n, d);
      const B = clipSolid(piece.polys, neg, -d);
      const ma = massProps(A), mb = massProps(B);
      if (ma.vol < minVol || mb.vol < minVol) { next.push(piece); continue; }
      const ra = [], rb = [];
      for (const r of piece.rosettes) (n.dot(rosettes[r].base) - d >= 0 ? ra : rb).push(r);
      next.push(
        { id: nextPieceId++, parentId: piece.id, polys: A, volume: ma.vol, centroid: ma.centroid, rosettes: ra, planes: piece.planes.concat([{ n: n.clone(), d }]) },
        { id: nextPieceId++, parentId: piece.id, polys: B, volume: mb.vol, centroid: mb.centroid, rosettes: rb, planes: piece.planes.concat([{ n: neg.clone(), d: -d }]) },
      );
      splits++;
    }
    return splits ? next : null;
  }

  // ---------------------------------------------------------------------------
  // Camera (custom orbit with damping)
  // ---------------------------------------------------------------------------
  const BASE_R = 7.6;
  const CAM_MAX_Y = 9.4;      // stay below the pendant lamps
  const CAM_MAX_REACH = 12.4; // stay in front of the perimeter cabinets
  const cam = { az: 0, el: EL_DEFAULT, r: BASE_R, taz: 0, tel: EL_DEFAULT, tr: BASE_R, rMin: 4.4, rMax: 12, shake: 0, autoOrbit: 0 };
  let portraitScale = 1;

  function defaultRadius() {
    return BASE_R * portraitScale;
  }

  function resetCamera(instant) {
    const wrap = ((cam.az % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2) - Math.PI;
    cam.taz = cam.az - wrap;
    cam.tel = EL_DEFAULT;
    cam.tr = defaultRadius();
    if (instant) { cam.az = cam.taz; cam.el = cam.tel; cam.r = cam.tr; }
  }

  function updateCamera(dt) {
    if (cam.autoOrbit > 0) { cam.taz += dt * 0.28; cam.autoOrbit -= dt; }
    cam.tel = Math.min(EL_MAX, Math.max(EL_MIN, cam.tel));
    cam.tr = Math.min(cam.rMax, Math.max(cam.rMin, cam.tr));
    const k = 1 - Math.exp(-dt * 10);
    cam.az += (cam.taz - cam.az) * k;
    cam.el += (cam.tel - cam.el) * k;
    cam.r += (cam.tr - cam.r) * k;
    const ce = Math.cos(cam.el);
    // Pull back a little when looking from above so the whole top stays in frame.
    const lift = Math.min(1, Math.max(0, (cam.el - EL_DEFAULT) / (EL_MAX - EL_DEFAULT)));
    let r = cam.r * (1 + 0.3 * lift);
    r = Math.min(r, (CAM_MAX_Y - CAM_TARGET.y) / Math.max(0.05, Math.sin(cam.el)), CAM_MAX_REACH / Math.max(0.05, Math.cos(cam.el)));
    camera.position.set(
      CAM_TARGET.x + r * ce * Math.sin(cam.az),
      CAM_TARGET.y + r * Math.sin(cam.el),
      CAM_TARGET.z + r * ce * Math.cos(cam.az)
    );
    const look = CAM_TARGET.clone();
    if (cam.shake > 0) {
      look.y += Math.sin(cam.shake * 60) * cam.shake * 0.05;
      cam.shake = Math.max(0, cam.shake - dt);
    }
    camera.lookAt(look);
    state.camera.theta = cam.az; state.camera.phi = cam.el; state.camera.radius = cam.r;
  }

  // ---------------------------------------------------------------------------
  // Cut plane from a screen drag
  // ---------------------------------------------------------------------------
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();

  function rayAt(x, y) {
    ndc.set((x / window.innerWidth) * 2 - 1, -(y / window.innerHeight) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    return raycaster.ray.clone();
  }

  // Distance along the ray to the first hit on the canonical cake cylinder, or -1.
  function rayCakeT(ray) {
    const o = ray.origin, d = ray.direction;
    const y0 = STAND_TOP, y1 = STAND_TOP + H;
    let best = -1;
    const take = (t) => { if (t > 0 && (best < 0 || t < best)) best = t; };
    const a = d.x * d.x + d.z * d.z;
    const b = 2 * (o.x * d.x + o.z * d.z);
    const c = o.x * o.x + o.z * o.z - R * R;
    if (a > 1e-9) {
      const disc = b * b - 4 * a * c;
      if (disc >= 0) {
        const sq = Math.sqrt(disc);
        for (const t of [(-b - sq) / (2 * a), (-b + sq) / (2 * a)]) {
          const y = o.y + d.y * t;
          if (y >= y0 && y <= y1) take(t);
        }
      }
    }
    if (Math.abs(d.y) > 1e-9) {
      for (const yc of [y0, y1]) {
        const t = (yc - o.y) / d.y;
        const x = o.x + d.x * t, z = o.z + d.z * t;
        if (x * x + z * z <= R * R) take(t);
      }
    }
    return best;
  }

  function strokeHits(a, b) {
    const hits = [];
    const steps = 32;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const ray = rayAt(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);
      const d = rayCakeT(ray);
      if (d > 0) hits.push(ray.at(d, new V3()));
    }
    return hits;
  }

  function strokeTouchesCake(a, b) {
    return strokeHits(a, b).length > 0;
  }

  // World-space plane { n, point } for a drag from a to b (screen px).
  function planeFromDrag(a, b) {
    const r1 = rayAt(a.x, a.y), r2 = rayAt(b.x, b.y);
    const n = new V3().crossVectors(r1.direction, r2.direction);
    if (n.lengthSq() < 1e-10) return null;
    n.normalize();
    const eye = camera.position.clone();
    const upDot = Math.abs(n.y);

    // Knife held level: a (nearly) horizontal plane through where it crosses the cake axis.
    if (upDot > Math.cos(HORIZONTAL_SNAP)) {
      // Level the plane at the height where the stroke actually touches the visible cake.
      const hits = strokeHits(a, b);
      const y = hits.length ? hits.reduce((acc, p) => acc + p.y, 0) / hits.length : n.dot(eye) / n.y;
      return { n: new V3(0, 1, 0), point: new V3(0, y, 0), kind: 'horizontal' };
    }

    // Looking down on the cake: the stroke is drawn on the top surface -> vertical cut through it.
    if (cam.el >= TOP_PROJECTION_MIN_EL) {
      const topY = STAND_TOP + H;
      const hit = (ray) => {
        if (Math.abs(ray.direction.y) < 1e-6) return null;
        const t = (topY - ray.origin.y) / ray.direction.y;
        return t > 0 ? ray.origin.clone().addScaledVector(ray.direction, t) : null;
      };
      const p1 = hit(r1), p2 = hit(r2);
      if (p1 && p2) {
        const dir = p2.clone().sub(p1);
        dir.y = 0;
        if (dir.lengthSq() < 1e-8) return null;
        const vn = new V3(0, 1, 0).cross(dir).normalize();
        return { n: vn, point: p1, kind: 'vertical' };
      }
    }

    // Low camera: plane along the line of sight, lightly stabilised when nearly vertical.
    const anchor = CAKE_CENTER_W.clone().addScaledVector(n, -n.dot(CAKE_CENTER_W.clone().sub(eye)));
    if (upDot < Math.sin(VERTICAL_SNAP)) {
      const vn = new V3(n.x, 0, n.z).normalize();
      return { n: vn, point: anchor, kind: 'vertical' };
    }
    return { n, point: eye, kind: 'angled' };
  }

  // ---------------------------------------------------------------------------
  // Cut preview plane, crumbs
  // ---------------------------------------------------------------------------
  const previewMat = new THREE.MeshBasicMaterial({
    map: planeTex, color: 0xfff3e2, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide,
    toneMapped: false,
  });
  const preview = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), previewMat);
  preview.renderOrder = 10;
  preview.visible = false;
  scene.add(preview);
  let previewFlash = 0;

  function placePreview(plane) {
    const n = plane.n;
    const center = CAKE_CENTER_W.clone().addScaledVector(n, -n.dot(CAKE_CENTER_W.clone().sub(plane.point)));
    const u = Math.abs(n.y) < 0.98 ? new V3().crossVectors(new V3(0, 1, 0), n).normalize() : new V3(1, 0, 0);
    const v = new V3().crossVectors(n, u);
    const m = new THREE.Matrix4().makeBasis(u, v, n);
    preview.quaternion.setFromRotationMatrix(m);
    preview.position.copy(center);
    const w = R * 2 * 1.3;
    const hgt = Math.abs(n.y) < 0.5 ? H * 1.8 : R * 2 * 1.3;
    preview.scale.set(w, hgt, 1);
    preview.visible = true;
  }

  const CRUMBS = 40;
  const crumbMesh = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(0.018, 0),
    new THREE.MeshStandardMaterial({ color: 0x3a1b0e, roughness: 0.9 }),
    CRUMBS
  );
  crumbMesh.frustumCulled = false;
  cakeGroup.add(crumbMesh);
  const crumbs = Array.from({ length: CRUMBS }, () => ({ p: new V3(), v: new V3(), life: 0, max: 1, s: 1 }));
  const dummy = new THREE.Object3D();

  function spawnCrumbs(n, d) {
    const u = Math.abs(n.y) < 0.9 ? new V3().crossVectors(new V3(0, 1, 0), n).normalize() : new V3(1, 0, 0);
    const v = new V3().crossVectors(n, u);
    const c0 = n.clone().multiplyScalar(d);
    let made = 0;
    for (let tries = 0; tries < 500 && made < CRUMBS; tries++) {
      const p = c0.clone().addScaledVector(u, (rng() * 2 - 1) * R).addScaledVector(v, (rng() * 2 - 1) * R);
      if (p.x * p.x + p.z * p.z > R * R || p.y < 0.2 * H || p.y > H) continue;
      if (rng() > 0.35 && p.y < H * 0.85 && p.x * p.x + p.z * p.z < (R * 0.85) ** 2) continue;
      const cr = crumbs[made++];
      cr.p.copy(p);
      cr.v.copy(n).multiplyScalar((rng() < 0.5 ? -1 : 1) * (0.25 + rng() * 0.5));
      cr.v.y += 0.4 + rng() * 0.6;
      cr.max = cr.life = 0.55 + rng() * 0.4;
      cr.s = 0.6 + rng() * 0.9;
    }
  }

  function updateCrumbs(dt) {
    for (let i = 0; i < CRUMBS; i++) {
      const c = crumbs[i];
      if (c.life > 0) {
        c.life -= dt;
        c.v.y -= 5.5 * dt;
        c.p.addScaledVector(c.v, dt);
      }
      const s = c.life > 0 ? c.s * Math.min(1, c.life / c.max * 2) : 0;
      dummy.position.copy(c.p);
      dummy.rotation.set(i, i * 1.7, c.life * 6);
      dummy.scale.setScalar(s);
      dummy.updateMatrix();
      crumbMesh.setMatrixAt(i, dummy.matrix);
    }
    crumbMesh.instanceMatrix.needsUpdate = true;
  }

  // ---------------------------------------------------------------------------
  // Audio (tiny synthesized sounds, quiet)
  // ---------------------------------------------------------------------------
  let actx = null;
  function audio() {
    if (!actx) {
      try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; }
    }
    if (actx.state === 'suspended') actx.resume();
    return actx;
  }
  function playSlice() {
    const c = audio(); if (!c) return;
    const dur = 0.24;
    const buf = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      const t = i / data.length;
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 2) * Math.min(1, t * 30);
    }
    const src = c.createBufferSource();
    src.buffer = buf;
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 1.4;
    bp.frequency.setValueAtTime(3200, c.currentTime);
    bp.frequency.exponentialRampToValueAtTime(900, c.currentTime + dur);
    const g = c.createGain();
    g.gain.value = 0.16;
    src.connect(bp).connect(g).connect(c.destination);
    src.start();
  }
  function tone(freq, start, dur, vol, type = 'sine') {
    const c = audio(); if (!c) return;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.value = freq;
    const t0 = c.currentTime + start;
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(c.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }
  const playClick = () => tone(880, 0, 0.06, 0.03);
  const playMiss = () => tone(190, 0, 0.14, 0.05, 'triangle');
  const playChime = () => { tone(659.25, 0, 0.6, 0.05); tone(783.99, 0.12, 0.6, 0.05); tone(1046.5, 0.24, 0.9, 0.05); };
  const playSoft = () => { tone(392, 0, 0.5, 0.04); tone(329.6, 0.14, 0.6, 0.04); };

  // ---------------------------------------------------------------------------
  // UI
  // ---------------------------------------------------------------------------
  const ui = {
    cutsLeft: $('#cuts-left'),
    pieces: $('#piece-count'),
    timer: $('#timer'),
    toast: $('#toast'),
    modeCut: $('#mode-cut'),
    modeRotate: $('#mode-rotate'),
    undo: $('#btn-undo'),
    explode: $('#btn-explode'),
    explodeLabel: $('#explode-label'),
    reset: $('#btn-reset'),
    intro: $('#intro'),
    start: $('#btn-start'),
    result: $('#result'),
    reopen: $('#reopen-result'),
    dragLine: $('#drag-line'),
    knife: $('#knife-cursor'),
    hud: $('#hud'),
  };

  function fmtTime(ms) {
    const s = Math.floor(ms / 1000);
    return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
  }

  function setStat(el, value) {
    const text = String(value);
    if (el.textContent === text) return;
    el.textContent = text;
    el.classList.remove('bump');
    void el.offsetWidth;
    el.classList.add('bump');
  }

  function refreshUI() {
    setStat(ui.cutsLeft, state.maxCuts - state.cutsUsed);
    setStat(ui.pieces, state.pieces.length);
    ui.undo.disabled = !state.history.length || state.gameOver || state.evaluating;
    ui.modeCut.disabled = state.gameOver;
    const rotate = state.interactionMode === 'rotate' || state.gameOver;
    ui.modeCut.classList.toggle('active', !rotate);
    ui.modeRotate.classList.toggle('active', rotate);
    ui.modeCut.setAttribute('aria-pressed', String(!rotate));
    ui.modeRotate.setAttribute('aria-pressed', String(rotate));
    ui.explode.setAttribute('aria-pressed', String(state.exploded));
    ui.explodeLabel.textContent = state.exploded ? 'Satukan' : 'Pisahkan';
    document.body.classList.toggle('mode-rotate', rotate);
    document.body.classList.toggle('game-over', state.gameOver);
  }

  let toastTimer = 0;
  function toast(msg, ms = 2400) {
    ui.toast.textContent = msg;
    ui.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => ui.toast.classList.remove('show'), ms);
  }

  function updateHudOffset() {
    const r = ui.hud.getBoundingClientRect();
    document.documentElement.style.setProperty('--hud-bottom', Math.round(r.bottom) + 'px');
  }

  // ---------------------------------------------------------------------------
  // Game flow
  // ---------------------------------------------------------------------------
  const ORDINAL = ['pertama', 'kedua', 'ketiga'];

  function commitCut(plane) {
    const G = cakeGroup.position;
    const nL = plane.n.clone().normalize();
    const dL = nL.dot(plane.point) - nL.dot(G);
    const next = applyCut(nL, dL);
    if (!next) {
      toast('Potongan tidak mengenai kue.');
      playMiss();
      return false;
    }
    state.history.push({ piecesSnapshot: state.pieces, cutsUsed: state.cutsUsed, cuts: state.cuts });
    state.pieces = next;
    state.cutsUsed += 1;
    state.cuts = state.cuts.concat([{ normal: nL.toArray(), distance: dL, timestamp: Date.now() }]);
    syncVisuals();

    placePreview(plane);
    previewFlash = 0.22;
    spawnCrumbs(nL, dL);
    cam.shake = 0.18;
    playSlice();

    const left = state.maxCuts - state.cutsUsed;
    const n = state.pieces.length;
    toast(`Potongan ${ORDINAL[state.cutsUsed - 1]} selesai. Sekarang ada ${n} bagian.` + (left ? ` Sisa ${left} potongan.` : ''));
    refreshUI();

    if (state.cutsUsed >= state.maxCuts) {
      state.evaluating = true;
      refreshUI();
      setTimeout(evaluate, 700);
    }
    return true;
  }

  function evaluate() {
    state.evaluating = false;
    state.gameOver = true;
    timerRunning = false;
    state.elapsedMs = performance.now() - timerStart;
    ui.timer.textContent = fmtTime(state.elapsedMs);

    const vols = state.pieces.map((p) => p.volume);
    const total = vols.reduce((a, b) => a + b, 0);
    const ideal = total / TARGET_PIECES;
    const devs = vols.map((v) => Math.abs(v - ideal) / ideal * 100);
    const count = state.pieces.length;
    const meanDev = devs.reduce((a, b) => a + b, 0) / devs.length;
    const maxDev = Math.max(...devs);
    const balance = count === TARGET_PIECES ? Math.max(0, 100 - meanDev) : null;
    const success = count === TARGET_PIECES && maxDev <= SUCCESS_MAX_DEV;

    resultData = { count, balance, maxDev, success, time: state.elapsedMs, shares: vols.map((v) => v / total * 100) };

    if (success) {
      state.exploded = true;
      updateTargets();
      if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) cam.autoOrbit = 3.5;
      playChime();
    } else {
      playSoft();
    }
    refreshUI();
    setTimeout(showResult, success ? 2200 : 450);
  }

  function showResult() {
    const r = resultData;
    if (!r) return;
    const tag = $('#result-tag');
    const title = $('#result-title');
    const sub = $('#result-sub');
    if (r.success) {
      tag.textContent = 'Challenge Completed';
      title.textContent = 'Tantangan berhasil!';
      sub.textContent = '8 bagian sama besar dengan 3 kali potong.';
    } else if (r.count === TARGET_PIECES) {
      tag.textContent = 'Hasil';
      title.textContent = '8 bagian terbentuk, tapi ukurannya belum sama.';
      sub.textContent = '';
    } else {
      tag.textContent = 'Hasil';
      title.textContent = 'Tantangan belum berhasil.';
      sub.textContent = `Terbentuk ${r.count} bagian dari target 8.`;
    }
    sub.hidden = !sub.textContent;
    $('#r-pieces').textContent = `${r.count} / 8`;
    $('#r-balance').textContent = r.balance == null ? '—' : `${Math.round(r.balance)}%`;
    $('#r-time').textContent = fmtTime(r.time);

    const bars = $('#bars');
    bars.innerHTML = '';
    const top = Math.max(25, ...r.shares) * 1.1;
    const line = document.createElement('div');
    line.className = 'ideal-line';
    line.style.bottom = `calc(20px + ${(12.5 / top) * 100}% - ${(12.5 / top) * 20}px)`;
    bars.appendChild(line);
    r.shares.forEach((pct, i) => {
      const bar = document.createElement('div');
      bar.className = 'bar';
      const fill = document.createElement('div');
      fill.className = 'bar-fill' + (Math.abs(pct - 12.5) / 12.5 * 100 > SUCCESS_MAX_DEV ? ' off' : '');
      fill.style.height = `${(pct / top) * 100}%`;
      fill.style.animationDelay = `${i * 60}ms`;
      const label = document.createElement('span');
      label.className = 'bar-pct';
      label.textContent = pct.toFixed(1).replace('.', ',') + '%';
      bar.append(fill, label);
      bars.appendChild(bar);
    });

    ui.result.hidden = false;
    ui.reopen.hidden = true;
    $('#btn-again').focus({ preventScroll: true });
  }

  function hideResult() {
    ui.result.hidden = true;
    if (state.gameOver) ui.reopen.hidden = false;
  }

  function resetGame(announce) {
    state.pieces = [initialPiece()];
    state.history = [];
    state.cuts = [];
    state.cutsUsed = 0;
    state.gameOver = false;
    state.evaluating = false;
    state.exploded = false;
    state.interactionMode = 'cut';
    state.elapsedMs = 0;
    resultData = null;
    for (const vis of visuals.values()) disposeVisual(vis);
    visuals.clear();
    syncVisuals();
    cam.autoOrbit = 0;
    resetCamera(false);
    cancelDrag();
    preview.visible = false;
    ui.result.hidden = true;
    ui.reopen.hidden = true;
    timerStart = performance.now();
    timerRunning = state.started;
    ui.timer.textContent = '00:00';
    refreshUI();
    if (announce) toast('Game direset.');
  }

  function undo() {
    if (!state.history.length || state.gameOver || state.evaluating) return;
    const h = state.history.pop();
    state.pieces = h.piecesSnapshot;
    state.cutsUsed = h.cutsUsed;
    state.cuts = h.cuts;
    syncVisuals();
    preview.visible = false;
    refreshUI();
    playClick();
    toast('Undo berhasil.');
  }

  function setMode(mode) {
    if (state.gameOver && mode === 'cut') return;
    state.interactionMode = mode;
    playClick();
    refreshUI();
  }

  ui.start.addEventListener('click', () => {
    ui.intro.hidden = true;
    document.body.classList.remove('pre');
    state.started = true;
    timerStart = performance.now();
    timerRunning = true;
    audio();
    playClick();
    updateHudOffset();
  });
  ui.modeCut.addEventListener('click', () => setMode('cut'));
  ui.modeRotate.addEventListener('click', () => setMode('rotate'));
  ui.undo.addEventListener('click', undo);
  ui.explode.addEventListener('click', () => {
    state.exploded = !state.exploded;
    updateTargets();
    playClick();
    refreshUI();
  });
  ui.reset.addEventListener('click', () => { playClick(); resetGame(true); });
  $('#btn-again').addEventListener('click', () => { playClick(); resetGame(false); });
  $('#btn-view').addEventListener('click', () => { playClick(); hideResult(); });
  ui.reopen.addEventListener('click', () => { playClick(); showResult(); });
  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && state.started) { e.preventDefault(); undo(); }
  });

  // ---------------------------------------------------------------------------
  // Input: cut / orbit / pinch
  // ---------------------------------------------------------------------------
  const pointers = new Map();
  let drag = null;

  function cancelDrag() {
    drag = null;
    ui.dragLine.classList.remove('on');
    ui.knife.classList.remove('on');
    document.body.classList.remove('orbiting');
    if (previewFlash <= 0) preview.visible = false;
  }

  function drawStroke(a, b) {
    ui.dragLine.setAttribute('x1', a.x); ui.dragLine.setAttribute('y1', a.y);
    ui.dragLine.setAttribute('x2', b.x); ui.dragLine.setAttribute('y2', b.y);
    ui.dragLine.classList.add('on');
    const ang = Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
    ui.knife.style.transform = `translate(${b.x - 10}px, ${b.y - 48}px) rotate(${ang * 0.15 - 8}deg)`;
    ui.knife.classList.add('on');
  }

  const inputBlocked = () => !state.started || !ui.result.hidden;

  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  canvas.addEventListener('pointerdown', (e) => {
    if (inputBlocked()) return;
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* synthetic pointer */ }
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {
      cancelDrag();
      const [p, q] = [...pointers.values()];
      drag = { type: 'pinch', dist: Math.hypot(p.x - q.x, p.y - q.y), mx: (p.x + q.x) / 2, my: (p.y + q.y) / 2 };
      return;
    }
    if (pointers.size > 2) return;
    if (e.button !== 0 && e.button !== 2) return;
    const orbit = e.button === 2 || e.ctrlKey || state.interactionMode === 'rotate' || state.gameOver || state.evaluating;
    if (orbit) {
      drag = { type: 'orbit', x: e.clientX, y: e.clientY };
      document.body.classList.add('orbiting');
    } else {
      drag = { type: 'cut', a: { x: e.clientX, y: e.clientY }, b: { x: e.clientX, y: e.clientY }, plane: null };
    }
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!pointers.has(e.pointerId)) return;
    const prev = pointers.get(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (!drag) return;
    if (drag.type === 'orbit') {
      cam.taz -= (e.clientX - drag.x) * 0.0065;
      cam.tel += (e.clientY - drag.y) * 0.005;
      drag.x = e.clientX; drag.y = e.clientY;
      cam.autoOrbit = 0;
    } else if (drag.type === 'pinch' && pointers.size >= 2) {
      const [p, q] = [...pointers.values()];
      const dist = Math.hypot(p.x - q.x, p.y - q.y);
      const mx = (p.x + q.x) / 2, my = (p.y + q.y) / 2;
      if (drag.dist > 0) cam.tr *= drag.dist / Math.max(1, dist);
      cam.taz -= (mx - drag.mx) * 0.0065;
      cam.tel += (my - drag.my) * 0.005;
      drag.dist = dist; drag.mx = mx; drag.my = my;
      cam.autoOrbit = 0;
    } else if (drag.type === 'cut') {
      drag.b = { x: e.clientX, y: e.clientY };
      drawStroke(drag.a, drag.b);
      if (Math.hypot(drag.b.x - drag.a.x, drag.b.y - drag.a.y) > 14) {
        drag.plane = planeFromDrag(drag.a, drag.b);
        if (drag.plane) { placePreview(drag.plane); previewMat.opacity = 0.42; }
      }
    }
    void prev;
  });

  function endPointer(e) {
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);
    if (!drag) return;
    if (drag.type === 'pinch') {
      if (pointers.size < 2) cancelDrag();
      return;
    }
    if (drag.type === 'cut' && e.type === 'pointerup') {
      const { a, b } = drag;
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      const plane = len > 24 ? planeFromDrag(a, b) : null;
      cancelDrag();
      if (len <= 24) return;
      if (!plane || !strokeTouchesCake(a, b)) {
        preview.visible = false;
        toast('Potongan tidak mengenai kue.');
        playMiss();
        return;
      }
      if (!commitCut(plane)) preview.visible = false;
      return;
    }
    cancelDrag();
  }
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);

  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (!state.started) return;
    cam.tr *= Math.exp(e.deltaY * 0.0011);
  }, { passive: false });

  // ---------------------------------------------------------------------------
  // Resize & loop
  // ---------------------------------------------------------------------------
  function onResize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    const aspect = w / h;
    camera.aspect = aspect;
    // Keep the cake's width in frame on tall screens: widen the lens first, then step back.
    const baseHalf = Math.tan(19 * DEG);
    const needHalf = aspect >= 1.3 ? baseHalf : baseHalf * 1.3 / aspect;
    const fovHalf = Math.min(needHalf, Math.tan(30 * DEG));
    camera.fov = (2 * Math.atan(fovHalf)) / DEG;
    camera.updateProjectionMatrix();
    portraitScale = needHalf / fovHalf;
    cam.rMin = 4.4;
    cam.rMax = Math.max(12, defaultRadius() * 1.3);
    updateHudOffset();
  }
  window.addEventListener('resize', onResize);
  onResize();
  resetCamera(true);
  syncVisuals();
  refreshUI();

  let last = performance.now();
  let lastSecond = -1;
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;

    updateCamera(dt);

    const k = 1 - Math.exp(-dt * 11);
    for (const vis of visuals.values()) {
      vis.cur.lerp(vis.target, k);
      vis.mesh.position.copy(vis.cur);
      vis.deco.position.copy(vis.cur);
      updateClipPlanes(vis);
    }
    for (const r of rosettes) {
      const vis = visuals.get(r.owner);
      r.mesh.position.copy(r.base);
      if (vis) r.mesh.position.add(vis.cur);
    }
    updateCrumbs(dt);

    if (previewFlash > 0) {
      previewFlash -= dt;
      previewMat.opacity = Math.max(0, previewFlash / 0.22) * 0.9;
      if (previewFlash <= 0 && !(drag && drag.type === 'cut')) preview.visible = false;
    }

    if (timerRunning) {
      state.elapsedMs = now - timerStart;
      const sec = Math.floor(state.elapsedMs / 1000);
      if (sec !== lastSecond) { lastSecond = sec; ui.timer.textContent = fmtTime(state.elapsedMs); }
    }

    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame((t) => {
    last = t;
    frame(t);
    loader.classList.add('done');
    setTimeout(() => loader.remove(), 700);
  });

  // Debug / QA hook (no gameplay help is exposed in the UI).
  window.__potongKue = { state, cam, camera, planeFromDrag, strokeHits, applyCutWorld: (n, point) => commitCut({ n: new V3(...n).normalize(), point: new V3(...point) }) };
})();
