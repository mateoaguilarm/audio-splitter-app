const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { splitAudio, cleanupFiles, scheduleCleanup } = require('../utils/audioProcessor');
const { createJob, updateJob, getJob } = require('../utils/jobs');

const router = express.Router();

// ---------------------------------------------------------------------------
// Multer configuration
// ---------------------------------------------------------------------------
const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || './tmp/uploads');
const MAX_FILE_SIZE_MB = parseInt(process.env.MAX_FILE_SIZE_MB || '500', 10);
const ALLOWED_MIMETYPES = ['audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/mp4', 'audio/m4a', 'audio/ogg', 'audio/x-m4a'];
const ALLOWED_EXTENSIONS = ['.mp3', '.wav', '.m4a', '.ogg'];

if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${path.extname(file.originalname).toLowerCase()}`);
  },
});

function fileFilter(_req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ALLOWED_EXTENSIONS.includes(ext) || ALLOWED_MIMETYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Formato no soportado: ${file.mimetype}. Usa MP3, WAV, M4A u OGG.`));
  }
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE_MB * 1024 * 1024 },
});

// ---------------------------------------------------------------------------
// Background processor — runs after the HTTP response is already sent
// ---------------------------------------------------------------------------
async function processAudioInBackground(jobId, inputPath, outputDir, safeName, segmentDurationSeconds, trimSilence) {
  try {
    console.log(`[job:${jobId}] Starting — trimSilence=${trimSilence} segmentDuration=${segmentDurationSeconds}s`);

    const segmentPaths = await splitAudio(
      inputPath, segmentDurationSeconds, outputDir, safeName, trimSilence
    );

    const segments = segmentPaths.map((p, idx) => ({
      index: idx + 1,
      filename: path.basename(p),
      // Relative path — frontend prepends its own origin (Netlify proxy handles it)
      downloadPath: `/api/download/${jobId}/${path.basename(p)}`,
      size: fs.statSync(p).size,
    }));

    cleanupFiles([inputPath]);
    scheduleCleanup(outputDir, 60 * 60 * 1000);

    updateJob(jobId, { status: 'done', segments });
    console.log(`[job:${jobId}] Done — ${segments.length} segments`);
  } catch (err) {
    console.error(`[job:${jobId}] Error:`, err.message);
    cleanupFiles([inputPath]);
    try { fs.rmSync(outputDir, { recursive: true, force: true }); } catch (_) {}
    updateJob(jobId, { status: 'error', error: err.message || 'Error al procesar el audio.' });
  }
}

// ---------------------------------------------------------------------------
// POST /api/split  — receives file, validates, starts background job, returns immediately
// ---------------------------------------------------------------------------
router.post('/split', (req, res, next) => {
  upload.single('audio')(req, res, (err) => {
    if (err) {
      const msg = err.code === 'LIMIT_FILE_SIZE'
        ? `Archivo muy grande. Máximo: ${MAX_FILE_SIZE_MB} MB.`
        : err.message || 'Error al subir el archivo.';
      return res.status(400).json({ error: msg });
    }
    next();
  });
}, (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No se recibió ningún archivo de audio.' });
  }

  const durationMinutes = parseFloat(req.body.segmentDuration);
  if (isNaN(durationMinutes) || durationMinutes < 1 || durationMinutes > 120) {
    cleanupFiles([req.file.path]);
    return res.status(400).json({ error: 'La duración del segmento debe estar entre 1 y 120 minutos.' });
  }

  const segmentDurationSeconds = Math.round(durationMinutes * 60);
  const inputPath = req.file.path;
  const trimSilence = req.body.trimSilence === 'true';

  // Safe base name from original filename
  const rawName = path.basename(req.file.originalname, path.extname(req.file.originalname));
  const safeName = rawName
    .replace(/[^a-zA-Z0-9_\-]/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_+|_+$/g, '') || 'audio';

  // jobId doubles as the output subdirectory name
  const jobId = path.basename(inputPath, path.extname(inputPath));
  const outputDir = path.join(UPLOAD_DIR, jobId);
  fs.mkdirSync(outputDir, { recursive: true });

  // Register job BEFORE responding so the client can poll immediately
  createJob(jobId);

  // Respond immediately — processing happens in the background
  res.json({ jobId });

  // Fire-and-forget (intentionally not awaited)
  processAudioInBackground(jobId, inputPath, outputDir, safeName, segmentDurationSeconds, trimSilence);
});

// ---------------------------------------------------------------------------
// GET /api/status/:jobId  — polling endpoint
// ---------------------------------------------------------------------------
router.get('/status/:jobId', (req, res) => {
  const { jobId } = req.params;
  if (jobId.includes('..')) return res.status(400).json({ error: 'ID inválido.' });

  const job = getJob(jobId);
  if (!job) {
    return res.status(404).json({
      error: 'Job no encontrado. El servidor puede haberse reiniciado. Intenta de nuevo.',
    });
  }

  // Only expose what the client needs
  res.json({
    status: job.status,           // 'processing' | 'done' | 'error'
    segments: job.segments,       // null while processing
    error: job.error,             // null unless errored
  });
});

// ---------------------------------------------------------------------------
// GET /api/download/:jobId/:filename
// ---------------------------------------------------------------------------
router.get('/download/:jobId/:filename', (req, res) => {
  const { jobId, filename } = req.params;

  if (jobId.includes('..') || filename.includes('..')) {
    return res.status(400).json({ error: 'Ruta inválida.' });
  }

  const filePath = path.join(UPLOAD_DIR, jobId, filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Archivo no encontrado. Puede haber expirado (1 hora).' });
  }

  res.download(filePath, filename, (err) => {
    if (err) {
      console.error('[download] Error:', err.message);
      if (!res.headersSent) res.status(500).json({ error: 'Error al enviar el archivo.' });
    }
  });
});

module.exports = router;
