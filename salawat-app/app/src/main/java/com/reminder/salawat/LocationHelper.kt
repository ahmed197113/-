package com.reminder.salawat

import android.Manifest
import android.annotation.SuppressLint
import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Looper
import android.provider.Settings
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.location.LocationManagerCompat
import androidx.lifecycle.lifecycleScope
import com.google.android.gms.common.api.ResolvableApiException
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.LocationSettingsRequest
import com.google.android.gms.location.Priority
import com.google.android.gms.tasks.CancellationTokenSource
import com.google.android.gms.tasks.Task
import kotlinx.coroutines.launch
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withTimeoutOrNull
import kotlin.coroutines.resume

/**
 * Gets the phone's location for prayer times and qibla: asks for the permission, offers to switch location
 * services on, then reads a fix from Google's fused provider (falling back to the platform LocationManager on
 * phones without Google Play services). Every failure is explained to the user in a dialog.
 */
object LocationHelper {

    private const val PERMISSION = Manifest.permission.ACCESS_COARSE_LOCATION

    /** Calls [onResult] with a location, or null after telling the user why none could be found. */
    fun obtain(activity: AppCompatActivity, permissions: PermissionRequester, onResult: suspend (Location?) -> Unit, onBusy: (Boolean) -> Unit) {
        permissions.request(PERMISSION) { granted ->
            if (!granted) {
                if (permissions.isBlocked(PERMISSION)) explainBlocked(activity)
                else message(activity, R.string.prayer_location_denied)
                launch(activity) { onResult(null) }
                return@request
            }
            ensureEnabled(activity, permissions) { enabled ->
                if (!enabled) {
                    launch(activity) { onResult(null) }
                    return@ensureEnabled
                }
                onBusy(true)
                launch(activity) {
                    val location = currentLocation(activity)
                    onBusy(false)
                    if (location == null) message(activity, R.string.prayer_location_failed)
                    onResult(location)
                }
            }
        }
    }

    private fun launch(activity: AppCompatActivity, block: suspend () -> Unit) {
        activity.lifecycleScope.launch { block() }
    }

    private fun isEnabled(context: Context): Boolean {
        val manager = context.getSystemService(LocationManager::class.java) ?: return false
        return LocationManagerCompat.isLocationEnabled(manager)
    }

    /** Asks Google Play services to show its one-tap "turn on location" dialog; falls back to the settings page. */
    private fun ensureEnabled(activity: AppCompatActivity, permissions: PermissionRequester, onResult: (Boolean) -> Unit) {
        if (isEnabled(activity)) return onResult(true)
        val request = LocationSettingsRequest.Builder()
            .addLocationRequest(LocationRequest.Builder(Priority.PRIORITY_BALANCED_POWER_ACCURACY, 10_000).build())
            .setAlwaysShow(true)
            .build()
        try {
            LocationServices.getSettingsClient(activity).checkLocationSettings(request)
                .addOnSuccessListener { onResult(true) }
                .addOnFailureListener { e ->
                    if (e is ResolvableApiException) {
                        permissions.resolve(e.resolution.intentSender) { ok ->
                            if (ok) onResult(true) else { askToEnable(activity); onResult(false) }
                        }
                    } else {
                        askToEnable(activity); onResult(false)
                    }
                }
        } catch (e: Exception) {
            askToEnable(activity); onResult(false)
        }
    }

