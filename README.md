# BookmView Watch (mobile PWA)

Watch-only progressive web app for iPhone Safari. Load your BookmView SQLite database from Files, browse videos, and play HLS or MP4 URLs stored in the database. **No server, no credentials, no upload** — the public GitHub Pages site is static code only.

## Privacy

- The `.db` file is read entirely in the browser via [sql.js](https://sql.js.org/) (WebAssembly).
- Stream URLs go directly from your device to the video CDN (same as desktop).
- Do not commit your database or cookies to the repository.

## Local development

```bash
cd mobile-pwa
npm install
npm run dev
```

Open `http://localhost:5174` and choose a `bookmview.db` file from your machine.

## GitHub Pages

1. In the repo on GitHub: **Settings → Pages → Build and deployment → GitHub Actions** (or use the workflow below).
2. Set the site base path if the app is not at the domain root.

For a project site `https://<user>.github.io/<repo>/`, build with:

```bash
VITE_BASE_PATH=/<repo>/ npm run build
```

Example for repo `Bookmview`:

```bash
VITE_BASE_PATH=/Bookmview/ npm run build
```

The workflow `.github/workflows/mobile-pwa-pages.yml` uses `github.event.repository.name` for this path automatically.

3. On iPhone: open the Pages URL in Safari → Share → **Add to Home Screen**.

## Using on iPhone

1. Copy `bookmview.db` from your desktop BookmView data directory to **Files** (iCloud Drive or On My iPhone).
2. Open the PWA → **Choose database file** → pick the `.db`.
3. Tap a title to watch.

If playback fails (expired signed URLs), refresh media in the desktop app, copy the updated `.db` again. Phase 2 may add an optional private refresh endpoint.

## Desktop app

The main BookmView `client/` and `server/` packages are unchanged. This folder is independent (`npm install` inside `mobile-pwa` only).

## Tech

- Vite + React
- sql.js (SQLite in WASM)
- Native HLS on Safari; hls.js fallback elsewhere
- vite-plugin-pwa (offline shell caching; does not cache your database or videos)
