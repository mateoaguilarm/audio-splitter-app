import { useCallback, useState } from 'react';

const ACCEPTED = '.mp3,.wav,.m4a,.ogg';
const ACCEPTED_TYPES = ['audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/mp4', 'audio/m4a', 'audio/ogg', 'audio/x-m4a'];
const MAX_SIZE_BYTES = 500 * 1024 * 1024; // 500 MB

function formatBytes(bytes) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

/**
 * Upload component — drag-and-drop or click to select an audio file.
 * Reads the audio duration client-side before handing it to the parent.
 *
 * Props:
 *   onFileSelected(file, durationSeconds)
 */
export default function Upload({ onFileSelected, disabled }) {
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState('');

  const processFile = useCallback(
    (file) => {
      setError('');

      if (!file) return;

      // Validate type
      const ext = file.name.split('.').pop().toLowerCase();
      const validExt = ['mp3', 'wav', 'm4a', 'ogg'].includes(ext);
      const validType = ACCEPTED_TYPES.includes(file.type);
      if (!validExt && !validType) {
        setError('Unsupported format. Please upload MP3, WAV, M4A, or OGG.');
        return;
      }

      // Validate size
      if (file.size > MAX_SIZE_BYTES) {
        setError(`File too large (${formatBytes(file.size)}). Maximum is 500 MB.`);
        return;
      }

      // Get duration via Web Audio API
      const url = URL.createObjectURL(file);
      const audio = new Audio();
      audio.preload = 'metadata';
      audio.onloadedmetadata = () => {
        URL.revokeObjectURL(url);
        onFileSelected(file, audio.duration);
      };
      audio.onerror = () => {
        URL.revokeObjectURL(url);
        // Still pass the file — backend can handle it
        onFileSelected(file, null);
      };
      audio.src = url;
    },
    [onFileSelected]
  );

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files?.[0];
      processFile(file);
    },
    [processFile]
  );

  const handleChange = (e) => {
    processFile(e.target.files?.[0]);
    // Reset input so the same file can be re-selected
    e.target.value = '';
  };

  return (
    <div className="w-full">
      <label
        htmlFor="audio-input"
        onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={disabled ? undefined : handleDrop}
        className={`
          flex flex-col items-center justify-center gap-4 w-full min-h-48 rounded-2xl border-2 border-dashed cursor-pointer transition-all duration-200
          ${dragging ? 'border-brand bg-brand/10 scale-[1.01]' : 'border-white/20 hover:border-brand/60 hover:bg-white/5'}
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        {/* Icon */}
        <div className="w-16 h-16 rounded-full bg-brand/15 flex items-center justify-center">
          <svg className="w-8 h-8 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M9 9l10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 11-.99-3.467l2.31-.66a2.25 2.25 0 001.632-2.163zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 01-.99-3.467l2.31-.66A2.25 2.25 0 009 15.553z" />
          </svg>
        </div>

        <div className="text-center px-4">
          <p className="text-base font-medium text-white">
            {dragging ? 'Drop it here!' : 'Drag & drop your audio file'}
          </p>
          <p className="text-sm text-white/50 mt-1">or click to browse</p>
          <p className="text-xs text-white/30 mt-2">MP3 · WAV · M4A · OGG &mdash; up to 500 MB</p>
        </div>

        <input
          id="audio-input"
          type="file"
          accept={ACCEPTED}
          className="hidden"
          onChange={handleChange}
          disabled={disabled}
        />
      </label>

      {error && (
        <p className="mt-3 text-sm text-red-400 flex items-center gap-1">
          <svg className="w-4 h-4 shrink-0" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
          </svg>
          {error}
        </p>
      )}
    </div>
  );
}

export { formatDuration, formatBytes };
