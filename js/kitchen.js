/*
 * Kitchen environment for Tantangan Potong Kue.
 *
 * A fully 3D warm home-bakery kitchen built from simple procedural geometry:
 * a rectangular marble island with cream cabinetry, perimeter counters, range
 * and hood, farmhouse sink under a sunny window, walnut shelves, brass pendants,
 * plants, and the props that sit on the island around the cake.
 * All textures are drawn on canvases, so the page also works from file://.
 *
 * Units: roughly 1 unit ≈ 9 cm. The island top is at y = 0 and the cake sits
 * at the origin.
 */
window.buildKitchen = function buildKitchen(THREE, renderer, rng) {
  'use strict';

  const V3 = THREE.Vector3;
  const FLOOR = -8.6;
  const CEIL = 15.5;
  const WALL = 19;
  const DEPTH = 5.5;  // perimeter counter depth
  const SLAB = 0.42;  // counter slab thickness
  const island = { minX: -4.6, maxX: 4.6, minZ: -3.1, maxZ: 2.5 };
  const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());

  const root = new THREE.Group();   // room shell + fixed furniture
  const props = new THREE.Group();  // things standing on the island
  const lights = [];

  // ---------------------------------------------------------------------------
  // Canvas textures
  // ---------------------------------------------------------------------------
  function canvasTex(w, h, draw, srgb = true) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = aniso;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  }

  // Draw fn once, plus wrapped copies where the shape crosses an edge (tileable).
  function wrapped(g, size, fn, x0, y0, x1, y1) {
    const xs = [0], ys = [0];
    if (x0 < 0) xs.push(size);
    if (x1 > size) xs.push(-size);
    if (y0 < 0) ys.push(size);
    if (y1 > size) ys.push(-size);
    for (const dx of xs) for (const dy of ys) { g.save(); g.translate(dx, dy); fn(); g.restore(); }
  }

  const marbleTex = canvasTex(2048, 2048, (g, s) => {
    g.fillStyle = '#f4e7d4';
    g.fillRect(0, 0, s, s);
    for (let i = 0; i < 300; i++) {
      const x = rng() * s, y = rng() * s, r = 80 + rng() * 300;
      const light = rng() < 0.55;
      wrapped(g, s, () => {
        const gr = g.createRadialGradient(x, y, 0, x, y, r);
        gr.addColorStop(0, light ? 'rgba(255,251,243,0.22)' : 'rgba(222,190,150,0.11)');
        gr.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = gr;
        g.fillRect(x - r, y - r, r * 2, r * 2);
      }, x - r, y - r, x + r, y + r);
    }
    g.lineCap = 'round';
    g.lineJoin = 'round';
    const vein = (x, y, ang, steps, width, alpha, depth) => {
      const pts = [[x, y]];
      for (let k = 0; k < steps; k++) {
        ang += (rng() - 0.5) * 0.55;
        x += Math.cos(ang) * 9; y += Math.sin(ang) * 9;
        pts.push([x, y]);
        if (depth < 2 && rng() < 0.035) vein(x, y, ang + (rng() < 0.5 ? 1 : -1) * (0.6 + rng()), steps * 0.4 | 0, width * 0.6, alpha * 0.8, depth + 1);
      }
      const col = `rgba(${196 + rng() * 22 | 0},${142 + rng() * 25 | 0},${78 + rng() * 25 | 0},`;
      const xsA = pts.map((q) => q[0]), ysA = pts.map((q) => q[1]);
      wrapped(g, s, () => {
        g.beginPath();
        g.moveTo(pts[0][0], pts[0][1]);
        for (const p of pts) g.lineTo(p[0], p[1]);
        g.strokeStyle = col + (alpha * 0.35) + ')';
        g.lineWidth = width * 4;
        g.stroke();
        g.strokeStyle = col + alpha + ')';
        g.lineWidth = width;
        g.stroke();
      }, Math.min(...xsA) - 10, Math.min(...ysA) - 10, Math.max(...xsA) + 10, Math.max(...ysA) + 10);
    };
    for (let i = 0; i < 30; i++) vein(rng() * s, rng() * s, rng() * Math.PI * 2, 50 + rng() * 140, 0.8 + rng() * 2, 0.16 + rng() * 0.26, 0);
  });

  const woodTex = canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#b8824e';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 280; i++) {
      const y0 = rng() * h, amp = 1 + rng() * 5, ph = rng() * 6;
      const k1 = 1 + (rng() * 3 | 0), k2 = 4 + (rng() * 4 | 0);
      g.strokeStyle = rng() < 0.6 ? `rgba(95,55,25,${0.05 + rng() * 0.16})` : `rgba(228,172,112,${0.05 + rng() * 0.12})`;
      g.lineWidth = 0.5 + rng() * 2.2;
      for (const off of [-h, 0, h]) {
        g.beginPath();
        for (let x = 0; x <= w; x += 8) {
          const t = (x / w) * Math.PI * 2;
          const y = y0 + off + Math.sin(t * k1 + ph) * amp + Math.sin(t * k2 + ph * 2) * amp * 0.35;
          if (x === 0) g.moveTo(x, y); else g.lineTo(x, y);
        }
        g.stroke();
      }
    }
  });

  const floorTex = canvasTex(1024, 1024, (g, w, h) => {
    const rows = 8, rh = h / rows;
    const tones = ['#c08a57', '#b57e4b', '#c9975f', '#ab7544', '#bd8753', '#c49060'];
    for (let r = 0; r < rows; r++) {
      let x = -rng() * 300;
      while (x < w) {
        const len = 280 + rng() * 380;
        g.fillStyle = tones[(rng() * tones.length) | 0];
        g.fillRect(x, r * rh, len, rh);
        for (let k = 0; k < 18; k++) {
          const yy = r * rh + 4 + rng() * (rh - 8);
          g.strokeStyle = `rgba(92,52,22,${0.04 + rng() * 0.1})`;
          g.lineWidth = 0.6 + rng() * 1.6;
          g.beginPath();
          g.moveTo(x, yy);
          for (let xx = x; xx <= x + len; xx += 16) g.lineTo(xx, yy + Math.sin(xx * 0.02 + k) * 2);
          g.stroke();
        }
        g.fillStyle = 'rgba(64,34,14,0.5)';
        g.fillRect(x, r * rh, 2, rh);
        x += len;
      }
      g.fillStyle = 'rgba(64,34,14,0.45)';
      g.fillRect(0, r * rh, w, 2);
    }
  });

  const plasterTex = canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#efe3d1';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) {
      const x = rng() * w, y = rng() * h, r = 6 + rng() * 40;
      g.fillStyle = rng() < 0.5 ? `rgba(255,250,240,${rng() * 0.08})` : `rgba(200,170,130,${rng() * 0.045})`;
      g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    }
  });

  const gardenTex = canvasTex(1024, 768, (g, w, h) => {
    const sky = g.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#f7ddaa');
    sky.addColorStop(0.5, '#fff0cc');
    sky.addColorStop(1, '#efdcaa');
    g.fillStyle = sky;
    g.fillRect(0, 0, w, h);
    const sun = g.createRadialGradient(w * 0.3, h * 0.22, 0, w * 0.3, h * 0.22, h * 0.7);
    sun.addColorStop(0, 'rgba(255,252,230,1)');
    sun.addColorStop(1, 'rgba(255,240,200,0)');
    g.fillStyle = sun;
    g.fillRect(0, 0, w, h);
    const blobs = (n, y0, y1, r0, r1, cols, blur) => {
      g.filter = `blur(${blur}px)`;
      for (let i = 0; i < n; i++) {
        g.fillStyle = cols[(rng() * cols.length) | 0];
        g.beginPath();
        g.ellipse(rng() * w, y0 + rng() * (y1 - y0), r0 + rng() * (r1 - r0), (r0 + rng() * (r1 - r0)) * 0.8, 0, 0, Math.PI * 2);
        g.fill();
      }
    };
    blobs(70, h * 0.35, h * 0.62, 30, 90, ['rgba(190,200,140,0.8)', 'rgba(205,210,150,0.7)', 'rgba(170,185,125,0.75)'], 10);
    blobs(90, h * 0.55, h * 1.05, 40, 130, ['rgba(125,150,85,0.95)', 'rgba(105,132,70,0.95)', 'rgba(150,168,98,0.9)'], 6);
    blobs(60, h * 0.5, h * 0.95, 20, 60, ['rgba(226,228,160,0.7)', 'rgba(240,232,170,0.6)'], 5);
    blobs(30, -h * 0.1, h * 0.4, 50, 140, ['rgba(120,145,82,0.9)', 'rgba(140,160,95,0.85)'], 7);
    g.filter = 'none';
  });

  const printTex = canvasTex(256, 340, (g, w, h) => {
    g.fillStyle = '#f5ecdb';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = '#71784a';
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(w * 0.5, h * 0.9);
    g.bezierCurveTo(w * 0.4, h * 0.6, w * 0.62, h * 0.4, w * 0.48, h * 0.1);
    g.stroke();
    for (let i = 0; i < 14; i++) {
      const t = i / 14;
      const x = w * (0.5 - 0.02 * Math.sin(t * 6)), y = h * (0.88 - t * 0.74);
      const side = i % 2 ? 1 : -1;
      g.save();
      g.translate(x, y);
      g.rotate(side * (0.7 + t * 0.3));
      g.fillStyle = i % 3 ? '#8c9a5e' : '#a1ad73';
      g.beginPath();
      g.ellipse(0, -26, 9, 26, 0, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }
    g.fillStyle = 'rgba(90,70,50,0.5)';
    g.fillRect(w * 0.3, h * 0.94, w * 0.4, 2);
  });

  const linenTex = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#efe4d2';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 6; i++) {
      g.fillStyle = i % 2 ? 'rgba(122,72,42,0.6)' : 'rgba(122,72,42,0.28)';
      g.fillRect(0, 22 + i * 40, w, i % 2 ? 8 : 3);
    }
    for (let i = 0; i < 2000; i++) {
      g.fillStyle = `rgba(90,60,40,${rng() * 0.06})`;
      g.fillRect(rng() * w, rng() * h, 1 + rng() * 3, 1);
    }
  });

  const rugTex = canvasTex(512, 384, (g, w, h) => {
    g.fillStyle = '#d2b58c';
    g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 4) {
      g.fillStyle = `rgba(120,86,50,${0.08 + rng() * 0.1})`;
      g.fillRect(0, y, w, 1.5);
    }
    for (let x = 0; x < w; x += 4) {
      g.fillStyle = `rgba(255,240,210,${0.05 + rng() * 0.08})`;
      g.fillRect(x, 0, 1.5, h);
    }
    g.strokeStyle = 'rgba(120,78,45,0.55)';
    g.lineWidth = 10;
    g.strokeRect(22, 22, w - 44, h - 44);
    g.lineWidth = 3;
    g.strokeRect(40, 40, w - 80, h - 80);
  });

  const speckleTex = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#efe5d6';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 500; i++) {
      g.fillStyle = `rgba(110,70,40,${0.25 + rng() * 0.5})`;
      g.beginPath(); g.arc(rng() * w, rng() * h, 0.5 + rng() * 1.4, 0, Math.PI * 2); g.fill();
    }
  });

  const shadowTex = canvasTex(256, 256, (g, w, h) => {
    g.filter = 'blur(22px)';
    g.fillStyle = 'rgba(0,0,0,0.85)';
    g.fillRect(40, 40, w - 80, h - 80);
    g.filter = 'none';
  }, false);

  // ---------------------------------------------------------------------------
  // Materials
  // ---------------------------------------------------------------------------
  const std = (o) => new THREE.MeshStandardMaterial(o);
  const phys = (o) => new THREE.MeshPhysicalMaterial(o);
  const M = {
    plaster: std({ map: plasterTex, roughness: 0.95 }),
    hood: std({ map: plasterTex, color: 0xfaf3e8, roughness: 0.85 }),
    ceiling: std({ color: 0xf4eadb, roughness: 1 }),
    cabinet: std({ color: 0xebe0cb, roughness: 0.48 }),
    toe: std({ color: 0xb7a486, roughness: 0.8 }),
    marble: phys({ map: marbleTex, roughness: 0.2, clearcoat: 0.55, clearcoatRoughness: 0.1 }),
    brass: std({ color: 0xd9aa60, metalness: 1, roughness: 0.3, side: THREE.DoubleSide }),
    wood: std({ map: woodTex, roughness: 0.55 }),
    walnut: std({ map: woodTex, color: 0x9d6d4b, roughness: 0.5 }),
    lightWood: std({ map: woodTex, color: 0xffe6c8, roughness: 0.6 }),
    floor: std({ map: floorTex, roughness: 0.55 }),
    enamel: phys({ color: 0xefe4d0, roughness: 0.25, clearcoat: 0.8, clearcoatRoughness: 0.1 }),
    iron: std({ color: 0x25201d, roughness: 0.55, metalness: 0.5 }),
    glassDark: phys({ color: 0x1d1613, roughness: 0.06, metalness: 0.2, clearcoat: 1 }),
    ceramic: phys({ color: 0xf6efe4, roughness: 0.25, clearcoat: 0.8, side: THREE.DoubleSide }),
    speckle: phys({ map: speckleTex, roughness: 0.35, clearcoat: 0.6, side: THREE.DoubleSide }),
    sage: phys({ color: 0xb9c2a2, roughness: 0.35, clearcoat: 0.5, side: THREE.DoubleSide }),
    terracotta: std({ color: 0xc5825a, roughness: 0.85, side: THREE.DoubleSide }),
    choco: std({ color: 0x3d1b0c, roughness: 0.36, flatShading: true }),
    leaf: std({ color: 0xffffff, roughness: 0.62, side: THREE.DoubleSide }),
    stem: std({ color: 0x6f7d45, roughness: 0.7 }),
    garden: new THREE.MeshBasicMaterial({ map: gardenTex, color: new THREE.Color(1.12, 1.06, 0.98) }),
    steel: std({ color: 0xdedad2, metalness: 1, roughness: 0.22 }),
    linen: std({ map: linenTex, roughness: 0.95 }),
    rug: std({ map: rugTex, roughness: 1 }),
    glass: phys({ color: 0xf4efe6, roughness: 0.05, transparent: true, opacity: 0.34, clearcoat: 1, depthWrite: false, side: THREE.DoubleSide, envMapIntensity: 1.4 }),
    amber: phys({ color: 0x8a4a14, roughness: 0.08, transparent: true, opacity: 0.82, clearcoat: 1 }),
    oliveOil: phys({ color: 0x9a8a2a, roughness: 0.08, transparent: true, opacity: 0.8, clearcoat: 1 }),
    berry: std({ color: 0xa8182f, roughness: 0.4 }),
    lemon: std({ color: 0xf0c540, roughness: 0.5 }),
    coffee: std({ color: 0x2a140a, roughness: 0.1 }),
    print: std({ map: printTex, roughness: 0.9 }),
    glow: new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 1.8, 1.1) }),
    bulb: new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 2.4, 1.6) }),
    shadeInner: std({ color: 0xfff1d8, emissive: 0xffc27a, emissiveIntensity: 0.8, roughness: 0.6, side: THREE.BackSide }),
    shadow: new THREE.MeshBasicMaterial({ color: 0x2a1a0e, alphaMap: shadowTex, transparent: true, opacity: 0.55, depthWrite: false }),
    rope: std({ color: 0xc9ab80, roughness: 0.9 }),
  };

  // ---------------------------------------------------------------------------
  // Geometry helpers
  // ---------------------------------------------------------------------------
  const dummy = new THREE.Object3D();

  // Planar UVs in world-ish units so textures keep their scale on every box.
  function worldUV(geo, s) {
    const p = geo.attributes.position, n = geo.attributes.normal;
    const uv = new Float32Array(p.count * 2);
    for (let i = 0; i < p.count; i++) {
      const nx = Math.abs(n.getX(i)), ny = Math.abs(n.getY(i)), nz = Math.abs(n.getZ(i));
      let u, v;
      if (ny >= nx && ny >= nz) { u = p.getX(i); v = p.getZ(i); }
      else if (nx >= nz) { u = p.getZ(i); v = p.getY(i); }
      else { u = p.getX(i); v = p.getY(i); }
      uv[i * 2] = u * s; uv[i * 2 + 1] = v * s;
    }
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  }

  function add(parent, geo, mat, opt = {}) {
    if (opt.uv) worldUV(geo, opt.uv);
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = !!opt.cast;
    m.receiveShadow = opt.receive !== false;
    parent.add(m);
    return m;
  }

  function box(parent, w, h, d, mat, x, y, z, opt = {}) {
    const g = new THREE.BoxGeometry(w, h, d);
    if (opt.ry) g.rotateY(opt.ry);
    g.translate(x, y, z);
    return add(parent, g, mat, { uv: 1 / 8, ...opt });
  }

  function cyl(parent, rt, rb, h, mat, x, y, z, opt = {}) {
    const g = new THREE.CylinderGeometry(rt, rb, h, opt.seg || 24, 1, !!opt.open);
    if (opt.rx) g.rotateX(opt.rx);
    if (opt.rz) g.rotateZ(opt.rz);
    if (opt.ry) g.rotateY(opt.ry);
    g.translate(x, y, z);
    return add(parent, g, mat, opt);
  }

  function lathe(parent, pts, mat, x, y, z, opt = {}) {
    const g = new THREE.LatheGeometry(pts.map(([a, b]) => new THREE.Vector2(a, b)), opt.seg || 40);
    if (opt.scale) g.scale(...opt.scale);
    if (opt.rx) g.rotateX(opt.rx);
    if (opt.rz) g.rotateZ(opt.rz);
    g.translate(x, y, z);
    return add(parent, g, mat, opt);
  }

  function sphere(parent, r, mat, x, y, z, opt = {}) {
    const g = new THREE.SphereGeometry(r, opt.seg || 16, opt.seg ? opt.seg * 0.75 : 12);
    if (opt.scale) g.scale(...opt.scale);
    g.translate(x, y, z);
    return add(parent, g, mat, opt);
  }

  function roundedRect(x, y, w, h, r) {
    const s = new THREE.Shape();
    s.moveTo(x + r, y);
    s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
    s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
    s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
    return s;
  }

  // Profile of an open bowl: outer surface bottom->rim, then inner surface back down.
  function bowlPts(r, h, t = 0.045, foot = 0.5) {
    const out = [[0, 0]];
    for (let i = 0; i <= 12; i++) {
      const a = i / 12;
      out.push([r * (foot + (1 - foot) * Math.sin(a * Math.PI / 2)), h * a]);
    }
    out.push([r - t * 0.5, h + t * 0.4]);
    for (let i = 12; i >= 0; i--) {
      const a = i / 12;
      out.push([Math.max(0.001, r * (foot + (1 - foot) * Math.sin(a * Math.PI / 2)) - t), Math.max(t, h * a)]);
    }
    out.push([0, t]);
    return out;
  }

  const leafGeo = new THREE.SphereGeometry(1, 7, 5);
  leafGeo.scale(0.45, 0.14, 1);
  leafGeo.translate(0, 0, 0.9);

  function leafCloud(parent, items) {
    const im = new THREE.InstancedMesh(leafGeo, M.leaf, items.length);
    const col = new THREE.Color();
    items.forEach((it, i) => {
      dummy.position.copy(it.p);
      dummy.rotation.set(it.rx ?? (rng() - 0.5) * 2.2, it.ry ?? rng() * Math.PI * 2, (rng() - 0.5) * 0.8);
      dummy.scale.setScalar(it.s);
      dummy.updateMatrix();
      im.setMatrixAt(i, dummy.matrix);
      im.setColorAt(i, col.set(it.c));
    });
    im.castShadow = !!items.cast;
    im.receiveShadow = true;
    parent.add(im);
    return im;
  }

  const GREENS = ['#6f8a45', '#7f9a52', '#5f7a3c', '#8ea560', '#6a8448'];
  const OLIVES = ['#8a9868', '#9aa777', '#7d8c5e', '#a8b287'];
  const pick = (a) => a[(rng() * a.length) | 0];

  function pottedPlant(parent, x, y, z, o = {}) {
    const r = o.r ?? 0.5, h = o.h ?? 0.7;
    lathe(parent, [[0, 0], [r * 0.78, 0], [r * 0.95, h * 0.85], [r * 1.04, h * 0.88], [r * 1.04, h], [r * 0.9, h], [r * 0.88, h * 0.9], [0, h * 0.9]], o.mat || M.terracotta, x, y, z, { seg: 28 });
    const items = [];
    const n = o.leaves ?? 60, spread = o.spread ?? r * 1.4, height = o.height ?? r * 1.8;
    for (let i = 0; i < n; i++) {
      const a = rng() * Math.PI * 2, rr = Math.sqrt(rng()) * spread;
      items.push({ p: new V3(x + Math.cos(a) * rr * 0.8, y + h + rng() * height * (1 - rr / spread * 0.5), z + Math.sin(a) * rr * 0.8), s: (o.leafSize ?? 0.22) * (0.7 + rng() * 0.6), c: pick(o.palette || GREENS), rx: -0.6 - rng() * 0.9, ry: a + Math.PI / 2 * (rng() - 0.5) });
    }
    for (let v = 0; v < (o.trailing ?? 0); v++) {
      const a = rng() * Math.PI * 2;
      let px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r, py = y + h;
      const len = (o.trailLen ?? 1.8) * (0.6 + rng() * 0.6);
      for (let k = 0; k < 14; k++) {
        px += Math.cos(a) * 0.05; pz += Math.sin(a) * 0.05; py -= len / 14;
        items.push({ p: new V3(px + (rng() - 0.5) * 0.1, py, pz + (rng() - 0.5) * 0.1), s: (o.leafSize ?? 0.22) * 0.75, c: pick(GREENS), rx: -1.2 + rng() * 0.6 });
      }
    }
    items.cast = !!o.cast;
    leafCloud(parent, items);
  }

  function frontPanel(parent, x, y, z, w, h, rotY, kind) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.y = rotY;
    parent.add(g);
    box(g, w, h, 0.12, M.cabinet, 0, 0, 0.06);
    if (kind === 'door') {
      box(g, w - 0.62, h - 0.62, 0.05, M.cabinet, 0, 0, 0.145);
      sphere(g, 0.1, M.brass, w / 2 - 0.34, h / 2 - 0.55, 0.26);
    } else {
      const p = new THREE.CylinderGeometry(0.12, 0.12, 0.64, 16, 1, true, 0, Math.PI);
      p.rotateZ(Math.PI / 2);
      p.translate(0, -0.02, 0.2);
      add(g, p, M.brass);
    }
    return g;
  }

  // Base cabinets along local +x (0..L), fronts facing local +z.
  function cabinetRun(parent, L, gaps = []) {
    const g = new THREE.Group();
    parent.add(g);
    const cuts = [0, ...gaps.flatMap((gp) => [gp.from, gp.to]), L].sort((a, b) => a - b);
    for (let i = 0; i < cuts.length - 1; i++) {
      const a = cuts[i], b = cuts[i + 1];
      if (b - a < 0.05) continue;
      const gap = gaps.find((gp) => Math.abs(gp.from - a) < 1e-6 && Math.abs(gp.to - b) < 1e-6);
      if (gap && gap.kind === 'none') continue;
      const sink = !!gap && gap.kind === 'sink';
      const w = b - a, cx = (a + b) / 2;
      const top = sink ? -3.0 : -SLAB;
      box(g, w, top - (FLOOR + 0.5), DEPTH - 0.14, M.cabinet, cx, (top + FLOOR + 0.5) / 2, (DEPTH - 0.14) / 2);
      box(g, w, 0.5, DEPTH - 0.6, M.toe, cx, FLOOR + 0.25, (DEPTH - 0.6) / 2);
      if (!sink) box(g, w, SLAB, DEPTH + 0.22, M.marble, cx, -SLAB / 2, (DEPTH + 0.22) / 2, { uv: 1 / 9 });
      const n = Math.max(1, Math.round(w / 3.1)), fw = w / n;
      for (let k = 0; k < n; k++) {
        const x = a + fw * (k + 0.5);
        if (!sink) frontPanel(g, x, -1.28, DEPTH - 0.14, fw - 0.1, 1.3, 0, 'drawer');
        const dTop = sink ? -3.1 : -2.05, dBot = FLOOR + 0.56;
        frontPanel(g, x, (dTop + dBot) / 2, DEPTH - 0.14, fw - 0.1, dTop - dBot, 0, 'door');
      }
    }
    return g;
  }

  function wallGroup(rotY, pos) {
    const g = new THREE.Group();
    g.rotation.y = rotY;
    g.position.copy(pos);
    root.add(g);
    return g;
  }

  function wallPlane(g, holes) {
    const s = new THREE.Shape();
    s.moveTo(-WALL, FLOOR); s.lineTo(WALL, FLOOR); s.lineTo(WALL, CEIL); s.lineTo(-WALL, CEIL); s.lineTo(-WALL, FLOOR);
    for (const [x0, x1, y0, y1] of holes) {
      const hp = new THREE.Path();
      hp.moveTo(x0, y0); hp.lineTo(x0, y1); hp.lineTo(x1, y1); hp.lineTo(x1, y0); hp.lineTo(x0, y0);
      s.holes.push(hp);
    }
    const geo = new THREE.ShapeGeometry(s);
    geo.computeVertexNormals();
    return add(g, geo, M.plaster, { uv: 1 / 8 });
  }

  // Window or glazed door in a wall group (local z = into the room).
  function glazing(g, x0, x1, y0, y1, cols, rows, door) {
    const w = x1 - x0, h = y1 - y0, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, D = 0.9;
    box(g, 0.12, h, D, M.plaster, x0 - 0.06, cy, -D / 2);
    box(g, 0.12, h, D, M.plaster, x1 + 0.06, cy, -D / 2);
    box(g, w + 0.24, 0.12, D, M.plaster, cx, y1 + 0.06, -D / 2);
    if (!door) box(g, w + 0.24, 0.12, D, M.plaster, cx, y0 - 0.06, -D / 2);
    const t = 0.42;
    box(g, t, h + t, 0.14, M.wood, x0 - t / 2, cy + t / 2, 0.07);
    box(g, t, h + t, 0.14, M.wood, x1 + t / 2, cy + t / 2, 0.07);
    box(g, w + 2 * t, t, 0.14, M.wood, cx, y1 + t / 2, 0.07);
    const fz = -0.5, bar = 0.18;
    const gy0 = door ? y0 + 2.6 : y0;
    box(g, w, bar * 1.6, 0.3, M.wood, cx, gy0 + bar * 0.8, fz);
    box(g, w, bar * 1.6, 0.3, M.wood, cx, y1 - bar * 0.8, fz);
    box(g, bar * 1.6, h, 0.3, M.wood, x0 + bar * 0.8, cy, fz);
    box(g, bar * 1.6, h, 0.3, M.wood, x1 - bar * 0.8, cy, fz);
    for (let c = 1; c < cols; c++) box(g, bar, y1 - gy0, 0.24, M.wood, x0 + (w * c) / cols, (gy0 + y1) / 2, fz);
    for (let r = 1; r < rows; r++) box(g, w, bar, 0.24, M.wood, cx, gy0 + ((y1 - gy0) * r) / rows, fz);
    if (door) {
      box(g, w, 2.6, 0.24, M.wood, cx, y0 + 1.3, fz);
      box(g, w - 1.0, 1.7, 0.08, M.wood, cx, y0 + 1.3, fz + 0.14);
      box(g, 0.1, 0.12, 0.5, M.brass, x1 - 0.7, y0 + 4.4, fz + 0.3);
      box(g, 0.5, 0.1, 0.1, M.brass, x1 - 0.95, y0 + 4.4, fz + 0.52);
    } else {
      box(g, w + 1.0, 0.18, 0.75, M.marble, cx, y0 - 0.09, 0.3, { uv: 1 / 9 });
    }
    const vg = new THREE.PlaneGeometry(w + 10, h + 8);
    vg.translate(cx, cy + 1, -4.5);
    add(g, vg, M.garden, { receive: false });
  }

  function canister(parent, x, y, z, r, h, mat = M.ceramic, lid = M.wood) {
    lathe(parent, [[0, 0], [r * 0.95, 0], [r, 0.06], [r, h], [r * 0.93, h + 0.02], [0, h + 0.02]], mat, x, y, z, { seg: 32, cast: true });
    cyl(parent, r * 1.03, r * 1.03, 0.14, lid, x, y + h + 0.09, z, { cast: true });
    sphere(parent, r * 0.22, lid, x, y + h + 0.2, z);
  }

  function plate(parent, x, y, z, r, mat = M.ceramic, opt = {}) {
    return lathe(parent, [[0, 0], [r * 0.58, 0], [r * 0.6, 0.03], [r * 0.64, 0.06], [r * 0.98, 0.13], [r, 0.15], [r * 0.95, 0.15], [r * 0.62, 0.09], [0, 0.09]], mat, x, y, z, { seg: 40, ...opt });
  }

  function bowl(parent, x, y, z, r, h, mat, opt = {}) {
    return lathe(parent, bowlPts(r, h, opt.t ?? 0.05, opt.foot ?? 0.5), mat, x, y, z, { seg: 44, cast: true, ...opt });
  }

  // Irregular broken-chocolate chunk: a box with consistently jittered corners.
  const chunkGeo = (() => {
    const g = new THREE.BoxGeometry(1, 0.7, 0.85, 2, 1, 2);
    const p = g.attributes.position;
    const key = (x, y, z) => Math.round(x * 100) * 73856093 ^ Math.round(y * 100) * 19349663 ^ Math.round(z * 100) * 83492791;
    const hash = (k, s) => { const x = Math.sin(k * 0.0001 + s) * 43758.5453; return x - Math.floor(x); };
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i), k = key(x, y, z);
      p.setXYZ(i, x + (hash(k, 1) - 0.5) * 0.28, y + (hash(k, 2) - 0.5) * 0.22, z + (hash(k, 3) - 0.5) * 0.28);
    }
    g.computeVertexNormals();
    return g;
  })();
  function chunkCloud(parent, list, mat = M.choco) {
    const im = new THREE.InstancedMesh(chunkGeo, mat, list.length);
    list.forEach(([x, y, z, s], i) => {
      dummy.position.set(x, y, z);
      dummy.rotation.set(rng() * 3, rng() * 3, rng() * 3);
      dummy.scale.set(s * (0.9 + rng() * 0.5), s * (0.55 + rng() * 0.3), s * (0.8 + rng() * 0.4));
      dummy.updateMatrix();
      im.setMatrixAt(i, dummy.matrix);
    });
    im.castShadow = true;
    im.receiveShadow = true;
    parent.add(im);
    return im;
  }

  function mound(cx, cy, cz, r, n, s, lift = 0.12) {
    const out = [];
    for (let i = 0; i < n; i++) {
      const a = rng() * Math.PI * 2, rr = Math.sqrt(rng()) * r;
      out.push([cx + Math.cos(a) * rr, cy + (1 - rr / r) * lift + rng() * 0.05, cz + Math.sin(a) * rr, s * (0.8 + rng() * 0.5)]);
    }
    return out;
  }

  // ---------------------------------------------------------------------------
  // Room shell
  // ---------------------------------------------------------------------------
  const floorGeo = new THREE.PlaneGeometry(WALL * 2, WALL * 2);
  floorGeo.rotateX(-Math.PI / 2);
  floorGeo.translate(0, FLOOR, 0);
  add(root, floorGeo, M.floor, { uv: 1 / 10 });

  const ceilGeo = new THREE.PlaneGeometry(WALL * 2, WALL * 2);
  ceilGeo.rotateX(Math.PI / 2);
  ceilGeo.translate(0, CEIL, 0);
  add(root, ceilGeo, M.ceiling, { receive: false });
  for (const z of [-9.5, -0.3, 9]) box(root, WALL * 2, 0.9, 1.1, M.walnut, 0, CEIL - 0.45, z, { uv: 1 / 6 });

  const back = wallGroup(0, new V3(0, 0, -WALL));
  const left = wallGroup(Math.PI / 2, new V3(-WALL, 0, 0));
  const right = wallGroup(-Math.PI / 2, new V3(WALL, 0, 0));
  const front = wallGroup(Math.PI, new V3(0, 0, WALL));

  // left wall: window over the sink (world z -8..6 -> local x -6..8)
  wallPlane(left, [[-6, 8, 2.2, 12.5]]);
  glazing(left, -6, 8, 2.2, 12.5, 3, 3, false);
  // right wall: glazed garden door (world z 3..10.5)
  wallPlane(right, [[3, 10.5, FLOOR + 0.02, 6.9]]);
  glazing(right, 3, 10.5, FLOOR + 0.02, 6.9, 2, 3, true);
  // front wall: second window (world x 5..13 -> local x -13..-5)
  wallPlane(front, [[-13, -5, 2.5, 11.5]]);
  glazing(front, -13, -5, 2.5, 11.5, 2, 3, false);
  wallPlane(back, []);

  // skirting boards
  for (const g of [back, left, front]) box(g, WALL * 2, 0.55, 0.12, M.cabinet, 0, FLOOR + 0.275, 0.06);
  box(right, WALL + 3, 0.55, 0.12, M.cabinet, (-WALL + 3) / 2, FLOOR + 0.275, 0.06);
  box(right, WALL - 10.5, 0.55, 0.12, M.cabinet, (WALL + 10.5) / 2, FLOOR + 0.275, 0.06);

  // framed botanical prints
  function framedPrint(g, x, y, w, h) {
    box(g, w + 0.45, h + 0.45, 0.14, M.walnut, x, y, 0.07);
    const p = new THREE.PlaneGeometry(w, h);
    p.translate(x, y, 0.15);
    add(g, p, M.print);
  }
  framedPrint(front, 3.5, 6.8, 3.2, 4.2);
  framedPrint(front, 8.3, 6.8, 3.2, 4.2);
  framedPrint(right, 14.4, 6.6, 2.6, 3.4);

  // ---------------------------------------------------------------------------
  // Perimeter cabinets, range, hood, sink
  // ---------------------------------------------------------------------------
  const backRun = cabinetRun(root, WALL * 2, [{ from: 15.2, to: 22.8, kind: 'none' }]);
  backRun.position.set(-WALL, 0, -WALL);

  const leftRun = cabinetRun(root, 22.5, [{ from: 8.3, to: 12.3, kind: 'sink' }]);
  leftRun.position.set(-WALL, 0, 9);
  leftRun.rotation.y = Math.PI / 2;

  const rightRun = cabinetRun(root, 14.5);
  rightRun.position.set(WALL, 0, -13.5);
  rightRun.rotation.y = -Math.PI / 2;

  // marble backsplashes
  box(root, WALL * 2, 9.8, 0.12, M.marble, 0, 4.9, -WALL + 0.06, { uv: 1 / 9 });
  box(root, 0.12, 2.2, 22.5, M.marble, -WALL + 0.06, 1.1, -2.25, { uv: 1 / 9 });
  box(root, 0.12, 9.8, 14.5, M.marble, WALL - 0.06, 4.9, -6.25, { uv: 1 / 9 });

  // range
  {
    const d = DEPTH + 0.05, zc = -WALL + d / 2, zF = -WALL + d;
    box(root, 7.6, -0.16 - (FLOOR + 0.35), d, M.enamel, 0, (-0.16 + FLOOR + 0.35) / 2, zc);
    box(root, 7.6, 0.35, d - 0.3, M.iron, 0, FLOOR + 0.175, zc - 0.15);
    box(root, 7.6, 0.16, d, M.iron, 0, -0.08, zc);
    box(root, 7.6, 1.4, 0.45, M.enamel, 0, 0.7, -WALL + 0.35);
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 2; j++) {
        const bx = -2.5 + i * 2.5, bz = zc - 1.1 + j * 2.2;
        cyl(root, 0.42, 0.46, 0.1, M.iron, bx, 0.05, bz);
        cyl(root, 0.2, 0.2, 0.06, M.brass, bx, 0.12, bz);
        box(root, 2.1, 0.09, 0.1, M.iron, bx, 0.22, bz);
        box(root, 0.1, 0.09, 1.9, M.iron, bx, 0.22, bz);
      }
    }
    for (let i = 0; i < 7; i++) cyl(root, 0.17, 0.2, 0.26, M.brass, -3 + i, -1.0, zF + 0.12, { rx: Math.PI / 2 });
    for (const ox of [-1.9, 1.9]) {
      box(root, 3.55, 5.4, 0.18, M.enamel, ox, -4.7, zF + 0.09);
      box(root, 2.6, 2.3, 0.06, M.glassDark, ox, -4.6, zF + 0.2);
      cyl(root, 0.07, 0.07, 3.0, M.brass, ox, -2.35, zF + 0.52, { rz: Math.PI / 2 });
      for (const px of [-1.4, 1.4]) cyl(root, 0.05, 0.05, 0.36, M.brass, ox + px, -2.35, zF + 0.34, { rx: Math.PI / 2 });
    }
    // white dutch oven on the front-left burner
    const px = -2.5, pz = zc + 1.1;
    lathe(root, [[0, 0], [0.95, 0], [1.02, 0.1], [1.02, 0.85], [0.97, 0.9], [0, 0.9]], M.enamel, px, 0.27, pz, { seg: 40, cast: true });
    lathe(root, [[0, 0.22], [0.6, 0.18], [1.0, 0.04], [1.04, 0]], M.enamel, px, 1.17, pz, { seg: 40 });
    cyl(root, 0.16, 0.2, 0.18, M.brass, px, 1.45, pz);
    for (const s of [-1, 1]) box(root, 0.3, 0.12, 0.35, M.enamel, px + s * 1.12, 0.95, pz);
  }

  // hood with walnut mantel
  {
    const hg = new THREE.BoxGeometry(8.8, CEIL - 9.8, 3.8);
    const p = hg.attributes.position;
    for (let i = 0; i < p.count; i++) {
      if (p.getY(i) > 0) { p.setX(i, p.getX(i) * 0.6); p.setZ(i, -1.9 + (p.getZ(i) + 1.9) * 0.6); }
    }
    hg.computeVertexNormals();
    hg.translate(0, (CEIL + 9.8) / 2, -WALL + 1.9);
    add(root, hg, M.hood, { uv: 1 / 8 });
    box(root, 9.3, 0.8, 4.15, M.walnut, 0, 10.2, -WALL + 2.07, { uv: 1 / 6 });
    box(root, 7.6, 0.05, 0.12, M.glow, 0, 9.77, -WALL + 3.4);
  }

  // farmhouse sink + brass faucet (left run local coords: x along run, z out of wall)
  {
    const g = leftRun;
    const x0 = 8.3, x1 = 12.3, cx = (x0 + x1) / 2;
    box(g, x1 - x0, 3.0, 0.22, M.ceramic, cx, -1.5, DEPTH + 0.05);
    box(g, x1 - x0, 2.9, 0.2, M.ceramic, cx, -1.45, 0.45);
    box(g, 0.22, 2.9, DEPTH - 0.3, M.ceramic, x0 + 0.11, -1.45, (DEPTH + 0.3) / 2);
    box(g, 0.22, 2.9, DEPTH - 0.3, M.ceramic, x1 - 0.11, -1.45, (DEPTH + 0.3) / 2);
    box(g, x1 - x0, 0.2, DEPTH - 0.3, M.ceramic, cx, -2.8, (DEPTH + 0.3) / 2);
    box(g, x1 - x0, SLAB, 0.36, M.marble, cx, -SLAB / 2, 0.18, { uv: 1 / 9 });
    cyl(g, 0.18, 0.2, 0.3, M.brass, cx, 0.15, 0.95);
    const curve = new THREE.CatmullRomCurve3([
      new V3(cx, 0.2, 0.95), new V3(cx, 2.2, 0.95), new V3(cx, 3.1, 1.2),
      new V3(cx, 3.2, 1.9), new V3(cx, 2.95, 2.45), new V3(cx, 2.45, 2.55),
    ]);
    add(g, new THREE.TubeGeometry(curve, 48, 0.1, 12, false), M.brass, { cast: true });
    for (const s of [-1, 1]) {
      cyl(g, 0.12, 0.14, 0.35, M.brass, cx + s * 0.8, 0.17, 0.95);
      cyl(g, 0.04, 0.04, 0.5, M.brass, cx + s * 0.8, 0.42, 0.95, { rz: Math.PI / 2 });
    }
    // amber soap bottle
    cyl(g, 0.22, 0.22, 0.8, M.amber, cx + 1.7, 0.4, 0.9);
    cyl(g, 0.05, 0.05, 0.3, M.iron, cx + 1.7, 0.95, 0.9);
    // folded towel over the apron
    box(g, 1.2, 1.6, 0.08, M.linen, cx - 0.6, -0.7, DEPTH + 0.22);
  }

  // ---------------------------------------------------------------------------
  // Shelves & counter decor
  // ---------------------------------------------------------------------------
  function shelf(x, y, z, w, d, ry = 0) {
    box(root, w, 0.32, d, M.walnut, x, y, z, { ry, uv: 1 / 6 });
    const gw = ry ? 0.08 : w - 0.6, gd = ry ? w - 0.6 : 0.08;
    const off = ry ? new V3(-(d / 2 - 0.15) * Math.sign(ry), 0, 0) : new V3(0, 0, d / 2 - 0.15);
    box(root, gw, 0.04, gd, M.glow, x + off.x, y - 0.18, z + off.z);
  }
  for (const sx of [-10.4, 10.4]) for (const sy of [4.4, 8.0]) shelf(sx, sy, -WALL + 0.95, 7.2, 1.9);
  for (const sy of [4.4, 8.0]) shelf(WALL - 0.95, sy, -6.8, 11, 1.9, Math.PI / 2);

  const bz = -WALL + 1.0;
  // back-left shelves
  canister(root, -13.1, 4.56, bz, 0.42, 1.1);
  canister(root, -12.1, 4.56, bz, 0.36, 0.85, M.sage);
  canister(root, -11.2, 4.56, bz, 0.32, 0.7);
  for (let i = 0; i < 3; i++) bowl(root, -9.2, 4.56 + i * 0.22, bz, 0.62 - i * 0.03, 0.4, M.ceramic);
  pottedPlant(root, -7.7, 4.56, bz, { r: 0.4, h: 0.55, mat: M.ceramic, leaves: 40, trailing: 6, trailLen: 2.4, leafSize: 0.2 });
  for (let i = 0; i < 3; i++) plate(root, -12.8 + i * 0.28, 8.16 + 0.8, bz - 0.25 + i * 0.02, 0.85, M.ceramic, { rx: Math.PI / 2 - 0.2 });
  lathe(root, [[0, 0], [0.4, 0], [0.5, 0.4], [0.42, 0.9], [0.38, 1.05], [0.46, 1.2], [0.42, 1.22], [0, 1.2]], M.ceramic, -10.3, 8.16, bz, { seg: 32 });
  pottedPlant(root, -8.1, 8.16, bz, { r: 0.38, h: 0.5, leaves: 45, trailing: 5, trailLen: 2.8, leafSize: 0.2 });
  // back-right shelves
  for (let i = 0; i < 4; i++) bowl(root, 8.2, 4.56 + i * 0.2, bz, 0.66 - i * 0.03, 0.42, i % 2 ? M.sage : M.ceramic);
  canister(root, 9.8, 4.56, bz, 0.4, 1.0, M.speckle);
  canister(root, 10.8, 4.56, bz, 0.34, 0.8);
  pottedPlant(root, 12.7, 4.56, bz, { r: 0.42, h: 0.55, mat: M.ceramic, leaves: 45, trailing: 7, trailLen: 2.6, leafSize: 0.2 });
  for (let i = 0; i < 5; i++) plate(root, 8.3, 8.16 + i * 0.16, bz, 0.8);
  canister(root, 10.4, 8.16, bz, 0.4, 1.2, M.ceramic, M.lightWood);
  pottedPlant(root, 12.4, 8.16, bz, { r: 0.38, h: 0.5, mat: M.terracotta, leaves: 50, leafSize: 0.2 });
  // right wall shelves (items along z)
  const rx = WALL - 1.0;
  for (let i = 0; i < 6; i++) plate(root, rx, 4.56 + i * 0.15, -10.5, 0.8);
  for (let i = 0; i < 3; i++) bowl(root, rx, 4.56 + i * 0.22, -8.3, 0.6, 0.38, M.speckle);
  canister(root, rx, 4.56, -6.4, 0.42, 1.2, M.sage);
  canister(root, rx, 4.56, -5.3, 0.34, 0.9);
  pottedPlant(root, rx, 4.56, -3.0, { r: 0.4, h: 0.5, mat: M.ceramic, leaves: 40, trailing: 6, trailLen: 2.2, leafSize: 0.2 });
  for (let i = 0; i < 3; i++) cyl(root, 0.35, 0.3, 0.7, M.ceramic, rx, 8.51, -11 + i * 0.85, { cast: false });
  lathe(root, [[0, 0], [0.45, 0], [0.55, 0.45], [0.46, 1.0], [0.4, 1.12], [0.5, 1.28], [0, 1.28]], M.sage, rx, 8.16, -7.5, { seg: 32 });
  for (let i = 0; i < 4; i++) plate(root, rx, 8.16 + i * 0.15, -5.4, 0.78, M.speckle);
  pottedPlant(root, rx, 8.16, -3.2, { r: 0.36, h: 0.5, leaves: 45, trailing: 4, trailLen: 2.4, leafSize: 0.2 });

  // leaning cutting boards on the back counter
  function cuttingBoard(x, z, w, h, lean, mat) {
    const s = roundedRect(-w / 2, 0, w, h, 0.28);
    const handle = roundedRect(-0.26, h - 0.2, 0.52, 0.95, 0.24);
    const g1 = new THREE.ExtrudeGeometry(s, { depth: 0.14, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 2 });
    const g2 = new THREE.ExtrudeGeometry(handle, { depth: 0.14, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 2 });
    for (const g of [g1, g2]) {
      g.rotateX(-lean);
      g.translate(x, 0.03, z);
      add(root, g, mat, { uv: 1 / 4 });
    }
  }
  cuttingBoard(-7.6, -WALL + 0.55, 1.7, 2.5, 0.12, M.lightWood);
  cuttingBoard(-6.4, -WALL + 0.8, 1.4, 1.9, 0.08, M.wood);
  // utensil crock & bottles
  cyl(root, 0.45, 0.4, 1.2, M.ceramic, 5.4, 0.6, -WALL + 1.4);
  for (let i = 0; i < 4; i++) {
    const a = i * 1.6;
    cyl(root, 0.045, 0.045, 2.6, M.lightWood, 5.4 + Math.cos(a) * 0.12, 1.5, -WALL + 1.4 + Math.sin(a) * 0.12, { rz: Math.cos(a) * 0.18 });
  }
  cyl(root, 0.26, 0.26, 1.4, M.oliveOil, 7.2, 0.7, -WALL + 1.2);
  cyl(root, 0.08, 0.1, 0.5, M.oliveOil, 7.2, 1.65, -WALL + 1.2);
  cyl(root, 0.22, 0.22, 1.1, M.amber, 7.9, 0.55, -WALL + 1.0);
  cyl(root, 0.07, 0.09, 0.45, M.amber, 7.9, 1.32, -WALL + 1.0);
  lathe(root, [[0, 0], [0.25, 0], [0.22, 0.5], [0.3, 0.9], [0.18, 1.35], [0.12, 1.5], [0, 1.52]], M.walnut, 8.7, 0, -WALL + 1.2, { seg: 24 });
  pottedPlant(root, -4.9, 0, -WALL + 1.3, { r: 0.55, h: 0.7, mat: M.ceramic, leaves: 70, leafSize: 0.24 });
  pottedPlant(root, 13.8, 0, -WALL + 1.4, { r: 0.6, h: 0.75, mat: M.terracotta, leaves: 80, leafSize: 0.26 });
  // lemons on the right counter
  bowl(root, WALL - 2.8, 0, -9.5, 1.0, 0.45, M.walnut);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    sphere(root, 0.26, M.lemon, WALL - 2.8 + Math.cos(a) * 0.45 * (i ? 1 : 0), 0.42 + (i ? 0 : 0.22), -9.5 + Math.sin(a) * 0.45 * (i ? 1 : 0), { scale: [1, 0.85, 0.85] });
  }
  // window sill plants
  for (const [z, s] of [[-6.4, 1], [4.2, 0.9]]) pottedPlant(root, -WALL + 0.45, 2.2, z, { r: 0.42 * s, h: 0.55 * s, mat: M.terracotta, leaves: 50, leafSize: 0.2 });

  // ---------------------------------------------------------------------------
  // Floor plants, hanging plant, rug
  // ---------------------------------------------------------------------------
  {
    // olive tree in a big cream planter (front-right corner)
    const tx = 15.2, tz = 15.2;
    lathe(root, [[0, 0], [1.3, 0], [1.6, 2.6], [1.7, 2.8], [1.55, 2.85], [0, 2.7]], M.ceramic, tx, FLOOR, tz, { seg: 36 });
    const branches = [
      [[0, 2.7, 0], [0.1, 6, 0.1], [-0.4, 9, 0.3], [-1.2, 11.5, 0.4]],
      [[0.1, 5.5, 0.1], [1.0, 8, -0.3], [1.8, 10.5, -0.6]],
      [[-0.2, 7.5, 0.2], [-1.4, 9.3, -0.8], [-2.2, 10.5, -1.2]],
      [[0.2, 8.5, 0], [0.6, 10.5, 1.2], [0.8, 12, 1.8]],
    ];
    const tips = [];
    branches.forEach((b, i) => {
      const pts = b.map(([x, y, z]) => new V3(tx + x, FLOOR + y, tz + z));
      add(root, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, i ? 0.1 : 0.2, 8, false), M.walnut);
      tips.push(pts[pts.length - 1], pts[pts.length - 2]);
    });
    const items = [];
    for (const c of tips) {
      for (let i = 0; i < 90; i++) {
        const d = new V3(rng() - 0.5, (rng() - 0.35) * 0.8, rng() - 0.5).normalize().multiplyScalar(Math.pow(rng(), 0.6) * 1.6);
        items.push({ p: c.clone().add(d), s: 0.28 * (0.7 + rng() * 0.5), c: pick(OLIVES) });
      }
    }
    leafCloud(root, items);

    // tall leafy plant in a woven basket (front-left corner)
    const bx = -15.6, bz2 = 15.6;
    lathe(root, [[0, 0], [1.1, 0], [1.3, 1.8], [1.35, 1.9], [1.2, 1.9], [0, 1.8]], M.lightWood, bx, FLOOR, bz2, { seg: 32 });
    const leaves = [];
    for (let i = 0; i < 26; i++) {
      const a = rng() * Math.PI * 2, hgt = 2 + rng() * 5.5;
      const stemTop = new V3(bx + Math.cos(a) * rng() * 1.2, FLOOR + hgt + 1.8, bz2 + Math.sin(a) * rng() * 1.2);
      add(root, new THREE.CylinderGeometry(0.03, 0.04, hgt, 5).translate(0, hgt / 2, 0).rotateZ((stemTop.x - bx) * 0.12).rotateX(-(stemTop.z - bz2) * 0.12).translate(bx, FLOOR + 1.8, bz2), M.stem);
      leaves.push({ p: stemTop, s: 0.9 + rng() * 0.5, c: pick(GREENS), rx: -0.3 - rng() * 0.6, ry: a });
    }
    leafCloud(root, leaves);

    // hanging plant near the back-left corner
    const hx = -14.5, hz = -12.5, hy = 10.2;
    lathe(root, [[0, 0], [0.55, 0.1], [0.7, 0.7], [0.72, 0.8], [0, 0.75]], M.ceramic, hx, hy, hz, { seg: 28 });
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      const pts = [new V3(hx + Math.cos(a) * 0.7, hy + 0.8, hz + Math.sin(a) * 0.7), new V3(hx, CEIL - 0.9, hz)];
      add(root, new THREE.TubeGeometry(new THREE.LineCurve3(pts[0], pts[1]), 2, 0.025, 5, false), M.rope);
    }
    const hang = [];
    for (let v = 0; v < 12; v++) {
      const a = rng() * Math.PI * 2;
      let px = hx + Math.cos(a) * 0.65, pz = hz + Math.sin(a) * 0.65, py = hy + 0.8;
      const len = 2.5 + rng() * 3;
      for (let k = 0; k < 18; k++) {
        px += Math.cos(a) * 0.04; pz += Math.sin(a) * 0.04; py -= len / 18;
        hang.push({ p: new V3(px, py, pz), s: 0.2, c: pick(GREENS), rx: -1.2 + rng() * 0.6 });
      }
    }
    for (let i = 0; i < 40; i++) hang.push({ p: new V3(hx + (rng() - 0.5) * 1.2, hy + 0.8 + rng() * 0.5, hz + (rng() - 0.5) * 1.2), s: 0.22, c: pick(GREENS) });
    leafCloud(root, hang);

    const rug = new THREE.PlaneGeometry(16, 12);
    rug.rotateX(-Math.PI / 2);
    rug.translate(0, FLOOR + 0.02, -0.3);
    add(root, rug, M.rug);
  }

  // ---------------------------------------------------------------------------
  // Island: rectangular marble top + cabinet base
  // ---------------------------------------------------------------------------
  {
    const iw = island.maxX - island.minX, id = island.maxZ - island.minZ;
    const icx = (island.minX + island.maxX) / 2, icz = (island.minZ + island.maxZ) / 2;
    const tg = new THREE.ExtrudeGeometry(roundedRect(island.minX, island.minZ, iw, id, 0.3), {
      depth: SLAB - 0.1, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 4, curveSegments: 12,
    });
    tg.rotateX(Math.PI / 2);
    tg.translate(0, -0.05, 0);
    add(root, tg, M.marble, { cast: true, uv: 1 / 9 });

    const inset = 0.32;
    const bx0 = island.minX + inset, bx1 = island.maxX - inset, bz0 = island.minZ + inset, bz1 = island.maxZ - inset;
    box(root, bx1 - bx0, -SLAB - (FLOOR + 0.5), bz1 - bz0, M.cabinet, icx, (-SLAB + FLOOR + 0.5) / 2, icz, { cast: true });
    box(root, bx1 - bx0 - 0.5, 0.5, bz1 - bz0 - 0.5, M.toe, icx, FLOOR + 0.25, icz);
    const dTop = -SLAB - 0.25, dBot = FLOOR + 0.56, dh = dTop - dBot, dy = (dTop + dBot) / 2;
    for (const [z, rot] of [[bz1, 0], [bz0, Math.PI]]) {
      const n = 3, fw = (bx1 - bx0) / n;
      for (let k = 0; k < n; k++) frontPanel(root, bx0 + fw * (k + 0.5), dy, z, fw - 0.12, dh, rot, 'door');
    }
    for (const [x, rot] of [[bx1, Math.PI / 2], [bx0, -Math.PI / 2]]) {
      const n = 2, fw = (bz1 - bz0) / n;
      for (let k = 0; k < n; k++) frontPanel(root, x, dy, bz0 + fw * (k + 0.5), fw - 0.12, dh, rot, 'door');
    }
    const sh = new THREE.PlaneGeometry(iw + 2.2, id + 2.2);
    sh.rotateX(-Math.PI / 2);
    sh.translate(icx, FLOOR + 0.04, icz);
    add(root, sh, M.shadow, { receive: false });
  }

  // ---------------------------------------------------------------------------
  // Brass pendants over the island
  // ---------------------------------------------------------------------------
  function pendant(x, z) {
    const y = 10.6;
    const prof = [[1.5, 0], [1.46, 0.28], [1.3, 0.72], [1.0, 1.06], [0.55, 1.28], [0.2, 1.36], [0.12, 1.6]];
    lathe(root, prof, M.brass, x, y, z, { seg: 48, receive: false });
    lathe(root, prof.map(([a, b]) => [a * 0.97, b]), M.shadeInner, x, y - 0.01, z, { seg: 48, receive: false });
    sphere(root, 0.34, M.bulb, x, y + 0.45, z, { receive: false });
    cyl(root, 0.03, 0.03, CEIL - y - 1.6, M.iron, x, (CEIL + y + 1.6) / 2, z, { seg: 6, receive: false });
    cyl(root, 0.4, 0.4, 0.16, M.brass, x, CEIL - 0.08, z, { receive: false });
    const l = new THREE.PointLight(0xffc88c, 34, 26, 2);
    l.position.set(x, y + 0.2, z);
    root.add(l);
    lights.push(l);
  }
  pendant(-3.2, -0.3);
  pendant(3.2, -0.3);

  // ---------------------------------------------------------------------------
  // Props on the island around the cake
  // ---------------------------------------------------------------------------
  {
    const P = props;
    // speckled bowl of chocolate chunks (front-left)
    bowl(P, -3.3, 0, 1.35, 0.62, 0.42, M.speckle);
    chunkCloud(P, mound(-3.3, 0.3, 1.35, 0.44, 26, 0.11, 0.16));
    // wooden bowl of chocolate chunks (right)
    bowl(P, 3.5, 0, -0.75, 0.72, 0.46, M.walnut, { t: 0.07 });
    chunkCloud(P, mound(3.5, 0.34, -0.75, 0.52, 32, 0.11, 0.18));
    // scattered chunks
    chunkCloud(P, [[-2.55, 0.04, 1.95, 0.08], [-2.35, 0.035, 1.6, 0.065], [-2.8, 0.03, 2.1, 0.055], [2.75, 0.04, 0.05, 0.075], [2.55, 0.03, 0.35, 0.06], [2.9, 0.03, -0.1, 0.05]]);

    // ceramic crock with wooden spoons + whisk (back-left)
    const cx = -3.8, cz = -2.4;
    lathe(P, [[0, 0], [0.4, 0], [0.43, 0.1], [0.43, 1.25], [0.47, 1.32], [0.4, 1.32], [0.38, 1.2], [0, 1.2]], M.ceramic, cx, 0, cz, { seg: 36, cast: true });
    for (let i = 0; i < 3; i++) {
      const a = -0.6 + i * 0.9, tilt = 0.14 + i * 0.05;
      const g = new THREE.Group();
      g.position.set(cx + Math.cos(a) * 0.12, 0.3, cz + Math.sin(a) * 0.12);
      g.rotation.set(Math.sin(a) * tilt, 0, -Math.cos(a) * tilt);
      P.add(g);
      cyl(g, 0.05, 0.06, 2.8, M.lightWood, 0, 1.4, 0, { seg: 10, cast: true });
      sphere(g, 0.24, M.lightWood, 0, 2.95, 0, { scale: [0.8, 1.35, 0.3], cast: true });
    }
    {
      const g = new THREE.Group();
      g.position.set(cx - 0.1, 0.3, cz - 0.05);
      g.rotation.set(0.12, 0, 0.1);
      P.add(g);
      cyl(g, 0.08, 0.09, 1.3, M.walnut, 0, 0.65, 0, { cast: true });
      for (let k = 0; k < 8; k++) {
        const pts = [];
        for (let i = 0; i <= 20; i++) {
          const t = (i / 20) * Math.PI;
          const along = (1 - Math.cos(t)) / 2;
          pts.push(new V3(Math.sin(t) * 0.36 * Math.pow(along, 0.35), 1.3 + along * 1.5, 0));
        }
        const curve = new THREE.CatmullRomCurve3(pts);
        const tg = new THREE.TubeGeometry(curve, 24, 0.012, 4, false);
        tg.rotateY((k / 8) * Math.PI);
        add(g, tg, M.steel, { cast: true });
      }
    }

    // bud vase with baby's-breath (back-right)
    const vx = 3.85, vz = -2.35;
    lathe(P, [[0, 0], [0.3, 0], [0.42, 0.35], [0.36, 0.8], [0.16, 1.1], [0.14, 1.35], [0.2, 1.42], [0.12, 1.42], [0, 1.3]], M.sage, vx, 0, vz, { seg: 32, cast: true });
    const blossoms = [];
    for (let s = 0; s < 9; s++) {
      const a = (s / 9) * Math.PI * 2 + rng() * 0.5, lean = 0.25 + rng() * 0.35, len = 1.3 + rng() * 0.9;
      const top = new V3(vx + Math.cos(a) * Math.sin(lean) * len, 1.35 + Math.cos(lean) * len, vz + Math.sin(a) * Math.sin(lean) * len);
      const curve = new THREE.QuadraticBezierCurve3(new V3(vx, 1.2, vz), new V3(vx + (top.x - vx) * 0.3, 1.35 + (top.y - 1.35) * 0.7, vz + (top.z - vz) * 0.3), top);
      add(P, new THREE.TubeGeometry(curve, 10, 0.015, 4, false), M.stem);
      for (let b = 0; b < 26; b++) {
        blossoms.push(top.clone().add(new V3((rng() - 0.5) * 0.55, (rng() - 0.3) * 0.35, (rng() - 0.5) * 0.55)));
      }
    }
    const bl = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.045, 1), std({ color: 0xffffff, roughness: 0.7 }), blossoms.length);
    const cc = new THREE.Color();
    blossoms.forEach((p, i) => {
      dummy.position.copy(p); dummy.rotation.set(0, 0, 0); dummy.scale.setScalar(0.7 + rng() * 0.7); dummy.updateMatrix();
      bl.setMatrixAt(i, dummy.matrix);
      bl.setColorAt(i, cc.set(rng() < 0.8 ? '#fffaf0' : '#f3e6cf'));
    });
    bl.castShadow = true;
    P.add(bl);

    // dessert plates with a fork (front-right)
    const px = 3.25, pz = 1.4;
    for (let i = 0; i < 3; i++) plate(P, px, i * 0.1, pz, 0.78 - i * 0.02, M.ceramic, { cast: true });
    {
      const g = new THREE.Group();
      g.position.set(px + 0.05, 0.36, pz + 0.05);
      g.rotation.y = 0.7;
      P.add(g);
      box(g, 0.1, 0.03, 0.95, M.steel, 0, 0, 0.1, { cast: true });
      box(g, 0.22, 0.03, 0.18, M.steel, 0, 0, -0.45, { cast: true });
      for (let t = 0; t < 4; t++) box(g, 0.035, 0.03, 0.34, M.steel, -0.09 + t * 0.06, 0, -0.7, { cast: true });
    }

    // linen napkin with a cake server (left)
    {
      const g = new THREE.Group();
      g.position.set(-3.05, 0, -0.55);
      g.rotation.y = 0.45;
      P.add(g);
      box(g, 1.35, 0.06, 1.0, M.linen, 0, 0.03, 0, { cast: true });
      box(g, 1.3, 0.03, 0.96, M.linen, 0.02, 0.075, 0.01);
      const blade = new THREE.Shape();
      blade.moveTo(0, -0.08); blade.lineTo(0.95, -0.24); blade.quadraticCurveTo(1.12, 0, 0.95, 0.24); blade.lineTo(0, 0.08); blade.lineTo(0, -0.08);
      const bg = new THREE.ExtrudeGeometry(blade, { depth: 0.02, bevelEnabled: false });
      bg.rotateX(-Math.PI / 2);
      bg.translate(-0.55, 0.12, 0);
      add(g, bg, M.steel, { cast: true });
      cyl(g, 0.065, 0.075, 0.9, M.walnut, -1.0, 0.16, 0, { rz: Math.PI / 2, cast: true });
      cyl(g, 0.07, 0.07, 0.08, M.brass, -0.57, 0.16, 0, { rz: Math.PI / 2 });
    }

    // glass jar of chocolate chips (back)
    {
      const jx = -2.0, jz = -2.55;
      lathe(P, [[0, 0], [0.36, 0], [0.4, 0.08], [0.4, 0.85], [0.32, 0.95], [0.3, 1.02], [0, 1.02]], M.glass, jx, 0, jz, { seg: 36 });
      cyl(P, 0.3, 0.28, 0.22, M.lightWood, jx, 1.12, jz, { cast: true });
      const chips = [];
      for (let i = 0; i < 120; i++) {
        const a = rng() * Math.PI * 2, rr = Math.sqrt(rng()) * 0.32;
        chips.push([jx + Math.cos(a) * rr, 0.06 + rng() * 0.55, jz + Math.sin(a) * rr, 0.045]);
      }
      chunkCloud(P, chips);
    }

    // coffee cup on a saucer (back-right)
    {
      const qx = 2.1, qz = -2.5;
      plate(P, qx, 0, qz, 0.62, M.ceramic, { cast: true });
      lathe(P, [[0, 0], [0.24, 0], [0.34, 0.12], [0.38, 0.5], [0.4, 0.56], [0.36, 0.56], [0.34, 0.5], [0.3, 0.14], [0, 0.12]], M.ceramic, qx, 0.1, qz, { seg: 36, cast: true });
      cyl(P, 0.34, 0.34, 0.02, M.coffee, qx, 0.58, qz, { seg: 32 });
      const hg = new THREE.TorusGeometry(0.14, 0.035, 8, 18, Math.PI * 1.3);
      hg.rotateZ(-Math.PI * 0.65);
      hg.translate(qx + 0.42, 0.42, qz);
      add(P, hg, M.ceramic, { cast: true });
    }

    // little bowl of raspberries (front)
    {
      const rxp = 1.75, rzp = 2.0;
      bowl(P, rxp, 0, rzp, 0.44, 0.3, M.ceramic);
      const bg = new THREE.IcosahedronGeometry(1, 3);
      const p = bg.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const v = new V3().fromBufferAttribute(p, i);
        const bump = Math.abs(Math.sin(v.x * 9) * Math.sin(v.y * 9) * Math.sin(v.z * 9));
        v.multiplyScalar(1 + 0.12 * Math.pow(bump, 0.5));
        v.y *= 1.15;
        p.setXYZ(i, v.x, v.y, v.z);
      }
      bg.computeVertexNormals();
      const berries = [...mound(rxp, 0.27, rzp, 0.28, 11, 0.09, 0.12), [1.2, 0.09, 2.25, 0.09], [1.05, 0.09, 1.95, 0.085]];
      const im = new THREE.InstancedMesh(bg, M.berry, berries.length);
      berries.forEach(([x, y, z, s], i) => {
        dummy.position.set(x, y, z);
        dummy.rotation.set(rng(), rng() * 3, rng());
        dummy.scale.setScalar(s);
        dummy.updateMatrix();
        im.setMatrixAt(i, dummy.matrix);
      });
      im.castShadow = true;
      im.receiveShadow = true;
      P.add(im);
    }
  }

  // ---------------------------------------------------------------------------
  // Merge static meshes per material to keep draw calls low
  // ---------------------------------------------------------------------------
  function bake(group) {
    group.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(group.matrixWorld).invert();
    const buckets = new Map();
    const keep = [];
    group.traverse((o) => {
      if (o === group) return;
      if (o.isInstancedMesh || o.isLight) { keep.push(o); return; }
      if (!o.isMesh) return;
      const key = o.material.uuid + (o.castShadow ? '|c' : '') + (o.receiveShadow ? '|r' : '');
      if (!buckets.has(key)) buckets.set(key, { mat: o.material, cast: o.castShadow, receive: o.receiveShadow, geos: [] });
      const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
      g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
      buckets.get(key).geos.push(g);
      o.geometry.dispose();
    });
    for (const o of keep) group.attach(o);
    for (const c of [...group.children]) if (!keep.includes(c)) group.remove(c);
    for (const b of buckets.values()) {
      let n = 0;
      for (const g of b.geos) n += g.attributes.position.count;
      const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2);
      let o = 0;
      for (const g of b.geos) {
        const c = g.attributes.position.count;
        pos.set(g.attributes.position.array, o * 3);
        if (g.attributes.normal) nor.set(g.attributes.normal.array, o * 3);
        if (g.attributes.uv) uv.set(g.attributes.uv.array, o * 2);
        o += c;
        g.dispose();
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
      geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      geo.computeBoundingSphere();
      const m = new THREE.Mesh(geo, b.mat);
      m.castShadow = b.cast;
      m.receiveShadow = b.receive;
      group.add(m);
    }
  }
  bake(root);
  bake(props);

  return { root, props, lights, island, marbleTex, FLOOR, CEIL, WALL };
};
