package com.icon.coupons

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.graphics.PixelFormat
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.os.Build
import android.os.IBinder
import android.provider.Settings
import android.view.*
import android.widget.FrameLayout
import android.widget.ImageButton
import android.widget.ImageView
import android.widget.TextView
import androidx.core.app.NotificationCompat
import androidx.core.content.getSystemService
import coil.ImageLoader
import coil.load
import kotlin.math.roundToInt
import android.app.Service

class OverlayService : Service(), SensorEventListener {

    companion object {
        const val CHANNEL_ID = "icon_overlay"
        const val NOTIF_ID = 1337

        const val ACTION_START = "overlay.START"
        const val ACTION_STOP = "overlay.STOP"
        const val ACTION_CREATE = "overlay.CREATE"
        const val ACTION_CLEAR = "overlay.CLEAR"
        const val ACTION_TOGGLE_BOUNCE = "overlay.BOUNCE"
        const val ACTION_RAIN = "overlay.RAIN"
        const val ACTION_PARTY = "overlay.PARTY"
        const val ACTION_URLS = "overlay.URLS" // string array extra
        const val ACTION_SHOW_CLEAR_BUTTON = "overlay.SHOW_CLEAR_BUTTON"

        fun startOrPermissions(context: Context) {
            if (!Settings.canDrawOverlays(context)) {
                val i = Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION)
                i.data = android.net.Uri.parse("package:" + context.packageName)
                i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                context.startActivity(i)
                return
            }
            val i = Intent(context, OverlayService::class.java)
            i.action = ACTION_START
            if (Build.VERSION.SDK_INT >= 26) context.startForegroundService(i) else context.startService(i)
        }

