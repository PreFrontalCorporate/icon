package com.icon.coupons

import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.webkit.CookieManager
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebStorage
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.appcompat.app.AppCompatActivity
import androidx.appcompat.widget.Toolbar

class MainActivity : AppCompatActivity() {
    private lateinit var webView: WebView
    private var lastVolUpTs = 0L
    private var lastVolDownTs = 0L

    private val libraryUrl = "https://icon-web-two.vercel.app/library"
    private val storeUrl = "https://icon.coupons"

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        val toolbar = findViewById<Toolbar>(R.id.toolbar)
        setSupportActionBar(toolbar)

        webView = findViewById(R.id.webview)
        setupWebView()

        // Default to Library (matches desktop initial view)
        if (savedInstanceState == null) {
            webView.loadUrl(libraryUrl)
        }

        // If overlay permission is already granted, start the service
        maybeStartOverlayService()
    }

    private fun setupWebView() {
        // Persist and accept cookies by default
        val cm = CookieManager.getInstance()
        cm.setAcceptCookie(true)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            cm.setAcceptThirdPartyCookies(webView, true)
        }

        val ws: WebSettings = webView.settings
        ws.javaScriptEnabled = true
        ws.domStorageEnabled = true
        ws.databaseEnabled = true
        ws.mixedContentMode = WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE
        ws.userAgentString = ws.userAgentString + " icon-android-app"

        // Enable remote inspection in debug builds via chrome://inspect
        if (BuildConfig.DEBUG) {
            WebView.setWebContentsDebuggingEnabled(true)
        }

        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(
                view: WebView?,
                request: WebResourceRequest?
            ): Boolean {
                val url = request?.url ?: return false
                val host = url.host ?: return false
                val inApp = host.endsWith("icon.coupons") || host.endsWith("vercel.app")
                return if (inApp) {
                    false // load in WebView
                } else {
                    tryOpenExternal(url)
                    true
                }
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onCreateWindow(
                view: WebView?,
                isDialog: Boolean,
                isUserGesture: Boolean,
                resultMsg: android.os.Message?
            ): Boolean {
                // Open target=_blank in external browser
                val hitTestResult = view?.hitTestResult
                val data = hitTestResult?.extra
                if (!data.isNullOrBlank()) {
                    tryOpenExternal(Uri.parse(data))
                    return true
                }
                return super.onCreateWindow(view, isDialog, isUserGesture, resultMsg)
            }
        }

        // Long-press images to create overlays
        webView.setOnLongClickListener {
            val hit = webView.hitTestResult
            if (hit != null &&
                (hit.type == WebView.HitTestResult.IMAGE_TYPE || hit.type == WebView.HitTestResult.SRC_IMAGE_ANCHOR_TYPE)
                && !hit.extra.isNullOrBlank()
            ) {
                val url = hit.extra
                androidx.appcompat.app.AlertDialog.Builder(this)
                    .setTitle("Overlay this image?")
                    .setMessage(url)
                    .setPositiveButton("Overlay") { _, _ ->
                        OverlayService.startOrPermissions(this)
                        OverlayService.send(this, OverlayService.ACTION_CREATE, arrayListOf(url))
                    }
                    .setNegativeButton(android.R.string.cancel, null)
                    .show()
                true
            } else false
        }
    }

    private fun maybeStartOverlayService() {
        if (android.provider.Settings.canDrawOverlays(this)) {
            OverlayService.startOrPermissions(this)
        }
    }

    private fun tryOpenExternal(uri: Uri) {
        try {
            startActivity(Intent(Intent.ACTION_VIEW, uri))
        } catch (_: ActivityNotFoundException) {
        }
    }

    override fun onBackPressed() {
        if (this::webView.isInitialized && webView.canGoBack()) {
            webView.goBack()
        } else {
            super.onBackPressed()
        }
    }

    override fun onCreateOptionsMenu(menu: android.view.Menu): Boolean {
        menuInflater.inflate(R.menu.main_menu, menu)
        return true
    }

    override fun onOptionsItemSelected(item: android.view.MenuItem): Boolean {
        return when (item.itemId) {
            R.id.action_library -> {
                webView.loadUrl(libraryUrl); true
            }
            R.id.action_store -> {
                webView.loadUrl(storeUrl); true
            }
            R.id.action_settings -> {
                startActivity(Intent(this, SettingsActivity::class.java)); true
            }
            else -> super.onOptionsItemSelected(item)
        }
    }

    override fun onKeyDown(keyCode: Int, event: android.view.KeyEvent): Boolean {
        val now = System.currentTimeMillis()
        when (keyCode) {
            android.view.KeyEvent.KEYCODE_VOLUME_UP -> {
                lastVolUpTs = now
                if (now - lastVolDownTs < 400) {
                    triggerPartyFromPage()
                    return true
                }
            }
            android.view.KeyEvent.KEYCODE_VOLUME_DOWN -> {
                lastVolDownTs = now
                if (now - lastVolUpTs < 400) {
                    triggerPartyFromPage()
                    return true
                }
            }
        }
        return super.onKeyDown(keyCode, event)
    }

    private fun triggerPartyFromPage() {
        // Try to extract image URLs from current page and send to service
        try {
            val js = """
                (function(){
                  try {
                    var imgs = Array.from(document.querySelectorAll('img'))
                      .map(i => i.currentSrc || i.src)
                      .filter(u => u && /(\\.(png|jpe?g|gif|webp|svg)(\\?|#|$))/i.test(u));
                    imgs = Array.from(new Set(imgs));
                    return JSON.stringify(imgs);
                  } catch(e){ return '[]'; }
                })();
            """.trimIndent()
            webView.evaluateJavascript(js) { json ->
                try {
                    val list = org.json.JSONArray(json)
                    val urls = ArrayList<String>()
                    for (i in 0 until list.length()) urls.add(list.getString(i))
                    if (urls.isEmpty()) return@evaluateJavascript
                    OverlayService.startOrPermissions(this)
                    OverlayService.send(this, OverlayService.ACTION_PARTY, urls)
                } catch (_: Exception) {
                    OverlayService.send(this, OverlayService.ACTION_PARTY)
                }
            }
        } catch (_: Exception) {
            OverlayService.send(this, OverlayService.ACTION_PARTY)
        }
    }
}
