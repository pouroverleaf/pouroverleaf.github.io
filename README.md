# pouroverleaf.github.io

Main website of pouroverleaf, a coffee and research club at the School of
Informatics, University of Edinburgh. React app built with Vite and served by
GitHub Pages.

One page, four panes. Wheel/trackpad drags the pane with rubber-band
resistance: let go early and it springs back, push past ~40% and it commits
with a short overshoot. Arrow keys, the index bar on the left, and the ↑/↓
buttons (bottom centre on home, top right elsewhere) also move between panes.
Hash routes: `#home #about #team #logs #gallery`.

| # | pane     | what is on it                                                                 |
|---|----------|-------------------------------------------------------------------------------|
| 1 | home     | three.js globe with pins for three toggleable layers, next-session box         |
| 2 | about    | text flowed into the side profile of a Hario Switch (cone, neck, flange, base) |
| 3 | team     | ASCII roundtable with committee cards around it, facing the centre            |
| 4 | logs     | cards spread into a cyclic log wheel on the left, log text on the right       |
| 5 | gallery  | looping cover-flow photo carousel                                             |

An animated site-percolation lattice runs behind everything. On the logs
pane the club logo is projected into it (p = 0.710 inside the logo, 0.318 outside).
On logs and gallery, scrolling only browses the items; leave with the ↑/↓
buttons, the index bar, or the keyboard (↑/↓ on gallery, Esc or PageUp on logs).

## Editing content

Everything you write lives in `src/content/`:

```
about.md            about text. Justified into the Switch silhouette; ~100–130 words fits.
home.md             the tagline on the home pane, one line per line
session.md          frontmatter: time, where. Optional: theme, bean, country, process, variety, roaster, roasted, notes
team/NN-role.md     one committee member per file, ordered by filename.
                    frontmatter: name, title, color, optional img (/img/...). body = bio
places/farms.md     one globe layer per file. frontmatter: label, color.
places/labs.md      body: a markdown table, one point per row:
places/cafes.md     name | place | lat | lon | (process | variety | altitude | notes) or (note)
logs/*.md           research logs. frontmatter: title, date (YYYY-MM-DD), author, tags
                    tags: coffee, research, meta research, fun (filter UI is off for now)
gallery/*.jpg       photos for the carousel, ordered by filename (jpg/png/webp/gif). Keep them
                    under ~300 KB each; they ship in the bundle.
site.md             frontmatter: instagram, instagram_url (link is off for now)
```

Log cards show `No.NNN` (counted from the oldest log) and a dotted date.
`src/lib/content.js` parses all of it; `src/lib/logs.js` handles the logs.

### Importing places from Google Maps

Saved lists have no API. Use a shared Google My Maps map (collaborators can add
pins) and its KML URL, or a Google Takeout export:

```
python3 -I tools/import_places.py --layer cafes --kml "https://www.google.com/maps/d/kml?mid=<MAP_ID>&forcekml=1"
python3 -I tools/import_places.py --layer cafes --csv ~/Downloads/Takeout/Maps/Cafes.csv     # geocodes via Nominatim
python3 -I tools/import_places.py --layer cafes --json ~/Downloads/Takeout/Maps/"Saved Places.json"
```

It rewrites the table in `src/content/places/<layer>.md` and keeps the frontmatter.

## Layout

```
index.html                     entry, Google Fonts (JetBrains Mono, Pixelify Sans)
src/App.jsx                    pane sections, drag/wheel/keyboard/touch input, per-frame pane slide
src/lib/panes.js               pane position, drag, spring-back, commit tween (goTo, mix, position)
src/lib/layout.js              where the roundtable disc and card orbit sit per pane
src/lib/content.js             parses src/content/*.md (frontmatter + tables) into data
src/lib/logs.js                loads src/content/logs/*.md, numbers them, filters by tag
src/lib/session.js             next Wednesday 10:00–12:00 Europe/London
src/components/Globe.jsx       three.js globe. Wheel over the sphere zooms; off it drags panes
src/components/Percolation.jsx background lattice, logo mask on logs
src/components/AsciiDisc.jsx   the roundtable drawn in characters from /img/Logo.png
src/components/Roundtable.jsx  committee cards and the log wheel, positioned per frame
src/components/IndexBar.jsx    left index (menu) and the ↑/↓ pane buttons
src/panes/*.jsx                per-pane HTML (GalleryPane.jsx is the cover-flow carousel)
static/css/style.css           one stylesheet. Pokémon-style text boxes are `.box`
```

Fonts: JetBrains Mono everywhere (`--mono`, also `--pk` for text boxes); Pokémon
Emerald (`static/fonts/pokemon-emerald.ttf`, `--px`, Pixelify Sans fallback) on metadata
lines, the pane buttons and the home line. To try Berkeley Mono, self-host the
woff2 and change `--mono`.

## Running it locally

You need Node 22 or newer (`node --version`). Install from nodejs.org or with
`brew install node`. Then:

```
git clone https://github.com/pouroverleaf/pouroverleaf.github.io
cd pouroverleaf.github.io
npm install
npm run dev
```

Open http://localhost:5173/. Edits to `src/content/*.md`, the code, or the CSS
show up without a reload.

If `npm install` fails with a 404 from a package proxy, your machine has a
custom npm registry in `~/.npmrc`. Run
`npm install --registry=https://registry.npmjs.org/` instead.

`npm run build` writes the production site to `dist/`; `npm run preview`
serves that build locally.

Debug: `?freeze=2,3,0.6#logs` holds the team→logs transition at 60%.

## Deploying

Pushing to `main` runs `.github/workflows/deploy.yml`, which builds the site
and publishes `dist/` to GitHub Pages. One-time repo setting: Settings →
Pages → Source → **GitHub Actions**. The workflow can also be started by hand
from the Actions tab. `.nojekyll` keeps Pages from running Jekyll.

To publish a change: edit, commit, push to `main` (or open a PR into `main`
and merge it). The site updates in about a minute.