        fun send(context: Context, action: String, urls: ArrayList<String>? = null) {
            val i = Intent(context, OverlayService::class.java)
            i.action = action
            if (urls != null) i.putStringArrayListExtra(ACTION_URLS, urls)
            if (Build.VERSION.SDK_INT >= 26) context.startForegroundService(i) else context.startService(i)
        }
    }

    private lateinit var wm: WindowManager
    private val overlays = mutableListOf<View>()
    private var showBounce = false
    private var clearButtonView: View? = null

    // Shake detection
    private var sensorManager: SensorManager? = null
    private var lastShakeTs = 0L

    override fun onCreate() {
        super.onCreate()
        wm = getSystemService(Context.WINDOW_SERVICE) as WindowManager
        sensorManager = getSystemService()
        createChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_START -> startForegroundInternal()
            ACTION_STOP -> stopSelf()
            ACTION_CREATE -> {
                val urls = intent.getStringArrayListExtra(ACTION_URLS)
                if (urls != null) urls.forEach { createOverlay(it) }
            }
            ACTION_CLEAR -> removeAll()
            ACTION_TOGGLE_BOUNCE -> toggleBounceAll()
            ACTION_RAIN -> {
                val urls = intent.getStringArrayListExtra(ACTION_URLS)
                if (!urls.isNullOrEmpty()) rain(urls, 24)
            }
            ACTION_PARTY -> {
                val urls = intent.getStringArrayListExtra(ACTION_URLS)
                party(urls ?: arrayListOf())
            }
            ACTION_SHOW_CLEAR_BUTTON -> showQuickClearButton()
        }
        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun startForegroundInternal() {
        val notif = buildNotification()
        startForeground(NOTIF_ID, notif)
        registerShake()
    }

    private fun buildNotification(): Notification {
        val openIntent = Intent(this, MainActivity::class.java)
        val contentPI = PendingIntent.getActivity(this, 0, openIntent, PendingIntent.FLAG_IMMUTABLE)

        val clearPI = PendingIntent.getService(this, 1, Intent(this, OverlayService::class.java).setAction(ACTION_CLEAR), PendingIntent.FLAG_IMMUTABLE)
        val partyPI = PendingIntent.getService(this, 2, Intent(this, OverlayService::class.java).setAction(ACTION_PARTY), PendingIntent.FLAG_IMMUTABLE)
        val rainPI = PendingIntent.getService(this, 3, Intent(this, OverlayService::class.java).setAction(ACTION_RAIN), PendingIntent.FLAG_IMMUTABLE)

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_menu_gallery)
            .setContentTitle("icon overlays")
            .setContentText("Shaking the phone makes the memes go away")
            .setContentIntent(contentPI)
            .setOngoing(true)
            .addAction(0, "Clear", clearPI)
            .addAction(0, "Party", partyPI)
            .addAction(0, "Rain", rainPI)
            .build()
    }

    private fun createChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            if (nm.getNotificationChannel(CHANNEL_ID) == null) {
                val ch = NotificationChannel(CHANNEL_ID, "Icon Overlay", NotificationManager.IMPORTANCE_LOW)
                nm.createNotificationChannel(ch)
            }
        }
    }

    private fun baseLayoutParams(w: Int = WindowManager.LayoutParams.WRAP_CONTENT, h: Int = WindowManager.LayoutParams.WRAP_CONTENT): WindowManager.LayoutParams {
        val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY else WindowManager.LayoutParams.TYPE_PHONE
        return WindowManager.LayoutParams(
            w, h, type,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS or WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.TOP or Gravity.START
            x = (Math.random() * 400).roundToInt()
            y = (Math.random() * 800).roundToInt()
        }
    }

    private fun createOverlay(url: String) {
        val ctx = this
        val container = FrameLayout(ctx)
        val img = ImageView(ctx)
        img.adjustViewBounds = true
        img.load(url, ImageLoader(ctx))
        container.addView(img)

        val lp = baseLayoutParams()
        container.setOnTouchListener(DragTouchListener(lp))
        wm.addView(container, lp)
        overlays.add(container)

        if (showBounce) applyBounce(container)
    }

    private fun applyBounce(view: View) {
        view.animate().cancel()
        view.animate()
            .translationYBy(20f)
            .setDuration(300)
            .withEndAction {
                view.animate().translationYBy(-20f).setDuration(300).withEndAction { applyBounce(view) }.start()
            }
            .start()
    }

    private fun removeAll() {
        overlays.forEach { v ->
            try { wm.removeView(v) } catch (_: Exception) {}
        }
        overlays.clear()
    }

    private fun toggleBounceAll() {
        showBounce = !showBounce
        overlays.forEach { v -> if (showBounce) applyBounce(v) else v.animate().cancel() }
    }

    private fun rain(urls: List<String>, count: Int) {
        if (urls.isEmpty()) return
        val bag = urls.toMutableList()
        repeat(count) {
            val idx = (Math.random() * bag.size).toInt()
            val u = bag[idx]
            createOverlay(u)
        }
    }

    private fun party(urls: List<String>) {
        toggleBounceAll()
        rain(urls, 24)
    }

    // Bottom-center clear button overlay shown after a shake
    private fun showQuickClearButton() {
        if (clearButtonView != null) return
        val ctx = this
        val btn = LayoutInflater.from(ctx).inflate(R.layout.overlay_clear_button, null)
        val lp = baseLayoutParams(WindowManager.LayoutParams.WRAP_CONTENT, WindowManager.LayoutParams.WRAP_CONTENT)
        lp.gravity = Gravity.BOTTOM or Gravity.CENTER_HORIZONTAL
        lp.y = 80
        btn.setOnClickListener { removeAll() }
        wm.addView(btn, lp)
        clearButtonView = btn
        btn.postDelayed({
            try {
                wm.removeView(btn)
            } catch (_: Exception) {}
            clearButtonView = null
        }, 6000)
    }

    // Simple shake detection
    private fun registerShake() {
        val sm = sensorManager ?: return
        val acc = sm.getDefaultSensor(Sensor.TYPE_ACCELEROMETER) ?: return
        sm.registerListener(this, acc, SensorManager.SENSOR_DELAY_UI)
    }

    private fun unregisterShake() {
        sensorManager?.unregisterListener(this)
    }

    override fun onDestroy() {
        super.onDestroy()
        unregisterShake()
        removeAll()
        clearButtonView?.let { try { wm.removeView(it) } catch (_: Exception) {} }
        clearButtonView = null
    }

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {}

    override fun onSensorChanged(event: SensorEvent) {
        if (event.sensor.type != Sensor.TYPE_ACCELEROMETER) return
        val x = event.values[0]
        val y = event.values[1]
        val z = event.values[2]
        val gX = x / SensorManager.GRAVITY_EARTH
        val gY = y / SensorManager.GRAVITY_EARTH
        val gZ = z / SensorManager.GRAVITY_EARTH
        val gForce = Math.sqrt((gX * gX + gY * gY + gZ * gZ).toDouble())
        val now = System.currentTimeMillis()
        if (gForce > 2.7) {
            if (now - lastShakeTs > 800) {
                lastShakeTs = now
                removeAll()
                showQuickClearButton()
            }
        }
    }

    private inner class DragTouchListener(private val lp: WindowManager.LayoutParams) : View.OnTouchListener {
        private var lastX = 0
        private var lastY = 0
        private var initX = 0
        private var initY = 0
        override fun onTouch(v: View, event: MotionEvent): Boolean {
            when (event.action) {
                MotionEvent.ACTION_DOWN -> {
                    lastX = event.rawX.toInt()
                    lastY = event.rawY.toInt()
                    initX = lp.x
                    initY = lp.y
                    return true
                }
                MotionEvent.ACTION_MOVE -> {
                    val dx = (event.rawX - lastX).toInt()
                    val dy = (event.rawY - lastY).toInt()
                    lp.x = initX + dx
                    lp.y = initY + dy
                    wm.updateViewLayout(v, lp)
                    return true
                }
                MotionEvent.ACTION_UP -> return true
            }
            return false
        }
    }
}

