# Desktop app (Electron)

A thin Electron shell around the regular dev server, so God's Eye View gets
its own window, Dock icon and app name instead of living in a browser tab.

```bash
npm install
npm run app
```

How it works:

- `main.mjs` shows a splash, spawns `server.mjs` with Electron's bundled Node
  (`ELECTRON_RUN_AS_NODE=1`, Node 24), waits for its ready line, then loads it.
- `server.mjs` boots the same Vite server as `npm run dev` on a free
  `127.0.0.1` port, so all local provider proxies and `.env` keys work as usual.
  Pin a port with `GEV_ELECTRON_PORT=4173 npm run app`.
- The renderer is sandboxed with context isolation. Only the app's own origin
  gets the mic, geolocation, fullscreen, pointer lock and clipboard write;
  external links open in your normal browser.
- Closing the window stops the server child.

Icons live in `assets/` and are generated from `public/logo.svg` with
`npm run electron:icons` (the `.icns` step needs macOS). Tests:
`npm run test:electron`.
