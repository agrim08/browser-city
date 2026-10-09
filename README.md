# Browser City

Your browsing history, rebuilt as a tiny isometric town.

- **Every site is a building.** The more you visit, the taller it grows. Your most-visited sites become landmarks downtown, each with a style that fits its district: spires, clock towers, picture palaces, observatories, planetariums.
- **Your interests are neighbourhoods.** Tinker Quarter (code and AI), Chatterbox Commons (social), Marquee Row (video and music), Inkwell Lane (news), Market Hollow (shopping), Scholar's Hill (learning), Clockwork Commons (work and search), Arcade Bay (games) and Wanderer's Edge (everything else).
- **Tab hops are traffic.** Cars drive between sites you really did visit back to back, weighted by how often you made that hop. Click a car to see where it's going.
- **Time is alive.** The clock follows your own rhythm: traffic and crowds swell at your busy hours, buildings give off hearts, notes, coins or `</>` when you usually visit them, and windows light up at night. Shadows follow the sun.
- **Little stories.** Ivy grows on favourites you've stopped visiting, new arrivals hang bunting, and sites you visited only once become trees in the Whispering Woods.

- **Weather from your habits.** A night you stayed online far later than usual brings rain that evening (pedestrians open umbrellas, puddles ripple). The morning after brings a rainbow.
- **Fireworks at rush hour.** When the clock reaches your busiest hour, the biggest landmarks light up the sky.
- **Fireflies** drift through the Whispering Woods after dark.
- **Sound (off by default).** Synthesized live, no audio files: birdsong by day, crickets at night, rain, and a traffic hum that swells at your busy hours.

Click anything. Clicking a car lets you **ride along** to its destination. Clicking a building sends someone up to **knock on its door**. Buildings open a story card with a 24-hour sundial, weekday rhythm, a "building directory" of your most-read pages, and where you usually head next. You can also take the bus **Tour**, **Replay** the city growing day by day, or save a **Postcard**.

**A day** opens a calendar of your last ~10 weeks (late nights are marked with a raindrop). Pick a day and watch it play out visit by visit: each site you opened lights up, a pin follows you around town, every hop sends a car, quiet stretches fast-forward, and that day's weather rolls in.

A short **quick guide** opens when the page loads (tick "Don't show this when the page opens" to skip it next time). Press **?** or the help button at the bottom right to bring it back. While a page of the guide is open, the controls it mentions glow on screen.

## Run it

No build step. Open `index.html` in a browser, or serve the folder:

```sh
python -m http.server 8765
```

## Using your own history

Click **Build my city** and drop in any of these:

| Source | File |
| --- | --- |
| Chrome / Edge / Brave / Arc | `History` (SQLite, in the profile folder; copy it first, since the browser locks it) |
| Firefox | `places.sqlite` |
| Safari | `History.json` (File › Export Browsing Data) or `History.db` |
| Google Takeout | `Chrome/History.json` / `BrowserHistory.json` |
| Anything else | a .txt / .csv / .json full of URLs, or paste links |

Everything is parsed in the page. SQLite files are read with [sql.js](https://sql.js.org) (loaded from cdnjs only when needed). Nothing is uploaded. Your city is kept in `localStorage` so it's there next time, and "Forget my city" removes it.

## Code map

- `js/data.js`: districts, domain parsing, classification, demo history, aggregation
- `js/importers.js`: Chromium / Firefox / Safari / Takeout / plain-text readers
- `js/city.js`: layout (districts grow from a central plaza, landmarks downtown, parks, woods)
- `js/art.js`: procedural isometric drawing for every building style, tree, car and amenity
- `js/sim.js`: traffic, pedestrians, visitors, fireworks, fireflies, particles, clouds, birds
- `js/sound.js`: the synthesized soundscape
- `js/render.js`: camera, sky, sprite caching, sun shadows, depth sorting, picking
- `js/ui.js`: cards, search, tour, replay, postcard, importer, input
