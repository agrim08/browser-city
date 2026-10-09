/* Browser City — a tiny synthesized soundscape. Nothing is downloaded; it's all Web Audio. */
(function () {
  const S = (BC.sound = { on: false });
  let ac = null, master, hum, rain, wind, white, brown;
  let nextBird = 0, nextCricket = 0;

  function noise(kind) {
    const len = ac.sampleRate * 2;
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (kind === 'brown') {
        last = (last + 0.02 * w) / 1.02;
        d[i] = last * 3.5;
      } else d[i] = w;
    }
    return buf;
  }
  function bed(buf, type, freq, q = 0.7) {
    const src = ac.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const f = ac.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ac.createGain();
    g.gain.value = 0;
    src.connect(f).connect(g).connect(master);
    src.start();
    return g;
  }
  function setup() {
    ac = new (window.AudioContext || window.webkitAudioContext)();
    master = ac.createGain();
    master.gain.value = 0;
    master.connect(ac.destination);
    white = noise('white');
    brown = noise('brown');
    hum = bed(brown, 'lowpass', 300);
    rain = bed(white, 'highpass', 1400);
    wind = bed(brown, 'bandpass', 520, 0.6);
  }
  function panned(node) {
    if (!ac.createStereoPanner) return node.connect(master);
    const p = ac.createStereoPanner();
    p.pan.value = Math.random() * 1.6 - 0.8;
    node.connect(p).connect(master);
  }
  function env(g, t0, peak, attack, decay) {
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + decay);
  }
  function burst(t0, type, freq, peak, decay) {
    const src = ac.createBufferSource();
    src.buffer = white;
    const f = ac.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    const g = ac.createGain();
    env(g, t0, peak, 0.004, decay);
    src.connect(f).connect(g);
    panned(g);
    src.start(t0, Math.random());
    src.stop(t0 + decay + 0.05);
  }
  function tone(t0, f0, f1, peak, dur, type = 'sine') {
    const o = ac.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t0);
    o.frequency.exponentialRampToValueAtTime(f1, t0 + dur * 0.7);
    const g = ac.createGain();
    env(g, t0, peak, Math.min(0.012, dur * 0.2), dur);
    o.connect(g);
    panned(g);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }

  function chirp() {
    const t = ac.currentTime + 0.02;
    const n = 2 + Math.floor(Math.random() * 4);
    const base = 2300 + Math.random() * 1700;
    for (let k = 0; k < n; k++) tone(t + k * (0.09 + Math.random() * 0.05), base, base * (1.25 + Math.random() * 0.4), 0.025, 0.07);
  }
  function cricket() {
    const t = ac.currentTime + 0.02;
    const f = 4200 + Math.random() * 500;
    for (let k = 0; k < 3; k++) tone(t + k * 0.06, f, f, 0.008, 0.04, 'triangle');
  }

  S.toggle = function () {
    if (!ac) setup();
    S.on = !S.on;
    if (S.on) ac.resume();
    master.gain.setTargetAtTime(S.on ? 0.9 : 0, ac.currentTime, 0.25);
    return S.on;
  };

  // called every frame with the town's state
  S.update = function (st, weather) {
    if (!S.on || !ac) return;
    const t = ac.currentTime;
    hum.gain.setTargetAtTime(0.04 + 0.16 * st.activity * (1 - 0.4 * st.night), t, 0.6);
    rain.gain.setTargetAtTime(0.09 * weather.rain, t, 0.8);
    wind.gain.setTargetAtTime(0.025 + 0.02 * weather.rain, t, 1);
    if (st.day > 0.3 && weather.rain < 0.4 && t > nextBird) {
      chirp();
      nextBird = t + 1.6 + (Math.random() * 4) / st.day;
    }
    if (st.night > 0.5 && t > nextCricket) {
      cricket();
      nextCricket = t + 0.5 + Math.random() * 1.1;
    }
  };

  S.knock = function () {
    if (!S.on) return;
    const t = ac.currentTime + 0.01;
    burst(t, 'lowpass', 700, 0.5, 0.09);
    burst(t + 0.17, 'lowpass', 700, 0.45, 0.09);
  };
  S.pop = function () {
    if (!S.on) return;
    tone(ac.currentTime + 0.01, 520, 900, 0.05, 0.12);
  };
  const PENTA = [523.25, 587.33, 659.25, 783.99, 880, 1046.5];
  S.ping = function (k) {
    if (!S.on) return;
    tone(ac.currentTime + 0.01, PENTA[k % PENTA.length], PENTA[k % PENTA.length] * 1.002, 0.03, 0.35);
  };
  S.launch = function () {
    if (!S.on) return;
    const t = ac.currentTime + 0.01;
    const src = ac.createBufferSource();
    src.buffer = white;
    const f = ac.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 3;
    f.frequency.setValueAtTime(500, t);
    f.frequency.exponentialRampToValueAtTime(2400, t + 0.9);
    const g = ac.createGain();
    env(g, t, 0.05, 0.2, 0.8);
    src.connect(f).connect(g);
    panned(g);
    src.start(t);
    src.stop(t + 1.1);
  };
  S.boom = function () {
    if (!S.on) return;
    const t = ac.currentTime + 0.01;
    burst(t, 'lowpass', 180, 0.6, 0.9);
    for (let k = 0; k < 7; k++) burst(t + 0.15 + Math.random() * 0.6, 'highpass', 3000, 0.08, 0.03);
  };
})();
