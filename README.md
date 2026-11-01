# pouroverleaf.github.io

Main website of pouroverleaf, a coffee and research club at the School of
Informatics, University of Edinburgh. Plain static HTML, served by GitHub Pages.

## Layout

```
/
├── index.html              home
├── about/index.html        /about/
├── static/
│   ├── css/style.css       one stylesheet for all pages
│   ├── js/next-session.js  "next session" counter
│   └── img/banner.jpg      grayscale banner (from IMG_3667.heic)
└── .nojekyll               serve files as-is, no Jekyll build
```

Each page is a directory with an `index.html`, so URLs stay clean (`/about/`).
Future sections follow the same rule. For the paper archive, use arXiv-style paths:

```
/list/<category>/           listing per area (e.g. /list/ml/)
/abs/<id>/                  abstract page per paper (e.g. /abs/2611.0001/)
/pdf/<id>.pdf               PDF
```

## Sessions

Edit the constants at the top of `static/js/next-session.js`:

- `ANCHOR`: one session date. Sessions repeat every 14 days from it.
- `SKIP`: session dates that do not happen (holidays, exams).

Also update the fallback date in `index.html` (`#next-date`) from time to time.
It shows only when JavaScript is off.

## Local preview

Paths are root-relative (`/static/...`), so use a server, not `file://`:

```
python3 -m http.server
```
