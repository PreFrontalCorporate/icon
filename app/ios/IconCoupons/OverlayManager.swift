import UIKit

final class OverlayManager {
    static let shared = OverlayManager()
    private init() {}

    private var overlays: [UIView] = []
    private weak var clearButton: UIView?
    private var bouncing = false

    // NOTE (for Apple review & engineering):
    // iOS does not allow drawing above other apps or creating windows visible system‑wide.
    // The functions below implement in‑app overlays only.
    // Theoretically-sound, Apple-compliant alternatives for “memes over other apps”:
    // 1) Live Activities + Dynamic Island: Surface currently “active memes” with quick actions (Clear, Party, Rain). Visible on Lock Screen/Dynamic Island, not over other apps.
    // 2) Interactive Widgets: Provide actions to spawn or clear meme sets, reflecting state in-app upon next open.
    // 3) Picture-in-Picture is limited to AV content; non‑media arbitrary overlays are not permitted.
    // 4) Call UI / VoIP or Screen Recording overlays are restricted and not appropriate here per App Store Review Guidelines.
    // 5) Accessibility/Assistive overlays must use sanctioned APIs and cannot draw over other apps.
    // This project keeps overlays strictly in‑app and documents these alternatives for future discussion.

    func createOverlay(url: String) {
        guard let window = UIApplication.shared.windows.first(where: { $0.isKeyWindow }) else { return }
        let container = UIView(frame: CGRect(x: 20, y: 120, width: 160, height: 160))
        container.clipsToBounds = true
        container.layer.cornerRadius = 12
        container.layer.borderWidth = 1
        container.layer.borderColor = UIColor(white: 1, alpha: 0.15).cgColor

        let iv = UIImageView(frame: container.bounds)
        iv.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        iv.contentMode = .scaleAspectFit
        container.addSubview(iv)

        // Lightweight image load (no external dependency): async fetch
        if let u = URL(string: url) {
            URLSession.shared.dataTask(with: u) { data, _, _ in
                guard let d = data, let img = UIImage(data: d) else { return }
                DispatchQueue.main.async { iv.image = img }
            }.resume()
        }

        // Drag
        let pan = UIPanGestureRecognizer(target: self, action: #selector(handlePan(_:)))
        container.addGestureRecognizer(pan)
        // Double‑tap to remove
        let dbl = UITapGestureRecognizer(target: self, action: #selector(handleDoubleTap(_:)))
        dbl.numberOfTapsRequired = 2
        container.addGestureRecognizer(dbl)

        window.addSubview(container)
        overlays.append(container)
        if bouncing { applyBounce(container) }
    }

    func removeAll() {
        overlays.forEach { $0.removeFromSuperview() }
        overlays.removeAll()
    }

    func toggleBounceAll() {
        bouncing.toggle()
        overlays.forEach { bouncing ? applyBounce($0) : $0.layer.removeAllAnimations() }
    }

    func rain(urls: [String], count: Int = 24) {
        guard !urls.isEmpty else { return }
        for _ in 0..<count { createOverlay(url: urls.randomElement()!) }
    }

    func party(urls: [String]) {
        toggleBounceAll()
        rain(urls: urls, count: 24)
    }

    // Bottom‑center Clear button shown after shake (in‑app only)
    func showQuickClearButton() {
        guard clearButton == nil, let window = UIApplication.shared.windows.first(where: { $0.isKeyWindow }) else { return }
        let btn = UIButton(type: .system)
        btn.setTitle("Clear", for: .normal)
        btn.titleLabel?.font = .boldSystemFont(ofSize: 16)
        btn.backgroundColor = UIColor(white: 0.1, alpha: 0.9)
        btn.setTitleColor(.white, for: .normal)
        btn.layer.cornerRadius = 24
        btn.contentEdgeInsets = UIEdgeInsets(top: 10, left: 18, bottom: 10, right: 18)
        btn.addTarget(self, action: #selector(clearTapped), for: .touchUpInside)

        btn.translatesAutoresizingMaskIntoConstraints = false
        window.addSubview(btn)
        NSLayoutConstraint.activate([
            btn.centerXAnchor.constraint(equalTo: window.centerXAnchor),
            btn.bottomAnchor.constraint(equalTo: window.safeAreaLayoutGuide.bottomAnchor, constant: -24)
        ])
        clearButton = btn

        DispatchQueue.main.asyncAfter(deadline: .now() + 6) { [weak self] in self?.hideQuickClear() }
    }

    private func hideQuickClear() {
        clearButton?.removeFromSuperview()
        clearButton = nil
    }

    @objc private func clearTapped() { removeAll(); hideQuickClear() }

    @objc private func handlePan(_ gr: UIPanGestureRecognizer) {
        guard let v = gr.view, let superview = v.superview else { return }
        let t = gr.translation(in: superview)
        switch gr.state {
        case .changed, .ended:
            v.center = CGPoint(x: v.center.x + t.x, y: v.center.y + t.y)
            gr.setTranslation(.zero, in: superview)
        default: break
        }
    }

    @objc private func handleDoubleTap(_ gr: UITapGestureRecognizer) {
        gr.view?.removeFromSuperview()
        overlays.removeAll { $0 === gr.view }
    }

    private func applyBounce(_ v: UIView) {
        v.layer.removeAllAnimations()
        func cycle() {
            UIView.animate(withDuration: 0.3, delay: 0, options: [.allowUserInteraction], animations: {
                v.transform = CGAffineTransform(translationX: 0, y: 8)
            }) { _ in
                UIView.animate(withDuration: 0.3, delay: 0, options: [.allowUserInteraction], animations: {
                    v.transform = .identity
                }) { _ in if self.bouncing { cycle() } }
            }
        }
        cycle()
    }
}

