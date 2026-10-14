package com.wafr.app.cloud

import android.content.Context
import androidx.credentials.ClearCredentialStateRequest
import androidx.credentials.CredentialManager
import androidx.credentials.CustomCredential
import androidx.credentials.GetCredentialRequest
import androidx.credentials.exceptions.GetCredentialCancellationException
import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential
import com.wafr.app.BuildConfig

data class GoogleProfile(val email: String, val name: String, val photoUrl: String)

/** "Sign in with Google" through Credential Manager. Needs the Web OAuth client id baked into BuildConfig. */
object GoogleAccount {
    val isConfigured: Boolean get() = BuildConfig.GOOGLE_WEB_CLIENT_ID.isNotBlank()

    class Cancelled : Exception()

    /** [context] must be an Activity: the account picker is shown on top of it. */
    suspend fun signIn(context: Context): GoogleProfile {
        check(isConfigured) { "not configured" }
        val option = GetSignInWithGoogleOption.Builder(BuildConfig.GOOGLE_WEB_CLIENT_ID).build()
        val request = GetCredentialRequest.Builder().addCredentialOption(option).build()
        val result = try {
            CredentialManager.create(context).getCredential(context, request)
        } catch (e: GetCredentialCancellationException) {
            throw Cancelled()
        }
        val cred = result.credential
        require(cred is CustomCredential && cred.type == GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL) { "unexpected credential" }
        val g = GoogleIdTokenCredential.createFrom(cred.data)
        return GoogleProfile(email = g.id, name = g.displayName.orEmpty(), photoUrl = g.profilePictureUri?.toString().orEmpty())
    }

    suspend fun signOut(context: Context) {
        runCatching { CredentialManager.create(context).clearCredentialState(ClearCredentialStateRequest()) }
    }
}
