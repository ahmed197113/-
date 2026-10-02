package com.contracting.academy.ui

import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.MenuBook
import androidx.compose.material.icons.filled.Calculate
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Translate
import androidx.compose.material.icons.filled.Verified
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.contracting.academy.ui.screens.AboutScreen
import com.contracting.academy.ui.screens.BookmarksScreen
import com.contracting.academy.ui.screens.GlossaryScreen
import com.contracting.academy.ui.screens.HomeScreen
import com.contracting.academy.ui.screens.LessonScreen
import com.contracting.academy.ui.screens.LibraryScreen
import com.contracting.academy.ui.screens.QuizScreen
import com.contracting.academy.ui.screens.SearchScreen
import com.contracting.academy.ui.screens.SourcesScreen
import com.contracting.academy.ui.screens.ToolScreen
import com.contracting.academy.ui.screens.ToolsScreen
import com.contracting.academy.ui.screens.TrackScreen

private data class Tab(val route: String, val label: String, val icon: ImageVector)

private val tabs = listOf(
    Tab("home", "الرئيسية", Icons.Filled.Home),
    Tab("library", "الدروس", Icons.AutoMirrored.Filled.MenuBook),
    Tab("tools", "الأدوات", Icons.Filled.Calculate),
    Tab("glossary", "القاموس", Icons.Filled.Translate),
    Tab("sources", "المصادر", Icons.Filled.Verified),
)

/** مسارات التنقل المستخدمة من الشاشات. */
class Nav(private val nav: NavHostController) {
    fun back() = nav.popBackStack()
    fun track(id: String) = nav.navigate("track/$id")
    fun lesson(id: String) = nav.navigate("lesson/$id")
    fun quiz(id: String) = nav.navigate("quiz/$id")
    fun tool(id: String) = nav.navigate("tool/$id")
    fun search() = nav.navigate("search")
    fun bookmarks() = nav.navigate("bookmarks")
    fun about() = nav.navigate("about")
    fun tab(route: String) = nav.navigate(route) {
        popUpTo(nav.graph.findStartDestination().id) { saveState = true }
        launchSingleTop = true
        restoreState = true
    }

    /** الانتقال للدرس التالي مع استبدال الدرس الحالي في سجل الرجوع. */
    fun replaceLesson(id: String) = nav.navigate("lesson/$id") {
        popUpTo("lesson/{id}") { inclusive = true }
    }
}

@Composable
fun AcademyApp() {
    val controller = rememberNavController()
    val nav = Nav(controller)
    val entry by controller.currentBackStackEntryAsState()
    val route = entry?.destination?.route
    val showBar = tabs.any { it.route == route }

    Scaffold(
        bottomBar = {
            if (showBar) {
                NavigationBar {
                    tabs.forEach { t ->
                        NavigationBarItem(
                            selected = route == t.route,
                            onClick = { nav.tab(t.route) },
                            icon = { Icon(t.icon, contentDescription = t.label) },
                            label = { Text(t.label) },
                        )
                    }
                }
            }
        },
    ) { inner ->
        NavHost(
            navController = controller,
            startDestination = "home",
            modifier = Modifier.padding(bottom = inner.calculateBottomPadding()),
        ) {
            composable("home") { HomeScreen(nav) }
            composable("library") { LibraryScreen(nav) }
            composable("tools") { ToolsScreen(nav) }
            composable("glossary") { GlossaryScreen() }
            composable("sources") { SourcesScreen() }
            composable("search") { SearchScreen(nav) }
            composable("bookmarks") { BookmarksScreen(nav) }
            composable("about") { AboutScreen(nav) }
            composable("track/{id}") { TrackScreen(it.arguments?.getString("id").orEmpty(), nav) }
            composable("lesson/{id}") { LessonScreen(it.arguments?.getString("id").orEmpty(), nav) }
            composable("quiz/{id}") { QuizScreen(it.arguments?.getString("id").orEmpty(), nav) }
            composable("tool/{id}") { ToolScreen(it.arguments?.getString("id").orEmpty(), nav) }
        }
    }
}
