/* Browser City — a small, honest visitor counter.
   This is the one thing on the page that talks to a server: once per page load it pings
   a free public hit-counter and shows the total back. If you're reading this wondering —
   no, this has nothing to do with your browsing history, which still never leaves the tab.
   It just counts how many times this page has been opened. If the service is unreachable
   (offline, blocked, or just down) the badge quietly stays hidden instead of erroring. */
(function () {
  const badge = document.getElementById('visitorBadge');
  const countEl = document.getElementById('visitorCount');
  if (!badge || !countEl) return;

  // unique-ish namespace so this counter doesn't collide with anyone else's on the same free service
  const ENDPOINT = 'https://abacus.jasoncameron.dev/hit/browser-city-f3n0x8/home';

  fetch(ENDPOINT, { cache: 'no-store' })
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => {
      if (!d || typeof d.value !== 'number') return;
      const n = (window.BC && BC.util ? BC.util.fmt(d.value) : String(Math.round(d.value)));
      countEl.textContent = n;
      badge.title = `You're visit #${n} to Browser City`;
      badge.hidden = false;
      requestAnimationFrame(() => badge.classList.add('show'));
    })
    .catch(() => {}); // offline, blocked by an extension, or the counter's down — stay hidden, no fuss

  badge.addEventListener('click', () => {
    const n = countEl.textContent;
    if (window.BC && BC.ui) BC.ui.toast(`You're visit <b>#${n}</b> to Browser City. Thanks for stopping by!`, 4500);
  });
})();
