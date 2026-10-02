package com.netguard.app.ui

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val Blue = Color(0xFF0D47A1)
private val BlueLight = Color(0xFF5472D3)
private val Green = Color(0xFF2E7D32)
private val Red = Color(0xFFC62828)

private val LightColors = lightColorScheme(
    primary = Blue, secondary = Green, error = Red,
)
private val DarkColors = darkColorScheme(
    primary = BlueLight, secondary = Color(0xFF66BB6A), error = Color(0xFFEF5350),
)

val BlockedColor = Red
val OnlineColor = Green

@Composable
fun NetGuardTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = if (isSystemInDarkTheme()) DarkColors else LightColors,
        content = content,
    )
}
