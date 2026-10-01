package com.reminder.salawat

import android.annotation.SuppressLint
import android.content.Context
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Build
import android.os.Bundle
import android.os.Looper
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withTimeoutOrNull
import kotlin.coroutines.resume

/** Coarse location without Google Play services; the caller must hold the location permission. */
object LocationHelper {

    @SuppressLint("MissingPermission")
    suspend fun currentLocation(context: Context): Location? {
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
