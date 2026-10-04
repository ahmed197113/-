package com.sahwa.app.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

object C {
    val Bg = Color(0xFF060A13)
    val Panel = Color(0xFF0D1424)
    val Panel2 = Color(0xFF141D33)
    val Cyan = Color(0xFF22D3EE)
    val Indigo = Color(0xFF818CF8)
    val Violet = Color(0xFFA78BFA)
    val Pink = Color(0xFFF472B6)
    val Green = Color(0xFF34D399)
    val Amber = Color(0xFFFBBF24)
    val Red = Color(0xFFF87171)
    val Text = Color(0xFFE6EDF7)
    val Muted = Color(0xFF8A97B0)
    val Rot = Color(0xFF8A7A4A)
}

@Composable
fun SahwaTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = darkColorScheme(
            primary = C.Cyan,
            onPrimary = Color(0xFF041016),
            secondary = C.Violet,
            background = C.Bg,
            surface = C.Panel,
            onSurface = C.Text,
            onBackground = C.Text,
            surfaceVariant = C.Panel2,
            error = C.Red,
        ),
        content = content,
    )
}

/** Glassy card with a subtle neon edge. */
@Composable
fun GlowCard(
    modifier: Modifier = Modifier,
    accent: Color = C.Cyan,
    padding: PaddingValues = PaddingValues(18.dp),
    content: @Composable ColumnScope.() -> Unit,
) {
    Surface(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(24.dp),
        color = C.Panel,
        border = BorderStroke(
            1.dp,
            Brush.linearGradient(listOf(accent.copy(alpha = 0.55f), Color.Transparent, accent.copy(alpha = 0.15f))),
        ),
    ) {
        Column(Modifier.padding(padding), content = content)
    }
}

@Composable
fun ScreenHeader(title: String, subtitle: String) {
    Column(Modifier.padding(top = 8.dp, bottom = 4.dp)) {
        Text(title, color = C.Text, fontSize = 28.sp, fontWeight = FontWeight.Black)
        Text(subtitle, color = C.Muted, fontSize = 14.sp)
    }
}

@Composable
fun SectionTitle(text: String) {
    Text(text, color = C.Text, fontSize = 17.sp, fontWeight = FontWeight.Bold)
}
