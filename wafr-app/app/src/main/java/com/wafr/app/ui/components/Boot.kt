package com.wafr.app.ui.components

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleOut
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.unit.dp
import com.wafr.app.ui.theme.HudStyle
import com.wafr.app.ui.theme.Mz
import kotlinx.coroutines.delay

/** One-second "power-on" sequence on cold start: the logo charges up inside a sweeping ring, then dissolves. */
@Composable
fun BootSequence() {
    var shown by rememberSaveable { mutableStateOf(true) }
    val c = Mz.colors
    val charge = remember { Animatable(0f) }
    LaunchedEffect(Unit) {
        if (!shown) return@LaunchedEffect
        charge.animateTo(1f, tween(850, easing = FastOutSlowInEasing))
        delay(120)
        shown = false
    }
    AnimatedVisibility(shown, exit = fadeOut(tween(380)) + scaleOut(tween(380), targetScale = 1.12f)) {
        Box(Modifier.fillMaxSize().background(c.bg), contentAlignment = Alignment.Center) {
            Canvas(Modifier.size(220.dp)) {
                val p = charge.value
                drawCircle(Brush.radialGradient(listOf(c.glow1.copy(alpha = 0.35f * p), Color.Transparent)), size.minDimension / 2)
                drawArc(
                    Brush.sweepGradient(listOf(c.glow1, c.glow2, c.glow3, c.glow4, c.glow1)),
                    -90f, 360f * p, false, style = Stroke(3.dp.toPx(), cap = StrokeCap.Round),
                )
            }
            Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
                Box(Modifier.scale(0.8f + 0.2f * charge.value)) { WafrLogo(96.dp) }
                Spacer(Modifier.height(18.dp))
                Text("WAFR OS · 2500 · ${(charge.value * 100).toInt()}%", style = HudStyle, color = c.glow1)
            }
        }
    }
}
