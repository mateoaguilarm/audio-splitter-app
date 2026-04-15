const ffmpeg = require('fluent-ffmpeg');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
const ffprobeInstaller = require('@ffprobe-installer/ffprobe');
const path = require('path');
const fs = require('fs');

// Use bundled binaries so the server works on any host without a system FFmpeg
ffmpeg.setFfmpegPath(ffmpegInstaller.path);
ffmpeg.setFfprobePath(ffprobeInstaller.path);

// ---------------------------------------------------------------------------
// Duration helper
// ---------------------------------------------------------------------------
function getAudioDuration(filePath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(new Error(`ffprobe error: ${err.message}`));
      const duration = metadata.format.duration;
      if (!duration) return reject(new Error('No se pudo determinar la duración del audio.'));
      resolve(duration);
    });
  });
}

// ---------------------------------------------------------------------------
// Silence detection
//
// Strategy: run the silencedetect filter on the FIRST maxScanSeconds of the
// file writing output to /dev/null (no re-encoding, no temp file).
// Parse FFmpeg's stderr to find when the first period of silence ENDS —
// that timestamp is where the real content starts.
//
// This is orders of magnitude faster than re-encoding the full file.
// ---------------------------------------------------------------------------

/**
 * Parse the first "silence_end" timestamp from FFmpeg stderr output.
 * Returns 0 if no silence was found.
 */
function parseFirstSilenceEnd(stderr) {
  const match = stderr.match(/silence_end:\s*([\d.]+)/);
  return match ? parseFloat(match[1]) : 0;
}

/**
 * Detect how many seconds of silence are at the very beginning of an audio file.
 * Only scans the first `maxScanSeconds` (default 6 min) — fast and sufficient.
 *
 * @param {string} inputPath
 * @param {number} maxScanSeconds
 * @returns {Promise<number>} Seconds of leading silence (0 if none found)
 */
function detectLeadingSilenceEnd(inputPath, maxScanSeconds = 360) {
  return new Promise((resolve) => {
    let stderrOutput = '';
    // /dev/null on Linux/macOS, NUL on Windows
    const nullDev = process.platform === 'win32' ? 'NUL' : '/dev/null';

    const cmd = ffmpeg(inputPath)
      .inputOptions(['-t', String(maxScanSeconds)])   // scan first 6 min only
      .audioFilters('silencedetect=noise=-45dB:duration=0.3')
      .outputOptions(['-f', 'null'])
      .output(nullDev);

    cmd.on('stderr', (line) => { stderrOutput += line + '\n'; });

    // Both 'end' and 'error' can fire when writing to null device —
    // parse whatever we collected either way.
    const finish = () => {
      const t = parseFirstSilenceEnd(stderrOutput);
      console.log(t > 0
        ? `[silence-detect] Leading silence ends at ${t.toFixed(2)}s`
        : '[silence-detect] No leading silence found'
      );
      resolve(t);
    };

    cmd.on('end', finish).on('error', finish).run();
  });
}

// ---------------------------------------------------------------------------
// Split
// ---------------------------------------------------------------------------

/**
 * Split an audio file into fixed-length segments using stream copy (no re-encode).
 *
 * If trimSilence is true:
 *   1. Run a fast silencedetect scan on the first 6 min → get seekOffset
 *   2. Add -ss seekOffset as an INPUT option (fast keyframe seek, no re-encode)
 *   3. Split from that point with -c copy as usual
 *
 * Total extra time for silence detection: ~10–30 s on a free-tier server.
 * (Previously: re-encoding the full file = 5–10 min. Now: seek + copy = seconds.)
 *
 * @param {string}  inputPath
 * @param {number}  segmentDurationSeconds
 * @param {string}  outputDir
 * @param {string}  baseName
 * @param {boolean} trimSilence
 * @returns {Promise<string[]>}
 */
async function splitAudio(inputPath, segmentDurationSeconds, outputDir, baseName = 'audio', trimSilence = false) {
  const ext = path.extname(inputPath).toLowerCase();

  // ── Step 1: detect leading silence (fast, no output written) ─────────────
  let seekOffset = 0;
  if (trimSilence) {
    console.log('[silence-detect] Scanning for leading silence (first 6 min)…');
    seekOffset = await detectLeadingSilenceEnd(inputPath);
  }

  // ── Step 2: compute segment count from effective duration ─────────────────
  const totalDuration = await getAudioDuration(inputPath);
  const effectiveDuration = totalDuration - seekOffset;
  const segmentCount = Math.ceil(effectiveDuration / segmentDurationSeconds);

  if (segmentCount < 2) {
    throw new Error(
      `La duración del segmento (${segmentDurationSeconds}s) es mayor o igual ` +
      `a la duración del archivo (${Math.round(effectiveDuration)}s). Elige una duración más corta.`
    );
  }

  // Build expected output paths (0-based → renamed to 1-based after FFmpeg)
  const outputPaths = [];
  for (let i = 0; i < segmentCount; i++) {
    outputPaths.push(path.join(outputDir, `${baseName}_parte${i + 1}${ext}`));
  }

  // ── Step 3: split (stream copy, near-instant) ─────────────────────────────
  await new Promise((resolve, reject) => {
    const ff = ffmpeg(inputPath);

    // If silence was found, seek past it using a fast INPUT seek.
    // Input seek (-ss before -i) is keyframe-accurate and adds zero processing time.
    if (seekOffset > 0) {
      ff.inputOptions(['-ss', seekOffset.toFixed(3)]);
    }

    ff.outputOptions([
        '-f', 'segment',
        '-segment_time', String(segmentDurationSeconds),
        '-c', 'copy',              // no re-encoding — fast and lossless
        '-reset_timestamps', '1',
      ])
      .output(path.join(outputDir, `${baseName}_parte%d${ext}`))
      .on('start', (cmd) => console.log('[ffmpeg split] command:', cmd))
      .on('error', (err) => reject(new Error(`FFmpeg error: ${err.message}`)))
      .on('end', () => {
        renameSegments(outputDir, baseName, ext, segmentCount)
          .then(resolve)
          .catch(reject);
      })
      .run();
  });

  return outputPaths.filter((p) => fs.existsSync(p));
}

// ---------------------------------------------------------------------------
// Rename helpers
// ---------------------------------------------------------------------------

async function renameSegments(outputDir, baseName, ext, count) {
  // Reverse order avoids clobbering e.g. parte1 before it has been renamed
  for (let i = count - 1; i >= 0; i--) {
    const from = path.join(outputDir, `${baseName}_parte${i}${ext}`);
    const to   = path.join(outputDir, `${baseName}_parte${i + 1}${ext}`);
    if (fs.existsSync(from)) fs.renameSync(from, to);
  }
}

// ---------------------------------------------------------------------------
// Cleanup utilities
// ---------------------------------------------------------------------------

function cleanupFiles(filePaths) {
  for (const p of filePaths) {
    try { if (fs.existsSync(p)) fs.unlinkSync(p); }
    catch (err) { console.warn(`[cleanup] Could not delete ${p}:`, err.message); }
  }
}

function scheduleCleanup(dir, delayMs = 60 * 60 * 1000) {
  setTimeout(() => {
    try {
      for (const f of fs.readdirSync(dir)) {
        try { fs.unlinkSync(path.join(dir, f)); } catch (_) {}
      }
      console.log(`[cleanup] Cleared ${dir}`);
    } catch (err) {
      console.warn(`[cleanup] Failed to clear ${dir}:`, err.message);
    }
  }, delayMs);
}

module.exports = { splitAudio, getAudioDuration, cleanupFiles, scheduleCleanup };
