/**
 * server.js
 * Backend Asisten AI Futuristik bertenaga Google Gemini API
 * Menggunakan Node.js, Express, dan Server-Sent Events (SSE) untuk streaming respons.
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

// --- Keamanan Middleware ---
app.use(
  helmet({
    contentSecurityPolicy: false, // Memungkinkan loading CDN (marked, highlight.js) & avatar lokal
    crossOriginEmbedderPolicy: false
  })
);
app.use(cors());
app.use(express.json({ limit: '25mb' })); // Dukungan unggahan dokumen & gambar beresolusi tinggi
app.use(express.static(path.join(__dirname, 'public')));

// Rate Limiter: Maksimal 60 permintaan per menit per IP untuk endpoint AI
const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Terlalu banyak permintaan dari perangkat Anda. Harap tunggu 1 menit sebelum mencoba kembali.'
  }
});

// --- System Instruction Berdasarkan Persona ---
const PERSONA_INSTRUCTIONS = {
  umum: `Anda adalah Asisten AI futuristik, ramah, dan sangat cerdas bernama "Asisten AI".
Selalu gunakan Bahasa Indonesia yang alami, santun, dan profesional.
Prioritaskan akurasi faktual, kejujuran jika tidak mengetahui suatu hal (jangan mengarang fakta), dan berikan jawaban yang terstruktur dengan format Markdown yang rapi.`,

  programmer: `Anda adalah Principal Software Engineer & Arsitek Sistem berpengalaman.
Jawab pertanyaan dalam Bahasa Indonesia. Tulis kode yang bersih, aman, modular, dan mengikuti kaidah Best Practice terkini.
Sertakan komentar ringkas pada kode, jelaskan kompleksitas jika relevan, dan berikan contoh langkah demi langkah.`,

  penulis: `Anda adalah Penulis Kreatif, Copywriter Senior, dan Editor Sastra berbahasa Indonesia.
Hasilkan tulisan yang memikat, kaya diksi, memiliki alur yang mengalir, tata bahasa yang presisi, dan daya persuasif yang kuat sesuai kebutuhan pengguna.`,

  guru: `Anda adalah Pendidik dan Guru yang sabar, inspiratif, dan metodis.
Gunakan Bahasa Indonesia yang komunikatif. Jelaskan konsep rumit menggunakan analogi sederhana sehari-hari, berikan ringkasan poin-poin kunci, dan uji pemahaman dengan pertanyaan reflektif yang ramah.`,

  analis: `Anda adalah Konsultan Manajemen Bisnis dan Analis Strategis Korporat.
Gunakan pendekatan analitis, data-driven, dan terstruktur (seperti SWOT, MECE, atau OKR).
Berikan ringkasan eksekutif di awal, evaluasi risiko, dan susun rekomendasi aksi yang terukur dalam Bahasa Indonesia.`,

  penerjemah: `Anda adalah Penerjemah Ahli Multibahasa dan Spesialis Lokalisasi.
Terjemahkan teks dengan akurasi makna yang sempurna, menjaga nada emosi, gaya bahasa asli, serta konteks kultural tanpa kaku. Berikan catatan konteks alternatif jika ada kata multitafsir.`
};

// --- Model Mapping yang Didukung ---
const ALLOWED_MODELS = {
  cepat: 'gemini-2.5-flash',
  pintar: 'gemini-3.1-pro-preview'
};

// --- Helper: Fetch dengan Retry & Exponential Backoff ---
async function fetchWithRetry(url, options, maxRetries = 3) {
  let attempt = 0;
  let delay = 1000;

  while (attempt < maxRetries) {
    try {
      const response = await fetch(url, options);
      // Jika status 429 atau 503, lakukan retry jika masih ada sisa upaya
      if ((response.status === 429 || response.status >= 500) && attempt < maxRetries - 1) {
        attempt++;
        await new Promise((res) => setTimeout(res, delay));
        delay *= 2;
        continue;
      }
      return response;
    } catch (err) {
      attempt++;
      if (attempt >= maxRetries) throw err;
      await new Promise((res) => setTimeout(res, delay));
      delay *= 2;
    }
  }
}

// --- Endpoint Health Check ---
app.get('/health', (req, res) => {
  const isKeyConfigured = Boolean(GEMINI_API_KEY && GEMINI_API_KEY !== 'MY_GEMINI_API_KEY');
  res.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    apiKeyConfigured: isKeyConfigured,
    message: isKeyConfigured
      ? 'Layanan siap dan terhubung ke Gemini API.'
      : 'Peringatan: GEMINI_API_KEY belum diisi atau masih menggunakan placeholder.'
  });
});

// --- Endpoint Streaming Chat (/api/chat/stream) ---
app.post('/api/chat/stream', chatLimiter, async (req, res) => {
  // Validasi Ketersediaan API Key
  if (!GEMINI_API_KEY || GEMINI_API_KEY === 'MY_GEMINI_API_KEY') {
    return res.status(401).json({
      error: 'GEMINI_API_KEY belum dikonfigurasi pada server (.env / Secrets panel). Harap masukkan API key Gemini yang valid.'
    });
  }

  const {
    prompt,
    history = [],
    persona = 'umum',
    modelSpeed = 'cepat',
    temperature = 0.7,
    enableSearch = false,
    attachments = []
  } = req.body;

  if (!prompt && (!attachments || attachments.length === 0)) {
    return res.status(400).json({ error: 'Pesan teks atau lampiran file tidak boleh kosong.' });
  }

  // Pilih model Gemini
  const modelName = ALLOWED_MODELS[modelSpeed] || 'gemini-2.5-flash';
  const targetUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:streamGenerateContent?alt=sse&key=${GEMINI_API_KEY}`;

  // Susun Riwayat Percakapan
  const contents = [];

  // Sisipkan riwayat sebelumnya jika ada (maksimal 16 putaran terakhir agar efisien)
  const slicedHistory = history.slice(-16);
  for (const item of slicedHistory) {
    if (item.role && item.text) {
      contents.push({
        role: item.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: item.text }]
      });
    }
  }

  // Susun konten pesan terkini
  const currentParts = [];
  if (prompt) {
    currentParts.push({ text: prompt });
  }

  // Tambahkan lampiran multimodal (gambar / PDF) jika ada
  if (Array.isArray(attachments)) {
    for (const file of attachments) {
      if (file.mimeType && file.base64) {
        currentParts.push({
          inlineData: {
            mimeType: file.mimeType,
            data: file.base64
          }
        });
      }
    }
  }

  contents.push({
    role: 'user',
    parts: currentParts
  });

  // Susun System Instruction & Tools (Google Search Grounding)
  const systemInstructionText = PERSONA_INSTRUCTIONS[persona] || PERSONA_INSTRUCTIONS.umum;

  const requestBody = {
    contents,
    systemInstruction: {
      parts: [{ text: systemInstructionText }]
    },
    generationConfig: {
      temperature: Math.max(0.0, Math.min(1.0, parseFloat(temperature) || 0.7)),
      topP: 0.95
    }
  };

  // Aktifkan Google Search Grounding jika dipilih oleh pengguna
  if (enableSearch) {
    requestBody.tools = [{ googleSearch: {} }];
  }

  // Atur Header SSE (Server-Sent Events)
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no'
  });

  // Deteksi jika klien menutup koneksi (tombol "Hentikan")
  const abortController = new AbortController();
  req.on('close', () => {
    abortController.abort();
  });

  try {
    const apiResponse = await fetchWithRetry(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
      signal: abortController.signal
    });

    if (!apiResponse.ok) {
      const errText = await apiResponse.text();
      let userFriendlyMsg = 'Terjadi kendala saat menghubungi server Gemini.';

      if (apiResponse.status === 400) {
        userFriendlyMsg = 'Format permintaan tidak didukung atau lampiran melebihi kapasitas.';
      } else if (apiResponse.status === 401 || apiResponse.status === 403) {
        userFriendlyMsg = 'Kunci API Gemini tidak valid atau izin akses ditolak. Harap periksa GEMINI_API_KEY.';
      } else if (apiResponse.status === 429) {
        userFriendlyMsg = 'Batas kuota gratis Gemini API tercapai (Rate Limit 429). Harap tunggu 1-2 menit sebelum mencoba lagi.';
      } else if (apiResponse.status >= 500) {
        userFriendlyMsg = 'Server Google Gemini sedang mengalami gangguan sementara. Silakan coba kembali sesaat lagi.';
      }

      res.write(`event: error\ndata: ${JSON.stringify({ error: userFriendlyMsg, detail: errText })}\n\n`);
      return res.end();
    }

    const reader = apiResponse.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop(); // Simpan baris yang belum selesai

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data:')) continue;

        const jsonStr = trimmed.replace(/^data:\s*/, '');
        if (jsonStr === '[DONE]') continue;

        try {
          const parsed = JSON.parse(jsonStr);
          const candidate = parsed.candidates?.[0];

          if (candidate?.content?.parts) {
            for (const part of candidate.content.parts) {
              if (part.text) {
                res.write(`event: chunk\ndata: ${JSON.stringify({ text: part.text })}\n\n`);
              }
            }
          }

          // Cek metadata grounding (sumber pencarian Google Search)
          const searchMetadata = candidate?.groundingMetadata;
          if (searchMetadata?.groundingChunks || searchMetadata?.webSearchQueries) {
            res.write(`event: grounding\ndata: ${JSON.stringify(searchMetadata)}\n\n`);
          }

          // Cek jika diblokir oleh safety filter
          if (candidate?.finishReason && candidate.finishReason !== 'STOP') {
            if (['SAFETY', 'RECITATION', 'BLOCKLIST'].includes(candidate.finishReason)) {
              res.write(
                `event: warning\ndata: ${JSON.stringify({
                  message: 'Respons dihentikan lebih awal karena kebijakan filter keamanan AI.'
                })}\n\n`
              );
            }
          }
        } catch (e) {
          // Abaikan baris JSON yang belum sempurna
        }
      }
    }

    res.write('event: done\ndata: {}\n\n');
    res.end();
  } catch (err) {
    if (err.name === 'AbortError') {
      res.end();
      return;
    }
    const errorMsg =
      err.code === 'ENOTFOUND' || err.code === 'ECONNRESET'
        ? 'Koneksi internet ke server Google Gemini terputus.'
        : `Kesalahan internal: ${err.message}`;

    res.write(`event: error\ndata: ${JSON.stringify({ error: errorMsg })}\n\n`);
    res.end();
  }
});

// Jalankan Server
app.listen(PORT, () => {
  console.log(`[Asisten AI] Server berjalan di http://localhost:${PORT}`);
  console.log(`[Status API] GEMINI_API_KEY: ${GEMINI_API_KEY ? 'Terpasang' : 'Belum diatur'}`);
});
