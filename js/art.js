/* Browser City — procedural isometric drawing. Everything is drawn in world pixels. */
(function () {
  const U = BC.util, iso = U.iso;
  const A = (BC.art = {});
  const FH = 10;
  const FONT = 'Fredoka, Nunito, "Segoe UI", sans-serif';

  // ---------- primitives ----------
  function trace(ctx, pts) {
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let k = 1; k < pts.length; k++) ctx.lineTo(pts[k][0], pts[k][1]);
    ctx.closePath();
  }
  function fill(ctx, pts, col) {
    ctx.beginPath();
    trace(ctx, pts);
    ctx.fillStyle = col;
    ctx.fill();
  }
  function line(ctx, a, b, col, lw) {
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.strokeStyle = col;
    ctx.lineWidth = lw || 1;
    ctx.stroke();
  }
  function rrect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function heart(ctx, x, y, s) {
    ctx.beginPath();
    ctx.moveTo(x, y + s * 0.35);
    ctx.bezierCurveTo(x - s, y - s * 0.35, x - s * 0.45, y - s, x, y - s * 0.45);
    ctx.bezierCurveTo(x + s * 0.45, y - s, x + s, y - s * 0.35, x, y + s * 0.35);
    ctx.closePath();
  }
  function star(ctx, x, y, r1, r2, n = 5, rot = -Math.PI / 2) {
    ctx.beginPath();
    for (let k = 0; k < n * 2; k++) {
      const r = k % 2 ? r2 : r1;
      const a = rot + (k * Math.PI) / n;
      ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    }
    ctx.closePath();
  }
  A.rrect = rrect;
  A.heart = heart;
  A.star = star;
  A.fill = fill;
  A.trace = trace;

  A.box = function (ctx, i0, j0, w, d, z0, h, col, o) {
    o = o || {};
    const t = z0 + h;
    const Ta = iso(i0, j0, t), Tb = iso(i0 + w, j0, t), Tc = iso(i0 + w, j0 + d, t), Td = iso(i0, j0 + d, t);
    const Bb = iso(i0 + w, j0, z0), Bc = iso(i0 + w, j0 + d, z0), Bd = iso(i0, j0 + d, z0);
    fill(ctx, [Bd, Bc, Tc, Td], o.left || col);
    fill(ctx, [Bc, Bb, Tb, Tc], o.right || U.dark(col, 0.14));
    if (!o.noTop) fill(ctx, [Ta, Tb, Tc, Td], o.top || U.light(col, 0.32));
    if (o.line !== false) {
      ctx.lineJoin = 'round';
      ctx.strokeStyle = o.line || U.rgba(U.dark(col, 0.6), 0.42);
      ctx.lineWidth = o.lw || 0.8;
      ctx.beginPath();
      trace(ctx, [Bd, Bc, Bb, Tb, Ta, Td]);
      ctx.moveTo(Bc[0], Bc[1]);
      ctx.lineTo(Tc[0], Tc[1]);
      ctx.stroke();
      if (!o.noTop && h > 1.5) {
        ctx.strokeStyle = 'rgba(255,255,255,.6)';
        ctx.beginPath();
        ctx.moveTo(Td[0], Td[1]);
        ctx.lineTo(Tc[0], Tc[1]);
        ctx.lineTo(Tb[0], Tb[1]);
        ctx.stroke();
      }
    }
    return { Ta, Tb, Tc, Td, Bb, Bc, Bd };
  };

  // faces: u runs along the face in tiles, v is absolute height in px
  A.faceL = (i0, j0, w, d) => ({ oi: i0, oj: j0 + d, di: 1, dj: 0, len: w, out: [0, 1] });
  A.faceR = (i0, j0, w, d) => ({ oi: i0 + w, oj: j0 + d, di: 0, dj: -1, len: d, out: [1, 0] });
  const fp = (A.fp = (f, u, v, o = 0) => iso(f.oi + f.di * u + f.out[0] * o, f.oj + f.dj * u + f.out[1] * o, v));
  function quad(ctx, f, u0, u1, v0, v1) {
    const a = fp(f, u0, v0), b = fp(f, u1, v0), c = fp(f, u1, v1), d = fp(f, u0, v1);
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.lineTo(c[0], c[1]);
    ctx.lineTo(d[0], d[1]);
    ctx.closePath();
  }
  A.quad = quad;
  // draw in a face's plane: x along the face (px), y downward (px)
  A.onFace = function (ctx, f, u, v, fn) {
    const o = fp(f, u, v);
    const ux = (f.di - f.dj) * 32, uy = (f.di + f.dj) * 16;
    const L = Math.hypot(ux, uy);
    ctx.save();
    ctx.transform(ux / L, uy / L, 0, 1, o[0], o[1]);
    fn(L);
    ctx.restore();
  };

  function windows(ctx, P, f, z0, floors, o) {
    o = o || {};
    const cols = o.cols || Math.max(1, Math.round(f.len / 0.24));
    const mU = o.mU != null ? o.mU : 0.09;
    const cw = (f.len - 2 * mU) / cols;
    const wf = o.wf || 0.52, hf = o.hf || 0.5;
    const litPct = o.lit != null ? o.lit : 62;
    const lit = [], dark = [];
    for (let k = o.start || 0; k < floors; k++) {
      for (let c = 0; c < cols; c++) {
        if (o.skip && o.skip(k, c)) continue;
        const u0 = mU + c * cw + (cw * (1 - wf)) / 2, u1 = u0 + cw * wf;
        const v0 = z0 + k * FH + FH * (1 - hf) * 0.45, v1 = v0 + FH * hf;
        const h = (P.seed ^ Math.imul(k + 1, 73856093) ^ Math.imul(c + 1, 19349663) ^ Math.imul((o.face || 0) + 1, 83492791)) >>> 0;
        (h % 100 < litPct ? lit : dark).push([u0, u1, v0, v1, h]);
      }
    }
    if (o.candy) {
      const C = ['#ff9ec4', '#8fdcff', '#ffe27a', '#b9a5ff', '#94efc0', '#ffb98a'];
      for (const q of lit.concat(dark)) {
        ctx.beginPath();
        quad(ctx, f, q[0], q[1], q[2], q[3]);
        const c = C[q[4] % C.length];
        ctx.fillStyle = P.night ? U.light(c, 0.15) : c;
        ctx.fill();
      }
      return;
    }
    if (!P.night) {
      ctx.beginPath();
      for (const q of lit) quad(ctx, f, q[0], q[1], q[2], q[3]);
      for (const q of dark) quad(ctx, f, q[0], q[1], q[2], q[3]);
      ctx.fillStyle = o.day || '#f6fbff';
      ctx.fill();
      if (o.frame) {
        ctx.strokeStyle = o.frame;
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }
    } else {
      ctx.beginPath();
      for (const q of dark) quad(ctx, f, q[0], q[1], q[2], q[3]);
      ctx.fillStyle = '#857eb3';
      ctx.fill();
      // soft halo, then the pane itself (cheaper than shadowBlur)
      ctx.beginPath();
      for (const q of lit) quad(ctx, f, q[0] - 0.025, q[1] + 0.025, q[2] - 1.3, q[3] + 1.3);
      ctx.fillStyle = 'rgba(255,221,140,.32)';
      ctx.fill();
      ctx.beginPath();
      for (const q of lit) quad(ctx, f, q[0], q[1], q[2], q[3]);
      ctx.fillStyle = o.litCol || '#ffe28a';
      ctx.fill();
    }
  }
  function door(ctx, P, f, u, col, w = 0.13, h = 7.5) {
    ctx.beginPath();
    quad(ctx, f, u, u + w, 0, h);
    ctx.fillStyle = P.night ? '#ffd98a' : col;
    ctx.fill();
    ctx.strokeStyle = U.rgba('#4a4270', 0.25);
    ctx.lineWidth = 0.5;
    ctx.stroke();
  }
  function band(ctx, f, v0, v1, col, u0 = 0, u1 = f.len) {
    ctx.beginPath();
    quad(ctx, f, u0, u1, v0, v1);
    ctx.fillStyle = col;
    ctx.fill();
  }
  function awning(ctx, f, u0, u1, z, ca, cb) {
    const n = Math.max(2, Math.round((u1 - u0) / 0.09));
    const du = (u1 - u0) / n;
    for (let k = 0; k < n; k++) {
      const a = u0 + k * du, b = a + du;
      fill(ctx, [fp(f, a, z + 1), fp(f, b, z + 1), fp(f, b, z - 4, 0.16), fp(f, a, z - 4, 0.16)], k % 2 ? cb : ca);
    }
    ctx.beginPath();
    for (let k = 0; k < n; k++) {
      const m = fp(f, u0 + (k + 0.5) * du, z - 4, 0.16);
      ctx.moveTo(m[0] + 2.4, m[1]);
      ctx.arc(m[0], m[1], 2.4, 0, Math.PI);
    }
    ctx.fillStyle = ca;
    ctx.fill();
  }
  function gable(ctx, x, y, w, d, H, gh, roofCol, wallCol, alongI, mid) {
    const e = 0.05;
    const A1 = iso(x - e, y - e, H), B1 = iso(x + w + e, y - e, H), C1 = iso(x + w + e, y + d + e, H), D1 = iso(x - e, y + d + e, H);
    const edge = U.rgba(U.dark(roofCol, 0.6), 0.45);
    ctx.lineJoin = 'round';
    if (alongI) {
      const cy = y + d / 2;
      const M1 = iso(x - e, cy, H + gh), M2 = iso(x + w + e, cy, H + gh);
      fill(ctx, [A1, B1, M2, M1], U.light(roofCol, 0.25));
      fill(ctx, [iso(x + w, y, H), iso(x + w, y + d, H), iso(x + w, cy, H + gh)], U.dark(wallCol, 0.14));
      if (mid) mid();
      fill(ctx, [D1, C1, M2, M1], roofCol);
      ctx.beginPath();
      trace(ctx, [D1, C1, M2, M1]);
      ctx.strokeStyle = edge;
      ctx.lineWidth = 0.8;
      ctx.stroke();
      line(ctx, M1, M2, 'rgba(255,255,255,.6)', 0.9);
    } else {
      const cx = x + w / 2;
      const N1 = iso(cx, y - e, H + gh), N2 = iso(cx, y + d + e, H + gh);
      fill(ctx, [A1, D1, N2, N1], U.light(roofCol, 0.25));
      fill(ctx, [iso(x, y + d, H), iso(x + w, y + d, H), iso(cx, y + d, H + gh)], wallCol);
      if (mid) mid();
      fill(ctx, [B1, C1, N2, N1], U.dark(roofCol, 0.08));
      ctx.beginPath();
      trace(ctx, [B1, C1, N2, N1]);
      ctx.strokeStyle = edge;
      ctx.lineWidth = 0.8;
      ctx.stroke();
      line(ctx, N1, N2, 'rgba(255,255,255,.6)', 0.9);
    }
  }
  function pyramid(ctx, x, y, w, d, H, ph, col) {
    const ap = iso(x + w / 2, y + d / 2, H + ph);
    const a = iso(x, y, H), b = iso(x + w, y, H), c = iso(x + w, y + d, H), dd = iso(x, y + d, H);
    fill(ctx, [a, b, ap], U.light(col, 0.3));
    fill(ctx, [a, dd, ap], U.light(col, 0.2));
    fill(ctx, [dd, c, ap], col);
    fill(ctx, [c, b, ap], U.dark(col, 0.12));
    ctx.beginPath();
    trace(ctx, [dd, c, b, ap]);
    ctx.strokeStyle = U.rgba(U.dark(col, 0.6), 0.4);
    ctx.lineWidth = 0.7;
    ctx.stroke();
    line(ctx, c, ap, 'rgba(255,255,255,.5)', 0.7);
  }
  function dome(ctx, cx, cy, z, r, col, drumH, drumCol) {
    const rx = r * 45.25, ry = rx / 2;
    const [sx, sy0] = iso(cx, cy, z);
    let sy = sy0;
    if (drumH) {
      const g = ctx.createLinearGradient(sx - rx, 0, sx + rx, 0);
      g.addColorStop(0, U.light(drumCol, 0.25));
      g.addColorStop(1, U.dark(drumCol, 0.12));
      ctx.beginPath();
      ctx.moveTo(sx - rx, sy - drumH);
      ctx.lineTo(sx - rx, sy);
      ctx.ellipse(sx, sy, rx, ry, 0, Math.PI, 0, true);
      ctx.lineTo(sx + rx, sy - drumH);
      ctx.ellipse(sx, sy - drumH, rx, ry, 0, 0, Math.PI, true);
      ctx.fillStyle = g;
      ctx.fill();
      sy -= drumH;
    }
    const g2 = ctx.createLinearGradient(sx - rx, sy - rx, sx + rx, sy);
    g2.addColorStop(0, U.light(col, 0.4));
    g2.addColorStop(0.55, col);
    g2.addColorStop(1, U.dark(col, 0.15));
    ctx.beginPath();
    ctx.moveTo(sx - rx, sy);
    ctx.ellipse(sx, sy, rx, rx * 0.95, 0, Math.PI, Math.PI * 2);
    ctx.ellipse(sx, sy, rx, ry, 0, 0, Math.PI);
    ctx.fillStyle = g2;
    ctx.fill();
    ctx.strokeStyle = U.rgba(U.dark(col, 0.6), 0.35);
    ctx.lineWidth = 0.7;
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(sx - rx * 0.35, sy - rx * 0.55, rx * 0.22, rx * 0.14, -0.5, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,.5)';
    ctx.fill();
    return [sx, sy, rx];
  }
  function sphere(ctx, x, y, r, col) {
    const g = ctx.createRadialGradient(x - r * 0.4, y - r * 0.45, r * 0.1, x, y, r);
    g.addColorStop(0, U.light(col, 0.6));
    g.addColorStop(0.6, col);
    g.addColorStop(1, U.dark(col, 0.18));
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();
  }
  function facadeSign(ctx, P, f, vTop, text, bg, fg) {
    A.onFace(ctx, f, 0, vTop, (L) => {
      let fs = 8;
      ctx.font = `600 ${fs}px ${FONT}`;
      let tw = ctx.measureText(text).width;
      const maxW = f.len * L * 0.78;
      if (tw > maxW) {
        fs = Math.max(3, (fs * maxW) / tw);
        ctx.font = `600 ${fs}px ${FONT}`;
        tw = ctx.measureText(text).width;
      }
      const pw = tw + 7, ph = fs + 4;
      const x0 = (f.len * L - pw) / 2;
      rrect(ctx, x0, 0, pw, ph, 2.5);
      ctx.fillStyle = bg;
      ctx.fill();
      ctx.fillStyle = fg;
      ctx.textBaseline = 'middle';
      ctx.fillText(text, x0 + 3.5, ph / 2 + 0.4);
    });
  }
  function ivy(ctx, b) {
    const r = U.rng(b.seed ^ 777);
    const cols = ['#9fd58c', '#8cc97a', '#b5e3a0', '#7fbf72'];
    const draw = (f, fromEnd) => {
      A.onFace(ctx, f, 0, 0, (L) => {
        const span = f.len * L;
        for (let k = 0; k < 22; k++) {
          const t = Math.pow(r(), 1.4);
          const x = fromEnd ? span - t * span * 0.5 : t * span * 0.5;
          const y = -Math.pow(r(), 1.3) * Math.min(b.H * 0.85, 30);
          ctx.beginPath();
          ctx.arc(x, y, r.range(1.2, 2.8), 0, Math.PI * 2);
          ctx.fillStyle = cols[k % cols.length];
          ctx.fill();
        }
      });
    };
    draw(A.faceL(b.i0, b.j0, b.w, b.d), false);
    draw(A.faceR(b.i0, b.j0, b.w, b.d), true);
  }
  function bunting(ctx, b) {
    const C = ['#ff9fb8', '#ffd36e', '#8fd6ff', '#a8e6a1', '#c9a8ff'];
    const z = b.H + 1;
    const pts = [iso(b.i0, b.j0 + b.d, z), iso(b.i0 + b.w, b.j0 + b.d, z), iso(b.i0 + b.w, b.j0, z)];
    let ci = 0;
    for (let s = 0; s < 2; s++) {
      const a = pts[s], c = pts[s + 1];
      const n = 6;
      ctx.beginPath();
      for (let k = 0; k <= 20; k++) {
        const t = k / 20;
        const x = a[0] + (c[0] - a[0]) * t, y = a[1] + (c[1] - a[1]) * t + Math.sin(Math.PI * t) * 4;
        k ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.strokeStyle = 'rgba(120,110,160,.6)';
      ctx.lineWidth = 0.5;
      ctx.stroke();
      for (let k = 0; k < n; k++) {
        const t = (k + 0.5) / n;
        const x = a[0] + (c[0] - a[0]) * t, y = a[1] + (c[1] - a[1]) * t + Math.sin(Math.PI * t) * 4;
        ctx.beginPath();
        ctx.moveTo(x - 1.8, y);
        ctx.lineTo(x + 1.8, y);
        ctx.lineTo(x, y + 4);
        ctx.closePath();
        ctx.fillStyle = C[ci++ % C.length];
        ctx.fill();
      }
    }
  }

  const ROOF_COLS = ['#f4a9a0', '#f2b98f', '#e7a6c3', '#b9a7e6', '#9fc7e8', '#a9d3a0'];

  // ---------- building styles ----------
  const STYLES = {
    tower(ctx, b, P, g) {
      b.tiers.forEach((t, idx) => {
        const col = idx % 2 ? U.light(g.body, 0.14) : g.body;
        A.box(ctx, t.i, t.j, t.w, t.d, t.z, t.h, col);
        const fl = A.faceL(t.i, t.j, t.w, t.d), fr = A.faceR(t.i, t.j, t.w, t.d);
        windows(ctx, P, fl, t.z, t.f, { cols: Math.max(2, Math.round(t.w / 0.12)), wf: 0.84, hf: 0.42, mU: 0.05, face: idx * 2, day: '#f3faff', lit: 55 });
        windows(ctx, P, fr, t.z, t.f, { cols: Math.max(2, Math.round(t.d / 0.12)), wf: 0.84, hf: 0.42, mU: 0.05, face: idx * 2 + 1, day: '#e6f1fb', lit: 55 });
        band(ctx, fl, t.z + t.h - 2, t.z + t.h, U.light(col, 0.4));
        band(ctx, fr, t.z + t.h - 2, t.z + t.h, U.light(col, 0.2));
      });
      const t0 = b.tiers[0];
      door(ctx, P, A.faceL(t0.i, t0.j, t0.w, t0.d), t0.w / 2 - 0.08, P.T('#9ed8c6'), 0.16, 8);
      const top = b.tiers[b.tiers.length - 1];
      const zt = top.z + top.h;
      const cx = b.i0 + b.w / 2, cy = b.j0 + b.d / 2;
      if (b.roof === 'spire') {
        A.box(ctx, cx - 0.16, cy - 0.16, 0.32, 0.32, zt, 10, U.light(g.acc, 0.35));
        pyramid(ctx, cx - 0.16, cy - 0.16, 0.32, 0.32, zt + 10, 38, U.light(g.acc, 0.15));
      } else if (b.roof === 'antenna') {
        const [ai, aj] = b.ant;
        A.box(ctx, ai - 0.05, aj - 0.05, 0.1, 0.1, zt, 3, P.T('#e8e4f0'));
        line(ctx, iso(ai, aj, zt + 3), iso(ai, aj, zt + 22), P.T('#9a92bd'), 1.1);
        line(ctx, iso(ai, aj, zt + 12), iso(ai + 0.08, aj - 0.08, zt + 15), P.T('#9a92bd'), 0.8);
      } else if (b.roof === 'solar') {
        for (let k = 0; k < 2; k++) {
          const pi = top.i + 0.08 + k * (top.w * 0.45), pj = top.j + 0.1;
          const pw = top.w * 0.38, pd = top.d * 0.75;
          fill(ctx, [iso(pi, pj, zt + 4), iso(pi + pw, pj, zt + 4), iso(pi + pw, pj + pd, zt + 1), iso(pi, pj + pd, zt + 1)], P.T('#8fa3df'));
          line(ctx, iso(pi + pw / 2, pj, zt + 4), iso(pi + pw / 2, pj + pd, zt + 1), 'rgba(255,255,255,.55)', 0.5);
        }
      } else if (b.roof === 'garden') {
        A.box(ctx, top.i + 0.07, top.j + 0.07, top.w - 0.14, top.d - 0.14, zt, 2, P.T('#c5e6a8'), { line: false });
        const R = U.rng(b.seed);
        for (let k = 0; k < 4; k++) {
          const p = iso(top.i + R.range(0.15, top.w - 0.15), top.j + R.range(0.15, top.d - 0.15), zt + 2);
          ctx.beginPath();
          ctx.arc(p[0], p[1] - 2.5, R.range(2.2, 3.4), 0, Math.PI * 2);
          ctx.fillStyle = P.T(R.pick(['#9fd58c', '#b3e09c', '#ffc1d6']));
          ctx.fill();
        }
      } else if (b.roof === 'helipad') {
        const [hx, hy] = iso(cx, cy, zt);
        ctx.beginPath();
        ctx.ellipse(hx, hy, top.w * 15, top.w * 7.5, 0, 0, Math.PI * 2);
        ctx.fillStyle = P.T('#f0edf7');
        ctx.fill();
        ctx.strokeStyle = P.T('#ffb3c6');
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.save();
        ctx.translate(hx, hy);
        ctx.scale(1, 0.5);
        ctx.font = `700 ${top.w * 14}px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = P.T('#c9a8e8');
        ctx.fillText('H', 0, 1);
        ctx.restore();
      }
      if (b.landmark) facadeSign(ctx, P, A.faceL(t0.i, t0.j, t0.w, t0.d), t0.z + t0.h - 3 - 9, b.site.name, P.T('#ffffff'), P.T(U.dark(g.acc, 0.2)));
    },

    house(ctx, b, P, g) {
      const { x, y, w, d, H } = g;
      A.box(ctx, x, y, w, d, 0, H, g.body);
      const fl = A.faceL(x, y, w, d), fr = A.faceR(x, y, w, d);
      const dc = Math.max(1, Math.round(w / 0.26));
      const du = w / 2 - 0.065;
      windows(ctx, P, fl, 0, b.floors, { cols: dc, wf: 0.42, hf: 0.5, face: 0, skip: (k, c) => k === 0 && Math.abs((0.09 + (c + 0.5) * ((w - 0.18) / dc)) - w / 2) < 0.13 });
      windows(ctx, P, fr, 0, b.floors, { cols: Math.max(1, Math.round(d / 0.26)), wf: 0.42, hf: 0.5, face: 1, day: '#eef5fd' });
      door(ctx, P, fl, du, P.T(U.dark(g.acc, 0.1)));
      if (b.floors >= 3) {
        for (let k = 1; k < b.floors; k += 2) {
          band(ctx, fl, k * FH, k * FH + 2.2, 'rgba(255,255,255,.75)', 0.06, w - 0.06);
          band(ctx, fr, k * FH, k * FH + 2.2, 'rgba(255,255,255,.55)', 0.06, d - 0.06);
        }
      }
      // flower boxes
      ctx.beginPath();
      const fcols = dc;
      for (let c = 0; c < fcols; c++) {
        const u = 0.09 + (c + 0.5) * ((w - 0.18) / fcols);
        if (Math.abs(u - w / 2) < 0.13) continue;
        quad(ctx, fl, u - 0.06, u + 0.06, FH * 0.12, FH * 0.12 + 2);
      }
      ctx.fillStyle = P.T('#ff9fb8');
      ctx.fill();
      if (b.roof === 'gable') {
        const rc = P.T(ROOF_COLS[b.seed % 3]);
        gable(ctx, x, y, w, d, H, b.gh, rc, g.body, w >= d);
      } else {
        A.box(ctx, x, y, w, d, H, 2.5, U.light(g.body, 0.3), { line: false });
        const R = U.rng(b.seed);
        for (let k = 0; k < 4; k++) {
          const p = iso(x + R.range(0.12, w - 0.12), y + R.range(0.12, d - 0.12), H + 2.5);
          ctx.beginPath();
          ctx.arc(p[0], p[1] - 2.5, R.range(2, 3.2), 0, Math.PI * 2);
          ctx.fillStyle = P.T(R.pick(['#9fd58c', '#b3e09c', '#ffc1d6', '#ffd9e6']));
          ctx.fill();
        }
        if (b.roof === 'bubble') {
          const [sx, sy] = iso(x + w / 2, y + d / 2, H + 2.5);
          line(ctx, [sx - 7, sy], [sx - 7, sy - 18], P.T('#b9b0d6'), 1.2);
          line(ctx, [sx + 7, sy], [sx + 7, sy - 18], P.T('#b9b0d6'), 1.2);
          rrect(ctx, sx - 19, sy - 42, 38, 24, 9);
          ctx.fillStyle = P.T('#ffffff');
          ctx.fill();
          ctx.strokeStyle = P.T(g.acc);
          ctx.lineWidth = 1.4;
          ctx.stroke();
          heart(ctx, sx, sy - 29, 8);
          ctx.fillStyle = P.night ? '#ff8fb1' : g.acc;
          if (P.night) {
            ctx.save();
            ctx.shadowColor = '#ff8fb1';
            ctx.shadowBlur = 6 * P.s;
            ctx.fill();
            ctx.restore();
          } else ctx.fill();
        }
      }
      if (b.landmark) facadeSign(ctx, P, fl, FH * 1 + 1, b.site.name, P.T('#ffffff'), P.T(U.dark(g.acc, 0.25)));
    },

    theater(ctx, b, P, g) {
      const { x, y, w, d, H } = g;
      A.box(ctx, x, y, w, d, 0, H, g.body);
      const fl = A.faceL(x, y, w, d), fr = A.faceR(x, y, w, d);
      windows(ctx, P, fl, 0, b.floors, { start: 2, cols: Math.max(1, Math.round(w / 0.22)), wf: 0.34, hf: 0.72, face: 0 });
      windows(ctx, P, fr, 0, b.floors, { start: 2, cols: Math.max(1, Math.round(d / 0.3)), wf: 0.3, hf: 0.72, face: 1, day: '#efe9fb' });
      band(ctx, fl, 0, 7.5, P.night ? '#ffe39a' : P.T(U.dark(g.acc, 0.15)), 0.12, w - 0.12);
      const mz = FH * 1.05;
      band(ctx, fl, mz, mz + 5, g.acc);
      band(ctx, fr, mz, mz + 5, U.dark(g.acc, 0.1));
      ctx.beginPath();
      for (const f of [fl, fr]) {
        for (let u = 0.05; u < f.len - 0.02; u += 0.075) {
          const p = fp(f, u, mz + 2.5);
          ctx.moveTo(p[0] + 0.9, p[1]);
          ctx.arc(p[0], p[1], 0.9, 0, Math.PI * 2);
        }
      }
      ctx.fillStyle = P.night ? '#fff1a8' : '#ffffff';
      ctx.fill();
      if (b.floors >= 3) {
        const v0 = FH * 1.7, v1 = Math.min(H - 4, FH * 3.7);
        band(ctx, fr, v0, v1, P.T('#fff7fb'), 0.14, d - 0.14);
        A.onFace(ctx, fr, d / 2, (v0 + v1) / 2, () => {
          const s = Math.min(6, (v1 - v0) * 0.32);
          ctx.beginPath();
          ctx.moveTo(-s * 0.6, -s);
          ctx.lineTo(s, 0);
          ctx.lineTo(-s * 0.6, s);
          ctx.closePath();
          ctx.fillStyle = g.acc;
          ctx.fill();
        });
      }
      const cx = x + w / 2, cy = y + d / 2;
      if (b.roof === 'star') {
        const [sx, sy] = iso(cx, cy, H);
        line(ctx, [sx, sy], [sx, sy - 16], P.T('#b9b0d6'), 1.2);
        star(ctx, sx, sy - 20, 7, 3.2);
        ctx.fillStyle = P.night ? '#ffe27a' : P.T('#ffd66e');
        ctx.fill();
        ctx.strokeStyle = P.T('#e9b53f');
        ctx.lineWidth = 0.8;
        ctx.stroke();
      } else {
        const pz = H + 9;
        line(ctx, iso(x + 0.25, cy, H), iso(x + 0.25, cy, pz), P.T('#b9b0d6'), 1.4);
        line(ctx, iso(x + w - 0.25, cy, H), iso(x + w - 0.25, cy, pz), P.T('#b9b0d6'), 1.4);
        A.box(ctx, x + 0.06, cy - 0.03, w - 0.12, 0.06, pz, 32, P.T('#fff4fa'));
        const bf = A.faceL(x + 0.06, cy - 0.03, w - 0.12, 0.06);
        A.onFace(ctx, bf, (w - 0.12) / 2, pz + 21, (L) => {
          ctx.beginPath();
          ctx.moveTo(-6, -7);
          ctx.lineTo(8, 0);
          ctx.lineTo(-6, 7);
          ctx.closePath();
          ctx.fillStyle = P.night ? '#c9a8ff' : g.acc;
          ctx.fill();
        });
        facadeSign(ctx, P, bf, pz + 3, b.site.name, 'rgba(0,0,0,0)', P.T(U.dark(g.acc, 0.3)));
      }
    },

    library(ctx, b, P, g) {
      const { x, y, w, d, H } = g;
      A.box(ctx, x - 0.04, y - 0.04, w + 0.08, d + 0.08, 0, 3, P.T('#f3eee8'));
      A.box(ctx, x, y, w, d, 3, H - 3, g.body);
      const fl = A.faceL(x, y, w, d), fr = A.faceR(x, y, w, d);
      const colTop = Math.min(H, FH * 2) - 1;
      const nCol = Math.max(3, Math.round(w / 0.15));
      ctx.beginPath();
      for (let k = 0; k < nCol; k++) {
        const u = 0.06 + (k * (w - 0.12 - 0.045)) / (nCol - 1);
        quad(ctx, fl, u, u + 0.045, 3, colTop);
      }
      ctx.fillStyle = P.T('#fffaf2');
      ctx.fill();
      band(ctx, fl, colTop, colTop + 3, P.T('#fffaf2'));
      band(ctx, fr, colTop, colTop + 3, P.T('#f1ebe2'));
      door(ctx, P, fl, w / 2 - 0.07, P.T('#c79b7d'), 0.14, 8);
      windows(ctx, P, fl, 0, b.floors, { start: 2, cols: Math.max(1, Math.round(w / 0.24)), wf: 0.45, hf: 0.55, face: 0 });
      windows(ctx, P, fr, 0, b.floors, { cols: Math.max(1, Math.round(d / 0.24)), wf: 0.45, hf: 0.55, face: 1, day: '#f2f6fb' });
      gable(ctx, x - 0.02, y - 0.02, w + 0.04, d + 0.04, H, b.gh, P.T(U.mix(g.acc, '#fff4d6', 0.55)), P.T('#fffaf2'), false);
      // a round window in the pediment
      const pc = iso(x + w / 2, y + d + 0.02, H + b.gh * 0.38);
      ctx.beginPath();
      ctx.ellipse(pc[0], pc[1], 2.6, 2.6, 0, 0, Math.PI * 2);
      ctx.fillStyle = P.night ? '#ffe28a' : P.T(g.acc);
      ctx.fill();
      if (b.landmark) facadeSign(ctx, P, fr, colTop - 9, b.site.name, P.T('#ffffff'), P.T(U.dark(g.acc, 0.35)));
    },

    shop(ctx, b, P, g) {
      const { x, y, w, d, H } = g;
      A.box(ctx, x, y, w, d, 0, H, g.body);
      const fl = A.faceL(x, y, w, d), fr = A.faceR(x, y, w, d);
      windows(ctx, P, fl, 0, b.floors, { start: 1, cols: Math.max(1, Math.round(w / 0.24)), wf: 0.5, hf: 0.5, face: 0 });
      windows(ctx, P, fr, 0, b.floors, { start: 1, cols: Math.max(1, Math.round(d / 0.24)), wf: 0.5, hf: 0.5, face: 1, day: '#f0f6fd' });
      const disp = P.night ? '#ffe9a8' : '#eef8ff';
      ctx.beginPath();
      quad(ctx, fl, 0.07, w / 2 - 0.09, 1.5, FH - 3);
      quad(ctx, fl, w / 2 + 0.09, w - 0.07, 1.5, FH - 3);
      quad(ctx, fr, 0.07, d - 0.07, 1.5, FH - 3);
      ctx.fillStyle = disp;
      ctx.fill();
      door(ctx, P, fl, w / 2 - 0.07, P.T(U.dark(g.acc, 0.1)), 0.14, 7.5);
      const stripe = P.T('#ffffff');
      awning(ctx, fl, 0.03, w - 0.03, FH - 1, P.T(g.acc), stripe);
      awning(ctx, fr, 0.03, d - 0.03, FH - 1, P.T(U.dark(g.acc, 0.08)), P.T('#f4f0f6'));
      const cx = x + w / 2, cy = y + d / 2;
      if (b.roof === 'sign') {
        line(ctx, iso(x + 0.15, cy, H), iso(x + 0.15, cy, H + 5), P.T('#b9b0d6'), 1);
        line(ctx, iso(x + w - 0.15, cy, H), iso(x + w - 0.15, cy, H + 5), P.T('#b9b0d6'), 1);
        A.box(ctx, x + 0.05, cy - 0.025, w - 0.1, 0.05, H + 5, 12, P.T('#fffaf3'));
        facadeSign(ctx, P, A.faceL(x + 0.05, cy - 0.025, w - 0.1, 0.05), H + 15, b.site.name, 'rgba(0,0,0,0)', P.night ? '#ff9a6a' : P.T(U.dark(g.acc, 0.2)));
      } else {
        A.box(ctx, x + 0.05, y + 0.05, w - 0.1, d - 0.1, H, 3, U.light(g.body, 0.3));
        const prev = ctx.globalAlpha;
        ctx.globalAlpha = prev * 0.92;
        const [sx, sy, rx] = dome(ctx, cx, cy, H + 3, Math.min(w, d) * 0.4, P.night ? '#ffe9b0' : '#d6efff', 0);
        ctx.globalAlpha = prev;
        ctx.strokeStyle = 'rgba(255,255,255,.8)';
        ctx.lineWidth = 0.7;
        for (let k = -2; k <= 2; k++) {
          ctx.beginPath();
          ctx.ellipse(sx, sy, Math.abs(k) * rx * 0.3 + 0.01, rx * 0.95, 0, Math.PI, Math.PI * 2);
          ctx.stroke();
        }
        facadeSign(ctx, P, fl, FH + 3, b.site.name, P.T('#ffffff'), P.T(U.dark(g.acc, 0.2)));
      }
    },

    academy(ctx, b, P, g) {
      const { x, y, w, d, H } = g;
      A.box(ctx, x - 0.04, y - 0.04, w + 0.08, d + 0.08, 0, 3, P.T('#eef0f7'));
      A.box(ctx, x, y, w, d, 3, H - 3, g.body);
      const fl = A.faceL(x, y, w, d), fr = A.faceR(x, y, w, d);
      const colTop = Math.min(H - 2, FH * 2);
      for (const f of [fl, fr]) {
        const n = Math.max(3, Math.round(f.len / 0.16));
        ctx.beginPath();
        for (let k = 0; k < n; k++) {
          const u = 0.05 + (k * (f.len - 0.1 - 0.04)) / (n - 1);
          quad(ctx, f, u, u + 0.04, 3, colTop);
        }
        ctx.fillStyle = f === fl ? P.T('#fbfdff') : P.T('#eef3fa');
        ctx.fill();
      }
      windows(ctx, P, fl, 0, b.floors, { start: 2, cols: Math.max(1, Math.round(w / 0.22)), wf: 0.4, hf: 0.62, face: 0 });
      windows(ctx, P, fr, 0, b.floors, { start: 2, cols: Math.max(1, Math.round(d / 0.22)), wf: 0.4, hf: 0.62, face: 1, day: '#eef4fb' });
      band(ctx, fl, H - 3, H, P.T('#fbfdff'));
      band(ctx, fr, H - 3, H, P.T('#eef3fa'));
      door(ctx, P, fl, w / 2 - 0.07, P.T(U.dark(g.acc, 0.15)), 0.14, 8);
      const cx = x + w / 2, cy = y + d / 2;
      const [sx, sy, rx] = dome(ctx, cx, cy, H, b.dr, P.T(b.roof === 'observatory' ? '#e9edf7' : U.light(g.acc, 0.3)), 7, P.T('#f6f8fd'));
      if (b.roof === 'observatory') {
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(sx - rx * 0.12, sy + rx * 0.02);
        ctx.lineTo(sx - rx * 0.12, sy - rx * 0.92);
        ctx.lineTo(sx + rx * 0.12, sy - rx * 0.92);
        ctx.lineTo(sx + rx * 0.12, sy + rx * 0.05);
        ctx.closePath();
        ctx.fillStyle = P.T('#7b74a6');
        ctx.fill();
        ctx.restore();
        ctx.save();
        ctx.translate(sx, sy - rx * 0.55);
        ctx.rotate(-0.75);
        rrect(ctx, -2, -3.2, rx * 0.95, 6.4, 2);
        ctx.fillStyle = P.T(U.light(g.acc, 0.2));
        ctx.fill();
        ctx.strokeStyle = U.rgba('#4a4270', 0.3);
        ctx.lineWidth = 0.6;
        ctx.stroke();
        ctx.restore();
      } else {
        line(ctx, [sx, sy - rx * 0.95], [sx, sy - rx * 0.95 - 8], P.T('#b9b0d6'), 1);
        ctx.beginPath();
        ctx.arc(sx, sy - rx * 0.95 - 8.5, 1.8, 0, Math.PI * 2);
        ctx.fillStyle = P.T('#ffd66e');
        ctx.fill();
      }
      if (b.landmark) facadeSign(ctx, P, fl, colTop + 1, b.site.name, P.T('#ffffff'), P.T(U.dark(g.acc, 0.3)));
    },

    civic(ctx, b, P, g) {
      const { x, y, w, d, H } = g;
      A.box(ctx, x, y, w, d, 0, H, g.body);
      const fl = A.faceL(x, y, w, d), fr = A.faceR(x, y, w, d);
      const midDoor = (k, c, cols, len) => k === 0 && Math.abs(0.09 + (c + 0.5) * ((len - 0.18) / cols) - len / 2) < 0.12;
      const cl = Math.max(1, Math.round(w / 0.2)), cr = Math.max(1, Math.round(d / 0.2));
      windows(ctx, P, fl, 0, b.floors, { cols: cl, wf: 0.5, hf: 0.55, face: 0, skip: (k, c) => midDoor(k, c, cl, w) });
      windows(ctx, P, fr, 0, b.floors, { cols: cr, wf: 0.5, hf: 0.55, face: 1, day: '#f0f6fd' });
      band(ctx, fl, H - 2.5, H, P.T('#fbfdf6'));
      band(ctx, fr, H - 2.5, H, P.T('#eef2e6'));
      if (b.floors > 2) {
        band(ctx, fl, FH - 1, FH + 0.6, P.T('#fbfdf6'));
        band(ctx, fr, FH - 1, FH + 0.6, P.T('#eef2e6'));
      }
      door(ctx, P, fl, w / 2 - 0.09, P.T('#b7c99a'), 0.18, 8);
      const cx = x + w / 2, cy = y + d / 2;
      if (b.roof === 'watertower') {
        const ti = x + w * 0.66, tj = y + d * 0.34;
        const [tx, ty] = iso(ti, tj, H);
        const legCol = P.T('#b9a48f');
        for (const dx of [-5, -2, 2, 5]) line(ctx, [tx + dx, ty + (Math.abs(dx) < 3 ? 1.5 : 0)], [tx + dx * 0.8, ty - 12], legCol, 0.9);
        const rx = 7.5, ry = 3.75, top = ty - 24, bot = ty - 12;
        const gr = ctx.createLinearGradient(tx - rx, 0, tx + rx, 0);
        gr.addColorStop(0, P.T('#f1dcc4'));
        gr.addColorStop(1, P.T('#cfb193'));
        ctx.beginPath();
        ctx.moveTo(tx - rx, top);
        ctx.lineTo(tx - rx, bot);
        ctx.ellipse(tx, bot, rx, ry, 0, Math.PI, 0, true);
        ctx.lineTo(tx + rx, top);
        ctx.ellipse(tx, top, rx, ry, 0, 0, Math.PI, true);
        ctx.fillStyle = gr;
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(tx - rx - 1, top);
        ctx.lineTo(tx, top - 7);
        ctx.lineTo(tx + rx + 1, top);
        ctx.ellipse(tx, top, rx + 1, ry + 0.5, 0, 0, Math.PI);
        ctx.fillStyle = P.T('#e9a7a0');
        ctx.fill();
      } else if (b.roof === 'hvac') {
        A.box(ctx, x + 0.12, y + 0.12, w * 0.32, d * 0.28, H, 5, P.T('#e9e6f0'));
        A.box(ctx, x + w * 0.55, y + d * 0.5, w * 0.3, d * 0.3, H, 4, P.T('#e1dde9'));
      } else if (b.roof === 'clocktower') {
        const c = b.ct;
        A.box(ctx, c.i - 0.05, c.j - 0.05, c.w + 0.1, c.d + 0.1, H, 4, U.light(g.body, 0.3));
        A.box(ctx, c.i, c.j, c.w, c.d, H + 4, c.h - 4, U.light(g.body, 0.12));
        for (const f of [A.faceL(c.i, c.j, c.w, c.d), A.faceR(c.i, c.j, c.w, c.d)]) {
          A.onFace(ctx, f, f.len / 2, H + c.h - 12, () => {
            ctx.beginPath();
            ctx.arc(0, 0, 7.2, 0, Math.PI * 2);
            ctx.fillStyle = P.night ? '#fff3c4' : '#ffffff';
            ctx.fill();
            ctx.strokeStyle = P.T(g.acc);
            ctx.lineWidth = 1.2;
            ctx.stroke();
            ctx.fillStyle = P.T('#8a82b0');
            for (let k = 0; k < 12; k++) {
              const a = (k / 12) * Math.PI * 2;
              ctx.fillRect(Math.cos(a) * 5.6 - 0.4, Math.sin(a) * 5.6 - 0.4, 0.8, 0.8);
            }
          });
        }
        pyramid(ctx, c.i - 0.04, c.j - 0.04, c.w + 0.08, c.d + 0.08, H + c.h, 24, P.T(U.light(g.acc, 0.1)));
      }
      if (b.landmark) facadeSign(ctx, P, fl, H - 13, b.site.name, P.T('#ffffff'), P.T(U.dark(g.acc, 0.3)));
    },

    arcade(ctx, b, P, g) {
      const { x, y, w, d, H } = g;
      A.box(ctx, x, y, w, d, 0, H, g.body);
      const fl = A.faceL(x, y, w, d), fr = A.faceR(x, y, w, d);
      windows(ctx, P, fl, 0, b.floors, { start: 1, cols: Math.max(2, Math.round(w / 0.13)), wf: 0.7, hf: 0.62, face: 0, candy: true });
      windows(ctx, P, fr, 0, b.floors, { start: 1, cols: Math.max(2, Math.round(d / 0.13)), wf: 0.7, hf: 0.62, face: 1, candy: true });
      band(ctx, fl, 0, 7, P.night ? '#c8f6ff' : P.T(U.dark(g.acc, 0.05)), 0.15, w - 0.15);
      // zigzag neon trim
      for (const f of [fl, fr]) {
        ctx.beginPath();
        let k = 0;
        for (let u = 0.02; u <= f.len - 0.02; u += 0.06, k++) {
          const p = fp(f, u, H - 3 + (k % 2 ? 1.5 : -1.5));
          k ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]);
        }
        ctx.strokeStyle = P.night ? '#ff9ee0' : '#ffffff';
        ctx.lineWidth = 1.1;
        ctx.stroke();
      }
      const cx = x + w / 2, cy = y + d / 2;
      A.box(ctx, cx - 0.09, cy - 0.09, 0.18, 0.18, H, 6, P.T('#efeaf7'));
      const [sx, sy] = iso(cx, cy, H + 6 + b.ballR);
      const ballCol = P.T(['#ff9ec4', '#ffd36e', '#8fdcff', '#b9a5ff'][b.seed % 4]);
      if (b.roof === 'planet') {
        ctx.beginPath();
        ctx.ellipse(sx, sy, b.ballR * 1.75, b.ballR * 0.5, -0.25, Math.PI, Math.PI * 2);
        ctx.strokeStyle = P.T('#ffe9a8');
        ctx.lineWidth = 3;
        ctx.stroke();
      }
      sphere(ctx, sx, sy, b.ballR, ballCol);
      if (b.roof === 'planet') {
        ctx.beginPath();
        ctx.ellipse(sx, sy, b.ballR * 1.75, b.ballR * 0.5, -0.25, 0, Math.PI);
        ctx.strokeStyle = P.T('#ffe9a8');
        ctx.lineWidth = 3;
        ctx.stroke();
        facadeSign(ctx, P, fl, FH + 2, b.site.name, P.T('#ffffff'), P.T(U.dark(g.acc, 0.3)));
      }
    },

    cottage(ctx, b, P, g) {
      const { x, y, w, d, H } = g;
      const wall = P.T(U.light(b.color, 0.25));
      A.box(ctx, x, y, w, d, 0, H, wall);
      const fl = A.faceL(x, y, w, d), fr = A.faceR(x, y, w, d);
      const dc = Math.max(1, Math.round(w / 0.3));
      windows(ctx, P, fl, 0, b.floors, { cols: dc, wf: 0.36, hf: 0.48, face: 0, frame: P.T('#c9b49a'), skip: (k, c) => k === 0 && Math.abs(0.09 + (c + 0.5) * ((w - 0.18) / dc) - w * 0.3) < 0.12 });
      windows(ctx, P, fr, 0, b.floors, { cols: Math.max(1, Math.round(d / 0.3)), wf: 0.36, hf: 0.48, face: 1, frame: P.T('#c9b49a'), day: '#f2f6fb' });
      door(ctx, P, fl, w * 0.3 - 0.06, P.T('#c79b7d'), 0.12, 7);
      const rc = P.T(ROOF_COLS[b.seed % ROOF_COLS.length]);
      const chimney = () => {
        const [ci, cj] = b.chim;
        A.box(ctx, ci - 0.05, cj - 0.05, 0.1, 0.1, H, b.gh * 0.85 + 6, P.T('#e8b4a0'));
      };
      if (b.roof === 'hip') {
        chimney();
        pyramid(ctx, x - 0.05, y - 0.05, w + 0.1, d + 0.1, H, b.gh + 6, rc);
      } else gable(ctx, x, y, w, d, H, b.gh, rc, wall, true, chimney);
      if (b.landmark) facadeSign(ctx, P, fr, H - 12, b.site.name, P.T('#ffffff'), P.T(U.dark(g.acc, 0.3)));
    },
  };

  // draws one building (both day and night variants)
  A.drawBuilding = function (ctx, b, night, s) {
    const T = night ? (c) => U.mix(c, U.NIGHT, 0.36) : (c) => c;
    const P = { night, s: s || 2, seed: b.seed, T };
    const g = { x: b.i0, y: b.j0, w: b.w, d: b.d, H: b.H, body: T(b.color), acc: T(b.accent) };
    (STYLES[b.style] || STYLES.cottage)(ctx, b, P, g);
    if (b.ivy) ivy(ctx, b);
    if (b.isNew) bunting(ctx, b);
  };

  // ---------- animated bits attached to buildings ----------
  A.drawFx = function (ctx, b, t, night) {
    for (const f of b.fx) {
      if (f.type === 'blink') {
        const on = Math.sin(t * 3 + b.seed) > 0.2;
        const [x, y] = iso(f.i, f.j, f.z);
        if (on) {
          ctx.beginPath();
          ctx.arc(x, y, 4.5, 0, Math.PI * 2);
          ctx.fillStyle = U.rgba(f.color, 0.25 + night * 0.25);
          ctx.fill();
        }
        ctx.beginPath();
        ctx.arc(x, y, 1.7, 0, Math.PI * 2);
        ctx.fillStyle = on ? f.color : U.dark(f.color, 0.3);
        ctx.fill();
      } else if (f.type === 'flag') {
        const [x, y] = iso(f.i, f.j, f.z);
        line(ctx, [x, y], [x, y - 16], night ? '#8d86b5' : '#a49bc8', 1);
        ctx.beginPath();
        ctx.moveTo(x, y - 16);
        for (let k = 0; k <= 6; k++) {
          const u = k / 6;
          ctx.lineTo(x + u * 11, y - 16 + Math.sin(t * 5 + u * 4 + b.seed) * 1.6 * u);
        }
        for (let k = 6; k >= 0; k--) {
          const u = k / 6;
          ctx.lineTo(x + u * 11, y - 10 + Math.sin(t * 5 + u * 4 + b.seed) * 1.6 * u);
        }
        ctx.closePath();
        ctx.fillStyle = U.nightTint(f.color, night);
        ctx.fill();
      } else if (f.type === 'clock') {
        const c = b.ct;
        const now = new Date();
        const hh = (now.getHours() % 12) + now.getMinutes() / 60, mm = now.getMinutes() + now.getSeconds() / 60;
        for (const fc of [A.faceL(c.i, c.j, c.w, c.d), A.faceR(c.i, c.j, c.w, c.d)]) {
          A.onFace(ctx, fc, fc.len / 2, b.H + c.h - 12, () => {
            ctx.strokeStyle = '#5b5394';
            ctx.lineCap = 'round';
            const ha = (hh / 12) * Math.PI * 2 - Math.PI / 2, ma = (mm / 60) * Math.PI * 2 - Math.PI / 2;
            ctx.lineWidth = 1.1;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(Math.cos(ha) * 3.4, Math.sin(ha) * 3.4);
            ctx.stroke();
            ctx.lineWidth = 0.7;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(Math.cos(ma) * 5, Math.sin(ma) * 5);
            ctx.stroke();
          });
        }
      } else if (f.type === 'marquee') {
        const fl = A.faceL(b.i0, b.j0, b.w, b.d);
        const mz = FH * 1.05 + 2.5;
        let k = 0;
        ctx.fillStyle = '#ffe680';
        ctx.beginPath();
        for (let u = 0.05; u < fl.len - 0.02; u += 0.075, k++) {
          if ((k + Math.floor(t * 6)) % 3) continue;
          const p = fp(fl, u, mz);
          ctx.moveTo(p[0] + 1.3, p[1]);
          ctx.arc(p[0], p[1], 1.3, 0, Math.PI * 2);
        }
        ctx.fill();
      }
    }
  };

  // ---------- trees ----------
  A.TREE_COLS = {
    round: ['#a8dc95', '#b8e3a0', '#9fd4a3', '#c3e6a1'],
    pine: ['#8fceaa', '#9ad6b0', '#86c4a4', '#a3dcb6'],
    blossom: ['#ffc1d6', '#ffb3cb', '#ffd0e0', '#f9bcd9'],
    bush: ['#a9dc9a', '#b6e2a2', '#9bd29c', '#c0e7a8'],
    tall: ['#a2d9a0', '#b0dea0', '#95cf9d', '#bce4a6'],
    palm: ['#9fdcb0', '#aee3b8', '#93d4a6', '#b9e8c0'],
  };
  A.TREE_BOX = [-16, -42, 32, 48]; // x, y, w, h around the root point
  // night is 0..1 (callers quantise it so sprites can be cached per level)
  A.drawTree = function (ctx, kind, ci, night) {
    const T = (c) => (night ? U.mix(c, U.NIGHT, 0.38 * night) : c);
    const col = T(A.TREE_COLS[kind][ci]);
    const trunk = T('#c9a184');
    ctx.beginPath();
    ctx.ellipse(1.5, 0.5, kind === 'bush' ? 8 : 9, 4.2, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(90,80,150,.16)';
    ctx.fill();
    const blob = (x, y, r, c) => {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = c;
      ctx.fill();
    };
    if (kind === 'pine') {
      ctx.fillStyle = trunk;
      ctx.fillRect(-1.2, -6, 2.4, 6);
      const tiers = [[-34, -21, 7], [-27, -13, 8.5], [-20, -5, 10]];
      for (const [ty, by, hw] of tiers) {
        fill(ctx, [[0, ty], [-hw, by], [0, by + 1.5]], U.light(col, 0.12));
        fill(ctx, [[0, ty], [hw, by], [0, by + 1.5]], U.dark(col, 0.1));
      }
    } else if (kind === 'tall') {
      ctx.fillStyle = trunk;
      ctx.fillRect(-1.2, -8, 2.4, 8);
      ctx.beginPath();
      ctx.ellipse(0.6, -18, 5.6, 13, 0, 0, Math.PI * 2);
      ctx.fillStyle = U.dark(col, 0.08);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(-0.8, -19.5, 4.4, 11.5, 0, 0, Math.PI * 2);
      ctx.fillStyle = col;
      ctx.fill();
      blob(-2, -24, 1.8, U.light(col, 0.35));
    } else if (kind === 'bush') {
      blob(2.5, -3.5, 5, U.dark(col, 0.08));
      blob(-2.5, -4, 5, col);
      blob(0.5, -7, 4.6, col);
      blob(-1.5, -8.2, 2, U.light(col, 0.35));
      if (ci % 2 === 0) {
        blob(3, -6, 0.9, T('#ffffff'));
        blob(-3.5, -5.5, 0.9, T('#ffd0e0'));
      }
    } else if (kind === 'palm') {
      ctx.beginPath();
      ctx.moveTo(-1.4, 0);
      ctx.quadraticCurveTo(-2, -12, 2.5, -24);
      ctx.lineTo(4, -24);
      ctx.quadraticCurveTo(0.6, -12, 1.4, 0);
      ctx.closePath();
      ctx.fillStyle = trunk;
      ctx.fill();
      for (let k = 0; k < 6; k++) {
        const a = -Math.PI / 2 + (k - 2.5) * 0.55;
        ctx.save();
        ctx.translate(3.2, -24);
        ctx.rotate(a + Math.PI / 2);
        ctx.beginPath();
        ctx.ellipse(0, -7, 2.4, 8, 0, 0, Math.PI * 2);
        ctx.fillStyle = k % 2 ? col : U.dark(col, 0.08);
        ctx.fill();
        ctx.restore();
      }
      blob(3.2, -24, 1.6, T('#c9a184'));
    } else {
      // round / blossom
      ctx.fillStyle = trunk;
      ctx.fillRect(-1.3, -9, 2.6, 9);
      blob(2.5, -12.5, 6.2, U.dark(col, 0.09));
      blob(-3.5, -12.5, 5.6, col);
      blob(0, -16, 7.4, col);
      blob(-2.4, -18.6, 3, U.light(col, 0.38));
      if (kind === 'blossom') {
        for (const [px, py] of [[3, -15], [-4, -11], [1, -20], [5, -11], [-1, -12]]) blob(px, py, 0.9, T('#ffffff'));
      }
    }
  };

  // ---------- vehicles & people ----------
  A.drawCar = function (ctx, c, night, k) {
    const L = c.big ? 0.62 : 0.36, W = c.big ? 0.22 : 0.2;
    const alongI = c.axis === 'i';
    const w = alongI ? L : W, d = alongI ? W : L;
    const x0 = c.i - w / 2, y0 = c.j - d / 2;
    const s = k == null ? 1 : k;
    if (s < 1) {
      ctx.save();
      const [px, py] = iso(c.i, c.j);
      ctx.translate(px, py);
      ctx.scale(s, s);
      ctx.translate(-px, -py);
    }
    if (night > 0.15) {
      const fx = alongI ? c.dir : 0, fy = alongI ? 0 : c.dir;
      const nose = [c.i + fx * L * 0.5, c.j + fy * L * 0.5];
      const pa = iso(nose[0], nose[1]);
      const tip = iso(nose[0] + fx * 0.9, nose[1] + fy * 0.9);
      const sideA = iso(nose[0] + fx * 0.9 - fy * 0.28, nose[1] + fy * 0.9 + fx * 0.28);
      const sideB = iso(nose[0] + fx * 0.9 + fy * 0.28, nose[1] + fy * 0.9 - fx * 0.28);
      const gr = ctx.createRadialGradient(pa[0], pa[1], 1, tip[0], tip[1], 40);
      gr.addColorStop(0, `rgba(255,236,170,${0.42 * night})`);
      gr.addColorStop(1, 'rgba(255,236,170,0)');
      ctx.beginPath();
      ctx.moveTo(pa[0], pa[1]);
      ctx.lineTo(sideA[0], sideA[1]);
      ctx.lineTo(sideB[0], sideB[1]);
      ctx.closePath();
      ctx.fillStyle = gr;
      ctx.fill();
    }
    fill(ctx, [iso(x0 - 0.02, y0 - 0.02), iso(x0 + w + 0.04, y0 - 0.02), iso(x0 + w + 0.04, y0 + d + 0.04), iso(x0 - 0.02, y0 + d + 0.04)], 'rgba(80,70,140,.16)');
    const col = U.nightTint(c.color, night);
    A.box(ctx, x0, y0, w, d, 1.2, c.big ? 8 : 4.6, col, { lw: 0.6 });
    if (!c.big) {
      const back = -c.dir * L * 0.08;
      const cw = alongI ? L * 0.52 : W * 0.86, cd = alongI ? W * 0.86 : L * 0.52;
      const cxx = c.i + (alongI ? back : 0) - cw / 2, cyy = c.j + (alongI ? 0 : back) - cd / 2;
      A.box(ctx, cxx, cyy, cw, cd, 5.8, 3.4, U.nightTint('#eef6ff', night), { top: U.nightTint(U.light(c.color, 0.35), night), lw: 0.5 });
    } else {
      const f = alongI ? A.faceL(x0, y0, w, d) : A.faceR(x0, y0, w, d);
      ctx.beginPath();
      for (let u = 0.05; u < f.len - 0.06; u += 0.11) quad(ctx, f, u, u + 0.08, 5.5, 8.4);
      ctx.fillStyle = night > 0.3 ? '#ffe28a' : '#f4faff';
      ctx.fill();
    }
    if (s < 1) ctx.restore();
  };

  A.drawPed = function (ctx, p, night, t, rain) {
    const [x, y] = iso(p.i, p.j);
    const bob = p.moving ? Math.abs(Math.sin(t * 9 + p.ph)) * 0.8 : 0;
    ctx.beginPath();
    ctx.ellipse(x, y, 2.4, 1.1, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(80,70,140,.18)';
    ctx.fill();
    const legA = p.moving ? Math.sin(t * 9 + p.ph) * 1.1 : 0;
    ctx.strokeStyle = U.nightTint('#8a7fa8', night);
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(x - 0.6, y - 3.5);
    ctx.lineTo(x - 0.6 + legA, y);
    ctx.moveTo(x + 0.6, y - 3.5);
    ctx.lineTo(x + 0.6 - legA, y);
    ctx.stroke();
    rrect(ctx, x - 1.7, y - 8.6 - bob, 3.4, 5.6, 1.4);
    ctx.fillStyle = U.nightTint(p.color, night);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y - 10.4 - bob, 1.75, 0, Math.PI * 2);
    ctx.fillStyle = U.nightTint(p.skin, night);
    ctx.fill();
    if (rain > 0.3 && p.umb) {
      const uy = y - 15.5 - bob;
      ctx.strokeStyle = U.nightTint('#8a7fa8', night);
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.moveTo(x + 0.6, uy);
      ctx.lineTo(x + 0.6, y - 8 - bob);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x - 5.5, uy + 1.2);
      ctx.quadraticCurveTo(x, uy - 5.5, x + 5.5, uy + 1.2);
      for (let k = 2; k >= 0; k--) ctx.quadraticCurveTo(x - 5.5 + (k + 0.5) * 3.67, uy - 0.2, x - 5.5 + k * 3.67, uy + 1.2);
      ctx.closePath();
      ctx.fillStyle = U.nightTint(p.umb, night);
      ctx.fill();
    }
    if (p.dog) {
      const dx = x - p.vx * 5, dy = y - p.vy * 2.5;
      ctx.beginPath();
      ctx.ellipse(dx, dy - 1.6, 1.8, 1.1, 0, 0, Math.PI * 2);
      ctx.fillStyle = U.nightTint('#d9b38c', night);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(dx + (p.vx >= 0 ? 1.6 : -1.6), dy - 2.4, 0.9, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  // one pre-rendered warm glow, reused for lamps and lamplight pools
  let glow = null;
  A.glow = function () {
    if (glow) return glow;
    glow = document.createElement('canvas');
    glow.width = glow.height = 64;
    const g = glow.getContext('2d');
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,236,170,1)');
    gr.addColorStop(0.45, 'rgba(255,232,165,.45)');
    gr.addColorStop(1, 'rgba(255,232,160,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 64, 64);
    return glow;
  };
  A.drawLamp = function (ctx, l, night) {
    const [x, y] = iso(l.i, l.j);
    if (night > 0.05) {
      ctx.globalAlpha = 0.6 * night;
      ctx.drawImage(A.glow(), x - 16, y - 34, 32, 32);
      ctx.globalAlpha = 1;
    }
    ctx.strokeStyle = U.nightTint('#a59cc7', night * 0.5);
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y - 16);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y - 18, 2.1, 0, Math.PI * 2);
    ctx.fillStyle = night > 0.2 ? '#fff1b8' : '#fffaf0';
    ctx.fill();
    ctx.strokeStyle = U.nightTint('#b8afd6', night * 0.5);
    ctx.lineWidth = 0.6;
    ctx.stroke();
  };

  // ---------- park amenities ----------
  A.drawAmenity = function (ctx, a, t, night, city) {
    const T = (c) => U.nightTint(c, night);
    const [x, y] = iso(a.i, a.j);
    if (a.type === 'fountain') {
      const rx = 34, ry = 17;
      ctx.beginPath();
      ctx.moveTo(x - rx, y - 5);
      ctx.lineTo(x - rx, y);
      ctx.ellipse(x, y, rx, ry, 0, Math.PI, 0, true);
      ctx.lineTo(x + rx, y - 5);
      ctx.ellipse(x, y - 5, rx, ry, 0, 0, Math.PI, true);
      ctx.fillStyle = T('#e7def0');
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(x, y - 5, rx, ry, 0, 0, Math.PI * 2);
      ctx.fillStyle = T('#f5f0fa');
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(x, y - 5, rx - 4, ry - 2.5, 0, 0, Math.PI * 2);
      ctx.fillStyle = T('#b5e3f5');
      ctx.fill();
      for (let k = 0; k < 3; k++) {
        const ph = (t * 0.5 + k / 3) % 1;
        ctx.beginPath();
        ctx.ellipse(x, y - 5, 6 + ph * 22, (6 + ph * 22) / 2, 0, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255,255,255,${0.7 * (1 - ph)})`;
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }
      ctx.fillStyle = T('#ece4f4');
      ctx.fillRect(x - 2.5, y - 20, 5, 15);
      ctx.beginPath();
      ctx.ellipse(x, y - 20, 11, 4.5, 0, 0, Math.PI * 2);
      ctx.fillStyle = T('#f6f1fb');
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(x, y - 20.5, 8.5, 3.2, 0, 0, Math.PI * 2);
      ctx.fillStyle = T('#c3ebf8');
      ctx.fill();
      ctx.fillStyle = T('#ece4f4');
      ctx.fillRect(x - 1.3, y - 29, 2.6, 9);
      ctx.beginPath();
      ctx.arc(x, y - 30, 2.6, 0, Math.PI * 2);
      ctx.fillStyle = T('#ffd0e0');
      ctx.fill();
    } else if (a.type === 'pond') {
      for (let k = 0; k < 4; k++) {
        const ph = t * 0.3 + k * 1.7;
        const px = x + Math.cos(ph) * 18, py = y + Math.sin(ph * 1.3) * 7;
        ctx.beginPath();
        ctx.moveTo(px - 4, py);
        ctx.lineTo(px + 4, py);
        ctx.strokeStyle = `rgba(255,255,255,${0.5 + 0.3 * Math.sin(t * 2 + k)})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      for (let k = 0; k < 2; k++) {
        const ang = t * 0.18 * (k ? -1 : 1) + k * 2.6;
        const di = a.i + Math.cos(ang) * 0.5, dj = a.j + Math.sin(ang) * 0.5;
        const [dx, dy] = iso(di, dj);
        const bob = Math.sin(t * 2 + k) * 0.5;
        const face = Math.cos(ang + Math.PI / 2) * (k ? -1 : 1) - Math.sin(ang + Math.PI / 2) * (k ? -1 : 1) > 0 ? 1 : -1;
        ctx.beginPath();
        ctx.ellipse(dx, dy - 1.5 + bob, 3.4, 2, 0, 0, Math.PI * 2);
        ctx.fillStyle = T(k ? '#fff7e0' : '#ffffff');
        ctx.fill();
        ctx.beginPath();
        ctx.arc(dx + face * 2.6, dy - 3.8 + bob, 1.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(dx + face * 3.8, dy - 3.9 + bob);
        ctx.lineTo(dx + face * 5.4, dy - 3.5 + bob);
        ctx.lineTo(dx + face * 3.8, dy - 3.2 + bob);
        ctx.fillStyle = T('#ffb070');
        ctx.fill();
      }
    } else if (a.type === 'ferris') {
      const hubZ = 46, R = 34;
      const [hx, hy] = iso(a.i, a.j, hubZ);
      const legs = T('#b7aed6');
      line(ctx, [x - 18, y + 6], [hx, hy], legs, 2);
      line(ctx, [x + 18, y + 6], [hx, hy], legs, 2);
      line(ctx, [x - 10, y + 10], [hx, hy], legs, 1.6);
      line(ctx, [x + 10, y + 10], [hx, hy], legs, 1.6);
      const rot = t * 0.18;
      ctx.beginPath();
      ctx.arc(hx, hy, R, 0, Math.PI * 2);
      ctx.strokeStyle = T('#f7a8c4');
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(hx, hy, R - 5, 0, Math.PI * 2);
      ctx.strokeStyle = T('#ffd3e2');
      ctx.lineWidth = 1;
      ctx.stroke();
      const n = 10;
      const C = ['#ff9ec4', '#8fdcff', '#ffe27a', '#b9a5ff', '#94efc0'];
      ctx.beginPath();
      for (let k = 0; k < n; k++) {
        const a2 = rot + (k / n) * Math.PI * 2;
        ctx.moveTo(hx, hy);
        ctx.lineTo(hx + Math.cos(a2) * R, hy + Math.sin(a2) * R);
      }
      ctx.strokeStyle = T('#e7def3');
      ctx.lineWidth = 0.8;
      ctx.stroke();
      for (let k = 0; k < n; k++) {
        const a2 = rot + (k / n) * Math.PI * 2;
        const cx = hx + Math.cos(a2) * R, cy = hy + Math.sin(a2) * R;
        line(ctx, [cx, cy], [cx, cy + 3], T('#b7aed6'), 0.7);
        rrect(ctx, cx - 3.2, cy + 3, 6.4, 5.2, 1.8);
        ctx.fillStyle = T(C[k % C.length]);
        ctx.fill();
        if (night > 0.3) {
          ctx.beginPath();
          ctx.arc(cx, cy, 1.3, 0, Math.PI * 2);
          ctx.fillStyle = '#fff1a8';
          ctx.fill();
        }
      }
      ctx.beginPath();
      ctx.arc(hx, hy, 3, 0, Math.PI * 2);
      ctx.fillStyle = T('#ffffff');
      ctx.fill();
    } else if (a.type === 'windmill') {
      const h = 46;
      const base = T('#fbf3e6');
      fill(ctx, [[x - 11, y], [x + 11, y], [x + 6.5, y - h], [x - 6.5, y - h]], base);
      fill(ctx, [[x, y + 2], [x + 11, y], [x + 6.5, y - h], [x, y - h]], T('#ede0cd'));
      rrect(ctx, x - 3, y - 8, 6, 8, 2.5);
      ctx.fillStyle = T('#c79b7d');
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x - 1, y - 26, 2, 0, Math.PI * 2);
      ctx.fillStyle = night > 0.3 ? '#ffe28a' : T('#cfe7f7');
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x - 8.5, y - h);
      ctx.quadraticCurveTo(x, y - h - 14, x + 8.5, y - h);
      ctx.closePath();
      ctx.fillStyle = T('#f2a9a0');
      ctx.fill();
      const hx = x - 2, hy = y - h + 2;
      const rot = t * 0.9;
      for (let k = 0; k < 4; k++) {
        const ang = rot + (k * Math.PI) / 2;
        ctx.save();
        ctx.translate(hx, hy);
        ctx.rotate(ang);
        fill(ctx, [[1.5, -1], [27, -2.5], [27, 3.5], [1.5, 1]], T('#fffaf3'));
        ctx.strokeStyle = T('#d8c6b0');
        ctx.lineWidth = 0.6;
        ctx.stroke();
        line(ctx, [0, 0], [28, 0], T('#c9b49a'), 1);
        ctx.restore();
      }
      ctx.beginPath();
      ctx.arc(hx, hy, 2.2, 0, Math.PI * 2);
      ctx.fillStyle = T('#c79b7d');
      ctx.fill();
    } else if (a.type === 'gazebo') {
      const rx = 22, ry = 11;
      ctx.beginPath();
      ctx.moveTo(x - rx, y - 3);
      ctx.lineTo(x - rx, y);
      ctx.ellipse(x, y, rx, ry, 0, Math.PI, 0, true);
      ctx.lineTo(x + rx, y - 3);
      ctx.ellipse(x, y - 3, rx, ry, 0, 0, Math.PI, true);
      ctx.fillStyle = T('#eadfcf');
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(x, y - 3, rx, ry, 0, 0, Math.PI * 2);
      ctx.fillStyle = T('#f8f1e7');
      ctx.fill();
      for (let k = 0; k < 6; k++) {
        const an = (k / 6) * Math.PI * 2 + 0.3;
        const px = x + Math.cos(an) * (rx - 3), py = y - 3 + Math.sin(an) * (ry - 1.5);
        line(ctx, [px, py], [px, py - 18], T('#ffffff'), 1.6);
      }
      ctx.beginPath();
      ctx.moveTo(x - rx - 3, y - 21);
      ctx.lineTo(x, y - 36);
      ctx.lineTo(x + rx + 3, y - 21);
      ctx.ellipse(x, y - 21, rx + 3, ry + 1.5, 0, 0, Math.PI);
      ctx.closePath();
      ctx.fillStyle = T('#c9b7ef');
      ctx.fill();
      fill(ctx, [[x, y - 36], [x + rx + 3, y - 21], [x, y - 21 + ry + 1.5]], T('#b7a3e6'));
      ctx.beginPath();
      ctx.arc(x, y - 37, 1.8, 0, Math.PI * 2);
      ctx.fillStyle = T('#ffd66e');
      ctx.fill();
    } else if (a.type === 'sign') {
      const by = y - 6;
      line(ctx, [x - 20, y], [x - 20, by - 18], T('#c9a184'), 2);
      line(ctx, [x + 20, y], [x + 20, by - 18], T('#c9a184'), 2);
      rrect(ctx, x - 30, by - 34, 60, 22, 6);
      ctx.fillStyle = T('#fffaf3');
      ctx.fill();
      ctx.strokeStyle = T('#f7a8c4');
      ctx.lineWidth = 1.6;
      ctx.stroke();
      ctx.textAlign = 'center';
      ctx.fillStyle = T('#5b5394');
      ctx.font = `700 7.5px ${FONT}`;
      ctx.fillText('BROWSER CITY', x, by - 23);
      ctx.font = `500 4.6px ${FONT}`;
      ctx.fillStyle = T('#8a82b0');
      ctx.fillText('pop. ' + U.fmt(city.ds.total) + ' visits', x, by - 16);
      ctx.textAlign = 'left';
      for (const fx of [-24, 24]) {
        ctx.beginPath();
        ctx.arc(x + fx, y - 1, 2.4, 0, Math.PI * 2);
        ctx.fillStyle = T('#ffb3cb');
        ctx.fill();
      }
    }
  };

  // ---------- sky things ----------
  A.drawCloud = function (ctx, c, x, y, alpha, night, rain = 0) {
    ctx.globalAlpha = alpha;
    let base = night > 0.5 ? '#e7e2fb' : '#ffffff';
    if (rain > 0.02) base = U.mix(base, '#aaa6c6', Math.round(rain * 10) / 14);
    for (const b of c.blobs) {
      ctx.beginPath();
      ctx.arc(x + b[0], y + b[1] + 2, b[2], 0, Math.PI * 2);
      ctx.fillStyle = U.mix(base, '#c9c3ea', 0.4);
      ctx.fill();
    }
    for (const b of c.blobs) {
      ctx.beginPath();
      ctx.arc(x + b[0], y + b[1], b[2], 0, Math.PI * 2);
      ctx.fillStyle = base;
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  };
  A.drawBalloon = function (ctx, x, y, t, night) {
    const T = (c) => U.nightTint(c, night);
    const sway = Math.sin(t * 0.7) * 2;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(sway * 0.01);
    const C = ['#ffb3cb', '#fff3c4', '#b9e3ff', '#d9c8ff', '#c7f0d8'];
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(0, 22);
    ctx.bezierCurveTo(-22, 6, -18, -20, 0, -20);
    ctx.bezierCurveTo(18, -20, 22, 6, 0, 22);
    ctx.closePath();
    ctx.clip();
    for (let k = 0; k < 5; k++) {
      ctx.fillStyle = T(C[k]);
      ctx.fillRect(-20 + k * 8, -22, 8, 46);
    }
    ctx.fillStyle = 'rgba(255,255,255,.3)';
    ctx.beginPath();
    ctx.ellipse(-7, -8, 4, 8, 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = T('#b9a78f');
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(-6, 18);
    ctx.lineTo(-4, 29);
    ctx.moveTo(6, 18);
    ctx.lineTo(4, 29);
    ctx.stroke();
    rrect(ctx, -5, 29, 10, 6, 1.5);
    ctx.fillStyle = T('#d7b48f');
    ctx.fill();
    ctx.restore();
  };
  A.drawBird = function (ctx, x, y, flap, night) {
    const f = Math.sin(flap) * 2.6;
    ctx.beginPath();
    ctx.moveTo(x - 4.5, y - f);
    ctx.quadraticCurveTo(x - 2, y - 1.5, x, y);
    ctx.quadraticCurveTo(x + 2, y - 1.5, x + 4.5, y - f);
    ctx.strokeStyle = night > 0.5 ? '#ece8ff' : '#8c84b3';
    ctx.lineWidth = 1;
    ctx.stroke();
  };

  const PCOLS = { heart: '#ff8fb1', note: '#a58bf0', paper: '#ffffff', coin: '#ffd25e', star: '#ffd66e', mail: '#ffffff', pixel: '#5fd3c7', leaf: '#9fd58c', code: '#3fae8c' };
  A.drawParticle = function (ctx, p, k = 1) {
    const [x, y] = iso(p.i, p.j, p.z);
    const a = Math.min(1, p.life * 2, (p.max - p.life) * 4);
    ctx.globalAlpha = Math.max(0, a);
    const col = p.color || PCOLS[p.kind] || '#ffffff';
    switch (p.kind) {
      case 'puff': {
        const r = 2 + (p.max - p.life) * 3.2;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,.75)';
        ctx.fill();
        break;
      }
      case 'drop':
        ctx.beginPath();
        ctx.arc(x, y, 1.1, 0, Math.PI * 2);
        ctx.fillStyle = '#d6f2ff';
        ctx.fill();
        break;
      case 'dust': {
        const r = 1.5 + (p.max - p.life) * 6;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(240,226,206,.8)';
        ctx.fill();
        break;
      }
      case 'heart':
        heart(ctx, x, y, 3.2);
        ctx.fillStyle = col;
        ctx.fill();
        break;
      case 'note':
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.ellipse(x, y, 1.8, 1.3, -0.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(x + 1.2, y - 6, 0.9, 6);
        ctx.fillRect(x + 1.2, y - 6, 3, 1.1);
        break;
      case 'paper':
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(Math.sin(p.ph + p.life * 3) * 0.6);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-2.5, -3, 5, 6);
        ctx.fillStyle = '#c9c2df';
        ctx.fillRect(-1.6, -1.8, 3.2, 0.6);
        ctx.fillRect(-1.6, -0.4, 3.2, 0.6);
        ctx.fillRect(-1.6, 1, 2, 0.6);
        ctx.restore();
        break;
      case 'coin':
        ctx.beginPath();
        ctx.ellipse(x, y, Math.abs(Math.cos(p.life * 6)) * 2.6 + 0.4, 2.6, 0, 0, Math.PI * 2);
        ctx.fillStyle = col;
        ctx.fill();
        ctx.strokeStyle = '#e9b53f';
        ctx.lineWidth = 0.6;
        ctx.stroke();
        break;
      case 'star':
        star(ctx, x, y, 3.2, 1.4, 5, p.life);
        ctx.fillStyle = col;
        ctx.fill();
        break;
      case 'mail':
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x - 3, y - 2, 6, 4);
        ctx.strokeStyle = '#9fc46c';
        ctx.lineWidth = 0.6;
        ctx.strokeRect(x - 3, y - 2, 6, 4);
        ctx.beginPath();
        ctx.moveTo(x - 3, y - 2);
        ctx.lineTo(x, y + 0.5);
        ctx.lineTo(x + 3, y - 2);
        ctx.stroke();
        break;
      case 'pixel':
        ctx.fillStyle = ['#ff9ec4', '#8fdcff', '#ffe27a', '#b9a5ff'][p.seed % 4];
        ctx.fillRect(x - 1.8, y - 1.8, 3.6, 3.6);
        break;
      case 'leaf':
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(p.ph + p.life * 2);
        ctx.beginPath();
        ctx.ellipse(0, 0, 2.8, 1.3, 0, 0, Math.PI * 2);
        ctx.fillStyle = col;
        ctx.fill();
        ctx.restore();
        break;
      case 'code':
        ctx.font = `700 5px ${FONT}`;
        ctx.fillStyle = col;
        ctx.textAlign = 'center';
        ctx.fillText(p.seed % 2 ? '</>' : '{ }', x, y);
        ctx.textAlign = 'left';
        break;
      case 'rocket':
        ctx.globalAlpha = 1;
        ctx.strokeStyle = 'rgba(255,240,200,.7)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - p.vi * 6, y + 9);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x, y, 1.6, 0, Math.PI * 2);
        ctx.fillStyle = '#fff7d6';
        ctx.fill();
        break;
      case 'flash': {
        const fr = (60 - 30 * (p.life / p.max)) * k;
        const fg = ctx.createRadialGradient(x, y, 0, x, y, fr);
        fg.addColorStop(0, 'rgba(255,255,255,.9)');
        fg.addColorStop(0.35, U.rgba(col, 0.45));
        fg.addColorStop(1, U.rgba(col, 0));
        ctx.globalAlpha = Math.max(0, p.life / p.max);
        ctx.fillStyle = fg;
        ctx.fillRect(x - fr, y - fr, fr * 2, fr * 2);
        break;
      }
      case 'fw': {
        const r = (1.5 + p.life * 0.7) * k;
        ctx.strokeStyle = U.rgba(col, 0.45);
        ctx.lineWidth = r * 0.8;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - p.vi * 32 * 0.12 + p.vj * 32 * 0.12, y - (p.vi + p.vj) * 16 * 0.12 + p.vz * 0.12);
        ctx.stroke();
        ctx.globalAlpha = Math.min(1, p.life * 1.4) * (0.75 + 0.25 * Math.sin(p.life * 40 + p.seed));
        ctx.beginPath();
        ctx.arc(x, y, r * 2.4, 0, Math.PI * 2);
        ctx.fillStyle = U.rgba(col, 0.25);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = col;
        ctx.fill();
        break;
      }
      case 'spark':
        star(ctx, x, y, 3, 0.9, 4, 0);
        ctx.fillStyle = '#fff3b0';
        ctx.fill();
        break;
    }
    ctx.globalAlpha = 1;
  };
})();
