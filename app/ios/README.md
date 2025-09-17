# Icon iOS App (placeholder overlays)

This folder contains Swift sources for an iOS app that mirrors the Android app:
- Loads Library and Store in a persistent `WKWebView`
- Long‑press images to "Overlay" (in‑app placeholder)
- Shake to clear overlays and show a bottom‑center Clear button
- Settings page with Logout (clears website data) and an overlays toggle (placeholder)

Notes about overlays on iOS
- iOS does not allow drawing above other apps. There is no supported equivalent to Android's TYPE_APPLICATION_OVERLAY.
- This project implements in‑app overlays only (placeholders) and documents theoretical/Apple‑compliant avenues in comments.

How to create the Xcode project and add these files
1) On a Mac, open Xcode (15+). File → New → Project → iOS App (SwiftUI or UIKit). Name: IconCoupons, Org ID: com.icon, Language: Swift, Interface: SwiftUI.
2) In the Xcode navigator, create group `IconCoupons` and add the Swift files from `app/ios/IconCoupons/`.
3) In target settings → Signing & Capabilities, add your Team. Set iOS Deployment Target 15.0+.
4) Run on a device or simulator. The app opens Library. Use the toolbar to switch to Store or open Settings.

File overview
- App.swift / AppDelegate.swift: App entry; installs a Shake‑aware window.
- ContentView.swift: Toolbar (Library/Store/Settings) + embedded WKWebView.
- WebView.swift: WKWebView wrapper, JS bridge for long‑press image → overlay.
- OverlayManager.swift: In‑app overlay placeholders (with Apple policy notes).
- SettingsView.swift: Logout clears cookies + website data; overlays toggle (placeholder).
- ShakeWindow.swift: Detects shake → clears overlays and shows bottom Clear button.

