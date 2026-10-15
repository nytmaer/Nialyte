# Niagara Lite Effect Lab | Installable PWA

## iPhone Home Screen installation

1. Upload the **contents** of this folder to an HTTPS static host such as GitHub Pages or Netlify. (Keep all files together.)
2. Open the hosted URL in **Safari** on iPhone.
3. Tap **Share** → **Add to Home Screen** → **Add**.
4. Launch **Niagara Lite** from your Home Screen. After the first successful online load, the app shell is cached for offline use.

Opening index.html directly from the Files app will not enable service workers or reliable PWA installation. A public HTTPS URL or localhost is needed.

## Features

Boost Burst, Rail Sparks, Portal Pulse; adjustable count, speed, lifetime and color; export effect JSON and 4×4 PNG flipbook. On iOS, downloads may be handled by Safari/Files depending on OS behavior.

## UEFN handoff

Import the 1024×1024 4×4 PNG atlas into UEFN and configure a flipbook-capable sprite material (4 columns, 4 rows). The JSON is a descriptive intermediate format, not a native Niagara asset. Validate available UEFN Python scripting before automating Niagara construction.

## Repo layout

- Root: the installable PWA (`index.html`, `manifest.webmanifest`, `sw.js`, icons). Serve the root over HTTPS, e.g. GitHub Pages from `main` / root.
- `standalone/`: the original Effect Lab 001 single-file version. Open `standalone/index.html` directly; no server needed.