    private fun askToEnable(activity: AppCompatActivity) {
        if (activity.isFinishing) return
        AlertDialog.Builder(activity)
            .setTitle(R.string.location_off_title)
            .setMessage(R.string.location_off_text)
            .setPositiveButton(R.string.location_open_settings) { _, _ ->
                open(activity, Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS))
            }
            .setNegativeButton(android.R.string.cancel, null)
            .show()
    }

    private fun explainBlocked(activity: AppCompatActivity) {
        if (activity.isFinishing) return
        AlertDialog.Builder(activity)
            .setTitle(R.string.location_blocked_title)
            .setMessage(R.string.location_blocked_text)
            .setPositiveButton(R.string.location_open_app_settings) { _, _ ->
                open(activity, Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.fromParts("package", activity.packageName, null)))
            }
            .setNegativeButton(android.R.string.cancel, null)
            .show()
    }

    private fun message(activity: AppCompatActivity, text: Int) {
        if (activity.isFinishing) return
        AlertDialog.Builder(activity).setMessage(text).setPositiveButton(android.R.string.ok, null).show()
    }

    private fun open(activity: AppCompatActivity, intent: Intent) {
        try {
            activity.startActivity(intent)
        } catch (e: ActivityNotFoundException) {
            runCatching { activity.startActivity(Intent(Settings.ACTION_SETTINGS)) }
        }
    }

    /** A fix from the fused provider, else from the platform providers; the caller holds the permission. */
    @SuppressLint("MissingPermission")
    suspend fun currentLocation(context: Context): Location? {
        val fused = runCatching { LocationServices.getFusedLocationProviderClient(context) }.getOrNull()
        if (fused != null) {
            val fresh = runCatching {
                withTimeoutOrNull(15_000) {
                    val token = CancellationTokenSource()
                    try {
                        fused.getCurrentLocation(Priority.PRIORITY_BALANCED_POWER_ACCURACY, token.token).await()
                    } finally {
                        token.cancel()
                    }
                }
            }.getOrNull()
            if (fresh != null) return fresh
            runCatching { fused.lastLocation.await() }.getOrNull()?.let { return it }
        }
        return platformLocation(context)
    }

    private suspend fun <T> Task<T>.await(): T? = suspendCancellableCoroutine { cont ->
        addOnSuccessListener { if (cont.isActive) cont.resume(it) }
        addOnFailureListener { if (cont.isActive) cont.resume(null) }
        addOnCanceledListener { if (cont.isActive) cont.resume(null) }
    }

    @SuppressLint("MissingPermission")
    private suspend fun platformLocation(context: Context): Location? {
        val manager = context.getSystemService(LocationManager::class.java) ?: return null
        val providers = listOf(LocationManager.NETWORK_PROVIDER, LocationManager.GPS_PROVIDER, LocationManager.PASSIVE_PROVIDER)
            .filter { runCatching { manager.isProviderEnabled(it) }.getOrDefault(false) }
        val lastKnown = providers.mapNotNull { runCatching { manager.getLastKnownLocation(it) }.getOrNull() }
            .maxByOrNull { it.time }
        if (lastKnown != null && System.currentTimeMillis() - lastKnown.time < 6 * 60 * 60_000L) return lastKnown
        val provider = providers.firstOrNull { it != LocationManager.PASSIVE_PROVIDER } ?: return lastKnown
        val fresh = withTimeoutOrNull(20_000) { requestSingle(manager, provider) }
        return fresh ?: lastKnown
    }

    @SuppressLint("MissingPermission")
    @Suppress("DEPRECATION")
    private suspend fun requestSingle(manager: LocationManager, provider: String): Location? =
        suspendCancellableCoroutine { cont ->
            if (Build.VERSION.SDK_INT >= 30) {
                val signal = android.os.CancellationSignal()
                cont.invokeOnCancellation { signal.cancel() }
                manager.getCurrentLocation(provider, signal, { it.run() }) { location ->
                    if (cont.isActive) cont.resume(location)
                }
            } else {
                val listener = object : LocationListener {
                    override fun onLocationChanged(location: Location) {
                        if (cont.isActive) cont.resume(location)
                    }
                    override fun onStatusChanged(provider: String?, status: Int, extras: Bundle?) {}
                    override fun onProviderEnabled(provider: String) {}
                    override fun onProviderDisabled(provider: String) {}
                }
                cont.invokeOnCancellation { manager.removeUpdates(listener) }
                manager.requestSingleUpdate(provider, listener, Looper.getMainLooper())
            }
        }
}
