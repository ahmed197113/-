package com.mizan.budget.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp

@Immutable
data class MizaniColors(
    val need: Color,
    val want: Color,
    val good: Color,
    val danger: Color,
    val muted: Color,
    val card: Color,
    val cardBorder: Color,
    val heroStart: Color,
    val heroEnd: Color,
    val isDark: Boolean,
) {
    val hero: Brush get() = Brush.linearGradient(listOf(heroStart, heroEnd))
}

private val DarkExtra = MizaniColors(
    need = Color(0xFF4FD1FF), want = Color(0xFFFFB547), good = Color(0xFF2EE6A6), danger = Color(0xFFFF5C7A),
    muted = Color(0xFF8A96B5), card = Color(0xFF111A2C), cardBorder = Color(0x1AFFFFFF),
    heroStart = Color(0xFF16324F), heroEnd = Color(0xFF2B1F5C), isDark = true,
)

private val LightExtra = MizaniColors(
    need = Color(0xFF0A8FD1), want = Color(0xFFE08A00), good = Color(0xFF0BAF7A), danger = Color(0xFFE5304F),
    muted = Color(0xFF66718F), card = Color(0xFFFFFFFF), cardBorder = Color(0x14000000),
    heroStart = Color(0xFF0F2A47), heroEnd = Color(0xFF3A2A8C), isDark = false,
)

val LocalMizani = staticCompositionLocalOf { DarkExtra }

private val DarkScheme = darkColorScheme(
    primary = Color(0xFF2EE6A6), onPrimary = Color(0xFF00281A),
    secondary = Color(0xFF8B7CFF), onSecondary = Color.White,
    tertiary = Color(0xFFFFB547),
    background = Color(0xFF070B14), onBackground = Color(0xFFEEF2FF),
    surface = Color(0xFF0C1322), onSurface = Color(0xFFEEF2FF),
    surfaceVariant = Color(0xFF172036), onSurfaceVariant = Color(0xFFB4BFDA),
    surfaceContainer = Color(0xFF111A2C), surfaceContainerHigh = Color(0xFF172036),
    surfaceContainerLow = Color(0xFF0C1322),
    outline = Color(0xFF2A3550),
    error = Color(0xFFFF5C7A),
)

private val LightScheme = lightColorScheme(
    primary = Color(0xFF07A877), onPrimary = Color.White,
    secondary = Color(0xFF6A5AE0), onSecondary = Color.White,
    tertiary = Color(0xFFE08A00),
    background = Color(0xFFF3F5FB), onBackground = Color(0xFF0E1630),
    surface = Color(0xFFFFFFFF), onSurface = Color(0xFF0E1630),
    surfaceVariant = Color(0xFFE8ECF6), onSurfaceVariant = Color(0xFF4A5677),
    surfaceContainer = Color(0xFFFFFFFF), surfaceContainerHigh = Color(0xFFEFF2FA),
    surfaceContainerLow = Color(0xFFF7F8FC),
    outline = Color(0xFFD5DBEA),
    error = Color(0xFFE5304F),
)

private val AppTypography = Typography().let { t ->
    t.copy(
        displayLarge = t.displayLarge.copy(fontWeight = FontWeight.ExtraBold),
        headlineLarge = t.headlineLarge.copy(fontWeight = FontWeight.Bold),
        headlineMedium = t.headlineMedium.copy(fontWeight = FontWeight.Bold),
        titleLarge = t.titleLarge.copy(fontWeight = FontWeight.Bold),
        titleMedium = t.titleMedium.copy(fontWeight = FontWeight.SemiBold),
        labelLarge = t.labelLarge.copy(fontWeight = FontWeight.SemiBold),
    )
}

val AmountStyle = TextStyle(fontSize = 40.sp, fontWeight = FontWeight.ExtraBold, letterSpacing = (-1).sp)

@Composable
fun MizaniTheme(themeMode: Int = 2, content: @Composable () -> Unit) {
    val dark = when (themeMode) {
        1 -> false
        2 -> true
        else -> isSystemInDarkTheme()
    }
    CompositionLocalProvider(LocalMizani provides if (dark) DarkExtra else LightExtra) {
        MaterialTheme(
            colorScheme = if (dark) DarkScheme else LightScheme,
            typography = AppTypography,
            content = content,
        )
    }
}

object Mz {
    val colors: MizaniColors @Composable get() = LocalMizani.current
}
