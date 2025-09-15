# icon Desktop • v2.0.5

**Pin stickers, memes, and images on top of any app.**
icon Desktop lets you click a sticker in the Library/Store and “pin” it as a floating, always-on-top overlay window you can move, resize, rotate, and clear with global hotkeys.

* **Platforms:** Windows, macOS, Linux
* **Tech:** Electron + Vite + TypeScript + pnpm
* **License:** MIT

---

## 🚀 Install (End users)

Grab the latest installers from **GitHub Releases** (Windows `.exe`, macOS `.dmg`/`.zip`, Linux `.AppImage`/`.deb`/`.rpm`).
File names follow:

* **Windows (x64):** `icon-Desktop-Setup-${version}-x64.exe` (NSIS) and a portable build
* **macOS:** `icon Desktop-${version}.dmg` and `.zip`
* **Linux:** `${name}-${version}.AppImage`, `.deb`, `.rpm`

> Tip: On first launch, you’ll see the app window with a Library/Store toolbar. Click stickers/images to pin them as overlays.

---

## 🧑‍💻 Develop locally (pnpm)

> This is a **pnpm workspace** monorepo. The desktop client lives in `app/desktop`.

### Requirements

* **Node.js 20.x**
* **pnpm 9.x**
* macOS/Windows/Linux build prerequisites for Electron (e.g., Xcode CLT on macOS, build tools on Linux)

### Install & run (desktop app only)

```bash
# from repo root OR anywhere
pnpm --dir app/desktop i
pnpm --dir app/desktop dev
```

That starts Vite for the renderer and launches Electron with live reload.

### Build (debug dist)

```bash
pnpm --dir app/desktop build
# outputs to app/desktop/dist (main, preload, renderer)
```

### Package installers (release)

```bash
pnpm --dir app/desktop dist
# outputs platform installers to app/desktop/release
```

> CI also builds the desktop app via `.github/workflows/desktop.yml`.

---

## 🎹 Global Hotkeys (default)

From the desktop app (registered on app ready):

* **Ctrl/Cmd + Alt + Shift + X** — Clear all overlays
* **Ctrl/Cmd + Alt + Shift + H** — Show/hide “Keyboard Shortcuts”
* **Ctrl/Cmd + Alt + Shift + P** — Party (fun test effect)
* **Ctrl/Cmd + Alt + Shift + B** — Toggle bounce animation for all overlays
* **Ctrl/Cmd + Alt + Shift + R** — “Rain” 24 overlays
* **Ctrl/Cmd + Alt + Shift + L** — Rain 24 random images from the Library view

You can also clear overlays from **Menu → File → Clear all stickers**.

---

## 🖼 Overlay controls (per-sticker window)

Each pinned overlay window is a frameless, transparent Electron `BrowserWindow` that stays on top:

* **Drag anywhere** (the image area is draggable)
* **Resize** from edges/corners
* **Esc** — Close overlay
* **R** — Rotate 90°
* **B** — Toggle gentle “bounce” animation
* **S** — Tiny “beep” sound (debug)

A small close button and hint appear on focus/hover.

---

## 🔌 How it works

* **Main process:** `app/desktop/src/main.ts` creates `BrowserWindow`, the toolbar Library/Store views (`BrowserView`/`<webview>`), app menu, tray, and global hotkeys.
* **Preload:** `app/desktop/src/preload.ts` exposes a safe IPC bridge (`window.api`) for overlays, Library navigation, and a mini HUD to show overlay count.
* **Overlays:** `app/desktop/src/ipc/overlay.ts` builds topmost, transparent windows that render the selected image with optional rotation/bounce and simple audio.
* **Library/Store integration:** `app/desktop/windows/webview-preload.js` runs inside the Library/Store view and forwards clicked image URLs to the host to pin.

---

## 🧯 Troubleshooting

* **Monorepo scripts:** The repository’s root `package.json` may reference packages not needed for desktop. If you hit postinstall issues at the root, install **only** in the desktop app:

  ```bash
  pnpm --dir app/desktop i
  ```
* **Linux dependencies:** Packaging `.deb`/`.rpm` may require additional dev packages (GTK, libX11, etc.) depending on your distro.

---

## 📦 Repository layout (relevant parts)

```
app/
  desktop/
    build/                 # icons
    index.html             # Vite entry
    package.json           # name: icon-desktop, version: 2.0.5
    vite.config.ts
    tsconfig.*.json
    windows/
      library.html         # toolbar shell for Library/Store
      overlay.html
      webview-preload.js   # forwards clicks to host
    src/
      main.ts              # Electron main
      preload.ts           # IPC bridge + overlay HUD
      ipc/
        overlay.ts         # overlay window creation & controls
        stickers.ts        # login/fetch for user stickers (Shopify-backed)
      renderer/
        main.ts            # simple renderer entry
release/                    # created by electron-builder
```

---

## 🛠 CI/CD

* **Workflow:** `.github/workflows/desktop.yml` (Node 20, pnpm cache, build + upload dist artifact)
* **electron-builder config:** in `app/desktop/package.json`

  * `directories.output: release`
  * Targets: macOS `dmg/zip`, Windows `nsis/portable`, Linux `AppImage/deb/rpm`
  * `publish: github` (owner: `PreFrontalCorporate`, repo: `icon`)

> **Release tip:** **Bump** `version` in `app/desktop/package.json` **before tagging** so GitHub Actions and auto-updates pick up the new release correctly.

---

## 🔐 (Optional) Shopify integration

Some helper endpoints (`app/desktop/api/verify/route.ts`) and sticker helpers (`src/ipc/stickers.ts`) are set up to talk to a Shopify-backed web API. If you wire those up, you’ll need:

```
SHOPIFY_SHOP=...
SHOPIFY_ADMIN_KEY=...
SHOPIFY_ADMIN_SECRET=...
SHOPIFY_MULTIPASS_SECRET=...
NEXT_PUBLIC_SHOPIFY_STOREFRONT_ENDPOINT=...
NEXT_PUBLIC_SHOPIFY_STOREFRONT_TOKEN=...
```

The core desktop overlay experience works without these.

---

## 🤝 Contributing

PRs welcome! Please run:

```bash
pnpm --dir app/desktop build
pnpm --dir app/desktop test:smoke
```

Before you tag a release, **update** `app/desktop/package.json:version`.

---

## 📄 License

MIT © 2025 Prefrontal Corporate
