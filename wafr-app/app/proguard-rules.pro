# Workers are instantiated by reflection.
-keep class com.wafr.app.** extends androidx.work.ListenableWorker { <init>(...); }
