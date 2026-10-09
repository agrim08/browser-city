/* Browser City — bootstrap and the main loop. */
(function () {
  const canvas = document.getElementById('city');
  BC.render.init(canvas);
  BC.ui.init(canvas);

  BC.app = {
    setDataset(ds, opts = {}) {
      const city = BC.buildCity(ds);
      BC.render.setCity(city);
      BC.sim.reset(city);
      BC.ui.onCity(city);
      if (opts.intro !== false) BC.render.playIntro();
      return city;
    },
  };

  const saved = BC.store.load();
  BC.app.setDataset(saved || BC.makeDemo());
  if (!BC.ui.guideOff()) BC.ui.showGuide(0);
  else if (saved) BC.ui.toast('Welcome back! Your city kept the lights on for you. Press <b>?</b> for the quick guide.', 5000);

  // canvas text uses the web fonts: redraw cached sprites once they arrive
  if (document.fonts) {
    Promise.all(['600 12px Fredoka', '700 12px Fredoka', '500 12px Fredoka'].map((f) => document.fonts.load(f)))
      .then(() => BC.render.clearSprites())
      .catch(() => {});
  }

  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    try {
      BC.render.frame(dt);
      BC.ui.tick(dt);
    } catch (e) {
      console.error(e);
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
