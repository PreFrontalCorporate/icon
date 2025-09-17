package com.icon.coupons

import android.Manifest
import android.app.AlertDialog
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.webkit.CookieManager
import android.webkit.WebStorage
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.preference.Preference
import androidx.preference.PreferenceFragmentCompat

class SettingsActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        supportActionBar?.setDisplayHomeAsUpEnabled(true)

        supportFragmentManager
            .beginTransaction()
            .replace(android.R.id.content, RootFragment())
            .commit()
    }

    override fun onSupportNavigateUp(): Boolean {
        if (supportFragmentManager.backStackEntryCount > 0) {
            supportFragmentManager.popBackStack()
            return true
        }
        finish()
        return true
    }

    class RootFragment : PreferenceFragmentCompat() {
        override fun onCreatePreferences(savedInstanceState: Bundle?, rootKey: String?) {
            setPreferencesFromResource(R.xml.prefs_root, rootKey)
        }
    }

    class AccountFragment : PreferenceFragmentCompat() {
        override fun onCreatePreferences(savedInstanceState: Bundle?, rootKey: String?) {
            setPreferencesFromResource(R.xml.prefs_account, rootKey)
        }
    }

    class AdvancedFragment : PreferenceFragmentCompat() {
        companion object { private const val REQ_POST_NOTIF = 2001 }
        override fun onCreatePreferences(savedInstanceState: Bundle?, rootKey: String?) {
            setPreferencesFromResource(R.xml.prefs_advanced, rootKey)

            val overlays: Preference? = findPreference("enable_overlays")
            overlays?.setOnPreferenceClickListener {
                if (Build.VERSION.SDK_INT >= 33) {
                    val granted = ContextCompat.checkSelfPermission(requireContext(), Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED
                    if (!granted) {
                        requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), REQ_POST_NOTIF)
                        return@setOnPreferenceClickListener true
                    }
                }
                OverlayService.startOrPermissions(requireContext())
                true
            }
        }

        override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
            super.onRequestPermissionsResult(requestCode, permissions, grantResults)
            if (requestCode == REQ_POST_NOTIF) {
                // Start overlays regardless; if permission denied, service will still run but notification may be limited
                OverlayService.startOrPermissions(requireContext())
            }
        }
    }

    class DangerFragment : PreferenceFragmentCompat() {
        override fun onCreatePreferences(savedInstanceState: Bundle?, rootKey: String?) {
            setPreferencesFromResource(R.xml.prefs_danger, rootKey)

            val logoutPref: Preference? = findPreference("logout")
            logoutPref?.setOnPreferenceClickListener {
                AlertDialog.Builder(requireContext())
                    .setTitle(R.string.logout_confirm_title)
                    .setMessage(R.string.logout_confirm_msg)
                    .setNegativeButton(R.string.logout_confirm_no, null)
                    .setPositiveButton(R.string.logout_confirm_yes) { _, _ ->
                        // Clear cookies and web storage to log out
                        CookieManager.getInstance().removeAllCookies(null)
                        CookieManager.getInstance().flush()
                        WebStorage.getInstance().deleteAllData()

                        // Return to main and reload
                        val i = Intent(requireContext(), MainActivity::class.java)
                        i.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_NEW_TASK)
                        startActivity(i)
                        activity?.finishAffinity()
                    }
                    .show()
                true
            }
        }
    }
}
