package com.contracting.academy.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.sp

val Navy = Color(0xFF1F3A5F)
val Teal = Color(0xFF2E7D7A)
val Gold = Color(0xFFB7860B)
val Success = Color(0xFF2E7D32)
val Danger = Color(0xFFC62828)

private val Light = lightColorScheme(
    primary = Navy,
    onPrimary = Color.White,
    primaryContainer = Color(0xFFD6E3F5),
    onPrimaryContainer = Color(0xFF0E2340),
    secondary = Teal,
    onSecondary = Color.White,
    secondaryContainer = Color(0xFFD3EEEC),
    onSecondaryContainer = Color(0xFF0B3A38),
    tertiary = Gold,
    tertiaryContainer = Color(0xFFFFF1CC),
    onTertiaryContainer = Color(0xFF4A3500),
    background = Color(0xFFF4F6F8),
    surface = Color(0xFFFFFFFF),
    surfaceVariant = Color(0xFFEEF2F6),
    onSurfaceVariant = Color(0xFF4A5663),
    outline = Color(0xFFC9D3DD),
    error = Danger,
)

private val Dark = darkColorScheme(
    primary = Color(0xFF9EC2F0),
    onPrimary = Color(0xFF0E2340),
    primaryContainer = Color(0xFF2C4A72),
    onPrimaryContainer = Color(0xFFD6E3F5),
    secondary = Color(0xFF7FD3CE),
    onSecondary = Color(0xFF0B3A38),
    secondaryContainer = Color(0xFF1F5552),
    onSecondaryContainer = Color(0xFFD3EEEC),
    tertiary = Color(0xFFF2C75C),
    tertiaryContainer = Color(0xFF5A4200),
    onTertiaryContainer = Color(0xFFFFF1CC),
    background = Color(0xFF101418),
    surface = Color(0xFF181D23),
    surfaceVariant = Color(0xFF232A32),
    onSurfaceVariant = Color(0xFFB8C3CF),
    outline = Color(0xFF3B4652),
    error = Color(0xFFFF8A80),
)

private val base = Typography()

private val AppTypography = Typography(
    headlineSmall = base.headlineSmall.copy(fontWeight = FontWeight.Bold),
    titleLarge = base.titleLarge.copy(fontWeight = FontWeight.Bold),
    titleMedium = base.titleMedium.copy(fontWeight = FontWeight.Bold),
    bodyLarge = base.bodyLarge.copy(lineHeight = 28.sp),
    bodyMedium = base.bodyMedium.copy(lineHeight = 24.sp),
    labelLarge = base.labelLarge.copy(fontWeight = FontWeight.SemiBold),
)

@Composable
fun AcademyTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = if (isSystemInDarkTheme()) Dark else Light,
        typography = AppTypography,
    ) {
        // التطبيق عربي بالكامل: نفرض الاتجاه من اليمين لليسار مهما كانت لغة الجهاز
        CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Rtl, content = content)
    }
}
