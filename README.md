# Navodaya Practice

Timed practice tests for the JNVST Class 6 entrance exam (Jawahar Navodaya Vidyalaya).

- Questions come from the **Navodaya questions** Google Sheet each time the app opens. Add a row to the sheet and it shows up in the next test.
- One full paper in exam order (Mental Ability, EVS, Arithmetic, Language), one timer for the whole paper, 1.25 marks per correct answer, pass mark checked per section.
- Past results are kept on the device. Installable from Chrome ("Install as app") and works offline with the last questions it loaded.

## Hosting

Plain static files, no build step. On Cloudflare Pages: connect this repository, framework preset **None**, build command empty, output directory `/`.

## Files

| File | What it does |
| --- | --- |
| `index.html` | The whole app |
| `manifest.webmanifest`, `icon-*.png` | Lets Chrome install it as an app |
| `sw.js` | Keeps the app working offline |
| `_headers` | Makes sure updates reach phones quickly |
