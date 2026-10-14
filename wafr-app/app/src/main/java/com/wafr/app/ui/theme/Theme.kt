package com.wafr.app.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.LocalContentColor
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
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import com.wafr.app.R

val Plex = FontFamily(
    Font(R.font.plex_regular, FontWeight.Normal),
    Font(R.font.plex_medium, FontWeight.Medium),
    Font(R.font.plex_semibold, FontWeight.SemiBold),
    Font(R.font.plex_bold, FontWeight.Bold),
    Font(R.font.plex_bold, FontWeight.ExtraBold),
)

/** Brand colours of the "2500" look: void black, iridescent holo spectrum, quantum glow. */
@Immutable
data class WafrColors(
    val need: Color,
    val want: Color,
    val good: Color,
    val danger: Color,
    val text: Color,
    val muted: Color,
    val card: Color,
    val cardBorder: Color,
    val glow1: Color,
    val glow2: Color,
    val glow3: Color,
    val glow4: Color,
    val bg: Color,
    val isDark: Boolean,
) {
    val spectrum: List<Color> get() = listOf(glow1, glow2, glow3, glow4)
    val neon: Brush get() = Brush.linearGradient(listOf(Color(0xFF00FFD1), Color(0xFF00D4FF), Color(0xFF9D6BFF)))
    val neonH: Brush get() = Brush.horizontalGradient(listOf(Color(0xFF00FFD1), Color(0xFF00D4FF), Color(0xFF9D6BFF)))
    val holo: Brush get() = Brush.linearGradient(listOf(glow1, glow2, glow3, glow4, glow1))
    val hero: Brush get() = Brush.linearGradient(listOf(Color(0xFF041A33), Color(0xFF0B0B3D), Color(0xFF2A0845), Color(0xFF12052A)))
    val border: Brush get() = Brush.linearGradient(listOf(glow1.copy(alpha = 0.6f), cardBorder, glow3.copy(alpha = 0.5f), glow4.copy(alpha = 0.35f)))
    val cardFill: Brush get() = Brush.verticalGradient(
        if (isDark) listOf(Color(0xD0121C38), Color(0xC8070C1E)) else listOf(Color(0xF7FFFFFF), Color(0xEEF3F6FE)),
    )
}

private val DarkExtra = WafrColors(
    need = Color(0xFF4DE1FF), want = Color(0xFFFFC247), good = Color(0xFF00FFD1), danger = Color(0xFFFF4D7E),
    text = Color(0xFFF4F7FF), muted = Color(0xFFA7B3D4),
    card = Color(0xC70A1228), cardBorder = Color(0x24FFFFFF),
    glow1 = Color(0xFF00FFD1), glow2 = Color(0xFF00B4FF), glow3 = Color(0xFF9D6BFF), glow4 = Color(0xFFFF4FD8),
    bg = Color(0xFF010208), isDark = true,
)

private val LightExtra = WafrColors(
    need = Color(0xFF0077CC), want = Color(0xFFC46A00), good = Color(0xFF008F72), danger = Color(0xFFD7263D),
    text = Color(0xFF0A1022), muted = Color(0xFF4E5B7A),
    card = Color(0xF2FFFFFF), cardBorder = Color(0x1A0A1022),
    glow1 = Color(0xFF00C9A7), glow2 = Color(0xFF3AA0FF), glow3 = Color(0xFF8A5CFF), glow4 = Color(0xFFE040B0),
    bg = Color(0xFFEDF1FA), isDark = false,
)

val LocalWafr = staticCompositionLocalOf { DarkExtra }

