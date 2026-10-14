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
import androidx.compose.ui.graphics.SolidColor
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

/** Brand colours: calm, high-contrast and practical. */
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
    /** Primary fill for buttons and highlights. */
    val neon: Brush get() = SolidColor(glow1)
    val neonH: Brush get() = SolidColor(glow1)
    val hero: Brush get() = Brush.linearGradient(listOf(Color(0xFF0F3D33), Color(0xFF0B2A30)))
    val border: Brush get() = SolidColor(cardBorder)
    val cardFill: Brush get() = SolidColor(card)
}

private val DarkExtra = WafrColors(
    need = Color(0xFF60A5FA), want = Color(0xFFF59E0B), good = Color(0xFF10B981), danger = Color(0xFFEF4444),
    text = Color(0xFFE8ECF2), muted = Color(0xFF9AA4B2),
    card = Color(0xFF171C24), cardBorder = Color(0xFF262D38),
    glow1 = Color(0xFF10B981), glow2 = Color(0xFF3B82F6), glow3 = Color(0xFF8B5CF6), glow4 = Color(0xFFEC4899),
    bg = Color(0xFF0E1117), isDark = true,
)

private val LightExtra = WafrColors(
    need = Color(0xFF2563EB), want = Color(0xFFB45309), good = Color(0xFF059669), danger = Color(0xFFDC2626),
    text = Color(0xFF111827), muted = Color(0xFF6B7280),
    card = Color(0xFFFFFFFF), cardBorder = Color(0xFFE3E7ED),
    glow1 = Color(0xFF059669), glow2 = Color(0xFF2563EB), glow3 = Color(0xFF7C3AED), glow4 = Color(0xFFDB2777),
    bg = Color(0xFFF4F6F9), isDark = false,
)

val LocalWafr = staticCompositionLocalOf { DarkExtra }

private val DarkScheme = darkColorScheme(
    primary = Color(0xFF10B981), onPrimary = Color(0xFF02140E),
    primaryContainer = Color(0xFF0F3D33), onPrimaryContainer = Color(0xFFB7F5DE),
    secondary = Color(0xFF60A5FA), onSecondary = Color(0xFF04172E),
    secondaryContainer = Color(0xFF1E3350), onSecondaryContainer = Color(0xFFD6E6FF),
    tertiary = Color(0xFFF59E0B),
    background = Color(0xFF0E1117), onBackground = Color(0xFFE8ECF2),
    surface = Color(0xFF151A21), onSurface = Color(0xFFE8ECF2),
    surfaceVariant = Color(0xFF212833), onSurfaceVariant = Color(0xFFC2CAD6),
    surfaceContainer = Color(0xFF171C24), surfaceContainerHigh = Color(0xFF1C222B),
    surfaceContainerHighest = Color(0xFF232A35), surfaceContainerLow = Color(0xFF12161D),
    outline = Color(0xFF3A4350), outlineVariant = Color(0xFF262D38),
    error = Color(0xFFEF4444),
)

private val LightScheme = lightColorScheme(
    primary = Color(0xFF059669), onPrimary = Color.White,
    primaryContainer = Color(0xFFD1FAE5), onPrimaryContainer = Color(0xFF052E22),
    secondary = Color(0xFF2563EB), onSecondary = Color.White,
    secondaryContainer = Color(0xFFDBEAFE), onSecondaryContainer = Color(0xFF0B1F44),
    tertiary = Color(0xFFB45309),
    background = Color(0xFFF4F6F9), onBackground = Color(0xFF111827),
    surface = Color(0xFFFFFFFF), onSurface = Color(0xFF111827),
    surfaceVariant = Color(0xFFEDF0F4), onSurfaceVariant = Color(0xFF4B5563),
    surfaceContainer = Color(0xFFFFFFFF), surfaceContainerHigh = Color(0xFFF6F7F9),
    surfaceContainerHighest = Color(0xFFEDF0F4), surfaceContainerLow = Color(0xFFF9FAFB),
    outline = Color(0xFFCBD2DB), outlineVariant = Color(0xFFE3E7ED),
    error = Color(0xFFDC2626),
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
