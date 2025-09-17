import SwiftUI

@main
struct IconCouponsApp: App {
    // Use UIKit window subclass for shake detection via AppDelegate bridge
    @UIApplicationDelegateAdaptor(AppDelegate.self) var appDelegate

    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}

