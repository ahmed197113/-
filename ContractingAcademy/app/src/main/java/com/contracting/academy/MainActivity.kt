package com.contracting.academy

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import com.contracting.academy.data.ContentRepository
import com.contracting.academy.data.ProgressStore
import com.contracting.academy.ui.AcademyApp
import com.contracting.academy.ui.theme.AcademyTheme

/** نقطة وصول مشتركة للمحتوى والتقدّم داخل الشاشات. */
object App {
    lateinit var content: ContentRepository
    lateinit var progress: ProgressStore
}

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (!App::content.isInitialized) App.content = ContentRepository(applicationContext)
        if (!App::progress.isInitialized) App.progress = ProgressStore(applicationContext)
        setContent {
            AcademyTheme { AcademyApp() }
        }
    }
}