private val DarkScheme = darkColorScheme(
    primary = Color(0xFF00FFD1), onPrimary = Color(0xFF00241C),
    primaryContainer = Color(0xFF003D31), onPrimaryContainer = Color(0xFFB8FFEC),
    secondary = Color(0xFF9D6BFF), onSecondary = Color.White,
    secondaryContainer = Color(0xFF2A1B5C), onSecondaryContainer = Color(0xFFE4DBFF),
    tertiary = Color(0xFFFFB020),
    background = Color(0xFF010208), onBackground = Color(0xFFF4F7FF),
    surface = Color(0xFF080F22), onSurface = Color(0xFFF4F7FF),
    surfaceVariant = Color(0xFF16213A), onSurfaceVariant = Color(0xFFC3CEE8),
    surfaceContainer = Color(0xFF0E172C), surfaceContainerHigh = Color(0xFF152038),
    surfaceContainerHighest = Color(0xFF1B2844), surfaceContainerLow = Color(0xFF0A1122),
    outline = Color(0xFF3A4A6E), outlineVariant = Color(0xFF26334F),
    error = Color(0xFFFF4D7E),
)

private val LightScheme = lightColorScheme(
    primary = Color(0xFF00876B), onPrimary = Color.White,
    primaryContainer = Color(0xFFC8FFF0), onPrimaryContainer = Color(0xFF002A21),
    secondary = Color(0xFF6A3FE0), onSecondary = Color.White,
    secondaryContainer = Color(0xFFE6DDFF), onSecondaryContainer = Color(0xFF21005E),
    tertiary = Color(0xFFC46A00),
    background = Color(0xFFEEF2FA), onBackground = Color(0xFF0A1022),
    surface = Color(0xFFFFFFFF), onSurface = Color(0xFF0A1022),
    surfaceVariant = Color(0xFFE3E8F4), onSurfaceVariant = Color(0xFF3B4766),
    surfaceContainer = Color(0xFFFFFFFF), surfaceContainerHigh = Color(0xFFF2F5FB),
    surfaceContainerHighest = Color(0xFFE8EDF7), surfaceContainerLow = Color(0xFFF7F9FD),
    outline = Color(0xFFB9C3D9), outlineVariant = Color(0xFFD7DEEC),
    error = Color(0xFFD7263D),
)

private val AppTypography = Typography().let { t ->
    fun TextStyle.p(w: FontWeight? = null) = copy(fontFamily = Plex, fontWeight = w ?: fontWeight)
    t.copy(
        displayLarge = t.displayLarge.p(FontWeight.Bold), displayMedium = t.displayMedium.p(FontWeight.Bold),
        displaySmall = t.displaySmall.p(FontWeight.Bold),
        headlineLarge = t.headlineLarge.p(FontWeight.Bold), headlineMedium = t.headlineMedium.p(FontWeight.Bold),
        headlineSmall = t.headlineSmall.p(FontWeight.Bold),
        titleLarge = t.titleLarge.p(FontWeight.Bold), titleMedium = t.titleMedium.p(FontWeight.SemiBold),
        titleSmall = t.titleSmall.p(FontWeight.SemiBold),
        bodyLarge = t.bodyLarge.p(), bodyMedium = t.bodyMedium.p(), bodySmall = t.bodySmall.p(),
        labelLarge = t.labelLarge.p(FontWeight.SemiBold), labelMedium = t.labelMedium.p(FontWeight.Medium),
        labelSmall = t.labelSmall.p(FontWeight.Medium),
    )
}

val AmountStyle = TextStyle(fontFamily = Plex, fontSize = 44.sp, fontWeight = FontWeight.Bold, letterSpacing = (-1).sp)

/** Small Latin HUD captions ("SYS · 2500"): wide tracking, like an instrument panel. */
val HudStyle = TextStyle(fontFamily = Plex, fontSize = 10.sp, fontWeight = FontWeight.SemiBold, letterSpacing = 2.sp)

@Composable
fun WafrTheme(themeMode: Int = 2, content: @Composable () -> Unit) {
    val dark = when (themeMode) {
        1 -> false
        2 -> true
        else -> isSystemInDarkTheme()
    }
    val scheme = if (dark) DarkScheme else LightScheme
    CompositionLocalProvider(LocalWafr provides if (dark) DarkExtra else LightExtra) {
        MaterialTheme(colorScheme = scheme, typography = AppTypography) {
            // Default text colour for anything not inside a Surface: fixes dark-on-dark text.
            CompositionLocalProvider(LocalContentColor provides scheme.onBackground, content = content)
        }
    }
}

object Mz {
    val colors: WafrColors @Composable get() = LocalWafr.current
}
