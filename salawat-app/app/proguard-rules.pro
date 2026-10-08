# Workers and receivers are instantiated by reflection (kept by AAPT/WorkManager rules).
-keep class com.reminder.salawat.** extends androidx.work.ListenableWorker { <init>(...); }
