package com.example

import android.app.Activity
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.speech.RecognizerIntent
import android.speech.tts.TextToSpeech
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.selection.SelectionContainer
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Send
import androidx.compose.material.icons.filled.VolumeUp
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.ui.theme.CyberBgDark
import com.example.ui.theme.CyberCard
import com.example.ui.theme.CyanNeon
import com.example.ui.theme.CyanNeonGlow
import com.example.ui.theme.EmeraldNeon
import com.example.ui.theme.MyApplicationTheme
import com.example.ui.theme.RoseNeon
import com.example.ui.theme.TextDim
import com.example.ui.theme.TextMuted
import com.example.ui.theme.TextPrimary
import com.example.ui.theme.VioletNeon
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.concurrent.TimeUnit

data class ChatMessage(
    val id: String = System.currentTimeMillis().toString(),
    val role: String, // "user" atau "assistant"
    val content: String,
    val timestamp: Long = System.currentTimeMillis()
)

enum class PersonaMode(val title: String, val prompt: String) {
    UMUM(
        "🤖 Umum",
        "Anda adalah Asisten AI cerdas dan ramah berbahasa Indonesia. Jawab secara ringkas, akurat, dan jelas. Akui jika tidak tahu."
    ),
    PROGRAMMER(
        "💻 Programmer",
        "Anda adalah Senior Software Architect. Berikan jawaban dalam Bahasa Indonesia, tulis kode yang bersih, aman, dan efisien."
    ),
    PENULIS(
        "✍️ Penulis",
        "Anda adalah Penulis Kreatif dan Editor Sastra profesional berbahasa Indonesia. Buat narasi yang kaya dan mengalir."
    ),
    GURU(
        "🎓 Guru",
        "Anda adalah Pendidik sabar berbahasa Indonesia. Jelaskan konsep rumit menggunakan analogi sederhana langkah demi langkah."
    ),
    ANALIS(
        "📊 Analis Bisnis",
        "Anda adalah Konsultan Bisnis Strategis. Berikan analisis berbasis data, kerangka kerja (SWOT, OKR), dan rekomendasi nyata."
    ),
    PENERJEMAH(
        "🌐 Penerjemah",
        "Anda adalah Penerjemah Presisi Multibahasa. Terjemahkan dengan nuansa alami, kontekstual, dan idiomatis dalam Bahasa Indonesia."
    )
}

class MainActivity : ComponentActivity() {
    private var tts: TextToSpeech? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        tts = TextToSpeech(this) { status ->
            if (status == TextToSpeech.SUCCESS) {
                tts?.language = Locale("id", "ID")
            }
        }

