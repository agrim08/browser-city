/* Browser City — reading real browsing history. Everything happens locally in the page. */
(function () {
  const SQL_VER = '1.10.3';
  const SQL_BASE = `https://cdnjs.cloudflare.com/ajax/libs/sql.js/${SQL_VER}/`;
  let sqlPromise = null;

  function loadSql() {
    if (sqlPromise) return sqlPromise;
    sqlPromise = new Promise((resolve, reject) => {
      const go = () => window.initSqlJs({ locateFile: (f) => SQL_BASE + f }).then(resolve, reject);
      if (window.initSqlJs) return go();
      const s = document.createElement('script');
      s.src = SQL_BASE + 'sql-wasm.js';
      s.onload = go;
      s.onerror = () => {
        sqlPromise = null;
        reject(new Error('Could not load the SQLite reader (are you offline?).'));
      };
      document.head.appendChild(s);
    });
    return sqlPromise;
  }

  async function fromSqlite(buf, status) {
    status('Opening the history database…');
    const SQL = await loadSql();
    const db = new SQL.Database(new Uint8Array(buf));
    try {
      const tables = new Set();
      const res = db.exec("SELECT name FROM sqlite_master WHERE type='table'");
      if (res[0]) for (const row of res[0].values) tables.add(row[0]);
      let sql, toMs, source;
      if (tables.has('visits') && tables.has('urls')) {
        sql = 'SELECT u.url, u.title, v.visit_time FROM visits v JOIN urls u ON u.id = v.url';
        toMs = (x) => x / 1000 - 11644473600000; // microseconds since 1601
        source = 'Chromium history';
      } else if (tables.has('moz_historyvisits') && tables.has('moz_places')) {
        sql = 'SELECT p.url, p.title, h.visit_date FROM moz_historyvisits h JOIN moz_places p ON p.id = h.place_id';
        toMs = (x) => x / 1000;
        source = 'Firefox history';
      } else if (tables.has('history_visits') && tables.has('history_items')) {
        sql = 'SELECT i.url, v.title, v.visit_time FROM history_visits v JOIN history_items i ON i.id = v.history_item';
        toMs = (x) => (x + 978307200) * 1000; // seconds since 2001
        source = 'Safari history';
      } else {
        throw new Error("That database doesn't look like browser history.");
      }
      status('Reading visits…');
      const stmt = db.prepare(sql);
      const items = [];
      while (stmt.step()) {
        const r = stmt.get();
        const t = toMs(Number(r[2]));
        items.push({ url: r[0], title: r[1], t: t > 0 ? t : 0 });
      }
      stmt.free();
      return { items, source };
    } finally {
      db.close();
    }
  }

  const TIME_KEYS = ['time_usec', 'visitTime', 'lastVisitTime', 'visit_time', 'time', 'timestamp', 'date', 'visited_at', 'last_visit_time'];
  function toMsGuess(v, key) {
    if (v == null) return 0;
    if (typeof v === 'string' && !/^\d+(\.\d+)?$/.test(v)) {
      const p = Date.parse(v);
      return isNaN(p) ? 0 : p;
    }
    let n = Number(v);
    if (!isFinite(n) || n <= 0) return 0;
    if (key === 'time_usec' || n > 1e15) n = n / 1000; // microseconds
    else if (n < 1e11) n = n * 1000; // seconds
    return n;
  }
  function fromJsonValue(json) {
    let arr = null, source = 'JSON export';
    if (Array.isArray(json)) arr = json;
    else if (json && typeof json === 'object') {
      if (Array.isArray(json['Browser History'])) {
        arr = json['Browser History'];
        source = 'Google Takeout';
      } else if (Array.isArray(json.history)) arr = json.history;
      else {
        for (const k in json) {
          if (Array.isArray(json[k]) && json[k].length && typeof json[k][0] === 'object' && json[k][0] && 'url' in json[k][0]) {
            arr = json[k];
            break;
          }
        }
      }
    }
    if (!arr) return null;
    const items = [];
    for (const e of arr) {
      if (!e) continue;
      if (typeof e === 'string') {
        items.push({ url: e, t: 0 });
        continue;
      }
      const url = e.url || e.URL || e.href || e.uri;
      if (!url) continue;
      let t = 0;
      for (const k of TIME_KEYS) {
        if (e[k] != null) {
          t = toMsGuess(e[k], k);
          if (t) break;
        }
      }
      const reps = Math.max(1, Math.min(400, Number(e.visitCount || e.visit_count || 1) | 0));
      for (let r = 0; r < reps; r++) items.push({ url, title: e.title || e.name || '', t });
    }
    return { items, source };
  }

  function fromPlainText(text) {
    const items = [];
    const urlRe = /https?:\/\/[^\s"'<>,;)]+/g;
    const dateRe = /\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?/;
    const bare = /^([a-z0-9-]+\.)+[a-z]{2,}$/i;
    for (const line of text.split(/\r?\n/)) {
      const s = line.trim();
      if (!s) continue;
      const urls = s.match(urlRe);
      const dm = s.match(dateRe);
      const t = dm ? Date.parse(dm[0].replace(' ', 'T')) || 0 : 0;
      if (urls) for (const u of urls) items.push({ url: u, t });
      else if (bare.test(s)) items.push({ url: 'https://' + s, t });
    }
    return { items, source: 'URL list' };
  }

  BC.importers = {
    async fromFile(file, status = () => {}) {
      const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
      const magic = String.fromCharCode.apply(null, head.slice(0, 15));
      let out;
      if (magic === 'SQLite format 3') out = await fromSqlite(await file.arrayBuffer(), status);
      else {
        status('Reading ' + file.name + '…');
        out = BC.importers.fromText(await file.text());
      }
      return finish(out, status);
    },
    fromText(text) {
      const trimmed = text.trim();
      if (trimmed[0] === '{' || trimmed[0] === '[') {
        try {
          const r = fromJsonValue(JSON.parse(trimmed));
          if (r && r.items.length) return r;
        } catch (e) {}
      }
      return fromPlainText(text);
    },
    finishText(text, status = () => {}) {
      return finish(BC.importers.fromText(text), status);
    },
  };

  function finish(out, status) {
    if (!out || !out.items.length) throw new Error("I couldn't find any web addresses in that.");
    status(`Found ${out.items.length.toLocaleString()} visits. Laying out streets…`);
    const ds = BC.aggregate(out.items, { source: out.source, label: 'Your city' });
    if (!ds.sites.length) throw new Error('No regular websites in there (only internal browser pages?).');
    return ds;
  }
})();
