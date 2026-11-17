# pouroverleaf.github.io

Main website of pouroverleaf, a coffee and research club at the School of
Informatics, University of Edinburgh. React app built with Vite and served by
GitHub Pages.

## Layout

```
/
├── index.html              Vite entry point
├── src/App.jsx             React pages and shared layout
├── src/main.jsx            React entry point
├── static/
│   ├── css/style.css       one stylesheet for all pages
│   ├── img/theme.svg       current weekly theme artwork
│   ├── img/banner.jpg      fallback hero image
│   └── video/Coffeevideo.mp4 coffee hero background
└── .nojekyll               serve files as-is, no Jekyll build
```

The React app renders the clean page paths (`/about/`, `/list/`, etc.) from one
Vite entry point. For the paper archive, use arXiv-style paths:

```
/list/<category>/           listing per area (e.g. /list/ml/)
/abs/<id>/                  abstract page per paper (e.g. /abs/2611.0001/)
/pdf/<id>.pdf               PDF
```

## Sessions

The homepage calculates the next weekly Wednesday session in the
`Europe/London` timezone. Session details are defined in `src/App.jsx`.

The hero video is a locally stored royalty-free stock asset with the existing
banner image used as its poster and reduced-motion fallback.

## Local development

Install dependencies and start Vite:

```
npm install
npm run dev
```

Create a production build with `npm run build`, or preview one with
`npm run preview`.