        setContent {
            MyApplicationTheme {
                AiAssistantScreen(
                    onSpeakText = { text ->
                        tts?.speak(text, TextToSpeech.QUEUE_FLUSH, null, null)
                    }
                )
            }
        }
    }

    override fun onDestroy() {
        tts?.stop()
        tts?.shutdown()
        super.onDestroy()
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AiAssistantScreen(
    onSpeakText: (String) -> Unit
) {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()

    val messages = remember { mutableStateListOf<ChatMessage>() }
    var inputText by remember { mutableStateOf("") }
    var isLoading by remember { mutableStateOf(false) }
    var selectedPersona by remember { mutableStateOf(PersonaMode.UMUM) }
    var selectedModel by remember { mutableStateOf("gemini-2.5-flash") }
    var showMenu by remember { mutableStateOf(false) }

    val listState = rememberLazyListState()

    // Speech-to-Text launcher
    val speechLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (result.resultCode == Activity.RESULT_OK) {
            val spokenMatches = result.data?.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS)
            val recognizedText = spokenMatches?.firstOrNull() ?: ""
            if (recognizedText.isNotBlank()) {
                inputText = recognizedText
            }
        }
    }

    fun launchVoiceInput() {
        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE, "id-ID")
            putExtra(RecognizerIntent.EXTRA_PROMPT, "Bicara sekarang dalam Bahasa Indonesia...")
        }
        try {
            speechLauncher.launch(intent)
        } catch (e: Exception) {
            Toast.makeText(context, "Pengenalan suara tidak tersedia di perangkat ini", Toast.LENGTH_SHORT).show()
        }
    }

    fun sendMessage(text: String) {
        val trimmed = text.trim()
        if (trimmed.isEmpty() || isLoading) return

        messages.add(ChatMessage(role = "user", content = trimmed))
        inputText = ""
        isLoading = true

        coroutineScope.launch {
            listState.animateScrollToItem((messages.size - 1).coerceAtLeast(0))

            val responseText = callGeminiApi(
                prompt = trimmed,
                persona = selectedPersona,
                model = selectedModel,
                history = messages.take(messages.size - 1)
            )

            messages.add(ChatMessage(role = "assistant", content = responseText))
            isLoading = false
            listState.animateScrollToItem(messages.size - 1)
        }
    }

    Scaffold(
        modifier = Modifier
            .fillMaxSize()
            .background(CyberBgDark)
            .imePadding(),
        topBar = {
            TopAppBar(
                title = {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(
                            modifier = Modifier
                                .size(28.dp)
                                .clip(CircleShape)
                                .background(Brush.linearGradient(listOf(CyanNeon, VioletNeon)))
                        )
                        Spacer(modifier = Modifier.width(10.dp))
                        Column {
                            Text(
                                text = "ASISTEN AI",
                                fontSize = 16.sp,
                                fontWeight = FontWeight.ExtraBold,
                                color = TextPrimary,
                                fontFamily = FontFamily.Monospace
                            )
                            Text(
                                text = "Google Gemini • ${if (selectedModel.contains("pro")) "3.1 Pro" else "2.5 Flash"}",
                                fontSize = 11.sp,
                                color = CyanNeonGlow
                            )
                        }
                    }
                },
                actions = {
                    IconButton(onClick = {
                        messages.clear()
                        Toast.makeText(context, "Percakapan baru dimulai", Toast.LENGTH_SHORT).show()
                    }) {
                        Icon(Icons.Default.Add, contentDescription = "Obrolan Baru", tint = CyanNeon)
                    }
                    IconButton(onClick = { showMenu = !showMenu }) {
                        Icon(Icons.Default.MoreVert, contentDescription = "Menu", tint = TextMuted)
                    }
                    DropdownMenu(
                        expanded = showMenu,
                        onDismissRequest = { showMenu = false }
                    ) {
                        DropdownMenuItem(
                            text = { Text("Model: Gemini 2.5 Flash (Cepat)") },
                            onClick = {
                                selectedModel = "gemini-2.5-flash"
                                showMenu = false
                            }
                        )
                        DropdownMenuItem(
                            text = { Text("Model: Gemini 3.1 Pro (Pintar)") },
                            onClick = {
                                selectedModel = "gemini-3.1-pro-preview"
                                showMenu = false
                            }
                        )
                        DropdownMenuItem(
                            text = { Text("Bersihkan Riwayat") },
                            onClick = {
                                messages.clear()
                                showMenu = false
                            }
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = CyberBgDark.copy(alpha = 0.95f)
                )
            )
        },
        bottomBar = {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(CyberBgDark)
                    .padding(horizontal = 12.dp, vertical = 8.dp)
            ) {
                // Input Text & Action Buttons
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    OutlinedTextField(
                        value = inputText,
                        onValueChange = { inputText = it },
                        modifier = Modifier
                            .weight(1f)
                            .padding(end = 6.dp),
                        placeholder = {
                            Text(
                                "Ketik pesan Anda...",
                                color = TextDim,
                                fontSize = 14.sp
                            )
                        },
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = CyanNeon,
                            unfocusedBorderColor = CyberCard,
                            focusedTextColor = TextPrimary,
                            unfocusedTextColor = TextPrimary,
                            cursorColor = CyanNeon
                        ),
                        shape = RoundedCornerShape(24.dp),
                        maxLines = 4
                    )

                    // Voice Input Button
                    IconButton(
                        onClick = { launchVoiceInput() },
                        modifier = Modifier
                            .size(44.dp)
                            .clip(CircleShape)
                            .background(CyberCard)
                    ) {
                        Icon(
                            Icons.Default.Mic,
                            contentDescription = "Bicara",
                            tint = CyanNeon
                        )
                    }

                    Spacer(modifier = Modifier.width(6.dp))

                    // Send Button
                    IconButton(
                        onClick = { sendMessage(inputText) },
                        enabled = inputText.isNotBlank() && !isLoading,
                        modifier = Modifier
                            .size(44.dp)
                            .clip(CircleShape)
                            .background(
                                Brush.linearGradient(
                                    if (inputText.isNotBlank() && !isLoading)
                                        listOf(CyanNeon, VioletNeon)
                                    else
                                        listOf(Color.Gray, Color.DarkGray)
                                )
                            )
                    ) {
                        Icon(
                            Icons.Default.Send,
                            contentDescription = "Kirim",
                            tint = Color.White
                        )
                    }
                }
            }
        }
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .background(CyberBgDark)
        ) {
            // Persona Filter Chips
            LazyRow(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 12.dp, vertical = 4.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                items(PersonaMode.values()) { persona ->
                    FilterChip(
                        selected = selectedPersona == persona,
                        onClick = { selectedPersona = persona },
                        label = { Text(persona.title, fontSize = 12.sp) },
                        colors = FilterChipDefaults.filterChipColors(
                            selectedContainerColor = CyanNeon.copy(alpha = 0.2f),
                            selectedLabelColor = CyanNeon,
                            containerColor = CyberCard,
                            labelColor = TextMuted
                        ),
                        border = FilterChipDefaults.filterChipBorder(
                            enabled = true,
                            selected = selectedPersona == persona,
                            borderColor = if (selectedPersona == persona) CyanNeon else Color.Transparent
                        )
                    )
                }
            }

            // Message Stream or Welcome Hero
            if (messages.isEmpty()) {
                WelcomeHeroSection(onSelectPrompt = { prompt -> sendMessage(prompt) })
            } else {
                LazyColumn(
                    state = listState,
                    modifier = Modifier
                        .fillMaxSize()
                        .weight(1f)
                        .padding(horizontal = 12.dp),
                    verticalArrangement = Arrangement.spacedBy(14.dp),
                    contentPadding = PaddingValues(top = 10.dp, bottom = 16.dp)
                ) {
                    items(messages) { message ->
                        MessageItem(
                            message = message,
                            onCopy = {
                                val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                                clipboard.setPrimaryClip(ClipData.newPlainText("AI Message", message.content))
                                Toast.makeText(context, "Pesan disalin ke clipboard", Toast.LENGTH_SHORT).show()
                            },
                            onSpeak = {
                                onSpeakText(message.content)
                            }
                        )
                    }

                    if (isLoading) {
                        item {
                            ThinkingIndicator()
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun WelcomeHeroSection(onSelectPrompt: (String) -> Unit) {
    val infiniteTransition = rememberInfiniteTransition(label = "corePulse")
    val scale by infiniteTransition.animateFloat(
        initialValue = 0.95f,
        targetValue = 1.05f,
        animationSpec = infiniteRepeatable(
            animation = tween(2000, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "scale"
    )

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        // Holographic Core
        Box(
            modifier = Modifier
                .size(90.dp)
                .scale(scale)
                .clip(CircleShape)
                .background(Brush.radialGradient(listOf(CyanNeon, VioletNeon, Color.Transparent)))
                .border(2.dp, CyanNeonGlow, CircleShape),
            contentAlignment = Alignment.Center
        ) {
            Text(
                text = "AI",
                fontSize = 26.sp,
                fontWeight = FontWeight.ExtraBold,
                color = Color.White,
                fontFamily = FontFamily.Monospace
            )
        }

        Spacer(modifier = Modifier.height(16.dp))

        Text(
            text = "Halo! Saya Asisten AI Anda",
            fontSize = 20.sp,
            fontWeight = FontWeight.Bold,
            color = TextPrimary,
            textAlign = TextAlign.Center
        )

        Spacer(modifier = Modifier.height(6.dp))

        Text(
            text = "Kecerdasan generasi berikutnya berbahasa Indonesia. Tanyakan apa saja atau pilih topik cepat berikut:",
            fontSize = 13.sp,
            color = TextMuted,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(horizontal = 16.dp)
        )

        Spacer(modifier = Modifier.height(24.dp))

        // Suggestion Chips
        val suggestions = listOf(
            "💡 Ide bisnis rintisan teknologi digital di Indonesia",
            "💻 Jelaskan konsep Clean Architecture di Android",
            "✍️ Buat draf email penawaran kerja sama profesional",
            "📊 Analisis SWOT untuk ekspansi UMKM kuliner"
        )

        suggestions.forEach { suggestion ->
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 4.dp)
                    .clickable { onSelectPrompt(suggestion.substring(3)) },
                colors = CardDefaults.cardColors(containerColor = CyberCard),
                shape = RoundedCornerShape(12.dp)
            ) {
                Row(
                    modifier = Modifier.padding(horizontal = 14.dp, vertical = 12.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = suggestion,
                        fontSize = 13.sp,
                        color = TextPrimary
                    )
                }
            }
        }
    }
}

@Composable
fun MessageItem(
    message: ChatMessage,
    onCopy: () -> Unit,
    onSpeak: () -> Unit
) {
    val isUser = message.role == "user"
    val timeFormat = remember { SimpleDateFormat("HH:mm", Locale.getDefault()) }

    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = if (isUser) Arrangement.End else Arrangement.Start
    ) {
        if (!isUser) {
            Box(
                modifier = Modifier
                    .size(32.dp)
                    .clip(CircleShape)
                    .background(Brush.linearGradient(listOf(CyanNeon, VioletNeon))),
                contentAlignment = Alignment.Center
            ) {
                Text("AI", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = Color.White)
            }
            Spacer(modifier = Modifier.width(8.dp))
        }

        Column(
            horizontalAlignment = if (isUser) Alignment.End else Alignment.Start,
            modifier = Modifier.fillMaxWidth(0.85f)
        ) {
            Surface(
                shape = RoundedCornerShape(
                    topStart = 16.dp,
                    topEnd = 16.dp,
                    bottomStart = if (isUser) 16.dp else 4.dp,
                    bottomEnd = if (isUser) 4.dp else 16.dp
                ),
                color = if (isUser) Color(0xFF1E1B4B) else CyberCard,
                border = if (isUser) null else androidx.compose.foundation.BorderStroke(1.dp, Color(0xFF334155))
            ) {
                SelectionContainer {
                    Text(
                        text = message.content,
                        modifier = Modifier.padding(12.dp),
                        color = TextPrimary,
                        fontSize = 14.sp,
                        lineHeight = 20.sp
                    )
                }
            }

            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.padding(top = 4.dp)
            ) {
                Text(
                    text = timeFormat.format(Date(message.timestamp)),
                    fontSize = 10.sp,
                    color = TextDim
                )
                if (!isUser) {
                    Spacer(modifier = Modifier.width(8.dp))
                    Icon(
                        Icons.Default.ContentCopy,
                        contentDescription = "Salin",
                        tint = TextDim,
                        modifier = Modifier
                            .size(14.dp)
                            .clickable { onCopy() }
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Icon(
                        Icons.Default.VolumeUp,
                        contentDescription = "Bicara",
                        tint = TextDim,
                        modifier = Modifier
                            .size(14.dp)
                            .clickable { onSpeak() }
                    )
                }
            }
        }
    }
}

@Composable
fun ThinkingIndicator() {
    Row(
        modifier = Modifier.padding(start = 40.dp, top = 6.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(
            modifier = Modifier
                .size(10.dp)
                .clip(CircleShape)
                .background(CyanNeon)
        )
        Spacer(modifier = Modifier.width(8.dp))
        Text(
            text = "Asisten AI sedang berpikir...",
            fontSize = 12.sp,
            color = CyanNeonGlow,
            fontFamily = FontFamily.Monospace
        )
    }
}

suspend fun callGeminiApi(
    prompt: String,
    persona: PersonaMode,
    model: String,
    history: List<ChatMessage>
): String = withContext(Dispatchers.IO) {
    val apiKey = BuildConfig.GEMINI_API_KEY

    if (apiKey.isBlank() || apiKey == "MY_GEMINI_API_KEY") {
        return@withContext """
            ⚠️ Kunci API Gemini belum dikonfigurasi.
            
            Harap atur GEMINI_API_KEY pada panel Secrets di AI Studio atau pada berkas .env Anda.
        """.trimIndent()
    }

    val url = "https://generativelanguage.googleapis.com/v1beta/models/$model:generateContent?key=$apiKey"

    val client = OkHttpClient.Builder()
        .connectTimeout(60, TimeUnit.SECONDS)
        .readTimeout(60, TimeUnit.SECONDS)
        .build()

    val contentsArray = JSONArray()

    // Masukkan riwayat
    history.takeLast(10).forEach { chat ->
        val turnObj = JSONObject()
        turnObj.put("role", if (chat.role == "assistant") "model" else "user")
        val partsArray = JSONArray().put(JSONObject().put("text", chat.content))
        turnObj.put("parts", partsArray)
        contentsArray.put(turnObj)
    }

    // Pesan terkini
    val currentTurn = JSONObject()
    currentTurn.put("role", "user")
    currentTurn.put("parts", JSONArray().put(JSONObject().put("text", prompt)))
    contentsArray.put(currentTurn)

    val requestJson = JSONObject()
    requestJson.put("contents", contentsArray)

    // System instruction
    val systemInstruction = JSONObject()
    systemInstruction.put("parts", JSONArray().put(JSONObject().put("text", persona.prompt)))
    requestJson.put("systemInstruction", systemInstruction)

    // Generation Config
    val genConfig = JSONObject()
    genConfig.put("temperature", 0.7)
    requestJson.put("generationConfig", genConfig)

    val body = requestJson.toString().toRequestBody("application/json".toMediaType())
    val request = Request.Builder()
        .url(url)
        .post(body)
        .build()

    try {
        val response = client.newCall(request).execute()
        val responseBody = response.body?.string() ?: ""

        if (!response.isSuccessful) {
            return@withContext when (response.code) {
                400 -> "Permintaan tidak dapat diproses (400 Bad Request)."
                401, 403 -> "Kunci API Gemini tidak valid atau izin ditolak (401/403)."
                429 -> "Batas kuota API Gemini tercapai (429 Rate Limit). Harap tunggu beberapa saat."
                else -> "Gagal memproses permintaan (HTTP ${response.code})."
            }
        }

        val jsonResponse = JSONObject(responseBody)
        val candidates = jsonResponse.optJSONArray("candidates")
        val firstCandidate = candidates?.optJSONObject(0)
        val content = firstCandidate?.optJSONObject("content")
        val parts = content?.optJSONArray("parts")
        val text = parts?.optJSONObject(0)?.optString("text")

        text ?: "Tidak ada teks balasan yang dihasilkan."
    } catch (e: Exception) {
        "Kesalahan jaringan: ${e.localizedMessage ?: "Gagal terhubung ke Google Gemini."}"
    }
}
