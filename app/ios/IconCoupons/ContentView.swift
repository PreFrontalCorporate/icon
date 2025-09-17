import SwiftUI

struct ContentView: View {
    @State private var currentURL: URL = URL(string: "https://icon-web-two.vercel.app/library")!
    @State private var showingSettings = false
    @State private var isLibrary = true

    var body: some View {
        NavigationView {
            VStack(spacing: 0) {
                WebView(url: $currentURL)
                    .edgesIgnoringSafeArea(.bottom)
            }
            .navigationTitle("icon")
            .toolbar {
                ToolbarItemGroup(placement: .navigationBarLeading) {
                    Button("Library") {
                        isLibrary = true
                        currentURL = URL(string: "https://icon-web-two.vercel.app/library")!
                    }
                    Button("Store") {
                        isLibrary = false
                        currentURL = URL(string: "https://icon.coupons")!
                    }
                }
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button { showingSettings = true } label: { Image(systemName: "gear") }
                }
            }
        }
        .sheet(isPresented: $showingSettings) {
            SettingsView { action in
                switch action {
                case .logout:
                    // After logout, refresh the current page to reflect sign-out
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
                        currentURL = currentURL // trigger reload
                    }
                }
            }
        }
    }
}

