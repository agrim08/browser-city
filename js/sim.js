/* Browser City — the living bits: traffic built from real tab hops, walkers, particles, sky. */
(function () {
  const U = BC.util;
  const S = (BC.sim = {});
  const CAR_COLS = ['#ff9ec4', '#8fd0ff', '#ffd76e', '#b9a5ff', '#94e6c0', '#ffb08a', '#f4f1fb', '#a8c8ff'];
  const SHIRTS = ['#ff9ec4', '#8fd0ff', '#ffd76e', '#b9a5ff', '#94e6c0', '#ffb08a', '#ffffff', '#f7c6a5'];
  const SKINS = ['#f6d5c0', '#e8b89a', '#c99a7c', '#a77b5f', '#f2cbb0'];
  const R = U.rng('sim');

  let city = null;
  let prevRoad = null;
  let tripCum = null, trips = null;
  S.cars = [];
  S.peds = [];
  S.parts = [];
  S.clouds = [];
  S.flies = [];
  S.visitors = [];
  S.birds = [];
  S.balloon = null;
  let spawnTimer = 0, birdTimer = 4, emitAcc = 0;

  S.reset = function (c) {
    city = c;
    S.cars = [];
    S.parts = [];
    S.birds = [];
    S.visitors = [];
    S.flies = [];
    // fireflies drift about the woods after dark
    for (let k = 0; k < 46; k++) {
      const side = k % 4, t = R.range(-c.M, c.N + c.M), d = R.range(-c.M + 0.4, -0.6);
      const [i, j] = side === 0 ? [d, t] : side === 1 ? [t, d] : side === 2 ? [c.N - d - 1, t] : [t, c.N - d - 1];
      S.flies.push({ i, j, z: R.range(4, 22), ph: R() * 6, sp: R.range(0.6, 1.4) });
    }
    prevRoad = new Int32Array(c.N * c.N);
    // trips weighted by how often you really hopped between two sites
    trips = [];
    tripCum = [];
    let acc = 0;
    for (const [a, b, n] of c.ds.transitions) {
      const A = c.byDomain.get(a), B = c.byDomain.get(b);
      if (!A || !B || A === B) continue;
      acc += Math.pow(n, 0.85);
      trips.push({ from: A, to: B, n });
      tripCum.push(acc);
      if (trips.length > 2500) break;
    }
    if (!trips.length && c.buildings.length > 1) {
      for (let k = 0; k < 300; k++) {
        const A = pickWeighted(), B = pickWeighted();
        if (A !== B) {
          acc += 1;
          trips.push({ from: A, to: B, n: 0 });
          tripCum.push(acc);
        }
      }
    }
    // pedestrians loop around blocks on the pavement
    S.peds = [];
    const blocks = c.pedBlocks;
    const nPeds = Math.min(150, blocks.length * 3);
    for (let k = 0; k < nPeds; k++) {
      const bl = blocks[k % blocks.length];
      S.peds.push({
        bl, p: R() * 4, dirn: R.chance(0.5) ? 1 : -1, speed: R.range(0.08, 0.14),
        color: R.pick(SHIRTS), skin: R.pick(SKINS), ph: R() * 6, pause: 0, dog: R.chance(0.12),
        umb: R.pick(['#ff9ec4', '#8fd0ff', '#ffd76e', '#b9a5ff', '#94e6c0', '#ffb08a']),
        i: 0, j: 0, vx: 0, vy: 0, moving: true, rank: R(),
      });
    }
    // sky
    const b = c.bounds;
    S.clouds = [];
    for (let k = 0; k < 7; k++) S.clouds.push(makeCloud(R.range(-c.M, c.N + c.M), R.range(-c.M, c.N + c.M)));
    S.balloon = { a: R() * 6.28, r: c.N * 0.42, z: 190 };
    void b;
  };

  function pickWeighted() {
    const bs = city.buildings;
    let tot = 0;
    for (const b of bs) tot += Math.sqrt(b.site.visits);
    let x = R() * tot;
    for (const b of bs) if ((x -= Math.sqrt(b.site.visits)) <= 0) return b;
    return bs[0];
  }
  function makeCloud(i, j) {
    const blobs = [];
    const n = R.int(4, 7);
    for (let k = 0; k < n; k++) blobs.push([(k - n / 2) * R.range(9, 13), R.range(-8, 4), R.range(10, 19)]);
    return { i, j, z: R.range(160, 230), blobs, speed: R.range(0.08, 0.16) };
  }

  // ---------- roads ----------
  function bfs(a, b) {
    const N = city.N;
    const start = a[1] * N + a[0], goal = b[1] * N + b[0];
    prevRoad.fill(-1);
    prevRoad[start] = start;
    const q = [start];
    let head = 0;
    while (head < q.length) {
      const cur = q[head++];
      if (cur === goal) break;
      const ci = cur % N, cj = (cur / N) | 0;
      const nb = [[ci + 1, cj], [ci - 1, cj], [ci, cj + 1], [ci, cj - 1]];
      for (let k = nb.length - 1; k > 0; k--) {
        const r = Math.floor(R() * (k + 1));
        [nb[k], nb[r]] = [nb[r], nb[k]];
      }
      for (const [ni, nj] of nb) {
        if (!city.isRoad(ni, nj)) continue;
        const id = nj * N + ni;
        if (prevRoad[id] !== -1) continue;
        prevRoad[id] = cur;
        q.push(id);
      }
    }
    if (prevRoad[goal] === -1) return null;
    const path = [];
    for (let cur = goal; ; cur = prevRoad[cur]) {
      path.push([cur % N, (cur / N) | 0]);
      if (cur === start) break;
    }
    return path.reverse();
  }
  const right = (d) => [-d[1], d[0]];
  function lanePoints(path) {
    const o = 0.19;
    const pts = [];
    for (let k = 0; k < path.length; k++) {
      const c = [path[k][0] + 0.5, path[k][1] + 0.5];
      const dIn = k > 0 ? [path[k][0] - path[k - 1][0], path[k][1] - path[k - 1][1]] : null;
      const dOut = k < path.length - 1 ? [path[k + 1][0] - path[k][0], path[k + 1][1] - path[k][1]] : null;
      let off = [0, 0];
      if (dIn && dOut && (dIn[0] !== dOut[0] || dIn[1] !== dOut[1])) {
        const r1 = right(dIn), r2 = right(dOut);
        off = [(r1[0] + r2[0]) * o, (r1[1] + r2[1]) * o];
      } else {
        const r = right(dIn || dOut);
        off = [r[0] * o, r[1] * o];
      }
      pts.push([c[0] + off[0], c[1] + off[1]]);
    }
    return pts;
  }

  function spawnCar(trip) {
    if (!trip) {
      if (!trips.length) return;
      const x = R() * tripCum[tripCum.length - 1];
      let lo = 0, hi = tripCum.length - 1;
      while (lo < hi) {
        const m = (lo + hi) >> 1;
        if (tripCum[m] < x) lo = m + 1;
        else hi = m;
      }
      trip = trips[lo];
    }
    const a = trip.from.access, b = trip.to.access;
    if (!a || !b || (a[0] === b[0] && a[1] === b[1])) return;
    if ((trip.from.rise ?? 1) < 0.3 || (trip.to.rise ?? 1) < 0.3) return;
    const path = bfs(a, b);
    if (!path || path.length < 2) return;
    const pts = lanePoints(path);
    const segs = [];
    for (let k = 0; k < pts.length - 1; k++) segs.push(Math.hypot(pts[k + 1][0] - pts[k][0], pts[k + 1][1] - pts[k][1]));
    const big = R.chance(0.06);
    S.cars.push({
      pts, segs, seg: 0, along: 0, speed: big ? 0.36 : R.range(0.45, 0.65), big,
      color: big ? '#ffe08a' : R.chance(0.5) ? BC.DISTRICTS[trip.from.cat].color : R.pick(CAR_COLS),
      trip, age: 0, fade: 0, done: false, i: pts[0][0], j: pts[0][1], axis: 'i', dir: 1,
    });
    return S.cars[S.cars.length - 1];
  }
  S.spawnCar = spawnCar;

  function updateCar(c, dt, hold) {
    c.age += dt;
    if (c.done) {
      c.fade += dt * 3;
      return c.fade < 1;
    }
    if (c === hold) return true;
    // gentle braking when someone is right in front
    let speed = c.speed;
    for (const o of S.cars) {
      if (o === c || o.done || o.axis !== c.axis || o.dir !== c.dir) continue;
      const di = (o.i - c.i) * (c.axis === 'i' ? c.dir : 0) + (o.j - c.j) * (c.axis === 'j' ? c.dir : 0);
      const lat = c.axis === 'i' ? Math.abs(o.j - c.j) : Math.abs(o.i - c.i);
      if (di > 0 && di < 0.55 && lat < 0.12) {
        speed *= 0.25;
        break;
      }
    }
    c.along += speed * dt;
    while (c.seg < c.segs.length && c.along > c.segs[c.seg]) {
      c.along -= c.segs[c.seg];
      c.seg++;
    }
    if (c.seg >= c.segs.length) {
      const p = c.pts[c.pts.length - 1];
      c.i = p[0];
      c.j = p[1];
      c.done = true;
      if (R.chance(0.35)) S.emit('spark', c.trip.to.top[0], c.trip.to.top[1], 6, { vz: 10, life: 0.8 });
      return true;
    }
    const a = c.pts[c.seg], b = c.pts[c.seg + 1];
    const t = c.segs[c.seg] ? c.along / c.segs[c.seg] : 1;
    c.i = a[0] + (b[0] - a[0]) * t;
    c.j = a[1] + (b[1] - a[1]) * t;
    const di = b[0] - a[0], dj = b[1] - a[1];
    if (Math.abs(di) > Math.abs(dj)) {
      c.axis = 'i';
      c.dir = di > 0 ? 1 : -1;
    } else {
      c.axis = 'j';
      c.dir = dj > 0 ? 1 : -1;
    }
    return true;
  }

  function pedPos(p) {
    const { i0, j0 } = p.bl;
    const q = ((p.p % 4) + 4) % 4, s = Math.floor(q), f = q - s;
    const a = 0.1, L = 2.8;
    if (s === 0) return [i0 + a + L * f, j0 + a];
    if (s === 1) return [i0 + a + L, j0 + a + L * f];
    if (s === 2) return [i0 + a + L - L * f, j0 + a + L];
    return [i0 + a, j0 + a + L - L * f];
  }

  S.emit = function (kind, i, j, z, o = {}) {
    if (S.parts.length > (o.cap || 260)) return;
    const life = o.life || R.range(1.6, 2.6);
    S.parts.push({
      kind, i: i + (o.spread ? R.range(-o.spread, o.spread) : 0), j: j + (o.spread ? R.range(-o.spread, o.spread) : 0), z,
      vi: o.vi || R.range(-0.05, 0.05), vj: o.vj || R.range(-0.05, 0.05), vz: o.vz != null ? o.vz : R.range(9, 15),
      g: o.g || 0, life, max: life, ph: R() * 6, seed: R.int(0, 999), color: o.color, drag: o.drag || 0, burst: o.burst,
    });
  };

  // ---------- fireworks ----------
  const FW = ['#ff6f9f', '#ffc93c', '#4fc3f7', '#9b7fe6', '#4fd39a', '#ff8a5c'];
  S.firework = function (i, j, z) {
    S.emit('rocket', i, j, z, { vz: R.range(118, 140), vi: R.range(-0.2, 0.2), vj: R.range(-0.2, 0.2), g: 34, life: R.range(1.6, 2.2), burst: R.pick(FW), cap: 700 });
    if (BC.sound) BC.sound.launch();
  };
  function explode(p) {
    const n = 46;
    S.emit('flash', p.i, p.j, p.z, { vz: 0, vi: 0.0001, vj: 0.0001, life: 0.45, color: p.burst, cap: 700 });
    for (let k = 0; k < n; k++) {
      const u = R() * 2 - 1, a = R() * Math.PI * 2, r = Math.sqrt(1 - u * u);
      const sp = R.range(88, 110);
      S.emit('fw', p.i, p.j, p.z, { vi: (r * Math.cos(a) * sp) / 32, vj: (r * Math.sin(a) * sp) / 32, vz: u * sp, g: 16, drag: 1.25, life: R.range(1.4, 2.1), color: k % 5 ? p.burst : '#ffffff', cap: 700 });
    }
    if (BC.sound) BC.sound.boom();
  }

  // ---------- someone knocks on a door you clicked ----------
  S.knock = function (b) {
    const du = b.style === 'cottage' ? b.w * 0.3 : b.w / 2;
    const door = [b.i0 + du, b.j0 + b.d + 0.04];
    const from = [door[0] + 0.32, door[1] + 0.42];
    S.visitors = S.visitors.filter((v) => v.b !== b);
    S.visitors.push({ b, from, door, t: 0, i: from[0], j: from[1], color: R.pick(SHIRTS), skin: R.pick(SKINS), ph: R() * 6, moving: true, vx: -1, vy: 0, fade: 1 });
  };

  // activity: 0..1 how busy the town is at this hour
  S.update = function (dt, st) {
    if (!city) return;
    const { hour, activity, night, paused } = st;
    if (!paused) {
      // traffic (scripted days spawn their own cars)
      const base = U.clamp(Math.round(city.roadCount / 9), 8, 70);
      const target = Math.round(base * (0.18 + 0.82 * activity));
      spawnTimer -= dt;
      if (!st.scripted && S.cars.filter((c) => !c.done).length < target && spawnTimer <= 0) {
        spawnCar();
        spawnTimer = 0.12;
      }
      S.cars = S.cars.filter((c) => updateCar(c, dt, st.hold));
      // pedestrians
      const visible = Math.round(S.peds.length * (0.25 + 0.75 * activity));
      for (let k = 0; k < S.peds.length; k++) {
        const p = S.peds[k];
        p.hidden = k >= visible;
        if (p.pause > 0) {
          p.pause -= dt;
          p.moving = false;
        } else {
          p.moving = true;
          p.p += p.dirn * p.speed * dt;
          if (R() < dt * 0.04) p.pause = R.range(1, 4);
        }
        const [i, j] = pedPos(p);
        const di = i - p.i, dj = j - p.j;
        if (di || dj) {
          const sx = di - dj, sy = di + dj, l = Math.hypot(sx, sy) || 1;
          p.vx = sx / l;
          p.vy = sy / l;
        }
        p.i = i;
        p.j = j;
      }
      // activity particles above buildings busy at this hour
      emitAcc += dt;
      if (emitAcc > 0.1) {
        const step = emitAcc;
        emitAcc = 0;
        const h = Math.floor(hour) % 24;
        for (const b of city.buildings) {
          if ((b.rise ?? 1) < 0.95) continue;
          const hrs = b.site.hours;
          const mx = b._hmax || (b._hmax = Math.max(1, ...hrs));
          const busy = hrs[h] / mx;
          if (busy < 0.35) continue;
          const rate = busy * busy * (b.landmark ? 0.9 : 0.35);
          if (R() < rate * step) {
            const kind = BC.DISTRICTS[b.cat].particle;
            S.emit(kind, b.top[0], b.top[1], b.top[2] + 2, { spread: 0.12, vz: R.range(8, 13) });
          }
        }
        for (const b of city.buildings) {
          for (const f of b.fx) {
            if (f.type === 'smoke' && (b.rise ?? 1) > 0.95 && R() < 0.6 * step * (0.5 + night)) {
              S.emit('puff', f.i, f.j, f.z, { vz: 7, vi: 0.03, vj: -0.04, life: 2.2 });
            }
          }
        }
        for (const a of city.amenities) {
          if (a.type === 'fountain') {
            for (let k = 0; k < 4; k++) {
              const ang = R() * Math.PI * 2;
              S.emit('drop', a.i, a.j, 30, { vi: Math.cos(ang) * 0.18, vj: Math.sin(ang) * 0.18, vz: R.range(14, 22), g: 46, life: 0.85 });
            }
          }
        }
      }
    }
    // particles
    const bursts = [];
    S.parts = S.parts.filter((p) => {
      p.life -= dt;
      if (p.drag) {
        const k = Math.max(0, 1 - p.drag * dt);
        p.vi *= k;
        p.vj *= k;
        p.vz *= k;
      }
      p.i += p.vi * dt;
      p.j += p.vj * dt;
      p.vz -= p.g * dt;
      p.z += p.vz * dt;
      if (p.kind === 'rocket' && (p.life <= 0 || p.vz < 4)) {
        bursts.push(p);
        return false;
      }
      return p.life > 0 && p.z > -2;
    });
    bursts.forEach(explode);
    // visitors walk up, knock, and step inside
    S.visitors = S.visitors.filter((v) => {
      v.t += dt;
      const walk = U.clamp(v.t / 1.3, 0, 1);
      v.i = v.from[0] + (v.door[0] - v.from[0]) * walk;
      v.j = v.from[1] + (v.door[1] - v.from[1]) * walk;
      v.moving = walk < 1;
      if (walk >= 1 && !v.knocked) {
        v.knocked = true;
        v.b.knock = 1.8;
        if (BC.sound) BC.sound.knock();
      }
      if (v.t > 2.1) v.fade = Math.max(0, 1 - (v.t - 2.1) * 2.5);
      return v.t < 2.6;
    });
    for (const f of S.flies) {
      f.ph += dt * f.sp;
      f.i += Math.cos(f.ph * 0.7) * 0.15 * dt;
      f.j += Math.sin(f.ph * 0.9) * 0.15 * dt;
      f.z += Math.sin(f.ph * 1.3) * 3 * dt;
    }
    // clouds drift east, wrap around the diorama
    const lo = -city.M - 6, hi = city.N + city.M + 6;
    for (const c of S.clouds) {
      c.i += c.speed * dt;
      c.j -= c.speed * 0.3 * dt;
      if (c.i > hi) {
        c.i = lo;
        c.j = R.range(-city.M, city.N + city.M);
      }
      if (c.j < lo) c.j = hi;
    }
    // birds
    birdTimer -= dt;
    if (birdTimer <= 0 && night < 0.7) {
      birdTimer = R.range(14, 26);
      const n = R.int(3, 6);
      const sj = R.range(0, city.N);
      for (let k = 0; k < n; k++) S.birds.push({ i: -city.M - 2 - k * 0.6, j: sj + (k % 2 ? 0.5 : -0.5) * (k / 2), z: R.range(120, 150), ph: R() * 6, speed: R.range(1.6, 2) });
    }
    S.birds = S.birds.filter((b) => {
      b.i += b.speed * dt;
      b.j -= b.speed * 0.25 * dt;
      b.ph += dt * 10;
      return b.i < city.N + city.M + 4;
    });
    if (S.balloon) S.balloon.a += dt * 0.025;
  };

  S.balloonPos = function () {
    const b = S.balloon;
    const c = city.N / 2;
    return [c + Math.cos(b.a) * b.r, c + Math.sin(b.a) * b.r, b.z];
  };
})();
