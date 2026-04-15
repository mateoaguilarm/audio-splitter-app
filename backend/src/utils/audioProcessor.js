const ffmpeg = require('fluent-ffmpeg');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
const ffprobeInstaller = require('@ffprobe-installer/ffprobe');
const path = require('path');
const fs = require('fs');

// Use bundled binaries so the server works without a system FFmpeg install
ffmpeg.setFfmpegPath(ffmpegInstaller.path);
ffmpeg.setFfprobePath(ffprobeInstaller.path);

/**
 * Get the duration of an audio file in seconds.
 * @param {string} filePath - Absolute path to the audio file
 * @returns {Promise<number>} Duration in seconds
 */
function getAudioDuration(filePath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(new Error(`ffprobe error: ${err.message}`));
      const duration = metadata.format.duration;
      if (!duration) return reject(new Error('Could not determine audio duration'));
      resolve(duration);
    });
  });
}

/**
 * Split an audio file into segments of the given duration.
 * Uses -c copy to avoid re-encoding (fast and lossless).
 *
 * @param {string} inputPath - Absolute path to the source audio file
 * @param {number} segmentDurationSeconds - Duration of each segment in seconds
 * @param {string} outputDir - Directory where segments will be written
 * @param {string} baseName - Base name without extension (e.g. "parte")
 * @returns {Promise<string[]>} Array of output file paths
 */
async function splitAudio(inputPath, segmentDurationSeconds, outputDir, baseName = 'parte') {
  const totalDuration = await getAudioDuration(inputPath);
  const ext = path.extname(inputPath).toLowerCase(); // e.g. ".mp3"
  const segmentCount = Math.ceil(totalDuration / segmentDurationSeconds);

  if (segmentCount < 2) {
    throw new Error(
      `The segment duration (${segmentDurationSeconds}s) is longer than or equal to the file duration (${Math.round(totalDuration)}s). Choose a shorter segment duration.`
    );
  }

  // Build output paths up front so we can return them
  // Naming convention: baseName_parte1.ext, baseName_parte2.ext, …
  const outputPaths = [];
  for (let i = 0; i < segmentCount; i++) {
    outputPaths.push(path.join(outputDir, `${baseName}_parte${i + 1}${ext}`));
  }

  // Run the segmentation
  await new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .outputOptions([
        '-f', 'segment',
        '-segment_time', String(segmentDurationSeconds),
        '-c', 'copy',           // no re-encoding
        '-reset_timestamps', '1',
      ])
      // ffmpeg outputs 0-based: baseName_parte0.ext, baseName_parte1.ext, …
      .output(path.join(outputDir, `${baseName}_parte%d${ext}`))
      .on('start', (cmd) => console.log('[ffmpeg] command:', cmd))
      .on('error', (err) => reject(new Error(`FFmpeg error: ${err.message}`)))
      .on('end', () => {
        // Rename 0-based → 1-based
        renameSegments(outputDir, baseName, ext, segmentCount)
          .then(resolve)
          .catch(reject);
      })
      .run();
  });

  // Filter to only files that were actually created (last segment may be partial)
  const existing = outputPaths.filter((p) => fs.existsSync(p));
  return existing;
}

/**
 * Rename 0-indexed ffmpeg output (parte_0.mp3, parte_1.mp3 …) to 1-indexed.
 */
async function renameSegments(outputDir, baseName, ext, count) {
  // Iterate in reverse to avoid overwriting e.g. parte1 before it's been renamed
  for (let i = count - 1; i >= 0; i--) {
    const from = path.join(outputDir, `${baseName}_parte${i}${ext}`);
    const to   = path.join(outputDir, `${baseName}_parte${i + 1}${ext}`);
    if (fs.existsSync(from)) {
      fs.renameSync(from, to);
    }
  }
}

/**
 * Delete a list of files, ignoring errors for files that don't exist.
 * @param {string[]} filePaths
 */
function cleanupFiles(filePaths) {
  for (const p of filePaths) {
    try {
      if (fs.existsSync(p)) fs.unlinkSync(p);
    } catch (err) {
      console.warn(`[cleanup] Could not delete ${p}:`, err.message);
    }
  }
}

/**
 * Schedule cleanup of a directory's contents after a delay.
 * @param {string} dir
 * @param {number} delayMs
 */
function scheduleCleanup(dir, delayMs = 60 * 60 * 1000) {
  setTimeout(() => {
    try {
      const files = fs.readdirSync(dir);
      for (const f of files) {
        const full = path.join(dir, f);
        try { fs.unlinkSync(full); } catch (_) {}
      }
      console.log(`[cleanup] Cleared ${dir}`);
    } catch (err) {
      console.warn(`[cleanup] Failed to clear ${dir}:`, err.message);
    }
  }, delayMs);
}

module.exports = { splitAudio, getAudioDuration, cleanupFiles, scheduleCleanup };
