const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { splitAudio, cleanupFiles, scheduleCleanup } = require('../utils/audioProcessor');

const router = express.Router();

// ---------------------------------------------------------------------------
// Multer configuration
// ---------------------------------------------------------------------------
const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || './tmp/uploads');
const MAX_FILE_SIZE_MB = parseInt(process.env.MAX_FILE_SIZE_MB || '500', 10);
const ALLOWED_MIMETYPES = ['audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/mp4', 'audio/m4a', 'audio/ogg', 'audio/x-m4a'];
const ALLOWED_EXTENSIONS = ['.mp3', '.wav', '.m4a', '.ogg'];

// Ensure upload directory exists
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
    cb(new Error(`Unsupported file type: ${file.mimetype}. Allowed: MP3, WAV, M4A, OGG`));
  }
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE_MB * 1024 * 1024 },
});

// ---------------------------------------------------------------------------
// POST /api/split
// ---------------------------------------------------------------------------
router.post('/split', (req, res, next) => {
  // Wrap multer so its errors surface as 400 (not 500)
  upload.single('audio')(req, res, (err) => {
    if (err) {
      const msg = err.code === 'LIMIT_FILE_SIZE'
        ? `File too large. Maximum is ${MAX_FILE_SIZE_MB} MB.`
        : err.message || 'File upload failed.';
      return res.status(400).json({ error: msg });
    }
    next();
  });
}, async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No audio file provided.' });
  }

  const { segmentDuration } = req.body; // in minutes
  const durationMinutes = parseFloat(segmentDuration);

  if (isNaN(durationMinutes) || durationMinutes < 1 || durationMinutes > 120) {
    cleanupFiles([req.file.path]);
    return res.status(400).json({ error: 'segmentDuration must be a number between 1 and 120 (minutes).' });
  }

  const segmentDurationSeconds = Math.round(durationMinutes * 60);
  const inputPath = req.file.path;

  // Derive a safe base name from the original file name (e.g. "My Audio" → "My_Audio")
  const rawName = path.basename(req.file.originalname, path.extname(req.file.originalname));
  const safeName = rawName
    .replace(/[^a-zA-Z0-9_\-]/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_+|_+$/g, '') || 'audio';

  // Use a per-job subdirectory so segments from different jobs don't mix
  const jobId = path.basename(inputPath, path.extname(inputPath));
  const outputDir = path.join(UPLOAD_DIR, jobId);
  fs.mkdirSync(outputDir, { recursive: true });

  try {
    console.log(`[split] job=${jobId} file=${req.file.originalname} baseName=${safeName} segmentDuration=${durationMinutes}min`);

    const segmentPaths = await splitAudio(inputPath, segmentDurationSeconds, outputDir, safeName);

    // Return relative paths — the frontend prepends its own origin so all
    // requests flow through the Netlify proxy instead of hitting Render directly.
    const segments = segmentPaths.map((p, idx) => ({
      index: idx + 1,
      filename: path.basename(p),
      downloadPath: `/api/download/${jobId}/${path.basename(p)}`,
      size: fs.statSync(p).size,
    }));

    // Clean up the original upload, schedule output cleanup in 1 hour
    cleanupFiles([inputPath]);
    scheduleCleanup(outputDir, 60 * 60 * 1000);

    return res.json({
      success: true,
      jobId,
      totalSegments: segments.length,
      segments,
    });
  } catch (err) {
    console.error('[split] Error:', err.message);
    cleanupFiles([inputPath]);
    // Best-effort cleanup of output dir
    try { fs.rmSync(outputDir, { recursive: true, force: true }); } catch (_) {}
    return res.status(500).json({ error: err.message || 'Audio processing failed.' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/download/:jobId/:filename
// ---------------------------------------------------------------------------
router.get('/download/:jobId/:filename', (req, res) => {
  const { jobId, filename } = req.params;

  // Prevent path traversal
  if (jobId.includes('..') || filename.includes('..')) {
    return res.status(400).json({ error: 'Invalid path.' });
  }

  const filePath = path.join(UPLOAD_DIR, jobId, filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found. It may have expired.' });
  }

  res.download(filePath, filename, (err) => {
    if (err) {
      console.error('[download] Error sending file:', err.message);
      if (!res.headersSent) res.status(500).json({ error: 'Failed to send file.' });
    }
  });
});

module.exports = router;
