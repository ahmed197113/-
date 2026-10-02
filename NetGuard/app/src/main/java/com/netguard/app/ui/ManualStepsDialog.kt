package com.netguard.app.ui

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.netguard.app.router.RouterResult

@Composable
fun ManualStepsDialog(steps: RouterResult.ManualRequired, onDismiss: () -> Unit) {
    AlertDialog(
        onDismissRequest = onDismiss,
        confirmButton = { TextButton(onClick = onDismiss) { Text("تمام") } },
        title = { Text("خطوات الحظر على الراوتر") },
        text = {
            Column {
                Text(
                    "هذا الموديل يحتاج تنفيذ الخطوات التالية يدويًا (تم تسجيل الحالة في التطبيق):",
                    fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Spacer(Modifier.height(8.dp))
                steps.stepsAr.forEachIndexed { i, s ->
                    Text("${i + 1}. $s", fontSize = 13.sp)
                    Spacer(Modifier.height(4.dp))
                }
            }
        },
    )
}
