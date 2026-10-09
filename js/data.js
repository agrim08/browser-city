/* Browser City — districts, domain parsing, classification, demo history and aggregation. */
(function () {
  const U = BC.util;

  BC.DISTRICTS = {
    code: {
      name: 'Tinker Quarter', short: 'Code & tools',
      blurb: 'Where code gets written, docs get read and the robots hum along.',
      color: '#bfe8d6', ground: '#e2f4eb', accent: '#4fb592', style: 'tower', particle: 'code',
      palette: ['#bfe8d6', '#a9dfcb', '#cdeee2', '#b6e2ea', '#d2f0e4'],
      persona: "a tinkerer's town",
    },
    social: {
      name: 'Chatterbox Commons', short: 'Social',
      blurb: 'Gossip, memes and messages. The friendliest corner of town.',
      color: '#ffc8d9', ground: '#fdedf2', accent: '#ef7fa3', style: 'house', particle: 'heart',
      palette: ['#ffc8d9', '#ffb8cd', '#ffd8e5', '#f8c6e1', '#ffcfd2'],
      persona: 'a chatty little village',
    },
    watch: {
      name: 'Marquee Row', short: 'Video & music',
      blurb: 'Screens, songs and streams. The lights stay on late here.',
      color: '#d9c8ff', ground: '#f0ebfc', accent: '#9b7fe6', style: 'theater', particle: 'note',
      palette: ['#d9c8ff', '#cbb9f6', '#e5d9ff', '#d3c6f2', '#dccdfa'],
      persona: 'a town that never quite sleeps',
    },
    news: {
      name: 'Inkwell Lane', short: 'News & reading',
      blurb: 'Headlines, essays and rabbit holes, fresh off the press.',
      color: '#ffe7a3', ground: '#fcf5dc', accent: '#d9a93a', style: 'library', particle: 'paper',
      palette: ['#ffe7a3', '#fbe09a', '#fff0c4', '#f6e3a9', '#ffe9b8'],
      persona: 'a well-read borough',
    },
    shop: {
      name: 'Market Hollow', short: 'Shopping & food',
      blurb: 'Carts, deals, deliveries and things you definitely needed.',
      color: '#ffd2b0', ground: '#fceee3', accent: '#ee915a', style: 'shop', particle: 'coin',
      palette: ['#ffd2b0', '#ffc6a0', '#ffdcc4', '#fbcdb0', '#ffd8b8'],
      persona: 'a bustling market town',
    },
    learn: {
      name: "Scholar's Hill", short: 'Learning',
      blurb: 'Encyclopedias, courses, papers and late-night curiosity.',
      color: '#bfe0ff', ground: '#e8f1fc', accent: '#5c9fe0', style: 'academy', particle: 'star',
      palette: ['#bfe0ff', '#afd5f8', '#d1e8ff', '#bcd9f2', '#c8e2fc'],
      persona: 'a scholarly hamlet',
    },
    work: {
      name: 'Clockwork Commons', short: 'Work & search',
      blurb: 'Inboxes, calendars and search bars: the civic machinery of your day.',
      color: '#d6e8b8', ground: '#eef5e1', accent: '#86b04a', style: 'civic', particle: 'mail',
      palette: ['#d6e8b8', '#c8dfa6', '#e2efcb', '#d0e2b2', '#dbeac0'],
      persona: 'a hard-working township',
    },
    play: {
      name: 'Arcade Bay', short: 'Games',
      blurb: 'Games, puzzles and high scores by the water.',
      color: '#b8ece6', ground: '#e4f7f4', accent: '#36b7ab', style: 'arcade', particle: 'pixel',
      palette: ['#b8ece6', '#a6e3dd', '#caf3ee', '#b3e5ef', '#c0efe6'],
      persona: 'a playful seaside town',
    },
    misc: {
      name: "Wanderer's Edge", short: 'Everything else',
      blurb: 'Odd little corners: travel plans, recipes, the weather and everything else.',
      color: '#ecdfcc', ground: '#f6f0e6', accent: '#b8946b', style: 'cottage', particle: 'leaf',
      palette: ['#ecdfcc', '#e3d3bd', '#f3e9db', '#e8d7c6', '#efe2d0'],
      persona: "a wanderer's waystation",
    },
  };
  BC.DISTRICT_ORDER = ['code', 'social', 'watch', 'news', 'shop', 'learn', 'work', 'play', 'misc'];

  // ---------- domains ----------
  const MULTI = new Set(
    'co.uk org.uk ac.uk gov.uk me.uk com.au net.au org.au edu.au co.in net.in org.in ac.in gov.in co.jp ne.jp or.jp ac.jp co.nz com.br com.mx co.za com.sg com.tr com.cn com.hk co.kr com.ar com.tw co.id com.my com.ph com.vn com.pk com.ng co.il'.split(' ')
  );
  const KEEP_SUB = new Set(
    'google.com microsoft.com live.com yahoo.com amazon.com apple.com ycombinator.com atlassian.net stackexchange.com blogspot.com github.io wordpress.com substack.com tumblr.com office.com notion.site vercel.app netlify.app pages.dev herokuapp.com'.split(' ')
  );
  const GENERIC_SUB = new Set('www www2 m mobile en web amp smile l lm'.split(' '));

  BC.domainOf = function (url) {
    if (!url) return null;
    let u;
    try {
      u = new URL(url);
    } catch (e) {
      try {
        u = new URL('https://' + url);
      } catch (e2) {
        return null;
      }
    }
    if (!/^https?:$/.test(u.protocol)) return null;
    let host = u.hostname.toLowerCase().replace(/\.$/, '');
    if (!host || host.indexOf('.') < 0) return host === 'localhost' ? 'localhost' : null;
    if (/^127\.|^0\.0\.0\.0$|^192\.168\.|^10\./.test(host)) return 'localhost';
    if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) return host;
    const parts = host.split('.');
    let n = 2;
    if (parts.length > 2 && MULTI.has(parts.slice(-2).join('.'))) n = 3;
    const base = parts.slice(-n).join('.');
    if (KEEP_SUB.has(base) && parts.length > n) {
      const sub = parts[parts.length - n - 1];
      if (!GENERIC_SUB.has(sub)) return sub + '.' + base;
    }
    return base;
  };

  const BRANDS = {
    'github.com': 'GitHub', 'youtube.com': 'YouTube', 'stackoverflow.com': 'Stack Overflow', 'linkedin.com': 'LinkedIn',
    'chatgpt.com': 'ChatGPT', 'news.ycombinator.com': 'Hacker News', 'mail.google.com': 'Gmail', 'x.com': 'X',
    'developer.mozilla.org': 'MDN', 'mozilla.org': 'Mozilla', 'claude.ai': 'Claude', 'localhost': 'The Garage', 'reddit.com': 'Reddit',
    'wikipedia.org': 'Wikipedia', 'docs.google.com': 'Google Docs', 'drive.google.com': 'Google Drive',
    'calendar.google.com': 'Google Calendar', 'meet.google.com': 'Google Meet', 'scholar.google.com': 'Google Scholar',
    'translate.google.com': 'Google Translate', 'maps.google.com': 'Google Maps', 'news.google.com': 'Google News',
    'aws.amazon.com': 'AWS', 'music.apple.com': 'Apple Music', 'developer.apple.com': 'Apple Developer',
    'tiktok.com': 'TikTok', 'imdb.com': 'IMDb', 'ebay.com': 'eBay', 'nytimes.com': 'The New York Times', 'bbc.com': 'BBC',
    'bbc.co.uk': 'BBC', 'theverge.com': 'The Verge', 'theguardian.com': 'The Guardian', 'npmjs.com': 'npm',
    'arxiv.org': 'arXiv', 'whatsapp.com': 'WhatsApp', 'doordash.com': 'DoorDash', 'steampowered.com': 'Steam',
    'bsky.app': 'Bluesky', 'geeksforgeeks.org': 'GeeksforGeeks', 'huggingface.co': 'Hugging Face', 'geoguessr.com': 'GeoGuessr',
    'w3schools.com': 'W3Schools', 'primevideo.com': 'Prime Video', 'techcrunch.com': 'TechCrunch', 'soundcloud.com': 'SoundCloud',
    'codepen.io': 'CodePen', 'khanacademy.org': 'Khan Academy', 'allrecipes.com': 'Allrecipes', 'wolframalpha.com': 'Wolfram|Alpha',
    'ign.com': 'IGN', 'dev.to': 'DEV', 'duckduckgo.com': 'DuckDuckGo', 'paypal.com': 'PayPal', 'nasa.gov': 'NASA',
    'neal.fun': 'neal.fun', 'xkcd.com': 'xkcd', 'producthunt.com': 'Product Hunt', 'arstechnica.com': 'Ars Technica',
    'google.com': 'Google', 'python.org': 'Python Docs', 'chess.com': 'Chess.com', 'zoom.us': 'Zoom', 'notion.so': 'Notion',
    'linear.app': 'Linear', 'twitch.tv': 'Twitch', 'itch.io': 'itch.io', 'epicgames.com': 'Epic Games', 'airbnb.com': 'Airbnb',
    'openai.com': 'OpenAI', 'gemini.google.com': 'Gemini', 'perplexity.ai': 'Perplexity', 'bestbuy.com': 'Best Buy',
    'aliexpress.com': 'AliExpress', 'outlook.live.com': 'Outlook', 'web.whatsapp.com': 'WhatsApp',
  };
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  BC.brandOf = function (domain) {
    if (BRANDS[domain]) return BRANDS[domain];
    if (/^\d+\.\d+\.\d+\.\d+$/.test(domain)) return domain;
    const parts = domain.split('.');
    const baseKey = parts.slice(-2).join('.');
    if (parts.length >= 3 && KEEP_SUB.has(baseKey)) {
      const baseName = BRANDS[baseKey] || cap(parts[parts.length - 2]);
      return baseName + ' ' + cap(parts[0]);
    }
    const label = parts.length > 2 && MULTI.has(parts.slice(-2).join('.')) ? parts[parts.length - 3] : parts[parts.length - 2];
    return label
      .split('-')
      .map(cap)
      .join(' ');
  };

  // ---------- classification ----------
  const CAT_LIST = {
    code:
      'github.com gitlab.com bitbucket.org stackoverflow.com stackexchange.com superuser.com serverfault.com askubuntu.com npmjs.com pypi.org crates.io pkg.go.dev rubygems.org nuget.org packagist.org developer.mozilla.org mozilla.org localhost vercel.com netlify.com heroku.com render.com fly.io railway.app supabase.com firebase.google.com cloud.google.com console.cloud.google.com aws.amazon.com azure.com portal.azure.com digitalocean.com cloudflare.com docker.com kubernetes.io codepen.io codesandbox.io replit.com jsfiddle.net glitch.com dev.to hashnode.com hashnode.dev css-tricks.com smashingmagazine.com python.org nodejs.org reactjs.org react.dev nextjs.org vuejs.org svelte.dev angular.io angular.dev typescriptlang.org rust-lang.org go.dev golang.org kotlinlang.org swift.org developer.apple.com learn.microsoft.com docs.microsoft.com chatgpt.com openai.com claude.ai anthropic.com gemini.google.com aistudio.google.com perplexity.ai huggingface.co kaggle.com colab.research.google.com figma.com sentry.io postman.com jetbrains.com visualstudio.com tailwindcss.com getbootstrap.com regex101.com caniuse.com jsdelivr.com unpkg.com cdnjs.com sourcegraph.com vitejs.dev deno.com bun.sh stripe.com readthedocs.io readthedocs.org gitbook.io mdn.dev web.dev phind.com cursor.com cursor.sh copilot.microsoft.com',
    social:
      'facebook.com instagram.com twitter.com x.com reddit.com linkedin.com tiktok.com pinterest.com tumblr.com discord.com discord.gg whatsapp.com web.whatsapp.com messenger.com telegram.org snapchat.com threads.net bsky.app mastodon.social quora.com 9gag.com imgur.com vk.com weibo.com nextdoor.com meetup.com tinder.com bumble.com hinge.co lemmy.world tildes.net',
    watch:
      'youtube.com youtu.be netflix.com twitch.tv spotify.com soundcloud.com primevideo.com hulu.com disneyplus.com hbomax.com max.com vimeo.com crunchyroll.com music.apple.com tv.apple.com bandcamp.com imdb.com letterboxd.com hotstar.com jiocinema.com dailymotion.com deezer.com tidal.com last.fm pandora.com peacocktv.com paramountplus.com mubi.com rottentomatoes.com nebula.tv kick.com',
    news:
      'nytimes.com bbc.com bbc.co.uk cnn.com theguardian.com washingtonpost.com reuters.com apnews.com bloomberg.com medium.com substack.com theverge.com techcrunch.com wired.com arstechnica.com news.ycombinator.com ycombinator.com aljazeera.com ndtv.com timesofindia.com indiatimes.com hindustantimes.com thehindu.com economist.com ft.com wsj.com npr.org vox.com buzzfeed.com engadget.com theatlantic.com newyorker.com axios.com politico.com news.google.com lobste.rs slashdot.org 9to5mac.com macrumors.com gizmodo.com lifehacker.com xkcd.com producthunt.com nature.com scientificamerican.com',
    shop:
      'amazon.com amazon.in amazon.co.uk ebay.com etsy.com walmart.com target.com bestbuy.com aliexpress.com flipkart.com myntra.com ikea.com shopify.com zara.com hm.com nike.com adidas.com apple.com wayfair.com costco.com temu.com shein.com meesho.com ajio.com nykaa.com swiggy.com zomato.com doordash.com ubereats.com instacart.com uniqlo.com asos.com newegg.com homedepot.com lowes.com sephora.com glossier.com grubhub.com deliveroo.co.uk',
    learn:
      'wikipedia.org wikimedia.org wiktionary.org coursera.org udemy.com khanacademy.org edx.org duolingo.com quizlet.com chegg.com britannica.com arxiv.org scholar.google.com researchgate.net wolframalpha.com brilliant.org w3schools.com geeksforgeeks.org freecodecamp.org codecademy.com leetcode.com hackerrank.com mit.edu stanford.edu harvard.edu ted.com sciencedirect.com jstor.org pubmed.ncbi.nlm.nih.gov ncbi.nlm.nih.gov semanticscholar.org overleaf.com desmos.com',
    work:
      'google.com mail.google.com calendar.google.com docs.google.com drive.google.com sheets.google.com meet.google.com translate.google.com outlook.live.com outlook.office.com office.com microsoft.com teams.microsoft.com zoom.us slack.com notion.so trello.com asana.com atlassian.net atlassian.com jira.com dropbox.com box.com bing.com duckduckgo.com yahoo.com mail.yahoo.com paypal.com chase.com bankofamerica.com wellsfargo.com hdfcbank.com icicibank.com linear.app monday.com clickup.com airtable.com miro.com calendly.com docusign.com quickbooks.intuit.com intuit.com wise.com revolut.com ecosia.org startpage.com search.brave.com kagi.com proton.me mail.proton.me fastmail.com loom.com',
    play:
      'steampowered.com steamcommunity.com epicgames.com roblox.com chess.com lichess.org itch.io ign.com gamespot.com nintendo.com playstation.com xbox.com minecraft.net poki.com miniclip.com riotgames.com leagueoflegends.com battle.net geoguessr.com neal.fun kongregate.com crazygames.com polygon.com kotaku.com pcgamer.com speedrun.com chess24.com',
    misc:
      'maps.google.com airbnb.com booking.com tripadvisor.com expedia.com weather.com accuweather.com allrecipes.com strava.com goodreads.com canva.com archive.org timeanddate.com nasa.gov zillow.com photos.google.com',
  };
  const DOMAIN_CAT = {};
  for (const cat in CAT_LIST) for (const d of CAT_LIST[cat].split(/\s+/)) if (d) DOMAIN_CAT[d] = cat;

  const DOMAIN_RULES = [
    [/game|arcade|chess|puzzle|steam|gaming/, 'play'],
    [/tube|video|movie|film|music|stream|anime|radio|podcast|cinema|flix|sound|tv\./, 'watch'],
    [/shop|store|buy|mart|deal|outlet|boutique|cart|bazaar|kitchen|eats|food|pizza/, 'shop'],
    [/learn|course|school|academy|universit|college|tutor|wiki|study|lesson|\.edu$|\.ac\.[a-z]{2}$/, 'learn'],
    [/news|times|post|herald|journal|gazette|tribune|daily|blog|press|magazine|review|digest/, 'news'],
    [/social|chat|forum|community|friends|club/, 'social'],
    [/mail|bank|pay|finance|calendar|office|drive|search|invoice|tax|\.gov$|\.gov\.[a-z]{2}$/, 'work'],
    [/dev|code|git|api|docs|cloud|lab|tools|\.io$|\.ai$|\.dev$|\.sh$|\.app$/, 'code'],
  ];
  const TITLE_RULES = [
    [/\b(pull request|repository|api|documentation|docs|sdk|npm|error|exception|function)\b/, 'code'],
    [/\b(breaking|opinion|editorial|headlines|news)\b/, 'news'],
    [/\b(cart|checkout|buy|price|order|deal)\b/, 'shop'],
    [/\b(tutorial|course|lecture|learn|encyclopedia|wiki)\b/, 'learn'],
    [/\b(watch|episode|trailer|playlist|song|album|official video)\b/, 'watch'],
    [/\b(game|play now|level|leaderboard)\b/, 'play'],
    [/\b(inbox|calendar|meeting|dashboard|invoice|account)\b/, 'work'],
  ];

  BC.classify = function (domain, titleText) {
    if (DOMAIN_CAT[domain]) return DOMAIN_CAT[domain];
    const parts = domain.split('.');
    const base = parts.slice(-2).join('.');
    if (DOMAIN_CAT[base]) return DOMAIN_CAT[base];
    for (const [re, cat] of DOMAIN_RULES) if (re.test(domain)) return cat;
    if (titleText) {
      const t = titleText.toLowerCase();
      for (const [re, cat] of TITLE_RULES) if (re.test(t)) return cat;
    }
    return 'misc';
  };

  // ---------- aggregation ----------
  function cleanTitle(t) {
    if (!t) return '';
    t = String(t).replace(/\s+/g, ' ').trim();
    if (!t || /^https?:\/\//.test(t)) return '';
    return t.length > 90 ? t.slice(0, 88) + '…' : t;
  }

  const DAYLOG_DAYS = 70;
  BC.dayOf = (t) => Math.floor((t - new Date(t).getTimezoneOffset() * 60000) / 864e5);
  BC.dayStart = (day) => {
    const guess = day * 864e5;
    return guess + new Date(guess).getTimezoneOffset() * 60000;
  };

  // items: [{ url | domain, title, t (ms epoch, optional) }]
  BC.aggregate = function (items, meta = {}) {
    const hasTime = items.some((x) => x.t > 0);
    if (hasTime) items.sort((a, b) => (a.t || 0) - (b.t || 0));
    const map = new Map();
    const trans = new Map();
    const cityHours = new Array(24).fill(0);
    let prev = null, prevT = 0, t0 = Infinity, t1 = -Infinity, total = 0;
    // for "a day in your life": the ordered visits of recent days; for weather: late-night counts
    const tEnd = hasTime ? items[items.length - 1].t : 0;
    const seqFrom = tEnd - DAYLOG_DAYS * 864e5;
    const seq = [];
    const dayTotals = new Map();
    const late = new Map();
    for (const it of items) {
      const dom = it.domain || BC.domainOf(it.url);
      if (!dom) continue;
      let s = map.get(dom);
      if (!s) {
        s = { domain: dom, visits: 0, hours: new Array(24).fill(0), wd: new Array(7).fill(0), first: 0, last: 0, dayMap: new Map(), titleMap: new Map() };
        map.set(dom, s);
      }
      s.visits++;
      total++;
      const tt = cleanTitle(it.title);
      if (tt && (s.titleMap.size < 300 || s.titleMap.has(tt))) s.titleMap.set(tt, (s.titleMap.get(tt) || 0) + 1);
      if (hasTime && it.t > 0) {
        const dt = new Date(it.t);
        const h = dt.getHours();
        s.hours[h]++;
        cityHours[h]++;
        s.wd[(dt.getDay() + 6) % 7]++;
        if (!s.first || it.t < s.first) s.first = it.t;
        if (it.t > s.last) s.last = it.t;
        const day = Math.floor((it.t - dt.getTimezoneOffset() * 60000) / 864e5);
        s.dayMap.set(day, (s.dayMap.get(day) || 0) + 1);
        if (it.t < t0) t0 = it.t;
        if (it.t > t1) t1 = it.t;
        dayTotals.set(day, (dayTotals.get(day) || 0) + 1);
        if (h >= 22) late.set(day, (late.get(day) || 0) + 1);
        else if (h < 4) late.set(day - 1, (late.get(day - 1) || 0) + 1);
        if (it.t >= seqFrom) {
          const last = seq[seq.length - 1];
          if (!last || last[0] !== day || last[2] !== dom) seq.push([day, h * 60 + dt.getMinutes(), dom]);
        }
        if (prev && prev !== dom && it.t - prevT < 20 * 60000) {
          const k = prev + '\u0001' + dom;
          trans.set(k, (trans.get(k) || 0) + 1);
        }
        prev = dom;
        prevT = it.t;
      }
    }
    const sites = [];
    for (const s of map.values()) {
      const titles = [...s.titleMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
      const days = [...s.dayMap.entries()].sort((a, b) => a[0] - b[0]);
      sites.push({
        domain: s.domain,
        name: BC.brandOf(s.domain),
        cat: BC.classify(s.domain, titles.slice(0, 3).map((t) => t[0]).join(' · ')),
        visits: s.visits,
        hours: s.hours,
        wd: s.wd,
        first: s.first,
        last: s.last,
        days,
        titles,
      });
    }
    sites.sort((a, b) => b.visits - a.visits || a.domain.localeCompare(b.domain));
    const transitions = [...trans.entries()]
      .map(([k, c]) => {
        const [a, b] = k.split('\u0001');
        return [a, b, c];
      })
      .sort((a, b) => b[2] - a[2])
      .slice(0, 5000);
    const index = new Map(sites.map((s, i) => [s.domain, i]));
    const daylog = {};
    for (const [day, m, dom] of seq) {
      const i = index.get(dom);
      if (i == null || i >= 420) continue;
      (daylog[day] || (daylog[day] = [])).push(m, i);
    }
    const dayTotalsObj = {};
    for (const d in daylog) dayTotalsObj[d] = dayTotals.get(+d) || 0;
    return {
      sites,
      transitions,
      total,
      t0: hasTime ? t0 : 0,
      t1: hasTime ? t1 : 0,
      hasTime,
      cityHours,
      daylog,
      dayTotals: dayTotalsObj,
      nights: [...late.entries()].sort((a, b) => a[0] - b[0]),
      source: meta.source || 'import',
      label: meta.label || 'Your city',
    };
  };

  // ---------- persistence ----------
  const KEY = 'browser-city:v1';
  BC.store = {
    save(ds) {
      try {
        const keep = ds.sites.slice(0, 420);
        const set = new Set(keep.map((s) => s.domain));
        const slim = Object.assign({}, ds, {
          sites: keep,
          extraSites: Math.max(0, ds.sites.length - keep.length) + (ds.extraSites || 0),
          transitions: ds.transitions.filter((t) => set.has(t[0]) && set.has(t[1])).slice(0, 3000),
        });
        localStorage.setItem(KEY, JSON.stringify(slim));
        return true;
      } catch (e) {
        return false;
      }
    },
    load() {
      try {
        const raw = localStorage.getItem(KEY);
        if (!raw) return null;
        const ds = JSON.parse(raw);
        return ds && Array.isArray(ds.sites) && ds.sites.length ? ds : null;
      } catch (e) {
        return null;
      }
    },
    clear() {
      try {
        localStorage.removeItem(KEY);
      } catch (e) {}
    },
  };

  // ---------- demo town ----------
  // [domain, visits per day, rhythm, flag]
  const DEMO = [
    ['google.com', 30, 'allday'], ['youtube.com', 22, 'night'], ['github.com', 18, 'work'],
    ['mail.google.com', 10, 'work'], ['reddit.com', 12, 'evening'], ['localhost', 10, 'work'],
    ['chatgpt.com', 7, 'allday'], ['claude.ai', 8, 'work'], ['stackoverflow.com', 7, 'work'],
    ['slack.com', 7, 'work'], ['x.com', 6, 'allday'], ['news.ycombinator.com', 6, 'morning'],
    ['wikipedia.org', 6, 'allday'], ['docs.google.com', 5, 'work'], ['instagram.com', 5, 'evening'],
    ['spotify.com', 5, 'work'], ['notion.so', 4, 'work'], ['discord.com', 4, 'night'],
    ['amazon.com', 3.5, 'evening'], ['developer.mozilla.org', 3.5, 'work'], ['calendar.google.com', 3.5, 'work'],
    ['whatsapp.com', 3.5, 'allday'], ['figma.com', 3, 'work'], ['linear.app', 3, 'work'],
    ['netflix.com', 2.6, 'night'], ['nytimes.com', 2.6, 'morning'], ['linkedin.com', 2.5, 'work'],
    ['chess.com', 2.6, 'night'], ['theverge.com', 2, 'morning'], ['twitch.tv', 1.8, 'night'],
    ['bbc.com', 1.8, 'morning'], ['medium.com', 1.7, 'lunch'], ['drive.google.com', 1.7, 'work'],
    ['duolingo.com', 1.5, 'morning'], ['zoom.us', 1.4, 'work'], ['python.org', 1.3, 'work'],
    ['translate.google.com', 1.2, 'allday'], ['theguardian.com', 1.2, 'morning'], ['arxiv.org', 1.1, 'work'],
    ['meet.google.com', 1.1, 'work'], ['imdb.com', 1.1, 'evening'], ['leetcode.com', 1, 'evening'],
    ['doordash.com', 1, 'evening'], ['facebook.com', 1, 'evening'], ['coursera.org', 0.9, 'evening'],
    ['substack.com', 0.9, 'morning'], ['steampowered.com', 0.9, 'weekend'], ['bsky.app', 0.9, 'morning'],
    ['weather.com', 0.9, 'morning'], ['vercel.com', 0.9, 'work'], ['geeksforgeeks.org', 0.8, 'work'],
    ['huggingface.co', 1.4, 'work', 'new'], ['geoguessr.com', 1.6, 'evening', 'new'], ['etsy.com', 0.7, 'weekend'],
    ['strava.com', 0.7, 'morning'], ['pinterest.com', 0.7, 'weekend'], ['arstechnica.com', 0.7, 'lunch'],
    ['lichess.org', 0.7, 'night'], ['scholar.google.com', 0.7, 'work'], ['npmjs.com', 0.7, 'work'],
    ['aws.amazon.com', 0.6, 'work'], ['letterboxd.com', 0.6, 'weekend'], ['crunchyroll.com', 0.6, 'night'],
    ['w3schools.com', 0.6, 'work'], ['primevideo.com', 0.6, 'weekend'], ['ebay.com', 0.5, 'evening'],
    ['techcrunch.com', 0.5, 'morning'], ['reuters.com', 0.5, 'morning'], ['wired.com', 0.5, 'lunch'],
    ['goodreads.com', 0.5, 'evening'], ['airbnb.com', 0.5, 'weekend'], ['canva.com', 0.5, 'work'],
    ['khanacademy.org', 0.4, 'evening'], ['soundcloud.com', 0.4, 'night'], ['music.apple.com', 0.4, 'evening'],
    ['codepen.io', 0.4, 'evening'], ['kaggle.com', 0.4, 'work'], ['apple.com', 0.4, 'evening'],
    ['ikea.com', 0.35, 'weekend'], ['itch.io', 0.35, 'weekend'], ['allrecipes.com', 0.35, 'evening'],
    ['dropbox.com', 0.35, 'work'], ['wolframalpha.com', 0.3, 'work'], ['ign.com', 0.3, 'evening'],
    ['quora.com', 0.3, 'lunch'], ['dev.to', 0.3, 'morning'], ['target.com', 0.3, 'weekend'],
    ['economist.com', 0.3, 'weekend'], ['trello.com', 0.9, 'work', 'faded'], ['epicgames.com', 0.25, 'weekend'],
    ['zillow.com', 0.25, 'weekend'], ['booking.com', 0.25, 'weekend'], ['bloomberg.com', 0.25, 'morning'],
    ['instacart.com', 0.25, 'weekend'], ['udemy.com', 0.8, 'evening', 'faded'], ['archive.org', 0.2, 'night'],
    ['tumblr.com', 0.6, 'night', 'faded'], ['bestbuy.com', 0.2, 'weekend'], ['duckduckgo.com', 0.2, 'allday'],
    ['quizlet.com', 0.5, 'evening', 'faded'], ['threads.net', 0.2, 'evening'], ['nasa.gov', 0.15, 'night'],
    ['timeanddate.com', 0.15, 'work'], ['roblox.com', 0.12, 'weekend'], ['neal.fun', 0.12, 'night'],
    ['britannica.com', 0.12, 'work'], ['uniqlo.com', 0.12, 'weekend'], ['tripadvisor.com', 0.12, 'weekend'],
    ['paypal.com', 0.12, 'evening'], ['bandcamp.com', 0.12, 'night'], ['vimeo.com', 0.1, 'work'],
    ['poki.com', 0.1, 'evening'], ['nature.com', 0.1, 'work'], ['producthunt.com', 0.1, 'morning'], ['xkcd.com', 0.1, 'lunch'],
  ];
  const TITLES = {
    'google.com': ['Google', 'how to center a div - Google Search', 'weather tomorrow - Google Search', 'best ramen near me - Google Search', 'Google Maps'],
    'youtube.com': ['YouTube', 'lofi hip hop radio – beats to relax/study to', 'How Cities Are Designed (40 min deep dive)', 'Tiny Desk Concert', 'Building a miniature diorama from scratch'],
    'github.com': ['GitHub', 'Pull requests · browser-city', 'Issues · browser-city', 'Notifications', 'Your Repositories'],
    'mail.google.com': ['Inbox (3)', 'Inbox (12)', 'Sent Mail', 'Drafts'],
    'reddit.com': ['r/CozyPlaces', 'r/webdev', 'r/AskReddit', 'r/MapPorn', 'Reddit - Dive into anything'],
    localhost: ['localhost:3000', 'Vite App – localhost:5173', 'dashboard – localhost:8080'],
    'chatgpt.com': ['ChatGPT', 'Regex for email validation', 'Trip itinerary for Kyoto'],
    'claude.ai': ['Claude', 'Refactoring the layout engine', 'Brainstorm: names for a tiny city'],
    'stackoverflow.com': ['How do I undo the most recent local commits in Git?', 'Why is my canvas blurry on retina displays?', 'What does "use strict" do in JavaScript?'],
    'slack.com': ['#general', '#design-crit', '#random', 'Threads'],
    'x.com': ['Home / X', 'Notifications / X', 'Explore / X'],
    'news.ycombinator.com': ['Hacker News', 'Show HN: I built a city out of my browser tabs', 'Ask HN: What are you working on?'],
    'wikipedia.org': ['Isometric video game graphics', 'Pastel (color)', 'List of tallest buildings', 'Ferris wheel', 'Desire path'],
    'docs.google.com': ['Q3 planning – Google Docs', 'Reading list – Google Sheets', 'Team offsite – Google Slides'],
    'instagram.com': ['Instagram', 'Reels', 'Direct'],
    'spotify.com': ['Discover Weekly', 'Liked Songs', 'daylist • sleepy sunday morning'],
    'notion.so': ['Weekly plan', 'Ideas backlog', 'Reading notes'],
    'discord.com': ['#general | Pixel Pals', 'Direct Messages', '#voice-chat | Game Night'],
    'amazon.com': ['Your Orders', 'mechanical keyboard', 'Shopping Cart'],
    'developer.mozilla.org': ['CanvasRenderingContext2D – Web APIs', 'Array.prototype.reduce()', 'CSS Grid Layout'],
    'calendar.google.com': ['Google Calendar – Week of Oct 6', 'Google Calendar – Today'],
    'figma.com': ['Browser City – moodboard', 'Icons v3', 'Design system'],
    'linear.app': ['My issues', 'Cycle 42', 'Roadmap'],
    'netflix.com': ['Netflix', 'Continue watching', 'Documentaries'],
    'nytimes.com': ['The New York Times', 'Wordle', 'The Crossword', 'Connections'],
    'chess.com': ['Play Chess Online', 'Puzzle Rush', 'Daily Puzzle'],
  };
  const GENERIC = {
    code: ['Docs', 'Getting started', 'API reference', 'Dashboard'],
    social: ['Home', 'Notifications', 'Messages'],
    watch: ['Home', 'Watch later', 'Now playing'],
    news: ['Front page', 'Top stories', 'Long read'],
    shop: ['Home', 'Cart', 'Your orders'],
    learn: ['Course home', 'Lesson 4', 'Search'],
    work: ['Home', 'Inbox', 'Search results'],
    play: ['Play', 'Leaderboard', 'Daily challenge'],
    misc: ['Home', 'Search', 'Saved'],
  };
  const PROFILES = {
    work: { peaks: [[10, 1.6, 1], [14.5, 2, 1], [21, 1.5, 0.22]], wd: 1, we: 0.28 },
    allday: { peaks: [[9, 2, 0.7], [13, 2, 0.8], [17, 2, 0.7], [21.5, 1.8, 0.8]], wd: 1, we: 1 },
    evening: { peaks: [[13, 1.2, 0.3], [20.5, 1.8, 1]], wd: 0.8, we: 1.4 },
    night: { peaks: [[22.5, 1.6, 1], [1, 1.2, 0.45], [13, 1.5, 0.15]], wd: 0.9, we: 1.3 },
    morning: { peaks: [[7.8, 1.1, 1], [12.5, 1, 0.35], [22, 1, 0.15]], wd: 1, we: 0.8 },
    lunch: { peaks: [[12.6, 0.8, 1], [18.5, 1.5, 0.4]], wd: 1, we: 0.6 },
    weekend: { peaks: [[11, 2, 1], [16, 2, 0.8], [21, 1.5, 0.6]], wd: 0.35, we: 2.2 },
  };
  const AFF = {
    'github.com': ['stackoverflow.com', 'localhost', 'developer.mozilla.org', 'npmjs.com', 'vercel.com', 'claude.ai'],
    'google.com': ['wikipedia.org', 'stackoverflow.com', 'youtube.com', 'reddit.com', 'weather.com'],
    'reddit.com': ['youtube.com', 'x.com', 'instagram.com'],
    'mail.google.com': ['calendar.google.com', 'docs.google.com', 'zoom.us', 'meet.google.com', 'slack.com'],
    'slack.com': ['linear.app', 'notion.so', 'github.com', 'docs.google.com', 'figma.com'],
    'news.ycombinator.com': ['github.com', 'arstechnica.com', 'theverge.com', 'substack.com'],
    'youtube.com': ['reddit.com', 'netflix.com', 'twitch.tv', 'spotify.com'],
    'chatgpt.com': ['stackoverflow.com', 'github.com', 'python.org'],
    'claude.ai': ['github.com', 'localhost', 'developer.mozilla.org'],
    'amazon.com': ['ebay.com', 'target.com', 'bestbuy.com'],
    'imdb.com': ['letterboxd.com', 'netflix.com', 'primevideo.com'],
    'chess.com': ['lichess.org', 'youtube.com'],
    'figma.com': ['slack.com', 'linear.app'],
    'wikipedia.org': ['britannica.com', 'arxiv.org', 'google.com'],
    'instagram.com': ['pinterest.com', 'whatsapp.com'],
    localhost: ['github.com', 'stackoverflow.com', 'developer.mozilla.org'],
  };
  const W1 = 'tiny paper moss pixel honey maple cloud otter lantern velvet pebble sprout quiet amber cosmic marble fern citrus orbit willow'.split(' ');
  const W2 = 'notes press kitchen journal lab garden works studio radio atlas post club tools review index diaries shop academy'.split(' ');
  const TLD = ['.com', '.net', '.org', '.io', '.blog', '.co'];

  function poisson(R, l) {
    if (l <= 0) return 0;
    if (l > 30) return Math.max(0, Math.round(l + Math.sqrt(l) * R.gauss()));
    const L = Math.exp(-l);
    let k = 0, p = 1;
    do {
      k++;
      p *= R();
    } while (p > L);
    return k - 1;
  }
  function sampleHour(R, prof) {
    let tot = 0;
    for (const p of prof.peaks) tot += p[2];
    let x = R() * tot, pk = prof.peaks[0];
    for (const p of prof.peaks) {
      if ((x -= p[2]) <= 0) {
        pk = p;
        break;
      }
    }
    return (((pk[0] + R.gauss() * pk[1]) % 24) + 24) % 24;
  }

  BC.makeDemo = function () {
    const R = U.rng(20261009);
    const DAYS = 120;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const start = today - (DAYS - 1) * 864e5;
    const list = DEMO.slice();
    const used = new Set(list.map((x) => x[0]));
    for (let k = 0; k < 70; k++) {
      const d = R.pick(W1) + R.pick(W2) + R.pick(TLD);
      if (used.has(d)) continue;
      used.add(d);
      list.push([d, R.range(0.012, 0.06), R.pick(Object.keys(PROFILES))]);
    }
    const nowT = Date.now();
    const visits = [];
    const add = (dom, t) => {
      if (t > nowT) return;
      const titles = TITLES[dom];
      let title;
      if (titles && titles.length) {
        const k = Math.min(titles.length - 1, Math.floor(Math.pow(R(), 1.8) * titles.length));
        title = titles[k];
      } else {
        const g = GENERIC[BC.classify(dom)];
        title = BC.brandOf(dom) + ' – ' + g[Math.floor(Math.pow(R(), 1.5) * g.length)];
      }
      visits.push({ domain: dom, title, t });
    };
    for (const [dom, rate, prof, flag] of list) {
      const P = PROFILES[prof];
      const d0 = flag === 'new' ? DAYS - 12 : 0;
      const d1 = flag === 'faded' ? 42 : DAYS;
      for (let d = d0; d < d1; d++) {
        const date = new Date(start + d * 864e5);
        const wd = date.getDay();
        const weekend = wd === 0 || wd === 6;
        const f = (weekend ? P.we : P.wd) * (0.55 + R() * 0.9) * 0.6 * (0.8 + (0.4 * d) / DAYS);
        const n = poisson(R, rate * f);
        for (let k = 0; k < n; k++) {
          const t = date.getTime() + sampleHour(R, P) * 3600e3;
          add(dom, t);
          const aff = AFF[dom];
          if (aff && R() < 0.35) {
            const nxt = R.pick(aff);
            const t2 = t + R.range(20, 360) * 1000;
            add(nxt, t2);
            if (AFF[nxt] && R() < 0.3) add(R.pick(AFF[nxt]), t2 + R.range(20, 300) * 1000);
          }
        }
      }
    }
    // a handful of late nights (including the last two) so the weather has a story to tell
    const BINGE = ['youtube.com', 'reddit.com', 'discord.com', 'twitch.tv', 'x.com', 'chess.com', 'netflix.com', 'wikipedia.org'];
    const lateNights = new Set([DAYS - 2, DAYS - 3]);
    while (lateNights.size < 10) lateNights.add(R.int(5, DAYS - 5));
    for (const d of lateNights) {
      let t = start + d * 864e5 + R.range(22.3, 23.2) * 3600e3;
      const n = R.int(28, 48);
      for (let k = 0; k < n; k++) {
        add(R.pick(BINGE), t);
        t += R.range(1.5, 7) * 60000;
      }
    }
    const ds = BC.aggregate(visits, { source: 'demo', label: 'The demo town' });
    ds.extraSites = 412; // pretend one-off visits that become the woods
    return ds;
  };
})();
