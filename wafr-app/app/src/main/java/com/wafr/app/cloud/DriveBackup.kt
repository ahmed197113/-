package com.wafr.app.cloud

import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import com.google.android.gms.auth.api.identity.AuthorizationRequest
import com.google.android.gms.auth.api.identity.Identity
import com.google.android.gms.common.api.Scope
import com.wafr.app.data.Repository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder

/**
 * Backs the app's JSON export up to the user's own Google Drive, in the hidden
 * per-app "appDataFolder" (only Wafr can see it; it doesn't clutter their Drive).
 */
object DriveBackup {
    private const val FILE_NAME = "wafr-backup.json"
    private val scope = Scope("https://www.googleapis.com/auth/drive.appdata")
    private val request: AuthorizationRequest = AuthorizationRequest.builder().setRequestedScopes(listOf(scope)).build()

    /** Either a ready access token, or a consent screen the user must see first. */
    sealed interface Auth {
        data class Token(val value: String) : Auth
        data class NeedsConsent(val intent: PendingIntent) : Auth
    }

    suspend fun authorize(context: Context): Auth {
        val r = Identity.getAuthorizationClient(context).authorize(request).await()
        val pending = r.pendingIntent
        return if (r.hasResolution() && pending != null) Auth.NeedsConsent(pending)
        else Auth.Token(r.accessToken ?: error("no token"))
    }

    /** Reads the token from the consent screen's result. */
    fun tokenFromConsent(context: Context, data: Intent?): String =
        Identity.getAuthorizationClient(context).getAuthorizationResultFromIntent(data).accessToken ?: error("no token")

    /** Silent token for background backups; null if the user has to approve something first. */
    suspend fun silentToken(context: Context): String? =
        runCatching { (authorize(context) as? Auth.Token)?.value }.getOrNull()

    suspend fun backup(repo: Repository, token: String) = withContext(Dispatchers.IO) {
        val json = repo.exportJson()
        val existing = findFile(token)
        if (existing == null) {
            val boundary = "wafr" + System.nanoTime()
            val meta = JSONObject().put("name", FILE_NAME).put("parents", org.json.JSONArray().put("appDataFolder")).toString()
            val body = buildString {
                append("--$boundary\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n$meta\r\n")
                append("--$boundary\r\nContent-Type: application/json\r\n\r\n$json\r\n--$boundary--")
            }
            call("POST", "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", token, body, "multipart/related; boundary=$boundary")
        } else {
            // HttpURLConnection has no PATCH; Google APIs accept the override header.
            call("POST", "https://www.googleapis.com/upload/drive/v3/files/$existing?uploadType=media", token, json, "application/json", override = "PATCH")
        }
        Unit
    }

    /** Restores the latest Drive backup; returns how many expenses came back, or null if there is no backup. */
    suspend fun restore(repo: Repository, token: String): Int? = withContext(Dispatchers.IO) {
        val id = findFile(token) ?: return@withContext null
        val text = call("GET", "https://www.googleapis.com/drive/v3/files/$id?alt=media", token)
        repo.importJson(text)
    }

    private fun findFile(token: String): String? {
        val q = URLEncoder.encode("name='$FILE_NAME'", "UTF-8")
        val res = call("GET", "https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=$q&fields=files(id)", token)
        val files = JSONObject(res).optJSONArray("files") ?: return null
        return if (files.length() > 0) files.getJSONObject(0).getString("id") else null
    }

    private fun call(method: String, url: String, token: String, body: String? = null, type: String? = null, override: String? = null): String {
        val c = URL(url).openConnection() as HttpURLConnection
        try {
            c.requestMethod = method
            c.connectTimeout = 15000
            c.readTimeout = 30000
            c.setRequestProperty("Authorization", "Bearer $token")
            if (override != null) c.setRequestProperty("X-HTTP-Method-Override", override)
            if (body != null) {
                c.doOutput = true
                c.setRequestProperty("Content-Type", type ?: "application/json")
                c.outputStream.use { it.write(body.toByteArray()) }
            }
            val code = c.responseCode
            val text = (if (code in 200..299) c.inputStream else c.errorStream)?.bufferedReader()?.use { it.readText() }.orEmpty()
            if (code !in 200..299) error("Drive HTTP $code: $text")
            return text
        } finally {
            c.disconnect()
        }
    }
}
