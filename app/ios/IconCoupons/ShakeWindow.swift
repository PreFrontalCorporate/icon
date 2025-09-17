import UIKit

class ShakeWindow: UIWindow {
    override var canBecomeFirstResponder: Bool { true }
    override func becomeFirstResponder() -> Bool { true }

    override func motionEnded(_ motion: UIEvent.EventSubtype, with event: UIEvent?) {
        guard motion == .motionShake else { return }
        // Shake-to-clear: remove all in-app overlays and show bottom Clear button
        OverlayManager.shared.removeAll()
        OverlayManager.shared.showQuickClearButton()
    }
}

