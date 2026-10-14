# Workers are instantiated by reflection.
-keep class com.wafr.app.** extends androidx.work.ListenableWorker { <init>(...); }

# Credential Manager loads its Play Services provider by reflection.
-if class androidx.credentials.CredentialManager
-keep class androidx.credentials.playservices.** { *; }
