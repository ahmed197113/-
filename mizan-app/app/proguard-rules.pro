# Workers are instantiated by reflection.
-keep class com.mizan.budget.** extends androidx.work.ListenableWorker { <init>(...); }
