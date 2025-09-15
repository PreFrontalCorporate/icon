# icon Desktop • v2.0.5

**Pin stickers, memes, and images on top of any app.**  
icon Desktop lets you click a sticker in the Library/Store and “pin” it as a floating, always-on-top overlay window you can move, resize, rotate, and clear with global hotkeys.

- **Platforms:** Windows, macOS, Linux  
- **Tech:** Electron + Vite + TypeScript + pnpm  
- **License:** MIT

---

## 🚀 Install (End users)

Grab the latest installers from **GitHub Releases** (Windows `.exe`, macOS `.dmg`/`.zip`, Linux `.AppImage`/`.deb`/`.rpm`).  
File names follow:

- **Windows (x64):** `icon-Desktop-Setup-${version}-x64.exe` (NSIS) and a portable build
- **macOS:** `icon Desktop-${version}.dmg` and `.zip`
- **Linux:** `${name}-${version}.AppImage`, `.deb`, `.rpm`

> Tip: On first launch, you’ll see the app window with a Library/Store toolbar. Click stickers/images to pin them as overlays.

---

## 🧑‍💻 Develop locally (pnpm)

> This is a **pnpm workspace** monorepo. The desktop client lives in `app/desktop`.

### Requirements
- **Node.js 20.x**
- **pnpm 9.x**
- macOS/Windows/Linux build prerequisites for Electron (e.g., Xcode CLT on macOS, build tools on Linux)

### Install & run (desktop app only)

```bash
# from repo root OR anywhere
pnpm --dir app/desktop i
pnpm --dir app/desktop dev
