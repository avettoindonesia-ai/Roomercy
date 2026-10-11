package com.example.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val CyberColorScheme = darkColorScheme(
    primary = CyanNeon,
    onPrimary = Color.Black,
    primaryContainer = Color(0xFF0E3A4B),
    onPrimaryContainer = CyanNeonGlow,
    secondary = VioletNeon,
    onSecondary = Color.White,
    secondaryContainer = Color(0xFF2E1A47),
    onSecondaryContainer = Color(0xFFD8B4FE),
    background = CyberBgDark,
    onBackground = TextPrimary,
    surface = CyberSurface,
    onSurface = TextPrimary,
    surfaceVariant = CyberCard,
    onSurfaceVariant = TextMuted,
    error = RoseNeon,
    onError = Color.White
)

@Composable
fun MyApplicationTheme(
    content: @Composable () -> Unit
) {
    MaterialTheme(
        colorScheme = CyberColorScheme,
        typography = Typography,
        content = content
    )
}
