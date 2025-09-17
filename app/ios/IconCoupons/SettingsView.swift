import SwiftUI
import WebKit

enum SettingsAction { case logout }

struct SettingsView: View {
    var onAction: (SettingsAction) -> Void
    @State private var overlaysEnabled = false

    var body: some View {
        NavigationView {
            List {
                Section(header: Text("Overlays")) {
                    Toggle(isOn: $overlaysEnabled) {
                        Text("Enable overlays (in‑app placeholder)")
                    }
                    .onChange(of: overlaysEnabled) { _ in
                        // Placeholder toggle: keeps behavior in‑app only
                        // See OverlayManager.swift header for Apple‑compliant alternatives
                    }
                }
                Section(header: Text("Danger Zone")) {
                    Button(role: .destructive) {
                        logout()
                    } label: { Text("Log out") }
                }
            }
            .navigationTitle("Settings")
            .toolbar { ToolbarItem(placement: .navigationBarTrailing) { Button("Done") { dismiss() } } }
        }
    }

    private func dismiss() { UIApplication.shared.sendAction(#selector(UIResponder.resignFirstResponder), to: nil, from: nil, for: nil) }

    private func logout() {
        // Clear cookies and website data to sign out
        let dataStore = WKWebsiteDataStore.default()
        let types = WKWebsiteDataStore.allWebsiteDataTypes()
        dataStore.fetchDataRecords(ofTypes: types) { records in
            dataStore.removeData(ofTypes: types, for: records) {
                onAction(.logout)
            }
        }
    }
}

