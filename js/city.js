/* Browser City — turning a dataset into streets, blocks, buildings, parks and trees. */
(function () {
  const U = BC.util, iso = U.iso;
  const FH = 10; // px per floor
  const MAX_BUILDINGS = 340;
  const LOT_ORDER = [[0, 0], [1, 0], [0, 1], [2, 0], [1, 1], [0, 2], [2, 1], [1, 2], [2, 2]]; // back to front
  const STYLE_MULT = { tower: 1.15, house: 0.8, theater: 0.85, library: 0.8, shop: 0.55, academy: 0.8, civic: 1, arcade: 0.85, cottage: 0.5 };
  const STYLE_CAP = { tower: 20, house: 8, theater: 9, library: 9, shop: 4, academy: 9, civic: 15, arcade: 9, cottage: 3 };
  const NOUNS = {
    tower: ['Works', 'Tower', 'Foundry', 'Lab'],
    house: ['House', 'Lounge', 'Parlour', 'Café'],
    theater: ['Picture Palace', 'Theatre', 'Cinema', 'Music Hall'],
    library: ['Reading Room', 'Gazette', 'Press', 'Library'],
    shop: ['Emporium', 'Market', 'Bazaar', 'Trading Co.'],
    academy: ['Academy', 'Institute', 'Athenaeum', 'College'],
    civic: ['Hall', 'Exchange', 'Bureau', 'Post Office'],
    arcade: ['Arcade', 'Fun House', 'Game Hall', 'Pavilion'],
    cottage: ['Cottage', 'Cabin', 'Nook', 'Lodge'],
  };
  const LANDMARK_NOUN = {
    tower: 'Spire', house: 'Commons', theater: 'Picture Palace', library: 'Library', shop: 'Department Store',
    academy: 'Observatory', civic: 'Clock Tower', arcade: 'Planetarium', cottage: 'Manor',
  };

  BC.FH = FH;

  BC.buildCity = function (ds) {
    const R = U.rng('layout:' + ds.total + ':' + ds.sites.length);
    const ORDER = BC.DISTRICT_ORDER;
    const kept = [];
    for (const s of ds.sites) {
      if (kept.length >= MAX_BUILDINGS) break;
      if (s.visits >= 2 || ds.sites.length < 80) kept.push(s);
    }
    const longTail = ds.sites.length - kept.length + (ds.extraSites || 0);
    const maxV = kept.length ? kept[0].visits : 1;

    // ---------- group & size ----------
    const groups = {};
    ORDER.forEach((k) => (groups[k] = []));
    kept.forEach((s, rank) => groups[s.cat].push({ site: s, rank }));
    for (const k of ORDER) {
      groups[k].forEach((e, di) => {
        const v = e.site.visits;
        let n = 1;
        if (kept.length >= 24 && e.rank < 2 && v >= 0.12 * maxV) n = 3;
        else if ((e.rank < 14 && v >= 0.035 * maxV && v >= 12) || (di === 0 && v >= 25 && v >= 0.02 * maxV)) n = 2;
        e.n = n;
      });
    }
    const need = {};
    let totalNeed = 0;
    for (const k of ORDER) {
      const g = groups[k];
      if (!g.length) {
        need[k] = 0;
        continue;
      }
      const c3 = g.filter((e) => e.n === 3).length;
      const c2 = g.filter((e) => e.n === 2).length;
      const c1 = g.length - c2 - c3;
      need[k] = Math.max(1, c3 + c2 + Math.max(0, Math.ceil((c1 - c2 * 4) / 7)));
      totalNeed += need[k];
    }
    const parksWanted = Math.max(3, Math.round(totalNeed * 0.16));
    let G = Math.max(3, Math.ceil(Math.sqrt(totalNeed + 1 + parksWanted)));

    // ---------- districts grow from seeds around a central plaza ----------
    const active = ORDER.filter((k) => need[k] > 0).sort((a, b) => need[b] - need[a]);
    function grow(G) {
      const owner = new Array(G * G).fill(null);
      const c = Math.floor((G - 1) / 2);
      owner[c * G + c] = 'plaza';
      const seeds = {}, owned = {}, got = {};
      const rad = Math.max(1, (G - 1) * 0.34);
      const off = R() * Math.PI * 2;
      active.forEach((k, idx) => {
        const a = off + (idx / active.length) * Math.PI * 2;
        seeds[k] = [c + Math.cos(a) * rad, c + Math.sin(a) * rad];
        owned[k] = [];
        got[k] = 0;
      });
      let remaining = active.reduce((s, k) => s + need[k], 0);
      while (remaining > 0) {
        let best = null, bestR = 2;
        for (const k of active) {
          if (got[k] < need[k]) {
            const r = got[k] / need[k];
            if (r < bestR) {
              bestR = r;
              best = k;
            }
          }
        }
        let cands = [];
        for (const idx of owned[best]) {
          const bx = idx % G, by = (idx / G) | 0;
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = bx + dx, ny = by + dy;
            if (nx >= 0 && ny >= 0 && nx < G && ny < G && owner[ny * G + nx] === null) cands.push(ny * G + nx);
          }
        }
        if (!cands.length) for (let q = 0; q < G * G; q++) if (owner[q] === null) cands.push(q);
        if (!cands.length) return null;
        let pick = -1, ps = Infinity;
        const sd = seeds[best];
        for (const q of cands) {
          const bx = q % G, by = (q / G) | 0;
          const s = Math.hypot(bx - sd[0], by - sd[1]) + 0.35 * Math.hypot(bx - c, by - c) + R() * 0.25;
          if (s < ps) {
            ps = s;
            pick = q;
          }
        }
        owner[pick] = best;
        owned[best].push(pick);
        got[best]++;
        remaining--;
      }
      return { owner, owned, c };
    }
    let grown = null;
    while (!(grown = grow(G))) G++;
    const N = G * 4 + 1;
    const M = 4; // grassy margin around the grid
    const center = [N / 2, N / 2];

    // ---------- blocks ----------
    const blocks = [];
    for (let by = 0; by < G; by++) {
      for (let bx = 0; bx < G; bx++) {
        const o = grown.owner[by * G + bx];
        blocks.push({
          bx, by, i0: bx * 4 + 1, j0: by * 4 + 1,
          kind: o === 'plaza' ? 'plaza' : o ? 'district' : 'park',
          cat: o && o !== 'plaza' ? o : null,
          used: 0, cap: 7, free: null, hasBig: false,
          dist: Math.hypot(bx * 4 + 2.5 - center[0], by * 4 + 2.5 - center[1]),
        });
      }
    }

    const buildings = [];
    const trees = [];
    const amenities = [];
    const decor = { beds: [], benches: [], paving: [], courts: [], ponds: [], fields: [] };

    function addTree(i, j, kind, s) {
      trees.push({ i, j, kind, s: s || R.range(0.8, 1.15), c: R.int(0, 3), ph: R() * Math.PI * 2, depth: i + j });
    }
    function treeKindFor(cat) {
      if (cat === 'social') return R.chance(0.55) ? 'blossom' : 'round';
      if (cat === 'misc') return R.chance(0.5) ? 'pine' : 'round';
      if (cat === 'play') return R.chance(0.5) ? 'palm' : 'round';
      return R.pick(['round', 'round', 'pine', 'bush', 'tall']);
    }

    function makeBuilding(e, cat, block, lx, ly, n) {
      const s = e.site;
      const D = BC.DISTRICTS[cat];
      const seed = U.hash(s.domain);
      const r = U.rng(seed);
      const lotI = block.i0 + lx, lotJ = block.j0 + ly;
      let w, d, oi, oj;
      if (n === 1) {
        w = r.range(0.58, 0.76);
        d = r.range(0.58, 0.76);
        oi = (1 - w) / 2 + r.range(-0.04, 0.04);
        oj = (1 - d) / 2 + r.range(-0.04, 0.04);
      } else {
        const m = n === 2 ? 0.17 : 0.34;
        w = d = n - 2 * m;
        oi = oj = m;
      }
      const style = D.style;
      let floors = Math.max(1, Math.round(Math.log2(s.visits + 1) * STYLE_MULT[style]));
      if (n === 2) floors = Math.max(floors + 1, 4);
      if (n === 3) floors = Math.max(floors + 2, 6);
      floors = Math.min(floors, STYLE_CAP[style] + (n === 3 ? 4 : n === 2 ? 2 : 0));
      const b = {
        id: buildings.length, site: s, cat, n, lotI, lotJ, block,
        i0: lotI + oi, j0: lotJ + oj, w, d, floors, H: floors * FH, style,
        color: r.pick(D.palette), accent: D.accent, seed, landmark: n >= 2, mega: n === 3, rank: e.rank,
        rise: 1, pop: 1,
      };
      planRoof(b, r);
      const noun = b.landmark ? LANDMARK_NOUN[style] : r.pick(NOUNS[style]);
      const bare = s.name.replace(/^The /, '');
      b.title = (b.mega ? 'The Grand ' : b.landmark || bare !== s.name ? 'The ' : '') + bare + ' ' + noun;
      b.depth = b.i0 + b.w / 2 + (b.j0 + b.d / 2);
      const span = ds.t1 - ds.t0;
      if (ds.hasTime && span > 20 * 864e5) {
        b.ivy = s.visits >= 10 && ds.t1 - s.last > 0.35 * span;
        b.isNew = s.first - ds.t0 > 0.86 * span;
      }
      // bounds for sprites & picking
      const topZ = b.H + b.roofH;
      b.bx0 = iso(b.i0, b.j0 + b.d)[0] - 16;
      b.bx1 = iso(b.i0 + b.w, b.j0)[0] + 16;
      b.by0 = iso(b.i0, b.j0)[1] - topZ - 18;
      b.by1 = iso(b.i0 + b.w, b.j0 + b.d)[1] + 8;
      const hz = b.H + b.roofH * 0.65;
      b.hull = [
        iso(b.i0, b.j0 + b.d), iso(b.i0 + b.w, b.j0 + b.d), iso(b.i0 + b.w, b.j0),
        iso(b.i0 + b.w, b.j0, hz), iso(b.i0, b.j0, hz), iso(b.i0, b.j0 + b.d, hz),
      ];
      b.top = [b.i0 + b.w / 2, b.j0 + b.d / 2, topZ];
      buildings.push(b);
      return b;
    }

    // ---------- fill districts ----------
    const districts = {};
    for (const k of active) {
      const blist = grown.owned[k].map((idx) => blocks[idx]).sort((a, b) => a.dist - b.dist);
      const g = groups[k];
      const big3 = g.filter((e) => e.n === 3), big2 = g.filter((e) => e.n === 2), small = g.filter((e) => e.n === 1);
      let bi = 0;
      for (const e of big3) {
        const bl = blist[bi++];
        if (!bl) break;
        makeBuilding(e, k, bl, 0, 0, 3);
        bl.cap = 0;
        bl.free = [];
        bl.hasBig = 3;
      }
      for (const e of big2) {
        const bl = blist[bi++];
        if (!bl) break;
        makeBuilding(e, k, bl, 0, 0, 2);
        bl.free = [[2, 0], [2, 1], [0, 2], [1, 2], [2, 2]];
        bl.cap = 4;
        bl.hasBig = 2;
      }
      for (let q = bi; q < blist.length; q++) {
        const bl = blist[q];
        const skip = new Set();
        while (skip.size < 2) skip.add(R.int(0, 8));
        bl.free = LOT_ORDER.filter((_, idx) => !skip.has(idx));
        bl.cap = 7;
      }
      const fillOrder = blist.filter((bl) => bl.cap > 0);
      let fi = 0;
      for (const e of small) {
        while (fi < fillOrder.length && fillOrder[fi].used >= fillOrder[fi].cap) fi++;
        if (fi >= fillOrder.length) break;
        const bl = fillOrder[fi];
        const lot = bl.free[bl.used++];
        makeBuilding(e, k, bl, lot[0], lot[1], 1);
      }
      districts[k] = { key: k, blocks: blist, buildings: [], visits: 0 };
    }
    for (const b of buildings) {
      districts[b.cat].buildings.push(b);
      districts[b.cat].visits += b.site.visits;
    }
    for (const k in districts) {
      const d = districts[k];
      let si = 0, sj = 0;
      for (const bl of d.blocks) {
        si += bl.i0 + 1.5;
        sj += bl.j0 + 1.5;
      }
      d.ci = si / d.blocks.length;
      d.cj = sj / d.blocks.length;
      d.buildings.sort((a, b) => b.site.visits - a.site.visits);
    }

    // ---------- leftover lots, plaza, parks ----------
    let plaza = null;
    const parkBlocks = blocks.filter((bl) => bl.kind === 'park');
    const parkTypes = [];
    if (parkBlocks.length >= 3) parkTypes.push('ferris');
    if (parkBlocks.length >= 2) parkTypes.push('windmill');
    parkTypes.push('pond');
    const bag = ['grove', 'flowers', 'pond', 'gazebo', 'court', 'grove', 'flowers', 'gazebo'];
    const shuffledParks = parkBlocks.slice().sort(() => R() - 0.5);
    shuffledParks.forEach((bl, idx) => (bl.parkType = parkTypes[idx] || bag[(idx + R.int(0, 7)) % bag.length]));

    for (const bl of blocks) {
      const { i0, j0 } = bl;
      if (bl.kind === 'district') {
        const usedLots = new Set();
        if (bl.hasBig === 3) {
          for (const [a, b] of [[0.3, 0.3], [2.7, 0.3], [0.3, 2.7], [2.7, 2.7]]) addTree(i0 + a, j0 + b, treeKindFor(bl.cat), 0.85);
          decor.paving.push({ i: i0, j: j0, w: 3, d: 3 });
          continue;
        }
        if (bl.hasBig === 2) ['0,0', '1,0', '0,1', '1,1'].forEach((s) => usedLots.add(s));
        for (let q = 0; q < bl.used; q++) usedLots.add(bl.free[q].join(','));
        for (let lx = 0; lx < 3; lx++) {
          for (let ly = 0; ly < 3; ly++) {
            if (usedLots.has(lx + ',' + ly)) continue;
            const li = i0 + lx, lj = j0 + ly;
            const roll = R();
            if (roll < 0.4) {
              decor.beds.push({ i: li + 0.2, j: lj + 0.2, w: 0.6, d: 0.6, c: R.int(0, 4) });
              addTree(li + 0.5, lj + 0.5, treeKindFor(bl.cat), R.range(0.7, 0.95));
            } else if (roll < 0.7) {
              addTree(li + R.range(0.25, 0.4), lj + R.range(0.25, 0.4), treeKindFor(bl.cat));
              addTree(li + R.range(0.6, 0.75), lj + R.range(0.6, 0.75), treeKindFor(bl.cat), R.range(0.6, 0.85));
              decor.benches.push({ i: li + 0.5, j: lj + 0.8, axis: 'i' });
            } else {
              for (let t = 0; t < 3; t++) addTree(li + R.range(0.2, 0.8), lj + R.range(0.2, 0.8), treeKindFor(bl.cat), R.range(0.6, 1));
            }
          }
        }
      } else if (bl.kind === 'plaza') {
        plaza = bl;
        decor.paving.push({ i: i0, j: j0, w: 3, d: 3, plaza: true });
        amenities.push({ type: 'fountain', i: i0 + 1.5, j: j0 + 1.5, depth: i0 + j0 + 3, pick: 0.85 });
        for (const [a, b] of [[0.35, 0.35], [2.65, 0.35], [0.35, 2.65], [2.65, 2.65]]) addTree(i0 + a, j0 + b, 'round', 0.95);
        decor.benches.push({ i: i0 + 1.5, j: j0 + 0.45, axis: 'i' }, { i: i0 + 1.5, j: j0 + 2.55, axis: 'i' }, { i: i0 + 0.45, j: j0 + 1.5, axis: 'j' }, { i: i0 + 2.55, j: j0 + 1.5, axis: 'j' });
      } else {
        const t = bl.parkType;
        const ci = i0 + 1.5, cj = j0 + 1.5;
        const ring = (count, rad, kind) => {
          for (let q = 0; q < count; q++) {
            const a = (q / count) * Math.PI * 2 + R() * 0.4;
            addTree(ci + Math.cos(a) * rad * R.range(0.9, 1.1), cj + Math.sin(a) * rad * R.range(0.9, 1.1), kind || R.pick(['round', 'round', 'pine', 'bush']));
          }
        };
        if (t === 'pond') {
          decor.ponds.push({ i: ci, j: cj, r: 0.95 });
          amenities.push({ type: 'pond', i: ci, j: cj, r: 0.95, depth: ci + cj - 2, pick: 1 });
          ring(9, 1.3);
        } else if (t === 'ferris') {
          amenities.push({ type: 'ferris', i: ci, j: cj, depth: ci + cj, pick: 1 });
          decor.paving.push({ i: ci - 0.8, j: cj - 0.8, w: 1.6, d: 1.6 });
          ring(7, 1.32);
        } else if (t === 'windmill') {
          amenities.push({ type: 'windmill', i: ci, j: cj, depth: ci + cj, pick: 0.8 });
          decor.fields.push({ i: i0 + 0.15, j: j0 + 0.15, w: 2.7, d: 2.7 });
        } else if (t === 'gazebo') {
          amenities.push({ type: 'gazebo', i: ci, j: cj, depth: ci + cj, pick: 0.7 });
          ring(8, 1.25);
          decor.beds.push({ i: i0 + 0.15, j: j0 + 1.25, w: 0.5, d: 0.5, c: R.int(0, 4) }, { i: i0 + 2.35, j: j0 + 1.25, w: 0.5, d: 0.5, c: R.int(0, 4) });
        } else if (t === 'court') {
          decor.courts.push({ i: i0 + 0.45, j: j0 + 0.75, w: 2.1, d: 1.5 });
          addTree(i0 + 0.3, j0 + 0.3, 'round');
          addTree(i0 + 2.7, j0 + 0.35, 'pine');
          addTree(i0 + 2.6, j0 + 2.7, 'round');
          addTree(i0 + 0.4, j0 + 2.65, 'bush');
        } else if (t === 'flowers') {
          for (let q = 0; q < 4; q++) decor.beds.push({ i: i0 + 0.2 + (q % 2) * 1.5, j: j0 + 0.2 + Math.floor(q / 2) * 1.5, w: 1.1, d: 1.1, c: R.int(0, 4), rows: true });
          addTree(ci, cj, 'blossom', 1.2);
        } else {
          for (let q = 0; q < 13; q++) addTree(i0 + R.range(0.2, 2.8), j0 + R.range(0.2, 2.8), R.pick(['round', 'pine', 'pine', 'tall', 'bush']));
        }
      }
    }

    // ---------- the woods (long tail) & a welcome sign ----------
    const sign = { type: 'sign', i: N / 2 + 0.5, j: N + 1.7, pick: 0.9 };
    sign.depth = sign.i + sign.j;
    amenities.push(sign);
    const density = U.clamp(0.42 + longTail / 3000, 0.42, 0.85);
    const rocks = [], meadow = [];
    for (let i = -M; i < N + M; i++) {
      for (let j = -M; j < N + M; j++) {
        if (i >= 0 && j >= 0 && i < N && j < N) continue;
        const dSign = Math.hypot(i + 0.5 - sign.i, j + 0.5 - sign.j);
        if (dSign < 1.6) continue;
        const edge = Math.min(i + M, j + M, N + M - 1 - i, N + M - 1 - j); // 0 at the very rim
        const noise = 0.5 + 0.5 * Math.sin(i * 0.7 + Math.cos(j * 0.45) * 2) * Math.cos(j * 0.6 - i * 0.2);
        const p = density * (0.45 + noise * 0.9) * (edge === 0 ? 0.6 : 1);
        let placed = 0;
        for (let q = 0; q < 2; q++) {
          if (R() < p * (q ? 0.45 : 1)) {
            addTree(i + R.range(0.15, 0.85), j + R.range(0.15, 0.85), R.pick(['pine', 'pine', 'round', 'tall', 'round', 'bush']), R.range(0.8, 1.25));
            placed++;
          }
        }
        if (!placed && R() < 0.12) rocks.push({ i: i + R.range(0.2, 0.8), j: j + R.range(0.2, 0.8), s: R.range(0.6, 1.2) });
        if (R() < 0.35) meadow.push({ i: i + R(), j: j + R(), c: R.int(0, 4) });
      }
    }

    // ---------- lamps & pedestrians ----------
    const lamps = [];
    const pedBlocks = [];
    for (const bl of blocks) {
      if (bl.kind === 'park') {
        lamps.push({ i: bl.i0 + 0.12, j: bl.j0 + 2.88 }, { i: bl.i0 + 2.88, j: bl.j0 + 0.12 });
        continue;
      }
      lamps.push({ i: bl.i0 + 0.12, j: bl.j0 + 0.12 }, { i: bl.i0 + 2.88, j: bl.j0 + 0.12 }, { i: bl.i0 + 0.12, j: bl.j0 + 2.88 }, { i: bl.i0 + 2.88, j: bl.j0 + 2.88 });
      pedBlocks.push(bl);
    }
    lamps.forEach((l) => (l.depth = l.i + l.j));

    // ---------- road access for each building ----------
    const isRoad = (i, j) => i >= 0 && j >= 0 && i < N && j < N && (i % 4 === 0 || j % 4 === 0);
    for (const b of buildings) {
      const { lotI, lotJ, n } = b;
      let acc = null;
      for (let t = 0; t < n && !acc; t++) {
        for (const [ai, aj] of [[lotI + t, lotJ + n], [lotI + n, lotJ + t], [lotI + t, lotJ - 1], [lotI - 1, lotJ + t]]) {
          if (isRoad(ai, aj)) {
            acc = [ai, aj];
            break;
          }
        }
      }
      b.access = acc || [lotI, b.block.j0 + 3];
    }

    let roadCount = 0;
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) if (isRoad(i, j)) roadCount++;

    // world bounds (px) for the camera
    const pts = [iso(-M, -M), iso(N + M, -M), iso(N + M, N + M), iso(-M, N + M)];
    const bounds = {
      x0: Math.min(...pts.map((p) => p[0])), x1: Math.max(...pts.map((p) => p[0])),
      y0: Math.min(...pts.map((p) => p[1])) - 200, y1: Math.max(...pts.map((p) => p[1])) + 70,
    };

    return {
      ds, N, G, M, blocks, buildings, trees, lamps, amenities, decor, rocks, meadow, districts, plaza,
      longTail, isRoad, roadCount, pedBlocks, bounds, center, sign,
      byDomain: new Map(buildings.map((b) => [b.site.domain, b])),
      ranked: buildings.slice().sort((a, b) => b.site.visits - a.site.visits),
    };
  };

  // ---------- roofs: decided once here so drawing and picking agree ----------
  function planRoof(b, r) {
    const x = b.i0, y = b.j0, w = b.w, d = b.d, H = b.H, cx = x + w / 2, cy = y + d / 2;
    b.fx = [];
    switch (b.style) {
      case 'tower': {
        const tiers = [];
        const T = b.mega ? 3 : b.landmark ? 2 : b.floors >= 9 && r.chance(0.6) ? 2 : 1;
        let fl = b.floors, z = 0, ii = x, jj = y, ww = w, dd = d;
        for (let t = 0; t < T && fl > 0; t++) {
          const f = t === T - 1 ? fl : Math.max(1, Math.round(fl * (t === 0 ? 0.55 : 0.6)));
          tiers.push({ i: ii, j: jj, w: ww, d: dd, z, h: f * FH, f });
          z += f * FH;
          fl -= f;
          const ins = Math.min(ww, dd) * 0.14;
          ii += ins; jj += ins; ww -= 2 * ins; dd -= 2 * ins;
        }
        b.tiers = tiers;
        const top = tiers[tiers.length - 1];
        if (b.landmark) {
          b.roof = 'spire';
          b.roofH = 50;
          b.fx.push({ type: 'blink', i: cx, j: cy, z: H + 48, color: '#ff7a9c' });
        } else {
          b.roof = r.pick(['antenna', 'solar', 'garden', 'helipad', 'antenna']);
          if (b.roof === 'helipad' && top.w < 0.55) b.roof = 'solar';
          if (b.roof === 'antenna') {
            b.ant = [top.i + top.w * 0.7, top.j + top.d * 0.3];
            b.roofH = 24;
            b.fx.push({ type: 'blink', i: b.ant[0], j: b.ant[1], z: H + 22, color: '#ff8fa8' });
          } else b.roofH = b.roof === 'garden' ? 10 : 4;
        }
        break;
      }
      case 'house':
        if (b.landmark) {
          b.roof = 'bubble';
          b.roofH = 44;
        } else if (b.floors <= 4) {
          b.roof = 'gable';
          b.gh = 8 + 10 * Math.min(w, d);
          b.roofH = b.gh;
        } else {
          b.roof = 'garden';
          b.roofH = 10;
        }
        break;
      case 'theater':
        b.roof = b.landmark ? 'billboard' : 'star';
        b.roofH = b.landmark ? 44 : 26;
        if (b.landmark) b.fx.push({ type: 'marquee' });
        break;
      case 'library':
        b.roof = 'pediment';
        b.gh = 8 + 7 * w;
        b.roofH = b.gh + (b.landmark ? 26 : 0);
        if (b.landmark) b.fx.push({ type: 'flag', i: cx, j: cy, z: H + b.gh - 2, color: '#ff9fb8' });
        break;
      case 'shop':
        b.roof = b.landmark ? 'glassdome' : 'sign';
        b.roofH = b.landmark ? 40 : 18;
        break;
      case 'academy':
        b.roof = b.landmark ? 'observatory' : 'dome';
        b.dr = Math.min(w, d) * 0.36;
        b.roofH = 8 + b.dr * 45 * 0.95 + 14;
        break;
      case 'civic':
        if (b.landmark) {
          b.roof = 'clocktower';
          b.ct = { i: cx - 0.22, j: cy - 0.22, w: 0.44, d: 0.44, h: 32 };
          b.roofH = 32 + 24 + 16;
          b.fx.push({ type: 'clock' });
          b.fx.push({ type: 'flag', i: cx, j: cy, z: H + 32 + 22, color: '#ff9fb8' });
        } else {
          b.roof = r.chance(0.6) ? 'watertower' : 'hvac';
          b.roofH = b.roof === 'watertower' ? 30 : 8;
        }
        break;
      case 'arcade':
        b.roof = b.landmark ? 'planet' : 'ball';
        b.ballR = b.landmark ? 17 : 8 + w * 4;
        b.roofH = 6 + b.ballR * 2 + 4;
        if (b.landmark) b.fx.push({ type: 'blink', i: cx, j: cy, z: H + 6 + b.ballR * 2 + 3, color: '#ffd36e' });
        break;
      default: // cottage
        b.roof = b.landmark ? 'hip' : 'gable';
        b.gh = 10 + 10 * Math.min(w, d);
        b.roofH = b.gh + (b.landmark ? 20 : 0);
        b.chim = [x + w * 0.72, y + d * 0.28];
        b.fx.push({ type: 'smoke', i: b.chim[0], j: b.chim[1], z: H + b.gh * 0.85 + 6 });
        if (b.landmark) b.fx.push({ type: 'flag', i: cx, j: cy, z: H + b.gh, color: '#9fd4ff' });
    }
  }
})();
