/* Browser City — everything outside the canvas: cards, search, tour, replay, importer, input. */
(function () {
  const U = BC.util, R = BC.render, A = BC.art, iso = U.iso;
  const UI = (BC.ui = {});
  const $ = (id) => document.getElementById(id);
  const st = R.state;
  const esc = U.esc;
  let city = null, canvas = null;
  let toastTimer = 0;
  let tour = null;
  let clockDragging = false;

  const MOOD = (h) =>
    h < 5 ? 'deep night' : h < 7 ? 'dawn' : h < 11 ? 'morning' : h < 14 ? 'midday' : h < 17 ? 'afternoon' : h < 19.2 ? 'golden hour' : h < 21 ? 'dusk' : 'night';
  const HOUR_PERSONA = (h) =>
    h >= 5 && h < 9 ? 'a morning ritual' : h < 12 && h >= 9 ? 'a mid-morning habit' : h >= 12 && h < 14 ? 'a lunch-break hangout' : h >= 14 && h < 18 ? 'an afternoon haunt' : h >= 18 && h < 22 ? 'an evening spot' : 'a night-owl hideout';
  const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  UI.init = function (cv) {
    canvas = cv;
    bindPointer();
    bindHud();
    bindKeys();
    bindDrop();
  };

  UI.onCity = function (c) {
    city = c;
    const ds = c.ds;
    $('signSub').textContent = `pop. ${U.fmt(ds.total)} visits · ${c.buildings.length} buildings`;
    const chips = $('districtChips');
    chips.innerHTML = '';
    Object.values(c.districts)
      .sort((a, b) => b.visits - a.visits)
      .forEach((d) => {
        const D = BC.DISTRICTS[d.key];
        const b = document.createElement('button');
        b.className = 'chip';
        b.innerHTML = `<i style="background:${D.color}"></i>${esc(D.name)} <small>${d.buildings.length}</small>`;
        b.title = `${D.short}: ${U.fmt(d.visits)} visits`;
        b.addEventListener('mouseenter', () => (st.focusDistrict = d.key));
        b.addEventListener('mouseleave', () => (st.focusDistrict = null));
        b.addEventListener('click', () => UI.openDistrict(d.key, true));
        chips.appendChild(b);
      });
    drawClockSpark();
    closeCard();
    endTour();
    $('search').value = '';
    $('searchList').classList.remove('open');
    $('btnReplay').disabled = !ds.hasTime;
    $('btnReplay').style.opacity = ds.hasTime ? '' : '.5';
  };

  // ---------- toast ----------
  UI.toast = function (html, ms = 4200) {
    const t = $('toast');
    t.innerHTML = html;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), ms);
  };

  // ---------- clock ----------
  function drawClockSpark() {
    const ch = city.ds.cityHours || new Array(24).fill(1);
    const mx = Math.max(1, ...ch);
    const W = 240, H = 40;
    let d = `M0 ${H}`;
    for (let h = 0; h <= 24; h++) {
      const v = (ch[h % 24] || 0) / mx;
      d += ` L${(h / 24) * W} ${H - 4 - v * 30}`;
    }
    d += ` L${W} ${H} Z`;
    $('clockSpark').innerHTML = `
      <defs><linearGradient id="dayg" x1="0" x2="1">
        <stop offset="0" stop-color="#c9c0f0"/><stop offset=".25" stop-color="#ffd9c4"/>
        <stop offset=".5" stop-color="#cfe7fb"/><stop offset=".76" stop-color="#ffc6d6"/><stop offset="1" stop-color="#c9c0f0"/>
      </linearGradient></defs>
      <path d="${d}" fill="rgba(155,127,230,.16)" stroke="rgba(155,127,230,.45)" stroke-width="1.2" vector-effect="non-scaling-stroke"/>
      <rect x="0" y="17" width="${W}" height="6" rx="3" fill="url(#dayg)"/>`;
  }
  function updateClock() {
    const h = st.hour;
    if (!clockDragging) $('clockRange').value = h.toFixed(2);
    $('clockTime').textContent = U.clockLabel(h);
    const busy = st.activity > 0.7 ? ' · busy streets' : st.activity < 0.22 ? ' · quiet streets' : '';
    const sky = st.rain > 0.35 ? ' · rainy' : st.rainbow > 0.35 ? ' · rainbow!' : busy;
    $('clockMood').textContent = MOOD(h) + sky;
    $('clock').classList.toggle('paused', !st.playing);
    $('clock').classList.toggle('night', st.night > 0.5);
    $('clockPlay').setAttribute('aria-label', st.playing ? 'Pause time' : 'Let time flow');
  }

  // ---------- cards ----------
  function cardOffsets() {
    if (window.innerWidth > 760) {
      R.offsetX = 0;
      R.offsetX = (384 + 18) / 2;
      R.offsetY = 0;
    } else {
      R.offsetX = 0;
      R.offsetY = window.innerHeight * 0.3;
    }
  }
  function openCard(html, after) {
    const body = $('cardBody');
    body.innerHTML = html;
    body.scrollTop = 0;
    $('card').classList.add('open');
    $('card').setAttribute('aria-hidden', 'false');
    if (after) requestAnimationFrame(() => after(body));
  }
  function closeCard() {
    $('card').classList.remove('open');
    $('card').setAttribute('aria-hidden', 'true');
    st.selected = null;
    R.offsetX = 0;
    R.offsetY = 0;
  }
  UI.closeCard = closeCard;

  function peakOf(hours) {
    let p = 0;
    for (let h = 1; h < 24; h++) if (hours[h] > hours[p]) p = h;
    return p;
  }
  function dialSVG(hours, D) {
    const mx = Math.max(1, ...hours), peak = peakOf(hours);
    const cx = 62, cy = 62, r0 = 23, L = 30;
    let s = `<svg width="124" height="124" viewBox="0 0 124 124" role="img" aria-label="Visits by hour of day, busiest at ${U.hourLabel(peak)}">`;
    s += `<path d="M${cx + 58} ${cy} A58 58 0 0 1 ${cx - 58} ${cy}Z" fill="#fff5d9"/>`;
    s += `<path d="M${cx - 58} ${cy} A58 58 0 0 1 ${cx + 58} ${cy}Z" fill="#eee9fc"/>`;
    for (let h = 0; h < 24; h++) {
      const a = ((h + 0.5) / 24) * Math.PI * 2 - Math.PI / 2;
      const len = 2 + (hours[h] / mx) * L;
      const x1 = cx + Math.cos(a) * r0, y1 = cy + Math.sin(a) * r0;
      const x2 = cx + Math.cos(a) * (r0 + len), y2 = cy + Math.sin(a) * (r0 + len);
      const col = h === peak ? D.accent : U.mix(D.color, D.accent, 0.35);
      s += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${col}" stroke-width="4" stroke-linecap="round"/>`;
    }
    s += `<circle cx="${cx}" cy="${cy}" r="19" fill="#fff"/>`;
    s += `<text x="${cx}" y="${cy + 1}" text-anchor="middle" font-family="Fredoka, sans-serif" font-weight="600" font-size="13" fill="#3d3a5c">${U.hourLabel(peak)}</text>`;
    s += `<text x="${cx}" y="${cy + 12}" text-anchor="middle" font-family="Nunito, sans-serif" font-weight="700" font-size="7.5" fill="#9a95b8">PEAK</text>`;
    s += `<circle cx="${cx}" cy="${cy + 55}" r="3.5" fill="#ffd66e"/>`;
    s += `<path d="M${cx + 2} ${cy - 59}a4 4 0 1 0 0 7a3 3 0 1 1 0-7z" fill="#b9a5ff"/>`;
    return s + '</svg>';
  }
  function weekHTML(wd, D) {
    const mx = Math.max(1, ...wd);
    return `<div class="week">${wd
      .map((v, k) => {
        const s = 7 + (v / mx) * 17;
        return `<div title="${DAY_NAMES[k]}: ${U.fmt(v)} visits"><i style="width:${s}px;height:${s}px;background:${v === mx ? D.accent : D.color}"></i><span>${DAYS[k]}</span></div>`;
      })
      .join('')}</div>`;
  }
  function dayIndex(t) {
    return Math.floor((t - new Date(t).getTimezoneOffset() * 60000) / 864e5);
  }
  function sparkHTML(site, D) {
    const ds = city.ds;
    const d0 = dayIndex(ds.t0), d1 = dayIndex(ds.t1);
    const nB = Math.max(2, Math.ceil((d1 - d0 + 1) / 7));
    const vals = new Array(nB).fill(0);
    for (const [d, c] of site.days) vals[U.clamp(Math.floor((d - d0) / 7), 0, nB - 1)] += c;
    const mx = Math.max(1, ...vals);
    const W = 320, H = 58;
    let p = `M0 ${H}`;
    vals.forEach((v, k) => (p += ` L${((k / (nB - 1)) * W).toFixed(1)} ${(H - 3 - (v / mx) * (H - 8)).toFixed(1)}`));
    const line = p.replace(`M0 ${H} L`, 'M');
    p += ` L${W} ${H} Z`;
    return `<svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" preserveAspectRatio="none" role="img" aria-label="Weekly visits over time">
      <path d="${p}" fill="${U.rgba(D.color, 0.75)}"/><path d="${line}" fill="none" stroke="${D.accent}" stroke-width="2" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg>
      <div class="spark-legend"><span>${U.dateLabel(ds.t0)}</span><span>${U.dateLabel(ds.t1)}</span></div>`;
  }
  function flavorFor(b) {
    const s = b.site, ds = city.ds;
    const lines = [];
    if (ds.hasTime) {
      const peak = peakOf(s.hours);
      const tot = s.visits || 1;
      const nightShare = [22, 23, 0, 1, 2, 3, 4].reduce((a, h) => a + s.hours[h], 0) / tot;
      const wkend = (s.wd[5] + s.wd[6]) / tot;
      const span = Math.max(1, dayIndex(ds.t1) - dayIndex(ds.t0) + 1);
      const active = s.days.length;
      if (b.isNew) lines.push(`Freshly built! The paint is still drying. You first knocked ${U.ago(s.first)}.`);
      if (b.ivy) lines.push(`Ivy is creeping up the walls. Nobody's been by since ${U.ago(s.last)}.`);
      if (active / span > 0.7) lines.push(`Open ${active} of the last ${span} days. The doorman knows you by name.`);
      if (nightShare > 0.35) lines.push(`After dark it glows like a lantern. ${Math.round(nightShare * 100)}% of your visits happen past 10pm.`);
      if (wkend > 0.45) lines.push(`A weekend hideaway: ${Math.round(wkend * 100)}% of visits land on Saturdays and Sundays.`);
      if (peak >= 5 && peak < 9) lines.push('The first door you open most mornings, before the kettle has boiled.');
      if (!lines.length) {
        const wd = s.wd.indexOf(Math.max(...s.wd));
        lines.push(`Busiest on ${DAY_NAMES[wd]}s, when the queue goes round the block.`);
      }
    }
    if (b.mega) lines.unshift('You can see this one from every corner of town. It basically is the skyline.');
    else if (b.landmark && lines.length < 2) lines.push('One of the tallest roofs in the neighbourhood. Pigeons fight over it.');
    if (s.domain === 'localhost') lines.unshift('Your own garage, where half-finished things get built at odd hours.');
    if (!lines.length) lines.push('A quiet little place. You pop in now and then.');
    return lines.slice(0, 2).join(' ');
  }

  UI.openBuilding = function (b, fly = true) {
    endTour();
    const s = b.site, D = BC.DISTRICTS[b.cat], ds = city.ds;
    st.selected = b;
    if (!st.dayMode) BC.sim.knock(b);
    BC.sound.pop();
    const pct = (s.visits / Math.max(1, ds.total)) * 100;
    const next = ds.transitions.filter((t) => t[0] === s.domain && city.byDomain.has(t[1])).slice(0, 5);
    const titles = s.titles || [];
    const href = s.domain === 'localhost' ? 'http://localhost' : /^\d+\.\d+\.\d+\.\d+$/.test(s.domain) ? '' : 'https://' + s.domain;
    const ribbons = [];
    if (b.landmark) ribbons.push(`<span class="ribbon">${b.mega ? 'Grand landmark' : 'Landmark'}</span>`);
    if (b.isNew) ribbons.push('<span class="ribbon ribbon-new">New in town</span>');
    if (b.ivy) ribbons.push('<span class="ribbon ribbon-ivy">Gone quiet</span>');
    const floorName = (i) => (i === 0 && b.floors >= 3 ? 'Penthouse' : b.floors - i >= 1 ? 'Floor ' + (b.floors - i) : 'Basement');
    let html = `
      <div class="card-art" style="--d:${D.color};--a:${D.accent}"><canvas aria-hidden="true"></canvas>${ribbons.join('')}</div>
      <div class="card-inner">
        <button class="kicker" data-district="${b.cat}"><i style="background:${D.color}"></i>${esc(D.name)}</button>
        <h2>${esc(b.title)}</h2>
        ${href ? `<a class="domain" href="${href}" target="_blank" rel="noopener noreferrer">${esc(s.domain)} ↗</a>` : `<span class="domain">${esc(s.domain)}</span>`}
        <p class="lede">You've walked through these doors <b>${U.fmt(s.visits)}</b> ${s.visits === 1 ? 'time' : 'times'}. That's enough habit to stack <b>${b.floors}</b> ${b.floors === 1 ? 'floor' : 'floors'}.</p>
        <div class="facts">
          <div><span>#${b.rank + 1}</span><small>in town</small></div>
          <div><span>${pct >= 1 ? pct.toFixed(1) : pct.toFixed(2)}%</span><small>of all visits</small></div>
          <div><span>${ds.hasTime ? U.fmt(s.days.length) : '—'}</span><small>days visited</small></div>
        </div>`;
    if (ds.hasTime) {
      const peak = peakOf(s.hours);
      html += `<section><h3>When the lights are on</h3>
        <div class="dial-row">${dialSVG(s.hours, D)}
        <p>Busiest around <b>${U.hourLabel(peak)}</b>, ${HOUR_PERSONA(peak)}.<br><br>First visit <b>${U.dateLabel(s.first)}</b><br>Last seen <b>${U.ago(s.last)}</b></p></div>
        ${weekHTML(s.wd, D)}</section>`;
      if (ds.t1 - ds.t0 > 14 * 864e5) html += `<section><h3>Its story so far</h3>${sparkHTML(s, D)}</section>`;
    }
    if (titles.length) {
      html += `<section><h3>Building directory</h3><ol class="directory">${titles
        .slice(0, 6)
        .map((t, i) => `<li><span class="floor">${floorName(i)}</span><span class="room" title="${esc(t[0])}">${esc(t[0])}</span><span class="count">×${U.fmt(t[1])}</span></li>`)
        .join('')}</ol></section>`;
    }
    if (next.length) {
      html += `<section><h3>Where visitors head next</h3><div class="hops">${next
        .map((t) => {
          const nb = city.byDomain.get(t[1]);
          return `<button class="hop" data-domain="${esc(t[1])}"><i style="background:${BC.DISTRICTS[nb.cat].color}"></i>${esc(nb.site.name)} <small>${U.fmt(t[2])} trips</small></button>`;
        })
        .join('')}</div>
        <button class="btn btn-small btn-primary ride-btn" data-act="ride" data-from="${esc(s.domain)}" data-to="${esc(next[0][1])}">
          <svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 16V11l2-4h10l2 4v5"/><path d="M3 16h18v2H3z"/><circle cx="7.5" cy="18.5" r="1.5"/><circle cx="16.5" cy="18.5" r="1.5"/></svg>
          Ride to ${esc(city.byDomain.get(next[0][1]).site.name)}
        </button></section>`;
    }
    html += `<blockquote class="flavor">${esc(flavorFor(b))}</blockquote></div>`;
    openCard(html, (body) => paintArt(body.querySelector('.card-art canvas'), [b]));
    if (fly) {
      cardOffsets();
      R.flyTo(b.top[0], b.top[1], b.H * 0.45, Math.max(R.cam.z, R.fitZ * 2.3));
    }
  };

  UI.openDistrict = function (key, fly = true) {
    endTour();
    const d = city.districts[key];
    if (!d) return;
    const D = BC.DISTRICTS[key], ds = city.ds;
    st.selected = null;
    const share = (d.visits / Math.max(1, ds.total)) * 100;
    const hours = new Array(24).fill(0);
    for (const b of d.buildings) b.site.hours.forEach((v, h) => (hours[h] += v));
    const top = d.buildings.slice(0, 8);
    const mx = top.length ? top[0].site.visits : 1;
    let html = `
      <div class="card-art" style="--d:${D.color};--a:${D.accent}"><canvas aria-hidden="true"></canvas><span class="ribbon">Neighbourhood</span></div>
      <div class="card-inner">
        <span class="kicker"><i style="background:${D.color}"></i>${esc(D.short)}</span>
        <h2>${esc(D.name)}</h2>
        <p class="lede">${esc(D.blurb)}</p>
        <div class="facts">
          <div><span>${d.buildings.length}</span><small>buildings</small></div>
          <div><span>${U.fmt(d.visits)}</span><small>visits</small></div>
          <div><span>${share.toFixed(share < 10 ? 1 : 0)}%</span><small>of the town</small></div>
        </div>`;
    if (ds.hasTime) {
      const peak = peakOf(hours);
      html += `<section><h3>Rush hour</h3><div class="dial-row">${dialSVG(hours, D)}<p>The streets here are busiest around <b>${U.hourLabel(peak)}</b>. Out of hours it's ${hours[peak] > 0 && hours[(peak + 12) % 24] / hours[peak] < 0.15 ? 'a ghost town' : 'still ticking over'}.</p></div></section>`;
    }
    html += `<section><h3>Tallest roofs</h3><div class="rows">${top
      .map(
        (b) => `<button class="row" data-domain="${esc(b.site.domain)}"><b>${esc(b.site.name)}</b><small>${U.fmt(b.site.visits)}</small><span class="bar"><i style="width:${Math.max(4, (b.site.visits / mx) * 100)}%;background:${D.accent}"></i></span></button>`
      )
      .join('')}</div></section></div>`;
    openCard(html, (body) => paintArt(body.querySelector('.card-art canvas'), top.slice(0, 5)));
    if (fly) {
      cardOffsets();
      R.flyTo(d.ci, d.cj, 20, R.fitZ * 1.7);
    }
  };

  UI.openOverview = function () {
    endTour();
    const ds = city.ds;
    st.selected = null;
    const bs = city.ranked;
    const dist = Object.values(city.districts).sort((a, b) => b.visits - a.visits);
    const dom = dist[0] ? BC.DISTRICTS[dist[0].key] : BC.DISTRICTS.misc;
    const ch = ds.cityHours || [];
    const tot = ds.total || 1;
    const nightShare = [22, 23, 0, 1, 2, 3, 4].reduce((a, h) => a + (ch[h] || 0), 0) / tot;
    const morningShare = [5, 6, 7, 8, 9].reduce((a, h) => a + (ch[h] || 0), 0) / tot;
    const officeShare = [9, 10, 11, 12, 13, 14, 15, 16, 17].reduce((a, h) => a + (ch[h] || 0), 0) / tot;
    let clause = 'awake at all sorts of hours';
    if (ds.hasTime) {
      if (nightShare > 0.25) clause = 'where the lights burn latest after 10pm';
      else if (morningShare > 0.25) clause = 'that wakes up with the sun';
      else if (officeShare > 0.6) clause = 'that hums along from nine to five';
    } else clause = 'still working out what time it is';
    const peak = ds.hasTime ? peakOf(ch) : -1;
    let quiet = 0;
    if (ds.hasTime) for (let h = 1; h < 24; h++) if (ch[h] < ch[quiet]) quiet = h;
    const busiest = ds.transitions.find((t) => city.byDomain.has(t[0]) && city.byDomain.has(t[1]));
    const newest = ds.hasTime ? bs.filter((b) => b.isNew).sort((a, b) => b.site.visits - a.site.visits)[0] : null;
    const faded = ds.hasTime ? bs.filter((b) => b.ivy).sort((a, b) => b.site.visits - a.site.visits)[0] : null;
    const link = (b) => `<button data-domain="${esc(b.site.domain)}">${esc(b.site.name)}</button>`;
    const rec = (bg, ico, text) => `<div class="record"><span class="ri" style="background:${bg}">${ico}</span><p>${text}</p></div>`;
    const recs = [];
    if (bs[0]) recs.push(rec('#ffe7f0', '🏙️', `Most-visited landmark: ${link(bs[0])}, ${bs[0].floors} floors and ${U.fmt(bs[0].site.visits)} visits.`));
    if (busiest) recs.push(rec('#e9f1ff', '🚗', `Busiest road: ${link(city.byDomain.get(busiest[0]))} → ${link(city.byDomain.get(busiest[1]))}, ${U.fmt(busiest[2])} trips.`));
    if (peak >= 0) recs.push(rec('#fff3d6', '⏰', `Rush hour is <b>${U.hourLabel(peak)}</b>. The quietest hour is <b>${U.hourLabel(quiet)}</b>. ${Math.round(nightShare * 100)}% of all visits happen after 10pm.`));
    if (newest) recs.push(rec('#fff7d1', '🎈', `Newest arrival: ${link(newest)}, first visited ${U.ago(newest.site.first)}.`));
    if (faded) recs.push(rec('#e6f5dc', '🌿', `Gone quiet: ${link(faded)}. Ivy has been growing since ${U.ago(faded.site.last)}.`));
    if (ds.hasTime && R.nightMap) {
      const storms = [...R.nightMap.values()].filter((v) => v >= R.stormThresh).length;
      let wx = `<b>${storms}</b> stormy ${storms === 1 ? 'night' : 'nights'} on record (nights you stayed online long past your usual bedtime).`;
      if (R.stormy(R.liveDay)) wx += ' Last night was one of them, so expect rain this evening.';
      if (R.stormy(R.liveDay - 1)) wx += ' The night before too, so watch for a rainbow in the morning.';
      recs.push(rec('#e6f0ff', '🌦️', wx));
    }
    if (R.peakHour != null) recs.push(rec('#fff0f5', '🎆', `Every day at <b>${U.hourLabel(R.peakHour)}</b>, your busiest hour, the town sets off fireworks. <button data-act="fw">Light them now</button>`));
    if (city.longTail) recs.push(rec('#e8f6e3', '🌲', `The Whispering Woods hold <b>${U.fmt(city.longTail)}</b> sites you only visited once, one tree each.`));
    const shareBar = dist.map((d) => `<i style="width:${(d.visits / tot) * 100}%;background:${BC.DISTRICTS[d.key].color}" title="${esc(BC.DISTRICTS[d.key].name)}"></i>`).join('');
    const legend = dist.map((d) => `<span><i style="background:${BC.DISTRICTS[d.key].color}"></i>${esc(BC.DISTRICTS[d.key].name)} ${Math.round((d.visits / tot) * 100)}%</span>`).join('');
    const span = ds.hasTime ? `${U.dateLabel(ds.t0)} – ${U.dateLabel(ds.t1)}` : 'no dates';
    const html = `
      <div class="card-art" style="--d:#ffd8e5;--a:#ef7fa3"><canvas aria-hidden="true"></canvas><span class="ribbon">Town hall records</span></div>
      <div class="card-inner">
        <span class="kicker"><i style="background:linear-gradient(135deg,#bfe8d6,#d9c8ff,#ffc8d9)"></i>${esc(ds.label || 'Browser City')}</span>
        <h2>Browser City is ${esc(dom.persona)}, ${esc(clause)}.</h2>
        <div class="facts" style="margin-top:14px">
          <div><span>${U.fmt(ds.total)}</span><small>visits</small></div>
          <div><span>${bs.length}</span><small>buildings</small></div>
          <div><span>${dist.length}</span><small>neighbourhoods</small></div>
        </div>
        <section><h3>Who lives here</h3><div class="sharebar">${shareBar}</div><div class="legend">${legend}</div></section>
        <section><h3>Town records</h3>${recs.join('')}</section>
        <p class="source">Built from ${esc(ds.source === 'demo' ? 'an invented history (demo)' : ds.source)} · ${esc(span)}</p>
        <div class="card-actions">
          ${ds.source === 'demo' ? '<button class="btn btn-primary btn-small" data-act="build">Build mine from my history</button>' : '<button class="btn btn-small" data-act="demo">Visit the demo town</button><button class="btn btn-small" data-act="build">Import again</button>'}
          ${ds.hasTime ? '<button class="btn btn-small" data-act="replay">Watch it grow</button>' : ''}
        </div>
      </div>`;
    openCard(html, (body) => paintArt(body.querySelector('.card-art canvas'), bs.slice(0, 7)));
    cardOffsets();
    R.offsetX = R.offsetX;
    R.flyTo(city.N / 2, city.N / 2, 0, R.fitZ * 1.05);
  };

  // little diorama of one or more buildings for a card header
  function paintArt(cv, list) {
    if (!cv || !list.length) return;
    const rect = cv.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(rect.width * dpr);
    cv.height = Math.round(rect.height * dpr);
    const ctx = cv.getContext('2d');
    // arrange tallest in the middle
    const sorted = list.slice().sort((a, b) => b.H + b.roofH - (a.H + a.roofH));
    const row = [];
    sorted.forEach((b, k) => (k % 2 ? row.unshift(b) : row.push(b)));
    const items = [];
    let x = 0, minY = 0;
    for (const b of row) {
      const plateL = iso(b.lotI, b.lotJ + b.n)[0], plateR = iso(b.lotI + b.n, b.lotJ)[0];
      const bottom = iso(b.lotI + b.n, b.lotJ + b.n)[1];
      const w = plateR - plateL;
      const top = b.by0 - bottom;
      items.push({ b, dx: x - plateL, dy: -bottom, w });
      minY = Math.min(minY, top);
      x += w * (row.length > 1 ? 0.78 : 1);
    }
    const totalW = x + (row.length > 1 ? items[items.length - 1].w * 0.22 : 0);
    const totalH = -minY + 6;
    const s = Math.min((rect.width * 0.86) / totalW, (rect.height * 0.8) / totalH, 3);
    ctx.setTransform(dpr * s, 0, 0, dpr * s, dpr * (rect.width - totalW * s) / 2, dpr * (rect.height - 14));
    for (const it of items) {
      const b = it.b;
      ctx.save();
      ctx.translate(it.dx, it.dy);
      const g = BC.DISTRICTS[b.cat].ground;
      A.box(ctx, b.lotI, b.lotJ, b.n, b.n, -6, 9, '#f6f3fa', { top: '#f6f3fa', left: '#e4def0', right: '#d6cfe6', line: false });
      const ins = 0.12;
      A.fill(ctx, [iso(b.lotI + ins, b.lotJ + ins, 3), iso(b.lotI + b.n - ins, b.lotJ + ins, 3), iso(b.lotI + b.n - ins, b.lotJ + b.n - ins, 3), iso(b.lotI + ins, b.lotJ + b.n - ins, 3)], g);
      ctx.translate(0, -3);
      A.drawBuilding(ctx, b, false, s * dpr);
      ctx.restore();
    }
  }

  // ---------- search ----------
  let searchSel = 0, searchHits = [];
  function runSearch() {
    const q = $('search').value.trim().toLowerCase();
    const list = $('searchList');
    if (!q) {
      list.classList.remove('open');
      return;
    }
    searchHits = city.buildings.filter((b) => b.site.domain.includes(q) || b.site.name.toLowerCase().includes(q) || b.title.toLowerCase().includes(q)).slice(0, 8);
    searchSel = 0;
    if (!searchHits.length) {
      const inWoods = city.ds.sites.some((s) => s.domain.includes(q));
      list.innerHTML = `<li class="empty">${inWoods ? 'That one lives as a tree in the Whispering Woods (visited too rarely to get a building).' : 'No building by that name. Yet.'}</li>`;
    } else {
      list.innerHTML = searchHits
        .map(
          (b, k) =>
            `<li role="option" data-k="${k}" aria-selected="${k === 0}"><span class="dot" style="background:${BC.DISTRICTS[b.cat].color}"></span><span class="nm">${esc(b.site.name)}<small>${esc(b.site.domain)}</small></span><span class="vs">${U.fmt(b.site.visits)}</span></li>`
        )
        .join('');
    }
    list.classList.add('open');
  }
  function chooseSearch(k) {
    const b = searchHits[k];
    if (!b) return;
    $('searchList').classList.remove('open');
    $('search').blur();
    UI.openBuilding(b, true);
  }

  // ---------- tour ----------
  function startTour() {
    if (st.replay) return;
    closeCard();
    const stops = Object.values(city.districts)
      .sort((a, b) => b.visits - a.visits)
      .slice(0, 8)
      .map((d) => d.buildings[0])
      .filter(Boolean)
      .map((b) => ({ b }));
    if (city.plaza) stops.push({ plaza: true });
    tour = { i: 0, stops, t: 0 };
    $('tourCap').hidden = false;
    document.body.classList.add('touring');
    goStop(0);
  }
  function goStop(i) {
    if (!tour) return;
    tour.i = U.clamp(i, 0, tour.stops.length - 1);
    tour.t = 0;
    const s = tour.stops[tour.i];
    R.offsetX = 0;
    R.offsetY = window.innerWidth <= 760 ? window.innerHeight * 0.16 : 90;
    $('tcStep').textContent = `Stop ${tour.i + 1} of ${tour.stops.length}`;
    if (s.plaza) {
      st.selected = null;
      R.flyTo(city.plaza.i0 + 1.5, city.plaza.j0 + 1.5, 0, R.fitZ * 1.25);
      $('tcTitle').textContent = 'Town Square';
      $('tcText').innerHTML = `And that's the tour! <b>${U.fmt(city.ds.total)}</b> visits built this town, one click at a time. Hop off anywhere and knock on a door.`;
      $('tcNext').textContent = 'Finish';
    } else {
      const b = s.b, D = BC.DISTRICTS[b.cat];
      st.selected = b;
      R.flyTo(b.top[0], b.top[1], b.H * 0.4, R.fitZ * 2.4);
      $('tcTitle').textContent = b.title;
      const peak = city.ds.hasTime ? ` Busiest around ${U.hourLabel(peakOf(b.site.hours))}.` : '';
      $('tcText').innerHTML = `The pride of <b>${esc(D.name)}</b>: ${U.fmt(b.site.visits)} visits.${esc(peak)} ${esc(flavorFor(b).split('. ')[0])}${flavorFor(b).includes('. ') ? '.' : ''}`;
      $('tcNext').textContent = 'Next stop ›';
    }
    $('tcPrev').disabled = tour.i === 0;
  }
  function endTour() {
    if (!tour) return;
    tour = null;
    $('tourCap').hidden = true;
    document.body.classList.remove('touring');
    st.selected = null;
    R.offsetX = R.offsetY = 0;
  }

  // ---------- replay ----------
  function startReplay() {
    if (!city.ds.hasTime) {
      UI.toast('This history has no timestamps, so there is nothing to replay.');
      return;
    }
    endTour();
    closeCard();
    const ok = R.startReplay(() => {
      $('replayBar').hidden = true;
      UI.toast('And that is how your city grew.');
    });
    if (!ok) {
      UI.toast('Not enough days of history to replay yet.');
      return;
    }
    $('replayBar').hidden = false;
    R.home();
  }
  function updateReplayBar() {
    const rp = st.replay;
    if (!rp) return;
    const t = Math.round(rp.day) * 864e5 + new Date().getTimezoneOffset() * 60000;
    const n = Math.round(rp.day - rp.d0) + 1, N = rp.d1 - rp.d0 + 1;
    $('rbDate').innerHTML = `<small>day ${n} of ${N}</small>${U.dateLabel(t)}`;
    $('rbFill').style.width = (rp.p || 0) * 100 + '%';
    $('rbStats').textContent = `${rp.count} buildings · ${U.fmt(rp.visits)} visits so far`;
  }

  // ---------- postcard ----------
  function postcard() {
    const src = R.snapshot();
    const PW = 1800, PH = 1200, m = 56;
    const c = document.createElement('canvas');
    c.width = PW;
    c.height = PH;
    const g = c.getContext('2d');
    g.fillStyle = '#fffaf1';
    g.fillRect(0, 0, PW, PH);
    const phW = PW - 2 * m, phH = PH - 2 * m - 210;
    g.save();
    A.rrect(g, m, m, phW, phH, 26);
    g.clip();
    const sr = src.width / src.height, dr = phW / phH;
    let sw, sh, sx, sy;
    if (sr > dr) {
      sh = src.height;
      sw = sh * dr;
      sx = (src.width - sw) / 2;
      sy = 0;
    } else {
      sw = src.width;
      sh = sw / dr;
      sx = 0;
      sy = (src.height - sh) / 2;
    }
    g.drawImage(src, sx, sy, sw, sh, m, m, phW, phH);
    g.restore();
    A.rrect(g, m, m, phW, phH, 26);
    g.strokeStyle = '#ffffff';
    g.lineWidth = 10;
    g.stroke();
    const by = PH - 150;
    g.fillStyle = '#a58fb8';
    g.font = '700 58px Caveat, cursive';
    g.fillText('Greetings from', m + 8, by - 18);
    const word = 'BROWSER CITY';
    const cols = ['#ef7fa3', '#9b7fe6', '#4fb592', '#d9a93a', '#ee915a', '#5c9fe0', '#86b04a', '#36b7ab'];
    g.font = '700 112px Fredoka, sans-serif';
    let x = m + 4;
    [...word].forEach((ch, k) => {
      g.save();
      g.translate(x, by + 92);
      g.rotate(Math.sin(k * 1.7) * 0.05);
      g.fillStyle = '#ffffff';
      g.fillText(ch, 5, 5);
      g.fillStyle = cols[k % cols.length];
      g.fillText(ch, 0, 0);
      g.restore();
      x += g.measureText(ch).width + (ch === ' ' ? 4 : 6);
    });
    g.fillStyle = '#6e6a8f';
    g.font = '700 30px Nunito, sans-serif';
    g.fillText(`${U.fmt(city.ds.total)} visits · ${city.buildings.length} buildings · ${Object.keys(city.districts).length} neighbourhoods`, x + 40, by + 70);
    // stamp
    const sx0 = PW - m - 210, sy0 = PH - m - 196;
    g.save();
    g.translate(sx0 + 100, sy0 + 98);
    g.rotate(0.05);
    g.fillStyle = '#ffffff';
    g.fillRect(-100, -98, 200, 196);
    g.fillStyle = '#fffaf1';
    for (let k = 0; k <= 10; k++) {
      for (const [ax, ay] of [[-100 + k * 20, -98], [-100 + k * 20, 98], [-100, -98 + k * 19.6], [100, -98 + k * 19.6]]) {
        g.beginPath();
        g.arc(ax, ay, 6, 0, Math.PI * 2);
        g.fill();
      }
    }
    const grd = g.createLinearGradient(0, -80, 0, 80);
    grd.addColorStop(0, '#d9ecff');
    grd.addColorStop(1, '#ffe3ec');
    g.fillStyle = grd;
    g.fillRect(-84, -82, 168, 164);
    const tall = city.ranked.slice(0, 5);
    tall.forEach((b, k) => {
      const h = 30 + (b.floors / Math.max(1, tall[0].floors)) * 70;
      g.fillStyle = BC.DISTRICTS[b.cat].color;
      g.fillRect(-70 + k * 28, 50 - h, 24, h);
      g.fillStyle = 'rgba(255,255,255,.7)';
      for (let y = 50 - h + 8; y < 44; y += 10) g.fillRect(-65 + k * 28, y, 14, 4);
    });
    g.fillStyle = '#9fd58c';
    g.fillRect(-84, 50, 168, 32);
    g.fillStyle = '#5b5394';
    g.font = '700 22px Fredoka, sans-serif';
    g.textAlign = 'center';
    g.fillText(U.fmt(city.ds.total), 0, 74);
    g.restore();
    // postmark
    g.save();
    g.translate(sx0 - 60, sy0 + 70);
    g.strokeStyle = 'rgba(155,127,230,.55)';
    g.lineWidth = 4;
    g.beginPath();
    g.arc(0, 0, 62, 0, Math.PI * 2);
    g.stroke();
    g.beginPath();
    g.arc(0, 0, 50, 0, Math.PI * 2);
    g.stroke();
    g.fillStyle = 'rgba(155,127,230,.7)';
    g.font = '700 17px Nunito, sans-serif';
    g.textAlign = 'center';
    g.fillText(U.dateLabel(Date.now()).toUpperCase(), 0, 6);
    for (let k = 0; k < 4; k++) {
      g.beginPath();
      for (let q = 0; q <= 40; q++) {
        const xx = 70 + q * 6, yy = -30 + k * 20 + Math.sin(q * 0.6) * 5;
        q ? g.lineTo(xx, yy) : g.moveTo(xx, yy);
      }
      g.stroke();
    }
    g.restore();
    c.toBlob((blob) => {
      if (!blob) return UI.toast('Could not make the postcard, sorry.');
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'browser-city-postcard.png';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      UI.toast('Postcard saved. Wish you were here!');
    }, 'image/png');
  }

  // ---------- modals ----------
  const LOCK = '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';
  function showModal(html, clear) {
    $('modalCard').classList.remove('narrow');
    if (!html.includes('class="guide"')) {
      guideStep = -1;
      clearGlow();
    }
    $('modalCard').innerHTML = html;
    $('modal').hidden = false;
    $('modal').classList.toggle('clear', !!clear);
  }
  function hideModal() {
    $('modal').hidden = true;
    $('modalCard').classList.remove('narrow');
    guideStep = -1;
    clearGlow();
  }
  UI.hideModal = hideModal;

  // ---------- quick guide (shown on start) ----------
  const GUIDE_KEY = 'browser-city:guide-off';
  const guideOff = () => {
    try {
      return localStorage.getItem(GUIDE_KEY) === '1';
    } catch (e) {
      return false;
    }
  };
  const ART = {
    look: '<svg viewBox="0 0 64 64"><path d="M32 14 48 22 32 30 16 22z" fill="#d2f0e4"/><path d="M16 22v18l16 8V30z" fill="#bfe8d6"/><path d="M48 22v18l-16 8V30z" fill="#9fd3bf"/><path d="M20 28l7 3.5M20 34l7 3.5M37 31.5l7-3.5M37 37.5l7-3.5" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/><circle cx="46" cy="44" r="8" fill="#fff" stroke="#9b7fe6" stroke-width="3"/><path d="m52 50 6 6" stroke="#9b7fe6" stroke-width="3.4" stroke-linecap="round"/></svg>',
    car: '<svg viewBox="0 0 64 64"><path d="M6 38 36 23 58 34 28 49z" fill="#e3dfed"/><path d="M14 38l20-10 12 6-20 10z" fill="#ffd8e5"/><path d="M14 38v6l12 6v-6z" fill="#ffc8d9"/><path d="M46 34v6l-20 10v-6z" fill="#f4a9c2"/><path d="M22 36l9-4.5 6 3-9 4.5z" fill="#f4faff"/><ellipse cx="30" cy="42" rx="22" ry="11" fill="none" stroke="#ef7fa3" stroke-width="2.4" stroke-dasharray="5 4"/></svg>',
    time: '<svg viewBox="0 0 64 64"><circle cx="24" cy="26" r="11" fill="#ffe7a3"/><path d="M24 9v4M24 39v4M7 26h4M37 26h4M12 14l3 3M33 35l3 3M12 38l3-3M33 17l3-3" stroke="#f2c35b" stroke-width="2.4" stroke-linecap="round"/><path d="M52 18a9 9 0 1 0 6 15 10 10 0 0 1-6-15z" fill="#b9a5ff"/><path d="M14 52a18 18 0 0 1 36 0" fill="none" stroke="#ffb3c6" stroke-width="3"/><path d="M19 52a13 13 0 0 1 26 0" fill="none" stroke="#bfe0ff" stroke-width="3"/><path d="M46 40q-3 5 0 7 3-2 0-7z" fill="#7fb6f2"/></svg>',
    day: '<svg viewBox="0 0 64 64"><rect x="10" y="14" width="44" height="40" rx="9" fill="#fff" stroke="#c9b9f2" stroke-width="2.5"/><path d="M10 25h44" stroke="#c9b9f2" stroke-width="2.5"/><path d="M21 9v9M43 9v9" stroke="#9b7fe6" stroke-width="3" stroke-linecap="round"/><g fill="#e7defb"><rect x="16" y="31" width="7" height="7" rx="2"/><rect x="28" y="31" width="7" height="7" rx="2" fill="#9b7fe6"/><rect x="40" y="31" width="7" height="7" rx="2"/><rect x="16" y="42" width="7" height="7" rx="2" fill="#c9b9f2"/><rect x="28" y="42" width="7" height="7" rx="2"/><rect x="40" y="42" width="7" height="7" rx="2" fill="#b59ef0"/></g><path d="M31.5 27q-3 4 0 6 3-2 0-6z" fill="#7fb6f2"/></svg>',
    sound: '<svg viewBox="0 0 64 64"><path d="M12 26v12h9l12 9V17l-12 9z" fill="#ffe7a3" stroke="#e0b34f" stroke-width="2" stroke-linejoin="round"/><path d="M40 25a10 10 0 0 1 0 14M45 19a18 18 0 0 1 0 26" fill="none" stroke="#9b7fe6" stroke-width="3" stroke-linecap="round"/><path d="M49 11q3-3 6 0 3-3 6 0" fill="none" stroke="#8c84b3" stroke-width="2" stroke-linecap="round"/></svg>',
    build: '<svg viewBox="0 0 64 64"><path d="M32 8 54 19 32 30 10 19z" fill="#ffd8e5"/><path d="M10 19v22l22 11V30z" fill="#ffc8d9"/><path d="M54 19v22L32 52V30z" fill="#f4a9c2"/><path d="M32 44V20M24 27l8-8 8 8" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  };
  const kbd = (k) => `<kbd class="gk">${k}</kbd>`;
  const GUIDE = [
    { hero: true },
    {
      art: 'look', kicker: 'Getting around', title: 'Look around town',
      items: [
        `<b>Drag</b> to wander, <b>scroll</b> or pinch to zoom, double-click to zoom in.`,
        `<b>Click any building</b> for its story: your busiest hours, favourite pages, and where you usually go next. Someone even knocks on the door.`,
        `Click a <b>neighbourhood</b> name or chip to visit it, the <b>welcome sign</b> for town records, or press ${kbd('/')} to search.`,
      ],
      glow: ['searchBox', 'districtChips', 'townSign'],
    },
    {
      art: 'car', kicker: 'Traffic', title: 'Every car is a real hop',
      items: [
        `Cars drive between sites you <b>actually visited back to back</b>. Busy routes get more traffic.`,
        `<b>Hover</b> a car and it waits for you. <b>Click</b> it to ride along to its destination.`,
        `Or open a building and press <b>“Ride to …”</b> to hop in a car to your usual next stop.`,
      ],
    },
    {
      art: 'time', kicker: 'Time & weather', title: 'The town keeps your hours',
      items: [
        `The <b>clock</b> at the bottom runs the day. Drag it, or pause it. Streets fill up at the hours you browse most.`,
        `Stayed up late? It <b>rains</b> that evening, and a <b>rainbow</b> shows up the morning after.`,
        `At your busiest hour the town sets off <b>fireworks</b>. After dark, fireflies come out in the woods.`,
      ],
      glow: ['clock'],
    },
    {
      art: 'day', kicker: 'Stories', title: 'A day in your life',
      items: [
        `<b>A day</b>: pick any day from the calendar and watch it play out visit by visit, with a pin following you around town.`,
        `<b>Replay</b>: watch the whole city grow from your first visit to today.`,
        `<b>Tour</b> takes the bus past your biggest landmarks. <b>Postcard</b> saves a picture of the view.`,
      ],
      glow: ['btnDay', 'btnReplay', 'btnTour', 'btnPostcard'],
    },
    {
      art: 'sound', kicker: 'Sound', title: 'Turn the town up',
      items: [
        `Sound is <b>off</b> until you press the speaker button at the bottom right.`,
        `Birdsong by day, crickets at night, rain, door knocks, fireworks, and traffic that hums louder at your busy hours.`,
        `Everything is made live in your browser. No audio files.`,
      ],
      glow: ['soundBtn'],
    },
    {
      art: 'build', kicker: 'Make it yours', title: 'Build your own city',
      items: [
        `You're looking at an <b>invented demo town</b>. Press <b>Build my city</b> to use your own history.`,
        `Drop in your browser's history file (Chrome, Edge, Brave, Firefox or Safari), a Google Takeout export, or just paste a list of links. The importer shows you where to find it.`,
        `${LOCK} It's all read inside this tab. <b>Nothing is uploaded</b>, and you can forget your city any time.`,
      ],
      glow: ['btnBuild'],
      last: true,
    },
  ];
  let guideStep = -1;
  function clearGlow() {
    document.querySelectorAll('.guide-glow').forEach((el) => el.classList.remove('guide-glow'));
  }
  function heroHTML() {
    const word = 'Browser City';
    const cols = ['#ef7fa3', '#9b7fe6', '#4fb592', '#d9a93a', '#ee915a', '#5c9fe0', '#86b04a', '#36b7ab'];
    const h1 = [...word].map((ch, k) => (ch === ' ' ? ' ' : `<span style="color:${cols[k % cols.length]};animation-delay:${k * 0.12}s">${ch}</span>`)).join('');
    return `<div class="intro">
        <div class="hand">a tiny town built from your tabs</div>
        <h1>${h1}</h1>
        <p class="lead">Every website you visit leaves a little footprint. Here those footprints become a town you can wander.</p>
        <div class="legendary">
          <div><svg viewBox="0 0 46 40"><path d="M23 6 35 12 23 18 11 12z" fill="#d2f0e4"/><path d="M11 12v16l12 6V18z" fill="#bfe8d6"/><path d="M35 12v16l-12 6V18z" fill="#9fd3bf"/><path d="M14 17l5 2.5M14 22l5 2.5M27 19.5l5-2.5M27 24.5l5-2.5" stroke="#fff" stroke-width="2" stroke-linecap="round"/></svg><b>Sites</b>become buildings</div>
          <div><svg viewBox="0 0 46 40"><path d="M14 16 22 20 14 24 6 20z" fill="#e5d9ff"/><path d="M6 20v10l8 4V24z" fill="#d9c8ff"/><path d="M22 20v10l-8 4V24z" fill="#c3aef2"/><path d="M31 4 39 8 31 12 23 8z" fill="#ffd8e5"/><path d="M23 8v22l8 4V12z" fill="#ffc8d9"/><path d="M39 8v22l-8 4V12z" fill="#f4a9c2"/><path d="M41 22V6M38 9l3-3 3 3" stroke="#9b7fe6" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg><b>Visits</b>make them taller</div>
          <div><svg viewBox="0 0 46 40"><path d="M12 14l7 4-7 4-7-4z" fill="#ffd8e5"/><path d="M5 18v7l7 4v-7z" fill="#ffc8d9"/><path d="M19 18v7l-7 4v-7z" fill="#f4a9c2"/><path d="M33 12l7 4-7 4-7-4z" fill="#fff0c4"/><path d="M26 16v9l7 4v-9z" fill="#ffe7a3"/><path d="M40 16v9l-7 4v-9z" fill="#ecd07c"/><path d="M23 22l7 4-7 4-7-4z" fill="#d2e8ff"/><path d="M16 26v5l7 4v-5z" fill="#bfe0ff"/><path d="M30 26v5l-7 4v-5z" fill="#9fc8ef"/></svg><b>Interests</b>form neighbourhoods</div>
          <div><svg viewBox="0 0 46 40"><path d="M6 24 26 14 40 21 20 31z" fill="#e3dfed"/><path d="M16 20l10-5 7 3.5-10 5z" fill="#ffd8e5"/><path d="M16 20v4l7 3.5v-4z" fill="#ffc8d9"/><path d="M33 18.5v4l-10 5v-4z" fill="#f4a9c2"/><path d="M20 19l5-2.5 3.5 1.7-5 2.5z" fill="#f4faff"/><path d="M9 26l4-2M30 16l4-2" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/></svg><b>Tab hops</b>become traffic</div>
        </div>
        <div class="privacy">${LOCK} Your history never leaves this tab. No servers, no uploads.</div>
      </div>`;
  }
  function renderGuide() {
    const g = GUIDE[guideStep];
    clearGlow();
    (g.glow || []).forEach((id) => $(id) && $(id).classList.add('guide-glow'));
    const mine = city && city.ds.source !== 'demo';
    const items = (g.items || []).slice();
    if (g.last && mine) items[0] = `This is <b>your city</b>, built from your own history. Press <b>Build my city</b> any time to import a fresher copy.`;
    const body = g.hero
      ? heroHTML()
      : `<div class="gstep">
          <div class="gart">${ART[g.art]}</div>
          <div class="gkick">${g.kicker}</div>
          <h2>${g.title}</h2>
          <ul>${items.map((it) => `<li>${it}</li>`).join('')}</ul>
        </div>`;
    const dots = GUIDE.map((_, k) => `<button class="gdot${k === guideStep ? ' on' : ''}" data-gstep="${k}" aria-label="Step ${k + 1}"></button>`).join('');
    const nav = g.last
      ? `<button class="btn btn-small" data-act="guide-demo">${mine ? 'Explore my city' : 'Wander the demo town'}</button><button class="btn btn-small btn-primary" data-act="build">Build my city →</button>`
      : `${guideStep > 0 ? '<button class="btn btn-small btn-ghost" data-gstep="' + (guideStep - 1) + '">Back</button>' : ''}<button class="btn btn-small btn-primary" data-gstep="${guideStep + 1}">${guideStep === 0 ? 'Show me around →' : 'Next →'}</button>`;
    showModal(
      `<div class="guide">
        <button class="gskip" data-act="guide-skip">Skip guide</button>
        <div class="gbody" key="${guideStep}">${body}</div>
        <div class="gnav"><div class="gdots">${dots}</div><div class="gbtns">${nav}</div></div>
        <label class="gnever"><input type="checkbox" id="guideNever" ${guideOff() ? 'checked' : ''}> Don't show this when the page opens</label>
      </div>`,
      true
    );
    $('modalCard').classList.add('narrow');
    $('guideNever').addEventListener('change', (e) => {
      try {
        if (e.target.checked) localStorage.setItem(GUIDE_KEY, '1');
        else localStorage.removeItem(GUIDE_KEY);
      } catch (err) {}
    });
  }
  UI.showGuide = function (step = 0) {
    endTour();
    guideStep = U.clamp(step, 0, GUIDE.length - 1);
    renderGuide();
  };
  UI.guideStep = (d) => {
    if (guideStep < 0 || $('modal').hidden) return false;
    const n = guideStep + d;
    if (n < 0 || n >= GUIDE.length) return true;
    UI.showGuide(n);
    return true;
  };
  UI.guideOff = guideOff;
  UI.showIntro = () => UI.showGuide(0);
  $('modalCard').addEventListener('click', (e) => {
    const t = e.target.closest('[data-gstep]');
    if (t) UI.showGuide(+t.dataset.gstep);
  });

  const PLATFORM = /Win/i.test(navigator.userAgent) ? 'Windows' : /Mac/i.test(navigator.userAgent) ? 'macOS' : 'Linux';
  const HOWTO = {
    chrome: {
      label: 'Chrome',
      paths: {
        Windows: '%LOCALAPPDATA%\\Google\\Chrome\\User Data\\Default\\History',
        macOS: '~/Library/Application Support/Google/Chrome/Default/History',
        Linux: '~/.config/google-chrome/Default/History',
      },
      tip: 'The file is just called <b>History</b>, with no extension. Chrome locks it while running, so copy it somewhere (like your Desktop) and drop the copy.',
    },
    edge: {
      label: 'Edge',
      paths: {
        Windows: '%LOCALAPPDATA%\\Microsoft\\Edge\\User Data\\Default\\History',
        macOS: '~/Library/Application Support/Microsoft Edge/Default/History',
        Linux: '~/.config/microsoft-edge/Default/History',
      },
      tip: 'Same format as Chrome. Copy the <b>History</b> file first, since Edge keeps it locked.',
    },
    brave: {
      label: 'Brave / Arc',
      paths: {
        Windows: '%LOCALAPPDATA%\\BraveSoftware\\Brave-Browser\\User Data\\Default\\History',
        macOS: '~/Library/Application Support/BraveSoftware/Brave-Browser/Default/History',
        Linux: '~/.config/BraveSoftware/Brave-Browser/Default/History',
      },
      tip: 'Arc on macOS keeps it in <code>~/Library/Application Support/Arc/User Data/Default/History</code>.',
    },
    firefox: {
      label: 'Firefox',
      paths: {
        Windows: '%APPDATA%\\Mozilla\\Firefox\\Profiles\\<profile>\\places.sqlite',
        macOS: '~/Library/Application Support/Firefox/Profiles/<profile>/places.sqlite',
        Linux: '~/.mozilla/firefox/<profile>/places.sqlite',
      },
      tip: 'Pick the profile folder ending in <b>.default-release</b>. Close Firefox first (or copy the file) so it is not locked.',
    },
    safari: {
      label: 'Safari',
      html: '<ol><li>In Safari 17 or later choose <b>File › Export Browsing Data to File…</b></li><li>Unzip it and drop <code>History.json</code> here.</li></ol><div class="tip">Older Safari: copy <code>~/Library/Safari/History.db</code> (Finder may need Full Disk Access).</div>',
    },
    takeout: {
      label: 'Google Takeout',
      html: '<ol><li>Visit <b>takeout.google.com</b>, click “Deselect all”, then tick <b>Chrome</b>.</li><li>Export, download and unzip.</li><li>Drop <code>Chrome/History.json</code> (sometimes <code>BrowserHistory.json</code>) here.</li></ol><div class="tip">Works for any signed-in Chrome, including your phone.</div>',
    },
  };
  function howtoHTML(key) {
    const h = HOWTO[key];
    if (h.html) return h.html;
    const order = [PLATFORM, ...['Windows', 'macOS', 'Linux'].filter((p) => p !== PLATFORM)];
    const lines = order.map((p, k) => `<li>${k === 0 ? '<b>' + p + '</b>' : p}: <code>${esc(h.paths[p])}</code></li>`).join('');
    const winTip = PLATFORM === 'Windows' && h.paths.Windows.includes('%') ? '<div class="tip">AppData is hidden: paste the path into the file picker’s address bar.</div>' : '';
    return `<ol>${lines}</ol><div class="tip">${h.tip}</div>${winTip}`;
  }

  UI.showImport = function () {
    endTour();
    const saved = BC.store.load();
    const tabs = Object.keys(HOWTO)
      .map((k, i) => `<button role="tab" data-tab="${k}" aria-selected="${i === 0}">${HOWTO[k].label}</button>`)
      .join('');
    showModal(`<div class="importer">
      <h2>Build your city</h2>
      <p class="sub">Browsers (rightly) won’t let a web page peek at your history, so you hand it over yourself. Everything is read right here in this tab. Nothing is uploaded, ever.</p>
      <label class="drop" id="drop" tabindex="0">
        <svg class="house" viewBox="0 0 54 46" aria-hidden="true"><path d="M27 3 49 14 27 25 5 14z" fill="#ffd8e5"/><path d="M5 14v18l22 11V25z" fill="#ffc8d9"/><path d="M49 14v18L27 43V25z" fill="#f4a9c2"/><path d="M22 34v-6l5 2.5V37z" fill="#fff"/></svg>
        <b>Drop a history file here, or click to browse</b>
        <span>Chrome · Edge · Brave <code>History</code>, Firefox <code>places.sqlite</code>, Safari <code>History.db</code> or <code>History.json</code>, a Google Takeout file, or any .txt / .csv full of links.</span>
      </label>
      <div class="status" id="impStatus"></div>
      <div class="tabs" role="tablist">${tabs}</div>
      <div class="howto" id="howto">${howtoHTML('chrome')}</div>
      <details class="paste"><summary>…or paste a list of web addresses</summary>
        <textarea id="pasteBox" placeholder="https://github.com/…&#10;https://en.wikipedia.org/wiki/…&#10;youtube.com"></textarea>
        <button class="btn btn-small" id="pasteGo">Build from these links</button>
      </details>
      <div class="modal-foot">
        <button class="btn btn-ghost btn-small" data-act="close">Back to town</button>
        <span>
          ${saved && city && city.ds.source === 'demo' ? '<button class="btn btn-small" data-act="mine">Return to my saved city</button>' : ''}
          ${saved ? '<button class="btn btn-ghost btn-small" data-act="forget">Forget my city</button>' : ''}
        </span>
      </div>
    </div>`);
    const drop = $('drop');
    drop.addEventListener('click', (e) => {
      e.preventDefault();
      $('fileInput').click();
    });
    drop.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        $('fileInput').click();
      }
    });
    ['dragenter', 'dragover'].forEach((ev) =>
      drop.addEventListener(ev, (e) => {
        e.preventDefault();
        drop.classList.add('over');
      })
    );
    ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, () => drop.classList.remove('over')));
    $('modalCard').querySelectorAll('[data-tab]').forEach((t) =>
      t.addEventListener('click', () => {
        $('modalCard').querySelectorAll('[data-tab]').forEach((x) => x.setAttribute('aria-selected', x === t));
        $('howto').innerHTML = howtoHTML(t.dataset.tab);
      })
    );
    $('pasteGo').addEventListener('click', () => {
      const text = $('pasteBox').value;
      if (!text.trim()) return setStatus('Paste some links first.', 'err');
      try {
        finishImport(BC.importers.finishText(text, (m) => setStatus(m, 'busy')));
      } catch (e) {
        setStatus(e.message || String(e), 'err');
      }
    });
  };
  function setStatus(msg, kind) {
    const el = $('impStatus');
    if (!el) return;
    el.textContent = msg;
    el.className = 'status' + (kind ? ' ' + kind : '');
  }
  async function handleFile(file) {
    if (!file) return;
    if ($('modal').hidden || !$('impStatus')) UI.showImport();
    setStatus(`Reading ${file.name}…`, 'busy');
    try {
      const ds = await BC.importers.fromFile(file, (m) => setStatus(m, 'busy'));
      finishImport(ds);
    } catch (e) {
      let msg = e && e.message ? e.message : String(e);
      if (/locked|NotReadable|could not be read/i.test(msg)) msg = 'That file is locked by the browser. Copy it somewhere else first, then drop the copy.';
      setStatus(msg, 'err');
    }
  }
  function finishImport(ds) {
    const saved = BC.store.save(ds);
    hideModal();
    const c = BC.app.setDataset(ds);
    UI.toast(`Welcome to your city: <b>${c.buildings.length}</b> buildings across <b>${Object.keys(c.districts).length}</b> neighbourhoods.${saved ? '' : ' (Too big to remember for next time, but enjoy!)'}`, 6000);
    setTimeout(() => {
      if (R.getCity() === c && !st.replay && !tour) UI.openOverview();
    }, 4300);
  }

  // ---------- event wiring ----------
  function bindHud() {
    $('townSign').addEventListener('click', () => UI.openOverview());
    $('btnTour').addEventListener('click', () => (tour ? endTour() : startTour()));
    $('btnReplay').addEventListener('click', startReplay);
    $('btnDay').addEventListener('click', () => UI.showDayPicker());
    $('helpBtn').addEventListener('click', () => UI.showGuide(0));
    $('dbStop').addEventListener('click', () => R.stopDay());
    $('dbSpeed').addEventListener('click', () => {
      const D = st.dayMode;
      if (!D) return;
      D.mult = D.mult === 1 ? 3 : D.mult === 3 ? 0.5 : 1;
      $('dbSpeed').textContent = '×' + (D.mult === 0.5 ? '½' : D.mult);
    });
    $('soundBtn').addEventListener('click', () => {
      const on = BC.sound.toggle();
      $('soundBtn').classList.toggle('on', on);
      $('soundBtn').setAttribute('aria-pressed', on);
      $('soundBtn').setAttribute('aria-label', on ? 'Turn sound off' : 'Turn sound on');
      if (on && !soundHinted) {
        soundHinted = true;
        UI.toast('Sound on: birdsong by day, crickets at night, and traffic that swells at your busiest hours.');
      }
    });
    R.onUnfollow = () => endRide();
    R.onFireworks = (h, manual) => {
      if (st.replay || st.dayMode) return;
      UI.toast(manual ? `Fireworks over Browser City! They go off by themselves every day at <b>${U.hourLabel(h)}</b>, your busiest hour.` : `It's <b>${U.hourLabel(h)}</b>, your busiest hour. The town is celebrating!`, 5000);
    };
    $('btnPostcard').addEventListener('click', postcard);
    $('btnBuild').addEventListener('click', () => UI.showImport());
    $('cardClose').addEventListener('click', closeCard);
    $('zoomIn').addEventListener('click', () => R.zoomAt(window.innerWidth / 2, window.innerHeight / 2, 1.35));
    $('zoomOut').addEventListener('click', () => R.zoomAt(window.innerWidth / 2, window.innerHeight / 2, 1 / 1.35));
    $('zoomHome').addEventListener('click', () => {
      closeCard();
      R.home();
    });
    $('clockPlay').addEventListener('click', () => (st.playing = !st.playing));
    const range = $('clockRange');
    range.addEventListener('input', () => {
      clockDragging = true;
      st.hour = parseFloat(range.value) % 24;
    });
    range.addEventListener('change', () => (clockDragging = false));
    range.addEventListener('pointerup', () => (clockDragging = false));
    $('rbStop').addEventListener('click', () => R.stopReplay());
    $('tcNext').addEventListener('click', () => (tour && tour.i >= tour.stops.length - 1 ? endTour() : tour && goStop(tour.i + 1)));
    $('tcPrev').addEventListener('click', () => tour && goStop(tour.i - 1));
    $('tcEnd').addEventListener('click', endTour);
    $('fileInput').addEventListener('change', (e) => {
      const f = e.target.files[0];
      e.target.value = '';
      handleFile(f);
    });

    const search = $('search');
    search.addEventListener('input', runSearch);
    search.addEventListener('focus', runSearch);
    search.addEventListener('keydown', (e) => {
      const list = $('searchList');
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (!searchHits.length) return;
        searchSel = (searchSel + (e.key === 'ArrowDown' ? 1 : -1) + searchHits.length) % searchHits.length;
        list.querySelectorAll('li').forEach((li, k) => li.setAttribute('aria-selected', k === searchSel));
      } else if (e.key === 'Enter') chooseSearch(searchSel);
      else if (e.key === 'Escape') {
        search.value = '';
        list.classList.remove('open');
        search.blur();
      }
    });
    $('searchList').addEventListener('mousedown', (e) => {
      const li = e.target.closest('li[data-k]');
      if (li) {
        e.preventDefault();
        chooseSearch(+li.dataset.k);
      }
    });
    search.addEventListener('blur', () => setTimeout(() => $('searchList').classList.remove('open'), 120));

    // delegated clicks inside cards and modals
    const delegate = (e) => {
      const t = e.target.closest('[data-domain],[data-district],[data-act]');
      if (!t) return;
      if (t.dataset.domain) {
        const b = city.byDomain.get(t.dataset.domain);
        if (b) UI.openBuilding(b, true);
      } else if (t.dataset.district) UI.openDistrict(t.dataset.district, true);
      else {
        const act = t.dataset.act;
        if (act === 'build') UI.showImport();
        else if (act === 'demo') {
          hideModal();
          if (city.ds.source !== 'demo') BC.app.setDataset(BC.makeDemo());
          else if (!$('card').classList.contains('open')) UI.toast('Drag to look around, scroll to zoom, and click any building to hear its story.', 6000);
        } else if (act === 'close') hideModal();
        else if (act === 'mine') {
          const ds = BC.store.load();
          hideModal();
          if (ds) BC.app.setDataset(ds);
        } else if (act === 'forget') {
          BC.store.clear();
          hideModal();
          if (city.ds.source !== 'demo') BC.app.setDataset(BC.makeDemo());
          UI.toast('Forgotten. Your city is gone from this browser.');
        } else if (act === 'replay') startReplay();
        else if (act === 'ride') {
          const from = city.byDomain.get(t.dataset.from), to = city.byDomain.get(t.dataset.to);
          const hop = city.ds.transitions.find((x) => x[0] === t.dataset.from && x[1] === t.dataset.to);
          const car = from && to && BC.sim.spawnCar({ from, to, n: hop ? hop[2] : 0 });
          if (car) startRide(car);
          else UI.toast('No road between those two right now. Try another stop.');
        } else if (act === 'guide-skip') {
          hideModal();
          if (!city || !$('card').classList.contains('open')) UI.toast('Drag to look around, scroll to zoom, and click any building to hear its story. Press <b>?</b> for the guide again.', 6000);
        } else if (act === 'guide-demo') {
          hideModal();
          UI.toast('Enjoy the stroll! Press <b>?</b> any time to see the guide again.', 5000);
        } else if (act === 'fw') {
          closeCard();
          R.home();
          R.fireworks(true);
        } else if (act === 'day-go') startDay(+t.dataset.day);
      }
    };
    $('cardBody').addEventListener('click', delegate);
    $('modalCard').addEventListener('click', delegate);
    $('modal').addEventListener('click', (e) => {
      if (e.target === $('modal') && !$('modal').classList.contains('clear')) hideModal();
    });
  }

  function bindDrop() {
    window.addEventListener('dragover', (e) => e.preventDefault());
    window.addEventListener('drop', (e) => {
      e.preventDefault();
      const f = e.dataTransfer && e.dataTransfer.files[0];
      if (f) handleFile(f);
    });
  }

  function bindKeys() {
    window.addEventListener('keydown', (e) => {
      const typing = /INPUT|TEXTAREA/.test(document.activeElement.tagName) && document.activeElement.type !== 'range';
      if (e.key === 'Escape') {
        if (!$('modal').hidden) hideModal();
        else if (st.dayMode) R.stopDay();
        else if (ride) endRide();
        else if (st.replay) R.stopReplay();
        else if (tour) endTour();
        else closeCard();
        return;
      }
      if (typing) return;
      if ((e.key === 'ArrowRight' || e.key === 'ArrowLeft') && UI.guideStep(e.key === 'ArrowRight' ? 1 : -1)) {
        e.preventDefault();
        return;
      }
      if (e.key === '?') {
        e.preventDefault();
        UI.showGuide(0);
        return;
      }
      if (e.key === '/') {
        e.preventDefault();
        $('search').focus();
      } else if (e.key === '+' || e.key === '=') R.zoomAt(window.innerWidth / 2, window.innerHeight / 2, 1.25);
      else if (e.key === '-' || e.key === '_') R.zoomAt(window.innerWidth / 2, window.innerHeight / 2, 0.8);
      else if (e.key === 'ArrowLeft') R.panBy(80, 0);
      else if (e.key === 'ArrowRight') R.panBy(-80, 0);
      else if (e.key === 'ArrowUp') R.panBy(0, 80);
      else if (e.key === 'ArrowDown') R.panBy(0, -80);
      else if (e.key === ' ' && document.activeElement === document.body) {
        e.preventDefault();
        st.playing = !st.playing;
      } else if (e.key === 'ArrowRight' && tour) goStop(tour.i + 1);
    });
  }

  function bindPointer() {
    const pts = new Map();
    let drag = null, pinch = null;
    canvas.addEventListener('pointerdown', (e) => {
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch (err) {}
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 1) drag = { x: e.clientX, y: e.clientY, moved: 0, t: performance.now(), vx: 0, vy: 0 };
      else if (pts.size === 2) {
        const [a, b] = [...pts.values()];
        pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
        drag = null;
      }
      R.cam.vx = R.cam.vy = 0;
    });
    canvas.addEventListener('pointermove', (e) => {
      if (pts.has(e.pointerId)) pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinch && pts.size === 2) {
        const [a, b] = [...pts.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y), cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
        R.panBy(cx - pinch.cx, cy - pinch.cy);
        R.zoomAt(cx, cy, d / Math.max(1, pinch.d));
        pinch = { d, cx, cy };
        return;
      }
      if (drag) {
        const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
        drag.moved += Math.abs(dx) + Math.abs(dy);
        const now = performance.now(), dt = Math.max(1, now - drag.t);
        if (drag.moved > 5) {
          R.panBy(dx, dy);
          canvas.classList.add('dragging');
          drag.vx = drag.vx * 0.6 + ((dx / dt) * 1000) * 0.4;
          drag.vy = drag.vy * 0.6 + ((dy / dt) * 1000) * 0.4;
          if (tour) tour.t = 0;
        }
        drag.x = e.clientX;
        drag.y = e.clientY;
        drag.t = now;
        return;
      }
      if (e.pointerType === 'mouse') hover(e.clientX, e.clientY);
    });
    const up = (e) => {
      pts.delete(e.pointerId);
      canvas.classList.remove('dragging');
      if (pinch) {
        if (pts.size < 2) pinch = null;
        drag = null;
        return;
      }
      if (drag) {
        if (drag.moved <= 5) click(e.clientX, e.clientY);
        else if (performance.now() - drag.t < 80) {
          R.cam.vx = drag.vx;
          R.cam.vy = drag.vy;
        }
      }
      drag = null;
    };
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    canvas.addEventListener('pointerleave', () => {
      st.hover = null;
      st.hoverCar = null;
    });
    canvas.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        const f = Math.exp(-e.deltaY * (e.ctrlKey ? 0.012 : 0.0016));
        R.zoomAt(e.clientX, e.clientY, f);
      },
      { passive: false }
    );
    canvas.addEventListener('dblclick', (e) => R.zoomAt(e.clientX, e.clientY, 1.7));
  }
  function hover(x, y) {
    const hit = R.pick(x, y);
    st.hover = hit && hit.type === 'building' ? hit.obj : null;
    st.hoverCar = hit && hit.type === 'car' ? hit.obj : null;
    canvas.classList.toggle('pointing', !!hit && hit.type !== 'woods');
    st.focusDistrict = hit && hit.type === 'district' ? hit.key : null;
  }
  function click(x, y) {
    const hit = R.pick(x, y);
    if (!hit) return closeCard();
    const ds = city.ds;
    switch (hit.type) {
      case 'building':
        UI.openBuilding(hit.obj, true);
        break;
      case 'district':
        UI.openDistrict(hit.key, true);
        break;
      case 'car':
        startRide(hit.obj);
        break;
      case 'amenity': {
        const a = hit.obj;
        if (a.type === 'fountain' || a.type === 'sign') UI.openOverview();
        else if (a.type === 'ferris') UI.toast(`The Tab Wheel turns once for every 100 visits. It has gone round <b>${U.fmt(Math.floor(ds.total / 100))}</b> times so far.`);
        else if (a.type === 'windmill') UI.toast(`The old windmill grinds <b>${U.fmt(city.longTail)}</b> one-off visits into flour for the Whispering Woods.`);
        else if (a.type === 'pond') UI.toast('The Duck Pond. The ducks have no opinion about your browsing history.');
        else if (a.type === 'gazebo') UI.toast('A gazebo for idle scrolling. Bring a snack.');
        break;
      }
      case 'balloon':
        UI.toast('The Cache Balloon drifts over town, carrying everything you meant to read later.');
        break;
      case 'woods':
        UI.toast(city.longTail ? `The Whispering Woods: <b>${U.fmt(city.longTail)}</b> sites you visited just once, each one now a tree.` : 'The Whispering Woods. Quiet out here.');
        break;
    }
  }

  // ---------- ride along ----------
  let ride = null, soundHinted = false;
  function startRide(c) {
    endTour();
    closeCard();
    ride = { car: c, arrived: false, t: 0 };
    st.follow = c;
    R.offsetX = R.offsetY = 0;
    R.cam.tz = Math.max(R.cam.z, R.fitZ * 2.6);
    const { from, to, n } = c.trip;
    $('rcStep').textContent = 'Riding along';
    $('rcTitle').innerHTML = `${esc(from.site.name)} <span style="color:var(--ink-3)">→</span> ${esc(to.site.name)}`;
    $('rcText').innerHTML = n
      ? `You've made this exact hop <b>${U.fmt(n)}</b> ${n === 1 ? 'time' : 'times'}. Sit back, it's a short drive.`
      : st.dayMode
        ? 'Following the trip you actually took that day.'
        : 'A little trip across town.';
    $('rcActions').innerHTML = `<button class="btn btn-small" data-domain="${esc(from.site.domain)}">Visit ${esc(from.site.name)}</button><button class="btn btn-small btn-ghost" id="rcOff" style="margin-left:auto">Hop out</button>`;
    $('rideCap').hidden = false;
    document.body.classList.add('touring');
  }
  function tickRide(dt) {
    ride.t += dt;
    if (!ride.arrived && ride.car.done) {
      ride.arrived = true;
      ride.t = 0;
      st.follow = null;
      const to = ride.car.trip.to;
      $('rcStep').textContent = 'You have arrived';
      $('rcTitle').textContent = to.title;
      $('rcText').innerHTML = `Parked outside <b>${esc(to.site.domain)}</b>, ${U.fmt(to.site.visits)} visits and counting.`;
      $('rcActions').innerHTML = `<button class="btn btn-small btn-primary" data-domain="${esc(to.site.domain)}">Step inside</button><button class="btn btn-small btn-ghost" id="rcOff" style="margin-left:auto">Hop out</button>`;
      BC.sim.knock(to);
    }
    if (ride && ride.arrived && ride.t > 7) endRide();
  }
  function endRide() {
    if (!ride) return;
    ride = null;
    st.follow = null;
    $('rideCap').hidden = true;
    document.body.classList.remove('touring');
  }
  $('rideCap').addEventListener('click', (e) => {
    const t = e.target.closest('[data-domain],#rcOff');
    if (!t) return;
    if (t.id === 'rcOff') return endRide();
    const b = city.byDomain.get(t.dataset.domain);
    endRide();
    if (b) UI.openBuilding(b, true);
  });

  // ---------- a day in your life ----------
  const WEEKDAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayDate = (day) => new Date(BC.dayStart(day));
  const dayName = (day) => {
    const d = dayDate(day);
    return `${WEEKDAY[d.getDay()]}, ${U.dateLabel(d.getTime()).replace(/ \d{4}$/, '')}`;
  };
  UI.showDayPicker = function () {
    const ds = city.ds;
    const keys = ds.daylog ? Object.keys(ds.daylog) : [];
    if (!keys.length) {
      UI.toast(ds.hasTime ? 'This city was saved before days were recorded. Import your history again to unlock it.' : 'This history has no timestamps, so there are no days to replay.', 5500);
      return;
    }
    endTour();
    endRide();
    const days = keys.map(Number).sort((a, b) => a - b);
    const total = (d) => (ds.dayTotals && ds.dayTotals[d]) || ds.daylog[d].length / 2;
    // shade by rank so quiet and busy days read clearly apart
    const sortedTotals = days.map(total).sort((a, b) => a - b);
    const pct = (v) => {
      let lo = 0;
      while (lo < sortedTotals.length && sortedTotals[lo] < v) lo++;
      return sortedTotals.length > 1 ? lo / (sortedTotals.length - 1) : 1;
    };
    const shade = (q) => U.mix('#f1ecfb', '#8a68e0', 0.06 + 0.94 * q);
    const wd = (d) => (dayDate(d).getDay() + 6) % 7;
    const first = days[0] - wd(days[0]), last = days[days.length - 1];
    const set = new Set(days);
    let cells = '';
    for (let d = first; d <= last; d++) {
      if (!set.has(d)) {
        cells += '<span></span>';
        continue;
      }
      const v = total(d);
      const col = shade(pct(v));
      const storm = R.stormy(d);
      cells += `<button data-act="day-go" data-day="${d}" class="${storm ? 'storm' : ''}" style="background:${col}" title="${dayName(d)}: ${U.fmt(v)} visits${storm ? ' · a very late night' : ''}" aria-label="${dayName(d)}, ${v} visits"></button>`;
    }
    const busiest = days.reduce((a, d) => (total(d) > total(a) ? d : a), days[0]);
    const latest = days.reduce((a, d) => (R.lateCount(d) > R.lateCount(a) ? d : a), days[0]);
    const yesterday = set.has(last - 1) ? last - 1 : last;
    const legend = [0, 0.33, 0.66, 1].map((q) => `<i style="background:${shade(q)}"></i>`).join('');
    $('modalCard').innerHTML = `<div class="daypick">
      <h2>A day in your life</h2>
      <p class="sub">Pick a day and watch it play out, visit by visit. Each site you opened lights up its building, each hop sends a car across town, and late nights bring the rain.</p>
      <div class="quick">
        <button class="btn btn-small btn-primary" data-act="day-go" data-day="${yesterday}">Yesterday</button>
        <button class="btn btn-small" data-act="day-go" data-day="${busiest}">Busiest day <small>${U.fmt(total(busiest))} visits</small></button>
        ${R.lateCount(latest) ? `<button class="btn btn-small" data-act="day-go" data-day="${latest}">Latest night <small>${dayName(latest).split(',')[0]}</small></button>` : ''}
      </div>
      <div class="cal-wrap">
        <div class="cal-days"><span>M</span><span></span><span>W</span><span></span><span>F</span><span></span><span>S</span></div>
        <div class="cal">${cells}</div>
      </div>
      <div class="cal-legend"><span>quiet</span>${legend}<span>busy</span><span class="storm-key">late night</span></div>
      <div class="cal-range">${U.dateLabel(dayDate(days[0]).getTime())} – ${U.dateLabel(dayDate(last).getTime())}</div>
      <div class="modal-foot"><button class="btn btn-ghost btn-small" data-act="close">Back to town</button></div>
    </div>`;
    $('modal').hidden = false;
    $('modal').classList.remove('clear');
  };
  function startDay(day) {
    hideModal();
    closeCard();
    endTour();
    endRide();
    const ok = R.startDay(day, (sum) => {
      $('dayBar').hidden = true;
      st.playing = true;
      UI.toast(`That was ${dayName(sum.day)}: <b>${U.fmt(sum.total)}</b> visits across <b>${sum.buildings}</b> buildings.`, 6000);
    });
    if (!ok) return UI.toast('Not enough happened that day to replay.');
    st.dayMode.startH = st.dayMode.hour;
    $('dbSpeed').textContent = '×1';
    $('dayBar').hidden = false;
    R.home();
    R.cam.tz = R.fitZ * 1.2;
    if (R.stormy(day)) setTimeout(() => st.dayMode && UI.toast('This one runs late. Bring an umbrella.', 3500), 1200);
  }
  function updateDayBar() {
    const D = st.dayMode;
    const span = Math.max(0.01, D.endM / 60 - D.startH);
    $('dbDate').innerHTML = `<small>a day in your life</small>${dayName(D.day)} · ${U.clockLabel(D.hour)}`;
    $('dbFill').style.width = U.clamp((D.hour - D.startH) / span, 0, 1) * 100 + '%';
    const now = D.currentSite ? `Now on <b>${esc(D.currentSite.name)}</b> · ` : '';
    $('dbStats').innerHTML = `${now}${U.fmt(D.count)} of ${U.fmt(D.ev.length)} stops · ${D.visited.size} buildings`;
  }

  // ---------- per-frame ----------
  UI.tick = function (dt) {
    if (!city) return;
    updateClock();
    if (st.replay) updateReplayBar();
    if (st.dayMode) updateDayBar();
    if (ride) tickRide(dt);
    if (tour) {
      tour.t += dt;
      if (tour.t > 8 && tour.i < tour.stops.length - 1) goStop(tour.i + 1);
    }
  };
})();
