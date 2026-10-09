/* Browser City — camera, sky, ground, depth-sorted world, labels and picking. */
(function () {
  const U = BC.util, A = BC.art, iso = U.iso, S = BC.sim;
  const R = (BC.render = {});
  const FONT = 'Fredoka, Nunito, "Segoe UI", sans-serif';

  let canvas, ctx, W = 0, H = 0, dpr = 1;
  const cam = (R.cam = { x: 0, y: 0, z: 1, tx: null, ty: null, tz: null, vx: 0, vy: 0, minZ: 0.3, maxZ: 4.5 });
  R.fitZ = 1;
  R.offsetX = 0; // screen px the view should shift (when a side card or sheet is open)
  R.offsetY = 0;
  let city = null, ground = null;
  const st = (R.state = {
    hour: 16.6, playing: true, speed: 0.05, night: 0, day: 1, hover: null, hoverCar: null, selected: null,
    t: 0, frame: 0, intro: null, replay: null, labels: [], focusDistrict: null, activity: 0.5,
    dayMode: null, follow: null, fw: null, rain: 0, rainbow: 0, dt: 0,
  });
  const sprites = new Map();
  const treeSprites = new Map();
  let drawn = [];
  let budget = 0;
  let stars = [];

  R.init = function (cv) {
    canvas = cv;
    ctx = canvas.getContext('2d');
    const rs = U.rng('stars');
    stars = Array.from({ length: 90 }, () => [rs(), rs() * 0.75, rs() * 1.2 + 0.4, rs() * 6]);
    window.addEventListener('resize', resize);
    resize();
  };
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.clientWidth || window.innerWidth;
    H = canvas.clientHeight || window.innerHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    if (city) computeFit(false);
  }
  R.size = () => [W, H];

  R.setCity = function (c) {
    city = c;
    sprites.clear();
    ground = buildGround(c);
    for (const t of c.trees) {
      const p = iso(t.i, t.j, insidePlate(t.i, t.j) ? 3 : 0);
      t.x = p[0];
      t.y = p[1];
      t.pop = 1;
    }
    computeFit(true);
    // weather: a night is stormy when you were online far later than usual
    const nights = c.ds.nights || [];
    const vals = nights.map((n) => n[1]).filter((v) => v > 0).sort((a, b) => a - b);
    const med = vals.length ? vals[vals.length >> 1] : 0;
    R.stormThresh = Math.max(14, med * 2.2);
    R.nightMap = new Map(nights);
    R.liveDay = c.ds.hasTime ? BC.dayOf(c.ds.t1) - 1 : null;
    const ch = c.ds.cityHours || [];
    R.peakHour = c.ds.hasTime && ch.length ? ch.indexOf(Math.max(...ch)) : null;
    st.dayMode = st.follow = st.fw = null;
    st.rain = st.rainbow = 0;
    const rr = U.rng('ripples');
    R.ripples = [];
    for (let k = 0; k < 60; k++) {
      const i = rr.int(0, c.N - 1), j = rr.int(0, c.G) * 4;
      R.ripples.push(rr.chance(0.5) ? [i + rr(), j + rr(), rr() * 3] : [j + rr(), i + rr(), rr() * 3]);
    }
  };
  R.stormy = (day) => (R.nightMap && R.nightMap.get(day)) >= R.stormThresh;
  R.lateCount = (day) => (R.nightMap && R.nightMap.get(day)) || 0;
  // rain on the evening of a late night, a rainbow the morning after
  R.weatherAt = function (day, hour) {
    let rain = 0, rainbow = 0;
    if (R.stormy(day) && hour >= 20) rain = U.smooth(20, 21.2, hour);
    if (R.stormy(day - 1)) {
      if (hour < 7) rain = Math.max(rain, 1 - U.smooth(5.6, 6.8, hour));
      if (hour >= 6 && hour < 11.5) rainbow = U.smooth(6.4, 7.6, hour) * (1 - U.smooth(10.3, 11.5, hour));
    }
    return { rain, rainbow };
  };
  R.clearSprites = () => {
    sprites.clear();
    treeSprites.clear();
  };
  function insidePlate(i, j) {
    return i >= 0 && j >= 0 && i < city.N && j < city.N;
  }
  function computeFit(reset) {
    const b = city.bounds;
    const zw = W / (b.x1 - b.x0), zh = H / (b.y1 - b.y0);
    const full = Math.min(zw, zh) * 0.98;
    // on a portrait phone the whole diorama is tiny, so "home" frames downtown instead
    R.fitZ = full * (W < 700 && H > W ? 1.8 : 1);
    cam.minZ = full * 0.55;
    cam.maxZ = Math.max(4, R.fitZ * 6);
    if (reset) {
      cam.x = (b.x0 + b.x1) / 2;
      cam.y = (b.y0 + b.y1) / 2 + 30;
      cam.z = R.fitZ;
      cam.tx = cam.ty = cam.tz = null;
    }
  }

  // ---------- coordinate helpers ----------
  R.screenToWorld = (sx, sy) => [(sx - W / 2) / cam.z + cam.x, (sy - H / 2) / cam.z + cam.y];
  R.worldToScreen = (wx, wy) => [(wx - cam.x) * cam.z + W / 2, (wy - cam.y) * cam.z + H / 2];
  R.flyTo = function (i, j, z, zoom) {
    const [wx, wy] = iso(i, j, z || 0);
    const tz = U.clamp(zoom || cam.z, cam.minZ, cam.maxZ);
    cam.tz = tz;
    cam.tx = wx + R.offsetX / tz;
    cam.ty = wy + R.offsetY / tz;
    cam.vx = cam.vy = 0;
  };
  R.home = function () {
    const b = city.bounds;
    cam.tx = (b.x0 + b.x1) / 2;
    cam.ty = (b.y0 + b.y1) / 2 + 30;
    cam.tz = R.fitZ;
  };
  R.panBy = function (dx, dy) {
    if (st.follow) {
      st.follow = null;
      if (R.onUnfollow) R.onUnfollow();
    }
    cam.x -= dx / cam.z;
    cam.y -= dy / cam.z;
    cam.tx = cam.ty = cam.tz = null;
    clampCam();
  };
  R.zoomAt = function (sx, sy, f) {
    const [wx, wy] = R.screenToWorld(sx, sy);
    const z = U.clamp(cam.z * f, cam.minZ, cam.maxZ);
    cam.z = z;
    cam.x = wx - (sx - W / 2) / z;
    cam.y = wy - (sy - H / 2) / z;
    cam.tx = cam.ty = cam.tz = null;
    clampCam();
  };
  function clampCam() {
    const b = city.bounds;
    cam.x = U.clamp(cam.x, b.x0, b.x1);
    cam.y = U.clamp(cam.y, b.y0, b.y1);
  }

  // ---------- time of day ----------
  const SKY = [
    [0, '#a9aee3', '#d6d0f1'], [4.5, '#b4addf', '#e2d3ee'], [6, '#c9bdee', '#ffd8d2'], [7.5, '#bcdcf7', '#ffeedd'],
    [12, '#bfe1fb', '#f4f9ff'], [16.5, '#c6dcf6', '#fff1df'], [18.4, '#f0c4d8', '#ffe0c2'], [19.8, '#bdaee3', '#f6c9d4'],
    [21.5, '#a9a8de', '#d9d2f2'], [24, '#a9aee3', '#d6d0f1'],
  ];
  function skyAt(h) {
    for (let k = 0; k < SKY.length - 1; k++) {
      const a = SKY[k], b = SKY[k + 1];
      if (h >= a[0] && h <= b[0]) {
        const t = (h - a[0]) / (b[0] - a[0]);
        return [U.mix(a[1], b[1], Math.round(t * 30) / 30), U.mix(a[2], b[2], Math.round(t * 30) / 30)];
      }
    }
    return [SKY[0][1], SKY[0][2]];
  }
  R.nightness = function (h) {
    if (h >= 7 && h <= 17.6) return 0;
    if (h > 17.6 && h < 20.6) return U.smooth(17.6, 20.6, h);
    if (h >= 20.6 || h < 5) return 1;
    return 1 - U.smooth(5, 7, h);
  };
  function daylight(h) {
    if (h < 6 || h > 18.6) return 0;
    return Math.min(U.smooth(6, 7.5, h), 1 - U.smooth(17.4, 18.6, h));
  }

  // ---------- ground (static, built once into Path2D layers) ----------
  function buildGround(c) {
    const { N, M } = c;
    const g = { layers: [] };
    const dia = (i, j, w, d, z = 0) => [iso(i, j, z), iso(i + w, j, z), iso(i + w, j + d, z), iso(i, j + d, z)];
    const add = (p, pts) => {
      p.moveTo(pts[0][0], pts[0][1]);
      for (let k = 1; k < pts.length; k++) p.lineTo(pts[k][0], pts[k][1]);
      p.closePath();
    };
    const layer = (fill, path) => {
      const p = path || new Path2D();
      g.layers.push({ fill, p });
      return p;
    };
    const ell = (p, i, j, r, z = 0) => {
      const [x, y] = iso(i, j, z);
      p.moveTo(x + r * 45.25, y);
      p.ellipse(x, y, r * 45.25, r * 22.6, 0, 0, Math.PI * 2);
    };
    const R0 = U.rng('ground');

    // floating island: shadow, strata, top
    const L = iso(-M, N + M), Bm = iso(N + M, N + M), Rt = iso(N + M, -M), Tp = iso(-M, -M);
    g.shadow = { x: (L[0] + Rt[0]) / 2, y: Bm[1] + 52, rx: (Rt[0] - L[0]) * 0.46, ry: 34 };
    const depths = [0, 7, 22, 44, 70];
    const cols = [['#b6dea0', '#a3d08c'], ['#f5dfc6', '#e7cdb0'], ['#ecd2b3', '#dcc1a0'], ['#e3cab7', '#d2b8a4']];
    const faces = [[L, Bm, 0], [Bm, Rt, 1]];
    for (let li = 0; li < 4; li++) {
      for (const [p0, p1, side] of faces) {
        const p = new Path2D();
        const n = 48;
        const wave = (k, d, x) => (k === 0 || k === depths.length - 1 ? 0 : Math.sin(x * 0.045 + k * 2) * 2.4 + Math.sin(x * 0.13 + k) * 1.1);
        for (let s = 0; s <= n; s++) {
          const t = s / n, x = p0[0] + (p1[0] - p0[0]) * t, y = p0[1] + (p1[1] - p0[1]) * t;
          const yy = y + depths[li] + wave(li, depths[li], x);
          s ? p.lineTo(x, yy) : p.moveTo(x, yy);
        }
        for (let s = n; s >= 0; s--) {
          const t = s / n, x = p0[0] + (p1[0] - p0[0]) * t, y = p0[1] + (p1[1] - p0[1]) * t;
          p.lineTo(x, y + depths[li + 1] + wave(li + 1, depths[li + 1], x));
        }
        p.closePath();
        layer(cols[li][side], p);
      }
    }
    const pebbles = layer('rgba(196,164,136,.45)');
    for (let k = 0; k < 70; k++) {
      const side = k % 2;
      const [p0, p1] = side ? [Bm, Rt] : [L, Bm];
      const t = R0.range(0.03, 0.97);
      const x = p0[0] + (p1[0] - p0[0]) * t, y = p0[1] + (p1[1] - p0[1]) * t + R0.range(14, 64);
      const r = R0.range(1.2, 3.4);
      pebbles.moveTo(x + r, y);
      pebbles.ellipse(x, y, r, r * 0.7, 0, 0, Math.PI * 2);
    }
    g.outline = new Path2D();
    add(g.outline, [Tp, Rt, [Rt[0], Rt[1] + 70], [Bm[0], Bm[1] + 70], [L[0], L[1] + 70], L]);
    add(layer('#d3ecbf'), [Tp, Rt, Bm, L]);
    // meadow texture & wildflowers in the margin
    const tex = layer('rgba(255,255,255,.35)');
    const R1 = U.rng('tex');
    for (let k = 0; k < (N + 2 * M) * 6; k++) {
      const i = R1.range(-M, N + M), j = R1.range(-M, N + M);
      if (i > -0.2 && j > -0.2 && i < N + 0.2 && j < N + 0.2) continue;
      const [x, y] = iso(i, j);
      tex.moveTo(x + 3, y);
      tex.ellipse(x, y, 3, 1.5, 0, 0, Math.PI * 2);
    }
    const FLOWER = ['#ffb3cb', '#fff3a6', '#ffffff', '#d9c8ff', '#ffd2b0'];
    const fl = FLOWER.map((col) => layer(col));
    for (const m of c.meadow) {
      const [x, y] = iso(m.i, m.j);
      fl[m.c].moveTo(x + 1.3, y);
      fl[m.c].arc(x, y, 1.3, 0, Math.PI * 2);
    }
    const rock = layer('#ddd6e8'), rockHi = layer('#f1edf7');
    for (const r of c.rocks) {
      const [x, y] = iso(r.i, r.j);
      rock.moveTo(x + 5 * r.s, y);
      rock.ellipse(x, y - 1.5 * r.s, 5 * r.s, 3.4 * r.s, 0, 0, Math.PI * 2);
      rockHi.moveTo(x, y);
      rockHi.ellipse(x - 1.2 * r.s, y - 2.6 * r.s, 2.6 * r.s, 1.4 * r.s, 0, 0, Math.PI * 2);
    }
    // a little path from the welcome sign into town
    const path = layer('#efe6d6');
    add(path, dia(c.sign.i - 0.35, N, 0.7, c.sign.j - N - 0.2));

    // roads
    add(layer('#e3dfed'), dia(0, 0, N, N));
    const dash = layer('rgba(255,255,255,.9)');
    const zebra = layer('rgba(255,255,255,.95)');
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        const ri = i % 4 === 0, rj = j % 4 === 0;
        if (!(ri || rj) || (ri && rj)) continue;
        if (ri) {
          // road runs along j
          const nearI = (j - 1) % 4 === 0 || (j + 1) % 4 === 0;
          if (nearI && j > 0 && j < N - 1) {
            const jA = (j - 1) % 4 === 0 ? j + 0.06 : j + 0.7;
            for (let s = 0; s < 5; s++) add(zebra, dia(i + 0.12 + s * 0.16, jA, 0.09, 0.24));
          } else add(dash, dia(i + 0.47, j + 0.3, 0.06, 0.4));
        } else {
          const nearJ = (i - 1) % 4 === 0 || (i + 1) % 4 === 0;
          if (nearJ && i > 0 && i < N - 1) {
            const iA = (i - 1) % 4 === 0 ? i + 0.06 : i + 0.7;
            for (let s = 0; s < 5; s++) add(zebra, dia(iA, j + 0.12 + s * 0.16, 0.24, 0.09));
          } else add(dash, dia(i + 0.3, j + 0.47, 0.4, 0.06));
        }
      }
    }

    // block plates: kerb sides, pavement ring, inner ground
    const groups = new Map();
    const grp = (col) => {
      if (!groups.has(col)) groups.set(col, { inner: new Path2D() });
      return groups.get(col);
    };
    const sideL = layer('#d9d3e6'), sideR = layer('#cbc4dc');
    const pave = new Path2D();
    for (const bl of c.blocks) {
      const { i0, j0 } = bl;
      add(sideL, [iso(i0, j0 + 3, 0), iso(i0 + 3, j0 + 3, 0), iso(i0 + 3, j0 + 3, 3), iso(i0, j0 + 3, 3)]);
      add(sideR, [iso(i0 + 3, j0 + 3, 0), iso(i0 + 3, j0, 0), iso(i0 + 3, j0, 3), iso(i0 + 3, j0 + 3, 3)]);
      add(pave, dia(i0, j0, 3, 3, 3));
      const col = bl.kind === 'park' ? '#cbe8b5' : bl.kind === 'plaza' ? '#f7efe6' : BC.DISTRICTS[bl.cat].ground;
      add(grp(col).inner, dia(i0 + 0.16, j0 + 0.16, 2.68, 2.68, 3));
    }
    layer('#f6f3fa', pave);
    for (const [col, gg] of groups) layer(col, gg.inner);

    // decor on plates
    const d = c.decor;
    const paving = layer('#f4ece2'), pavLine = { stroke: 'rgba(214,198,180,.6)', p: new Path2D() };
    for (const pv of d.paving) {
      add(paving, dia(pv.i + 0.12, pv.j + 0.12, pv.w - 0.24, pv.d - 0.24, 3));
      for (let k = 1; k < pv.w * 2; k++) {
        const a = iso(pv.i + 0.12 + k * 0.5 - 0.12 * (k / (pv.w * 2)), pv.j + 0.12, 3);
        const b2 = iso(pv.i + 0.12 + k * 0.5 - 0.12 * (k / (pv.w * 2)), pv.j + pv.d - 0.12, 3);
        pavLine.p.moveTo(a[0], a[1]);
        pavLine.p.lineTo(b2[0], b2[1]);
      }
      for (let k = 1; k < pv.d * 2; k++) {
        const a = iso(pv.i + 0.12, pv.j + 0.12 + k * 0.5 - 0.12 * (k / (pv.d * 2)), 3);
        const b2 = iso(pv.i + pv.w - 0.12, pv.j + 0.12 + k * 0.5 - 0.12 * (k / (pv.d * 2)), 3);
        pavLine.p.moveTo(a[0], a[1]);
        pavLine.p.lineTo(b2[0], b2[1]);
      }
      if (pv.plaza) {
        const ring = layer('#efe3f2');
        ell(ring, pv.i + 1.5, pv.j + 1.5, 1.08, 3);
        const ring2 = layer('#f7efe6');
        ell(ring2, pv.i + 1.5, pv.j + 1.5, 0.92, 3);
      }
    }
    g.layers.push({ stroke: pavLine.stroke, p: pavLine.p, lw: 0.6 });
    for (const b of c.buildings) {
      if (b.n !== 2) continue;
      add(layer(U.mix(BC.DISTRICTS[b.cat].ground, '#ffffff', 0.45)), dia(b.lotI + 0.08, b.lotJ + 0.08, 1.84, 1.84, 3));
    }
    const soil = layer('#bfe0a6');
    const petals = FLOWER.map((col) => layer(col));
    const R2 = U.rng('beds');
    for (const bd of d.beds) {
      add(soil, dia(bd.i, bd.j, bd.w, bd.d, 3));
      if (bd.rows) {
        const rows = 4;
        for (let r = 0; r < rows; r++) {
          const pc = petals[(bd.c + r) % petals.length];
          for (let k = 0; k < 9; k++) {
            const [x, y] = iso(bd.i + 0.08 + (k / 8) * (bd.w - 0.16), bd.j + 0.12 + (r / (rows - 1)) * (bd.d - 0.24), 3);
            pc.moveTo(x + 1.6, y);
            pc.arc(x, y - 0.6, 1.6, 0, Math.PI * 2);
          }
        }
      } else {
        for (let k = 0; k < 14; k++) {
          const pc = petals[(bd.c + k) % petals.length];
          const [x, y] = iso(bd.i + R2.range(0.06, bd.w - 0.06), bd.j + R2.range(0.06, bd.d - 0.06), 3);
          pc.moveTo(x + 1.4, y);
          pc.arc(x, y - 0.6, 1.4, 0, Math.PI * 2);
        }
      }
    }
    const court = layer('#f8d9cb'), courtLine = { stroke: 'rgba(255,255,255,.95)', p: new Path2D(), lw: 1 };
    for (const ct of d.courts) {
      add(court, dia(ct.i, ct.j, ct.w, ct.d, 3));
      add(courtLine.p, dia(ct.i + 0.08, ct.j + 0.08, ct.w - 0.16, ct.d - 0.16, 3));
      const a = iso(ct.i + ct.w / 2, ct.j + 0.08, 3), b2 = iso(ct.i + ct.w / 2, ct.j + ct.d - 0.08, 3);
      courtLine.p.moveTo(a[0], a[1]);
      courtLine.p.lineTo(b2[0], b2[1]);
    }
    g.layers.push(courtLine);
    const crop = [layer('#f5e7a8'), layer('#d6edae'), layer('#ffd9e4')];
    for (const fd of d.fields) {
      const rows = 7;
      for (let r = 0; r < rows; r++) add(crop[r % 3], dia(fd.i, fd.j + (r * fd.d) / rows, fd.w, (fd.d / rows) * 0.8, 3));
    }
    const rim = layer('#efe3cb'), water = layer('#b5e0f4'), waterHi = layer('#cdeaf8');
    for (const pd of d.ponds) {
      ell(rim, pd.i, pd.j, pd.r + 0.12, 3);
      ell(water, pd.i, pd.j, pd.r, 3);
      ell(waterHi, pd.i - 0.15, pd.j - 0.15, pd.r * 0.5, 3);
    }
    const bench = layer('#d7b796'), benchHi = layer('#ecd2b4');
    for (const bn of d.benches) {
      const w = bn.axis === 'i' ? 0.36 : 0.1, dd = bn.axis === 'i' ? 0.1 : 0.36;
      const i0 = bn.i - w / 2, j0 = bn.j - dd / 2;
      add(bench, [iso(i0, j0 + dd, 3), iso(i0 + w, j0 + dd, 3), iso(i0 + w, j0 + dd, 5.5), iso(i0, j0 + dd, 5.5)]);
      add(bench, [iso(i0 + w, j0 + dd, 3), iso(i0 + w, j0, 3), iso(i0 + w, j0, 5.5), iso(i0 + w, j0 + dd, 5.5)]);
      add(benchHi, dia(i0, j0, w, dd, 5.5));
    }
    return g;
  }

  // ---------- sprites ----------
  function bucketScale() {
    const s = cam.z * dpr;
    return Math.pow(2, Math.round(Math.log2(s) * 2) / 2);
  }
  function buildingSprite(b, night, bucket) {
    const key = b.id * 2 + (night ? 1 : 0);
    let e = sprites.get(key);
    if (e && e.bucket === bucket) {
      e.used = st.frame;
      return e;
    }
    if (budget <= 0) return e || null;
    budget--;
    const x0 = b.bx0, y0 = b.by0, w = b.bx1 - b.bx0, h = b.by1 - b.by0;
    const cw = Math.max(1, Math.ceil(w * bucket)), ch = Math.max(1, Math.ceil(h * bucket));
    const cv = e ? e.canvas : document.createElement('canvas');
    cv.width = cw;
    cv.height = ch;
    const c2 = cv.getContext('2d');
    c2.setTransform(bucket, 0, 0, bucket, -x0 * bucket, -y0 * bucket);
    A.drawBuilding(c2, b, night, bucket);
    e = { canvas: cv, bucket, x: x0, y: y0, w: cw / bucket, h: ch / bucket, used: st.frame };
    sprites.set(key, e);
    return e;
  }
  function treeSprite(kind, ci, night, bucket) {
    const key = kind + ci + ':' + night + ':' + bucket;
    let e = treeSprites.get(key);
    if (e) return e;
    if (treeSprites.size > 400) treeSprites.clear();
    const [bx, by, bw, bh] = A.TREE_BOX;
    const cv = document.createElement('canvas');
    cv.width = Math.ceil(bw * bucket);
    cv.height = Math.ceil(bh * bucket);
    const c2 = cv.getContext('2d');
    c2.setTransform(bucket, 0, 0, bucket, -bx * bucket, -by * bucket);
    A.drawTree(c2, kind, ci, night);
    e = { canvas: cv, x: bx, y: by, w: cv.width / bucket, h: cv.height / bucket };
    treeSprites.set(key, e);
    return e;
  }
  function evictSprites() {
    if (sprites.size < 520) return;
    for (const [k, e] of sprites) if (st.frame - e.used > 90) sprites.delete(k);
  }

  // ---------- sun shadows ----------
  let shadowPath = null, shadowKey = '';
  function shadows(animating) {
    const key = Math.round(st.hour * 20) + ':' + city.buildings.length;
    if (!animating && key === shadowKey && shadowPath) return shadowPath;
    shadowKey = key;
    const th = U.clamp((st.hour - 6) / 12.6, 0, 1) * Math.PI;
    const elev = Math.sin(th);
    const k = 0.42 + 1.6 * (1 - elev);
    const dx = -Math.cos(th), dy = -Math.sin(th) * 0.5;
    const p = new Path2D();
    for (const b of city.buildings) {
      const hh = (b.H + b.roofH * 0.4) * Math.min(1, b.rise) * k;
      if (hh < 1) continue;
      const fp = [iso(b.i0, b.j0, 3), iso(b.i0 + b.w, b.j0, 3), iso(b.i0 + b.w, b.j0 + b.d, 3), iso(b.i0, b.j0 + b.d, 3)];
      const pts = U.hull(fp.concat(fp.map((q) => [q[0] + dx * hh, q[1] + dy * hh])));
      p.moveTo(pts[0][0], pts[0][1]);
      for (let q = 1; q < pts.length; q++) p.lineTo(pts[q][0], pts[q][1]);
      p.closePath();
    }
    shadowPath = p;
    return p;
  }

  // ---------- intro & replay ----------
  R.playIntro = function () {
    const cN = city.N / 2;
    const r = U.rng('intro');
    let maxD = 0;
    for (const b of city.buildings) {
      const dist = Math.hypot(b.i0 - cN, b.j0 - cN) / city.N;
      b.delay = 0.35 + dist * 2.4 + r() * 0.35 - (b.landmark ? 0.2 : 0);
      b.rise = 0;
      b.wob = 0;
      b._landed = false;
      maxD = Math.max(maxD, b.delay);
    }
    for (const t of city.trees) {
      const dist = Math.hypot(t.i - cN, t.j - cN) / city.N;
      t.delay = 0.2 + dist * 2.6 + r() * 0.5;
      t.pop = 0;
    }
    st.intro = { t: 0, end: maxD + 1.6 };
  };
  function updateIntro(dt) {
    const I = st.intro;
    I.t += dt;
    for (const b of city.buildings) {
      const p = (I.t - b.delay) / 0.8;
      if (p <= 0) b.rise = 0;
      else if (p < 1) b.rise = U.easeOutCubic(p);
      else {
        b.rise = 1;
        if (!b._landed) {
          b._landed = true;
          b.wob = 1;
          dust(b);
        }
      }
      if (b.wob > 0) b.wob = Math.max(0, b.wob - dt * 2.4);
    }
    for (const t of city.trees) {
      const p = U.clamp((I.t - t.delay) / 0.5, 0, 1);
      t.pop = p <= 0 ? 0 : p >= 1 ? 1 : U.easeOutBack(p);
    }
    if (I.t > I.end) {
      st.intro = null;
      for (const b of city.buildings) {
        b.rise = 1;
        b.wob = 0;
      }
      for (const t of city.trees) t.pop = 1;
    }
  }
  function dust(b) {
    const cx = b.i0 + b.w / 2, cy = b.j0 + b.d / 2;
    for (let k = 0; k < (b.landmark ? 7 : 3); k++) {
      const a = (k / 3) * Math.PI * 2 + Math.random();
      S.emit('dust', cx + Math.cos(a) * b.w * 0.5, cy + Math.sin(a) * b.d * 0.5, 4, { vz: 3, vi: Math.cos(a) * 0.3, vj: Math.sin(a) * 0.3, life: 0.7 });
    }
  }
  function cumAt(site, day) {
    if (!site._cd) {
      site._cd = site.days.map((d) => d[0]);
      let s = 0;
      site._cc = site.days.map((d) => (s += d[1]));
    }
    const ds = site._cd;
    let lo = 0, hi = ds.length - 1, ans = -1;
    while (lo <= hi) {
      const m = (lo + hi) >> 1;
      if (ds[m] <= day) {
        ans = m;
        lo = m + 1;
      } else hi = m - 1;
    }
    return ans < 0 ? 0 : site._cc[ans];
  }
  R.startReplay = function (onEnd) {
    const ds = city.ds;
    if (!ds.hasTime) return false;
    let d0 = Infinity, d1 = -Infinity;
    for (const b of city.buildings) {
      const dd = b.site.days;
      if (!dd.length) continue;
      d0 = Math.min(d0, dd[0][0]);
      d1 = Math.max(d1, dd[dd.length - 1][0]);
    }
    if (!isFinite(d0) || d1 - d0 < 1) return false;
    st.intro = null;
    for (const b of city.buildings) {
      b.rise = 0;
      b._shown = false;
      b.wob = 0;
    }
    for (const t of city.trees) t.pop = 1;
    st.replay = { t: 0, dur: U.clamp((d1 - d0) * 0.2, 14, 32), d0, d1, day: d0, visits: 0, count: 0, onEnd, ending: 0 };
    return true;
  };
  R.stopReplay = function () {
    if (!st.replay) return;
    const cb = st.replay.onEnd;
    st.replay = null;
    for (const b of city.buildings) {
      b.rise = 1;
      b.wob = 0;
    }
    if (cb) cb();
  };
  function updateReplay(dt) {
    const rp = st.replay;
    rp.t += dt;
    const p = U.clamp(rp.t / rp.dur, 0, 1);
    rp.p = p;
    rp.day = rp.d0 + (rp.d1 - rp.d0) * U.easeInOut(p) ;
    let visits = 0, count = 0;
    for (const b of city.buildings) {
      const c = cumAt(b.site, rp.day);
      visits += c;
      if (c > 0) {
        count++;
        if (!b._shown) {
          b._shown = true;
          b.wob = 0.8;
          dust(b);
        }
        const target = Math.log(1 + c) / Math.log(1 + b.site.visits);
        b.rise += (target - b.rise) * Math.min(1, dt * 5);
      } else b.rise = 0;
      if (b.wob > 0) b.wob = Math.max(0, b.wob - dt * 2.4);
    }
    rp.visits = visits;
    rp.count = count;
    if (p >= 1) {
      rp.ending += dt;
      if (rp.ending > 1.8) R.stopReplay();
    }
  }

  // ---------- frame ----------
  R.frame = function (dt) {
    if (!city) return;
    st.t += dt;
    st.frame++;
    budget = 28;
    st.dt = dt;
    const prevHour = st.hour;
    if (st.dayMode) updateDay(dt);
    else if (st.playing && !st.replay) st.hour = (st.hour + dt * st.speed) % 24;
    st.night = R.nightness(st.hour);
    st.day = daylight(st.hour);
    const ch = city.ds.cityHours || [];
    const hmax = Math.max(1, ...ch);
    const h0 = Math.floor(st.hour) % 24, h1 = (h0 + 1) % 24, f = st.hour - Math.floor(st.hour);
    st.activity = ch.length ? ((ch[h0] || 0) * (1 - f) + (ch[h1] || 0) * f) / hmax : 0.6;
    if (!city.ds.hasTime) st.activity = 0.7;
    if (st.dayMode) {
      const D = st.dayMode, now = D.hour * 60;
      while (D.recent.length && D.recent[0] < now - 45) D.recent.shift();
      st.activity = U.clamp(D.recent.length / 10, 0.08, 1);
    }

    // weather
    const wday = st.dayMode ? st.dayMode.day : st.replay ? null : R.liveDay;
    const w = wday == null ? { rain: 0, rainbow: 0 } : R.weatherAt(wday, st.hour);
    const wk = Math.min(1, dt * 1.5);
    st.rain += (w.rain - st.rain) * wk;
    st.rainbow += (w.rainbow - st.rainbow) * wk;

    // fireworks when the clock strikes the town's rush hour
    if (R.peakHour != null && !st.dayMode && !st.replay && !st.intro && st.playing) {
      const ph = R.peakHour, cur = st.hour;
      const crossed = prevHour <= cur ? prevHour < ph && cur >= ph : ph > prevHour || ph <= cur;
      if (crossed && cur !== prevHour) R.fireworks();
    }
    if (st.fw) {
      const F = st.fw;
      F.t += dt;
      if (F.t < 9 && F.t >= F.next) {
        const tops = city.ranked.slice(0, 5);
        const b = tops[Math.floor(Math.random() * tops.length)];
        if (b) S.firework(b.top[0] + (Math.random() - 0.5) * 0.6, b.top[1] + (Math.random() - 0.5) * 0.6, b.top[2]);
        F.next += 0.3 + Math.random() * 0.45;
      }
      if (F.t > 12) st.fw = null;
    }
    for (const b of city.buildings) {
      if (b.knock > 0) b.knock -= dt;
      if (b.ping > 0) b.ping = Math.max(0, b.ping - dt * 1.1);
    }
    if (st.follow) {
      const c = st.follow;
      const [wx, wy] = iso(c.i, c.j, 6);
      cam.tx = wx;
      cam.ty = wy;
      if (cam.tz == null) cam.tz = cam.z;
    }

    // camera easing + inertia
    if (cam.tx != null) {
      const k = 1 - Math.exp(-dt * 4.2);
      cam.x += (cam.tx - cam.x) * k;
      cam.y += (cam.ty - cam.y) * k;
      cam.z = Math.exp(Math.log(cam.z) + (Math.log(cam.tz) - Math.log(cam.z)) * k);
      if (Math.abs(cam.tx - cam.x) < 0.5 && Math.abs(cam.ty - cam.y) < 0.5 && Math.abs(cam.tz - cam.z) < 0.002) cam.tx = cam.ty = cam.tz = null;
    } else if (Math.abs(cam.vx) + Math.abs(cam.vy) > 1) {
      cam.x -= (cam.vx * dt) / cam.z;
      cam.y -= (cam.vy * dt) / cam.z;
      const decay = Math.exp(-dt * 5);
      cam.vx *= decay;
      cam.vy *= decay;
      clampCam();
    }

    if (st.intro) updateIntro(dt);
    if (st.replay) updateReplay(dt);
    S.update(dt, { hour: st.hour, activity: st.activity, night: st.night, paused: false, scripted: !!st.dayMode, hold: st.hoverCar });
    if (BC.sound) BC.sound.update(st, { rain: st.rain });
    draw();
    evictSprites();
  };

  function draw() {
    const night = st.night;
    vx0 = cam.x - W / 2 / cam.z - 20;
    vx1 = cam.x + W / 2 / cam.z + 20;
    vy0 = cam.y - H / 2 / cam.z - 20;
    vy1 = cam.y + H / 2 / cam.z + 60;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // sky
    let [top, bot] = skyAt(st.hour);
    if (st.rain > 0.02) {
      const q = Math.round(st.rain * 12) / 20;
      top = U.mix(top, '#aeacc8', q);
      bot = U.mix(bot, '#d6d3e4', q);
    }
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, top);
    g.addColorStop(1, bot);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    if (night > 0.05) {
      for (const s of stars) {
        const a = night * (0.45 + 0.4 * Math.sin(st.t * 1.5 + s[3]));
        ctx.globalAlpha = Math.max(0, a);
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(s[0] * W, s[1] * H, s[2], 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    ctx.globalAlpha = 1 - st.rain * 0.85;
    drawSunMoon();
    ctx.globalAlpha = 1;
    if (st.rainbow > 0.01) drawRainbow();

    // world
    const z = cam.z;
    ctx.setTransform(dpr * z, 0, 0, dpr * z, dpr * (W / 2 - cam.x * z), dpr * (H / 2 - cam.y * z));
    const sh = ground.shadow;
    const sg = ctx.createRadialGradient(sh.x, sh.y, 0, sh.x, sh.y, sh.rx);
    sg.addColorStop(0, 'rgba(110,96,170,.22)');
    sg.addColorStop(1, 'rgba(110,96,170,0)');
    ctx.save();
    ctx.translate(sh.x, sh.y);
    ctx.scale(1, sh.ry / sh.rx);
    ctx.translate(-sh.x, -sh.y);
    ctx.fillStyle = sg;
    ctx.fillRect(sh.x - sh.rx, sh.y - sh.rx, sh.rx * 2, sh.rx * 2);
    ctx.restore();
    for (const l of ground.layers) {
      if (l.stroke) {
        ctx.strokeStyle = l.stroke;
        ctx.lineWidth = l.lw || 1;
        ctx.stroke(l.p);
      } else {
        ctx.fillStyle = l.fill;
        ctx.fill(l.p);
      }
    }
    const animating = !!(st.intro || st.replay);
    if (st.day > 0.01) {
      ctx.fillStyle = `rgba(104,92,170,${0.14 * st.day})`;
      ctx.fill(shadows(animating));
    }
    // cloud shadows
    for (const c of S.clouds) {
      const [x, y] = iso(c.i + 1.2, c.j + 1.2, 0);
      ctx.beginPath();
      ctx.ellipse(x, y, 70, 28, 0, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(104,92,170,${0.05 * st.day})`;
      ctx.fill();
    }
    // selection / hover rings
    const ring = (b, col, dash) => {
      const pad = 0.05;
      const pts = [iso(b.lotI + pad, b.lotJ + pad, 3), iso(b.lotI + b.n - pad, b.lotJ + pad, 3), iso(b.lotI + b.n - pad, b.lotJ + b.n - pad, 3), iso(b.lotI + pad, b.lotJ + b.n - pad, 3)];
      ctx.beginPath();
      A.trace(ctx, pts);
      ctx.strokeStyle = col;
      ctx.lineWidth = 2.2 / Math.max(0.6, z);
      if (dash) {
        ctx.setLineDash([7, 5]);
        ctx.lineDashOffset = -st.t * 18;
      }
      ctx.stroke();
      ctx.setLineDash([]);
    };
    if (st.dayMode) {
      for (const b of st.dayMode.visited) {
        ring(b, 'rgba(255,255,255,.95)', false);
        ring(b, BC.DISTRICTS[b.cat].accent, true);
        if (b.ping > 0) {
          const g2 = (1 - b.ping) * 0.9;
          const pts = [iso(b.lotI - g2, b.lotJ - g2, 3), iso(b.lotI + b.n + g2, b.lotJ - g2, 3), iso(b.lotI + b.n + g2, b.lotJ + b.n + g2, 3), iso(b.lotI - g2, b.lotJ + b.n + g2, 3)];
          ctx.beginPath();
          A.trace(ctx, pts);
          ctx.strokeStyle = U.rgba(BC.DISTRICTS[b.cat].accent, b.ping);
          ctx.lineWidth = 3 / Math.max(0.6, z);
          ctx.stroke();
        }
      }
    }
    if (st.selected && st.selected.lotI != null) ring(st.selected, BC.DISTRICTS[st.selected.cat].accent, true);
    if (st.hover && st.hover !== st.selected) ring(st.hover, 'rgba(255,255,255,.95)', false);

    if (night > 0.01) {
      ctx.fillStyle = `rgba(62,52,128,${0.32 * night})`;
      ctx.fill(ground.outline);
      // pools of lamplight
      const gl = A.glow();
      ctx.globalAlpha = night * 0.42;
      for (const l of city.lamps) {
        const [x, y] = iso(l.i, l.j, 3);
        if (!inView(x, y, 40)) continue;
        ctx.drawImage(gl, x - 30, y - 15, 60, 30);
      }
      ctx.globalAlpha = 1;
    }
    if (st.rain > 0.02) {
      ctx.fillStyle = `rgba(86,84,140,${0.13 * st.rain})`;
      ctx.fill(ground.outline);
      ctx.strokeStyle = `rgba(255,255,255,${0.55 * st.rain})`;
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      for (const r of R.ripples) {
        const ph = (st.t * 0.9 + r[2]) % 1;
        const [x, y] = iso(r[0], r[1]);
        if (!inView(x, y, 20)) continue;
        ctx.moveTo(x + 2 + ph * 9, y);
        ctx.ellipse(x, y, 2 + ph * 9, (2 + ph * 9) / 2, 0, 0, Math.PI * 2);
      }
      ctx.stroke();
    }

    // depth-sorted objects
    const list = [];
    for (const b of city.buildings) {
      if (b.bx1 < vx0 || b.bx0 > vx1 || b.by1 < vy0 || b.by0 > vy1) continue;
      list.push({ d: b.depth, k: 0, o: b });
    }
    for (const t of city.trees) if (t.pop > 0 && inView(t.x, t.y, 50)) list.push({ d: t.depth, k: 1, o: t });
    for (const l of city.lamps) {
      const [x, y] = iso(l.i, l.j, 3);
      if (inView(x, y, 30)) list.push({ d: l.depth, k: 2, o: l, x, y });
    }
    for (const a of city.amenities) list.push({ d: a.depth, k: 3, o: a });
    for (const c of S.cars) list.push({ d: c.i + c.j, k: 4, o: c });
    for (const p of S.peds) if (!p.hidden) list.push({ d: p.i + p.j, k: 5, o: p });
    for (const v of S.visitors) list.push({ d: v.i + v.j, k: 5, o: v });
    list.sort((a, b) => a.d - b.d || a.k - b.k);
    drawn = [];
    const bucket = Math.min(bucketScale(), 3.2);
    const direct = cam.z * dpr > 3.6;
    const tb = Math.min(bucketScale(), 4);
    for (const e of list) {
      switch (e.k) {
        case 0:
          drawBuilding(e.o, bucket, direct);
          drawn.push(e);
          break;
        case 1:
          drawTree(e.o, tb);
          break;
        case 2:
          ctx.save();
          ctx.translate(0, -3);
          A.drawLamp(ctx, e.o, night);
          ctx.restore();
          break;
        case 3:
          ctx.save();
          if (e.o.type !== 'sign') ctx.translate(0, -3);
          A.drawAmenity(ctx, e.o, st.t, night, city);
          ctx.restore();
          drawn.push(e);
          break;
        case 4: {
          const c = e.o;
          const k = c.done ? 1 - c.fade : Math.min(1, c.age * 4);
          if ((c === st.hoverCar || c === st.follow) && !c.done) {
            const [rx, ry] = iso(c.i, c.j);
            const pulse = 1 + Math.sin(st.t * 6) * 0.08;
            ctx.beginPath();
            ctx.ellipse(rx, ry, 17 * pulse, 8.5 * pulse, 0, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255,255,255,.45)';
            ctx.fill();
            ctx.strokeStyle = U.rgba(U.dark(c.color, 0.25), 0.9);
            ctx.lineWidth = 1.6;
            ctx.stroke();
          }
          ctx.save();
          ctx.globalAlpha = Math.max(0, Math.min(1, k * 1.2));
          A.drawCar(ctx, c, night, k);
          ctx.restore();
          drawn.push(e);
          break;
        }
        case 5:
          ctx.save();
          ctx.translate(0, -3);
          if (e.o.fade != null) ctx.globalAlpha = e.o.fade;
          A.drawPed(ctx, e.o, night, st.t, st.rain);
          ctx.restore();
          break;
      }
    }

    // x-ray: the car you're riding in (or pointing at) stays visible through buildings
    const xray = st.follow || st.hoverCar;
    if (xray && !xray.done) {
      const [rx, ry] = iso(xray.i, xray.j);
      ctx.save();
      const pulse = 1 + Math.sin(st.t * 6) * 0.1;
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.ellipse(rx, ry, 18 * pulse, 9 * pulse, 0, 0, Math.PI * 2);
      ctx.strokeStyle = '#ef7fa3';
      ctx.lineWidth = 2.6;
      ctx.setLineDash([5, 3]);
      ctx.lineDashOffset = -st.t * 14;
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 0.8;
      A.drawCar(ctx, xray, night, 1);
      ctx.restore();
    }

    // above the rooftops
    const pk = U.clamp(0.85 / cam.z, 1, 2.6);
    for (const p of S.parts) A.drawParticle(ctx, p, p.kind === 'fw' || p.kind === 'flash' || p.kind === 'rocket' ? pk : 1);
    if (night > 0.3) {
      const gl = A.glow();
      for (const f of S.flies) {
        const [x, y] = iso(f.i, f.j, f.z);
        if (!inView(x, y, 10)) continue;
        const a = (night - 0.3) * 1.4 * (0.5 + 0.5 * Math.sin(st.t * 2.6 + f.ph * 3));
        if (a <= 0.02) continue;
        ctx.globalAlpha = Math.min(1, a);
        ctx.drawImage(gl, x - 6, y - 6, 12, 12);
        ctx.fillStyle = '#f6ffb8';
        ctx.fillRect(x - 0.8, y - 0.8, 1.6, 1.6);
      }
      ctx.globalAlpha = 1;
    }
    const zr = cam.z / R.fitZ;
    const cloudA = U.clamp(0.82 - (zr - 1) * 0.45, 0.1, 0.82);
    const bp = S.balloonPos();
    const [bx, by] = iso(bp[0], bp[1], bp[2] + Math.sin(st.t * 0.6) * 6);
    A.drawBalloon(ctx, bx, by, st.t, night);
    R._balloon = [bx, by];
    for (const b of S.birds) {
      const [x, y] = iso(b.i, b.j, b.z);
      A.drawBird(ctx, x, y, b.ph, night);
    }
    for (const c of S.clouds) {
      const [x, y] = iso(c.i, c.j, c.z);
      if (inView(x, y, 120)) A.drawCloud(ctx, c, x, y, Math.min(0.92, cloudA + st.rain * 0.25), night, st.rain);
    }

    // screen-space overlays
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (st.rain > 0.03) drawRain();
    drawLabels(zr);
    drawTooltip();
  }

  let vx0 = 0, vx1 = 0, vy0 = 0, vy1 = 0;
  function inView(x, y, m) {
    return x > vx0 - m && x < vx1 + m && y > vy0 - m && y < vy1 + m;
  }

  function drawBuilding(b, bucket, direct) {
    const rise = b.rise;
    if (rise <= 0.002) return;
    const off = (1 - Math.min(1, rise)) * (b.H + b.roofH + 6);
    const lift = st.hover === b ? -3 : 0;
    ctx.save();
    if (off > 0.3) {
      const p1 = iso(b.i0 - 0.03, b.j0 + b.d + 0.03, 3), p2 = iso(b.i0 + b.w + 0.03, b.j0 + b.d + 0.03, 3), p3 = iso(b.i0 + b.w + 0.03, b.j0 - 0.03, 3);
      ctx.beginPath();
      ctx.moveTo(p1[0] - 30, p1[1]);
      ctx.lineTo(p1[0], p1[1]);
      ctx.lineTo(p2[0], p2[1]);
      ctx.lineTo(p3[0], p3[1]);
      ctx.lineTo(p3[0] + 30, p3[1]);
      ctx.lineTo(p3[0] + 30, p3[1] - 3000);
      ctx.lineTo(p1[0] - 30, p1[1] - 3000);
      ctx.closePath();
      ctx.clip();
    }
    if (b.wob > 0) {
      const s = 1 + Math.sin(b.wob * Math.PI * 3) * 0.07 * b.wob;
      const [bx, by] = iso(b.i0 + b.w / 2, b.j0 + b.d / 2, 3);
      ctx.translate(bx, by);
      ctx.scale(1 / Math.sqrt(s), s);
      ctx.translate(-bx, -by);
    }
    ctx.translate(0, off + lift - 3);
    const night = st.night;
    if (direct) A.drawBuilding(ctx, b, night >= 0.5, cam.z * dpr);
    else {
      const d = buildingSprite(b, false, bucket);
      if (d) ctx.drawImage(d.canvas, d.x, d.y, d.w, d.h);
      else A.drawBuilding(ctx, b, false, bucket);
      if (night > 0.01) {
        const n = buildingSprite(b, true, bucket);
        ctx.globalAlpha = night;
        if (n) ctx.drawImage(n.canvas, n.x, n.y, n.w, n.h);
        ctx.globalAlpha = 1;
      }
    }
    A.drawFx(ctx, b, st.t, night);
    if (b.knock > 0) {
      const f = A.faceL(b.i0, b.j0, b.w, b.d);
      const du = b.style === 'cottage' ? b.w * 0.3 - 0.06 : b.w / 2 - 0.07;
      const k = Math.min(1, b.knock);
      ctx.beginPath();
      A.quad(ctx, f, du, du + 0.15, 0, 8);
      ctx.fillStyle = `rgba(255,228,140,${0.95 * k})`;
      ctx.fill();
      const [gx, gy] = A.fp(f, du + 0.07, 4);
      ctx.globalAlpha = k * 0.9;
      ctx.drawImage(A.glow(), gx - 14, gy - 12, 28, 24);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  function drawTree(t, bucket) {
    const s = t.s * t.pop;
    if (s <= 0.01) return;
    const spr = treeSprite(t.kind, t.c, Math.round(st.night * 8) / 8, bucket);
    const sway = Math.sin(st.t * 1.3 + t.ph) * 0.04;
    // translate, sway-skew and scale folded into one transform
    const z = cam.z * dpr;
    ctx.setTransform(z * s, 0, z * sway * s, z * s, dpr * (W / 2 + (t.x - cam.x) * cam.z), dpr * (H / 2 + (t.y - cam.y) * cam.z));
    ctx.drawImage(spr.canvas, spr.x, spr.y, spr.w, spr.h);
    ctx.setTransform(z, 0, 0, z, dpr * (W / 2 - cam.x * cam.z), dpr * (H / 2 - cam.y * cam.z));
  }

  function drawSunMoon() {
    const h = st.hour;
    const dayP = (h - 6) / 12.6;
    if (dayP > 0 && dayP < 1) {
      const x = W * (0.08 + 0.84 * dayP), y = H * 0.34 - Math.sin(dayP * Math.PI) * H * 0.24;
      const g = ctx.createRadialGradient(x, y, 0, x, y, 70);
      g.addColorStop(0, 'rgba(255,246,214,.9)');
      g.addColorStop(0.3, 'rgba(255,240,200,.35)');
      g.addColorStop(1, 'rgba(255,240,200,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - 70, y - 70, 140, 140);
      ctx.beginPath();
      ctx.arc(x, y, 18, 0, Math.PI * 2);
      ctx.fillStyle = '#fff6d8';
      ctx.fill();
    }
    const nP = (((h - 18.6 + 24) % 24) / 11.4);
    if (nP > 0 && nP < 1) {
      const x = W * (0.08 + 0.84 * nP), y = H * 0.32 - Math.sin(nP * Math.PI) * H * 0.2;
      ctx.globalAlpha = Math.min(1, st.night * 1.2);
      ctx.beginPath();
      ctx.arc(x, y, 14, 0, Math.PI * 2);
      ctx.fillStyle = '#fbf6ff';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x + 6, y - 4, 12, 0, Math.PI * 2);
      ctx.fillStyle = skyAt(h)[0];
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  function pill(x, y, text, opts) {
    ctx.font = `${opts.weight || 600} ${opts.size || 13}px ${FONT}`;
    const tw = ctx.measureText(text).width;
    const padX = opts.dot ? 26 : 12;
    const w = tw + padX + 12, h = (opts.size || 13) + 14;
    const x0 = x - w / 2, y0 = y - h;
    ctx.shadowColor = 'rgba(92,80,140,.18)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 3;
    A.rrect(ctx, x0, y0, w, h, h / 2);
    ctx.fillStyle = opts.bg || 'rgba(255,253,248,.95)';
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    if (opts.border) {
      ctx.strokeStyle = opts.border;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    if (opts.dot) {
      ctx.beginPath();
      ctx.arc(x0 + 15, y0 + h / 2, 5.5, 0, Math.PI * 2);
      ctx.fillStyle = opts.dot;
      ctx.fill();
      ctx.strokeStyle = 'rgba(74,66,112,.25)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    ctx.fillStyle = opts.color || '#3d3a5c';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x0 + padX, y0 + h / 2 + 0.5);
    return { x: x0, y: y0, w, h };
  }

  function drawLabels(zr) {
    st.labels = [];
    const base = st.dayMode ? 0 : U.clamp(2.2 - zr * 1.15, 0, 1);
    for (const k in city.districts) {
      const d = city.districts[k];
      const D = BC.DISTRICTS[k];
      const focus = st.focusDistrict === k;
      const a = focus ? 1 : base;
      if (a <= 0.02) continue;
      const [wx, wy] = iso(d.ci, d.cj, 70);
      const [sx, sy] = R.worldToScreen(wx, wy);
      const [gx, gy] = R.worldToScreen(...iso(d.ci, d.cj, 3));
      ctx.globalAlpha = a;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(gx, gy);
      ctx.strokeStyle = 'rgba(255,255,255,.8)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([2, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(gx, gy, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      const r = pill(sx, sy, D.name, { dot: D.color, border: focus ? D.accent : null, size: (focus ? 15 : 13) - (W < 700 ? 2 : 0) });
      st.labels.push({ ...r, key: k });
    }
    // the woods
    const wa = U.clamp(1.6 - zr * 0.7, 0, 1);
    if (wa > 0.02 && city.longTail > 0) {
      const [wx, wy] = iso(-city.M + 1.4, city.N * 0.62, 40);
      const [sx, sy] = R.worldToScreen(wx, wy);
      ctx.globalAlpha = wa * 0.95;
      const r = pill(sx, sy, `Whispering Woods · ${U.fmt(city.longTail)} one-off sites`, { size: 11, weight: 500, bg: 'rgba(240,250,235,.92)', color: '#4f7a4a' });
      st.labels.push({ ...r, key: '__woods' });
    }
    ctx.globalAlpha = 1;
  }

  function drawTooltip() {
    // day mode: a bouncing pin over wherever you are right now
    const D = st.dayMode;
    if (D && D.current && D.current !== st.hover) {
      const c = D.current;
      const bob = Math.abs(Math.sin(st.t * 4)) * 6;
      const [sx, sy] = R.worldToScreen(...iso(c.top[0], c.top[1], c.top[2] + 8));
      const r = pill(sx, sy - 10 - bob, c.site.name, { dot: BC.DISTRICTS[c.cat].color, size: 13, border: BC.DISTRICTS[c.cat].accent });
      ctx.beginPath();
      ctx.moveTo(sx - 6, r.y + r.h - 0.5);
      ctx.lineTo(sx, r.y + r.h + 7);
      ctx.lineTo(sx + 6, r.y + r.h - 0.5);
      ctx.fillStyle = 'rgba(255,253,248,.95)';
      ctx.fill();
    }
    const b = st.hover;
    if (b && !st.replay) {
      const [wx, wy] = iso(b.top[0], b.top[1], b.top[2] + 10);
      const [sx, sy] = R.worldToScreen(wx, wy);
      const label = st.dayMode ? `${b.site.domain}  ·  ${b.dayVisits || 0} visits that day` : `${b.site.domain}  ·  ${U.fmt(b.site.visits)} visits`;
      pill(sx, sy - 4, label, { dot: BC.DISTRICTS[b.cat].color, size: 13 });
    } else if (st.hoverCar) {
      const c = st.hoverCar;
      const [sx, sy] = R.worldToScreen(...iso(c.i, c.j, 14));
      pill(sx, sy, `${c.trip.from.site.name} → ${c.trip.to.site.name}`, { size: 12, dot: c.color });
    }
  }

  // ---------- weather drawing ----------
  const drops = Array.from({ length: 240 }, () => [Math.random(), Math.random(), 0.7 + Math.random() * 0.6]);
  function drawRain() {
    const n = Math.round(drops.length * st.rain);
    ctx.strokeStyle = `rgba(255,255,255,${0.5 * st.rain})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let k = 0; k < n; k++) {
      const d = drops[k];
      d[1] += st.dt * 1.25 * d[2];
      d[0] += st.dt * 0.18 * d[2];
      if (d[1] > 1) {
        d[1] -= 1;
        d[0] = Math.random();
      }
      if (d[0] > 1) d[0] -= 1;
      const x = d[0] * W, y = d[1] * H;
      ctx.moveTo(x, y);
      ctx.lineTo(x - 3.5 * d[2], y - 14 * d[2]);
    }
    ctx.stroke();
  }
  const BOW = ['#ffb3c6', '#ffd2a6', '#fff0a3', '#bff0c8', '#bfe0ff', '#d6c4ff'];
  function drawRainbow() {
    const cx = W * 0.62, cy = H * 0.98, r0 = Math.max(W, H) * 0.52;
    ctx.globalAlpha = 0.5 * st.rainbow;
    ctx.lineWidth = Math.max(8, r0 * 0.022);
    BOW.forEach((c, k) => {
      ctx.beginPath();
      ctx.arc(cx, cy, r0 - k * ctx.lineWidth, Math.PI, Math.PI * 2);
      ctx.strokeStyle = c;
      ctx.stroke();
    });
    ctx.globalAlpha = 1;
  }

  // ---------- fireworks ----------
  R.fireworks = function (manual) {
    st.fw = { t: 0, next: 0 };
    if (R.onFireworks) R.onFireworks(R.peakHour, manual);
  };

  // ---------- a day in your life ----------
  R.startDay = function (day, onEnd) {
    const ds = city.ds;
    const flat = ds.daylog && ds.daylog[day];
    if (!flat || flat.length < 4) return false;
    st.intro = null;
    if (st.replay) R.stopReplay();
    for (const b of city.buildings) {
      b.rise = 1;
      b.wob = 0;
      b.dayVisits = 0;
      b.ping = 0;
    }
    const ev = [];
    for (let k = 0; k < flat.length; k += 2) {
      const site = ds.sites[flat[k + 1]];
      ev.push([flat[k], site ? city.byDomain.get(site.domain) || null : null, site]);
    }
    const startH = Math.max(0, ev[0][0] / 60 - 0.6);
    const endM = Math.min(24 * 60, ev[ev.length - 1][0] + 40);
    S.cars = [];
    st.dayMode = {
      day, ev, idx: 0, hour: startH, endM, ending: 0, count: 0, total: (ds.dayTotals && ds.dayTotals[day]) || ev.length,
      speed: U.clamp((endM / 60 - startH) / 55, 0.2, 1.1), mult: 1, visited: new Set(), recent: [], prev: null, current: null, onEnd,
    };
    st.selected = null;
    return true;
  };
  R.stopDay = function () {
    const D = st.dayMode;
    if (!D) return;
    st.dayMode = null;
    const summary = { day: D.day, events: D.idx, buildings: D.visited.size, total: D.total };
    for (const b of city.buildings) {
      b.dayVisits = 0;
      b.ping = 0;
    }
    if (D.onEnd) D.onEnd(summary);
  };
  function updateDay(dt) {
    const D = st.dayMode;
    const nextM = D.idx < D.ev.length ? D.ev[D.idx][0] : D.endM;
    let speed = D.speed * D.mult;
    if (nextM / 60 - D.hour > 1.2) speed *= 7; // skip quiet stretches
    D.hour = Math.min(D.endM / 60, D.hour + speed * dt);
    let fired = 0;
    while (D.idx < D.ev.length && D.ev[D.idx][0] <= D.hour * 60) {
      const [m, b, site] = D.ev[D.idx++];
      D.count++;
      D.recent.push(m);
      D.currentSite = site;
      if (b) {
        b.dayVisits = (b.dayVisits || 0) + 1;
        b.ping = 1;
        D.visited.add(b);
        D.current = b;
        if (fired++ < 2) {
          S.emit('spark', b.top[0], b.top[1], b.top[2], { vz: 12, life: 0.9 });
          if (BC.sound) BC.sound.ping(b.rank);
        }
        if (D.prev && D.prev.b !== b && m - D.prev.m <= 30) S.spawnCar({ from: D.prev.b, to: b, n: 0 });
        D.prev = { b, m };
      }
    }
    st.hour = D.hour % 24;
    if (D.hour * 60 >= D.endM - 0.01) {
      D.ending += dt;
      if (D.ending > 2.2) R.stopDay();
    }
  }

  // ---------- picking ----------
  R.pick = function (sx, sy) {
    if (!city) return null;
    for (const l of st.labels) if (sx >= l.x && sx <= l.x + l.w && sy >= l.y && sy <= l.y + l.h) return { type: l.key === '__woods' ? 'woods' : 'district', key: l.key };
    const [wx, wy] = R.screenToWorld(sx, sy);
    if (R._balloon && Math.hypot(wx - R._balloon[0], wy - R._balloon[1] + 5) < 24) return { type: 'balloon' };
    // cars first: a wide target (at least ~22 screen px) unless a building in front hides the car
    const reach = Math.max(14, 22 / cam.z);
    const near = [];
    drawn.forEach((e, idx) => {
      if (e.k !== 4 || e.o.done) return;
      const [cx, cy] = iso(e.o.i, e.o.j, 5);
      const d = Math.hypot(wx - cx, wy - cy);
      if (d < reach) near.push({ e, idx, d, cx, cy });
    });
    near.sort((a, b) => a.d - b.d);
    for (const n of near) {
      // the car counts as visible if its nose, tail or roof peeks out from behind the buildings in front
      const c = n.e.o;
      const fi = c.axis === 'i' ? 0.2 : 0, fj = c.axis === 'j' ? 0.2 : 0;
      const probes = [iso(c.i, c.j, 5), iso(c.i + fi, c.j + fj, 3), iso(c.i - fi, c.j - fj, 3), iso(c.i, c.j, 10)];
      const covered = (p) => {
        for (let k = n.idx + 1; k < drawn.length; k++) {
          const o = drawn[k];
          if (o.k === 0 && o.o.rise > 0.2 && U.pointInPoly(p[0], p[1] + 3, o.o.hull)) return true;
        }
        return false;
      };
      if (!probes.every(covered)) return { type: 'car', obj: c };
    }
    for (let k = drawn.length - 1; k >= 0; k--) {
      const e = drawn[k];
      if (e.k === 0) {
        const b = e.o;
        if (b.rise < 0.2) continue;
        if (U.pointInPoly(wx, wy + 3, b.hull)) return { type: 'building', obj: b };
      } else if (e.k === 3) {
        const a = e.o;
        const zc = a.type === 'ferris' ? 44 : a.type === 'windmill' ? 26 : a.type === 'sign' ? 26 : a.type === 'gazebo' ? 18 : a.type === 'fountain' ? 14 : 4;
        const [ax, ay] = iso(a.i, a.j, zc);
        if (Math.hypot(wx - ax, (wy - ay) * (a.type === 'pond' ? 2 : 1)) < a.pick * 40) return { type: 'amenity', obj: a };
      }
    }
    const [ti, tj] = U.toTile(wx, wy);
    const { N, M } = city;
    if (ti >= -M && tj >= -M && ti < N + M && tj < N + M && (ti < 0 || tj < 0 || ti >= N || tj >= N)) return { type: 'woods' };
    return null;
  };

  R.snapshot = () => canvas;
  R.getCity = () => city;
})();
