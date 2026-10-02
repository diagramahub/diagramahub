# Third-party notices

Diagramahub is licensed under the Apache License 2.0 (see `LICENSE`). The
components below are distributed **inside the application** (bundled into the
frontend build or served as static assets) under their own licenses, all of
which are compatible with Apache-2.0. Dependencies that are only used at
build or test time are not listed.

| Component | Version | License | Used for | Notice |
|---|---|---|---|---|
| [roughjs](https://github.com/rough-stuff/rough) | 4.6.x | MIT | hand-drawn rendering of shapes, lines and arrows in the freehand canvas | Copyright (c) 2019 Preet Shihn |
| [perfect-freehand](https://github.com/steveruizok/perfect-freehand) | 1.2.x | MIT | smooth, pressure-sensitive freehand strokes | Copyright (c) 2021 Stephen Ruiz Jr |
| [Caveat](https://github.com/googlefonts/caveat) (font) | from google/fonts `ofl/caveat` | SIL Open Font License 1.1 | handwriting font for freehand sketches (`frontend/public/fonts/caveat/`) | Copyright 2014 The Caveat Project Authors. Reserved Font Name "Caveat". License text in `frontend/public/fonts/caveat/OFL.txt` |

Notes

- MIT components require keeping their copyright notice; it is reproduced
  above and in their `LICENSE` files inside `node_modules` during the build.
- The OFL font is bundled unmodified together with its license text, as the
  OFL requires. It may not be sold by itself.
- Other runtime dependencies (React, TailwindCSS, Mermaid, Monaco, i18next,
  axios, jsPDF, html2canvas, DOMPurify, etc.) are MIT/Apache-2.0 licensed and
  were already part of the application before this file was introduced; see
  `frontend/package.json` and `backend/pyproject.toml` for the full lists.
