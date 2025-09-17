import SwiftUI
import WebKit

struct WebView: UIViewRepresentable {
    @Binding var url: URL

    func makeCoordinator() -> Coordinator { Coordinator(self) }

    func makeUIView(context: Context) -> WKWebView {
        let prefs = WKWebpagePreferences()
        prefs.allowsContentJavaScript = true
        let config = WKWebViewConfiguration()
        config.defaultWebpagePreferences = prefs
        config.websiteDataStore = .default() // persistent cookies & storage
        config.userContentController.add(context.coordinator, name: "overlay")

        let web = WKWebView(frame: .zero, configuration: config)
        web.navigationDelegate = context.coordinator
        web.allowsBackForwardNavigationGestures = true
        // Inject a lightweight long-press detector to target images
        let js = """
        (function(){
          if (window.__icon_injected) return; window.__icon_injected = true;
          var timer;
          document.addEventListener('touchstart', function(e){
            var t = e.target;
            timer = setTimeout(function(){
              try {
                if (!t) return;
                if (t.tagName === 'IMG') {
                  var src = t.currentSrc || t.src;
                  if (src) window.webkit.messageHandlers.overlay.postMessage(src);
                }
              } catch (err) {}
            }, 600);
          }, {passive:true});
          document.addEventListener('touchend', function(){ if (timer) clearTimeout(timer); });
        })();
        """
        let script = WKUserScript(source: js, injectionTime: .atDocumentEnd, forMainFrameOnly: true)
        web.configuration.userContentController.addUserScript(script)
        web.load(URLRequest(url: url))
        return web
    }

    func updateUIView(_ webView: WKWebView, context: Context) {
        if webView.url?.absoluteString != url.absoluteString {
            webView.load(URLRequest(url: url))
        } else {
            // Force a reload when the same URL is set again
            webView.reload()
        }
    }

    class Coordinator: NSObject, WKNavigationDelegate, WKScriptMessageHandler {
        let parent: WebView
        init(_ parent: WebView) { self.parent = parent }

        func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
            guard message.name == "overlay", let url = message.body as? String else { return }
            // In-app overlay placeholder
            OverlayManager.shared.createOverlay(url: url)
        }

        func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            if let host = navigationAction.request.url?.host {
                let inApp = host.hasSuffix("icon.coupons") || host.hasSuffix("vercel.app")
                if inApp { decisionHandler(.allow); return }
            }
            if let url = navigationAction.request.url { UIApplication.shared.open(url) }
            decisionHandler(.cancel)
        }
    }
}

