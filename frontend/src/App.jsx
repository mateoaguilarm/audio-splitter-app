import { useState } from 'react';
import axios from 'axios';
import Upload, { formatDuration } from './components/Upload';
import Controls from './components/Controls';
import Preview from './components/Preview';
import Progress from './components/Progress';
import Results from './components/Results';

// File uploads go directly to the Render backend, bypassing the Netlify proxy.
// Netlify's reverse proxy rejects multipart bodies over ~6 MB, so large audio
// files would fail with 400 if routed through netlify.toml redirects.
// CORS on the backend already accepts *.netlify.app so this works cross-origin.
// Override with VITE_API_URL env var if the backend URL ever changes.
const UPLOAD_URL = import.meta.env.VITE_API_URL || 'https://audio-splitter-app.onrender.com';

export default function App() {
  const [file, setFile] = useState(null);
  const [duration, setDuration] = useState(null); // seconds
  const [segmentMinutes, setSegmentMinutes] = useState(5);
  const [trimSilence, setTrimSilence] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [segments, setSegments] = useState(null); // null = not done yet

  const handleFileSelected = (f, dur) => {
    setFile(f);
    setDuration(dur);
    setSegments(null);
    setError('');
  };

  const handleSplit = async (mins) => {
    if (!file) return;
    setLoading(true);
    setError('');
    setSegmentMinutes(mins);

    const formData = new FormData();
    formData.append('audio', file);
    formData.append('segmentDuration', String(mins));
    formData.append('trimSilence', String(trimSilence));

    try {
      // Do NOT set Content-Type manually — Axios must auto-set it with the
      // multipart boundary; overriding it breaks multer's body parsing.
      const { data } = await axios.post(`${UPLOAD_URL}/api/split`, formData, {
        timeout: 10 * 60 * 1000, // 10 min
      });
      setSegments(data.segments);
    } catch (err) {
      const msg =
        err.response?.data?.error ||
        (err.code === 'ECONNABORTED' ? 'Request timed out. The file may be too large.' : err.message);
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setDuration(null);
    setSegments(null);
    setError('');
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      {/* Header */}
      <header className="w-full border-b border-white/10 py-4 px-6">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-brand/20 flex items-center justify-center">
            <svg className="w-5 h-5 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M9 9l10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 11-.99-3.467l2.31-.66a2.25 2.25 0 001.632-2.163zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 01-.99-3.467l2.31-.66A2.25 2.25 0 009 15.553z" />
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-bold text-white leading-none">Audio Splitter</h1>
            <p className="text-xs text-white/40">Split MP3, WAV, M4A &amp; OGG files</p>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 flex items-start justify-center px-4 py-10">
        <div className="w-full max-w-3xl flex flex-col gap-6">

          {/* Step 1 — Upload */}
          <section className="card">
            <h2 className="text-sm font-semibold text-white/50 uppercase tracking-widest mb-4">
              1 &mdash; Select File
            </h2>

            {segments ? (
              /* Show selected file info once done */
              <div className="flex items-center gap-3 text-sm text-white/70">
                <svg className="w-5 h-5 text-brand shrink-0" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                {file?.name}
                {duration && <span className="text-white/40">— {formatDuration(duration)}</span>}
              </div>
            ) : (
              <Upload onFileSelected={handleFileSelected} disabled={loading} />
            )}

            {/* File metadata chip */}
            {file && !segments && (
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="bg-white/10 text-white/70 text-xs rounded-full px-3 py-1">
                  {file.name}
                </span>
                {duration && (
                  <span className="bg-brand/15 text-brand text-xs rounded-full px-3 py-1">
                    {formatDuration(duration)}
                  </span>
                )}
              </div>
            )}
          </section>

          {/* Step 2 — Controls / Timeline / Progress */}
          {file && !segments && (
            <section className="card flex flex-col gap-6">
              <div>
                <h2 className="text-sm font-semibold text-white/50 uppercase tracking-widest mb-4">
                  2 &mdash; Configure Split
                </h2>
                {loading ? (
                  <Progress message={
                    trimSilence
                      ? 'Recortando silencio inicial y dividiendo el audio…'
                      : 'Dividiendo el audio con FFmpeg…'
                  } />
                ) : (
                  <Controls
                    file={file}
                    duration={duration}
                    onSplit={handleSplit}
                    loading={loading}
                    trimSilence={trimSilence}
                    onTrimSilenceChange={setTrimSilence}
                  />
                )}
              </div>

              {/* Live timeline preview */}
              {!loading && duration && (
                <>
                  <Preview duration={duration} segmentMinutes={segmentMinutes} />
                  {trimSilence && (
                    <p className="text-xs text-white/40 flex items-center gap-1.5 -mt-2">
                      <svg className="w-3.5 h-3.5 text-brand shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      La vista previa puede variar si hay silencio al inicio del archivo.
                    </p>
                  )}
                </>
              )}
            </section>
          )}

          {/* Error */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-sm text-red-400 flex items-start gap-2">
              <svg className="w-5 h-5 shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
              </svg>
              {error}
            </div>
          )}

          {/* Step 3 — Results */}
          {segments && (
            <section className="card">
              <h2 className="text-sm font-semibold text-white/50 uppercase tracking-widest mb-4">
                3 &mdash; Download Segments
              </h2>
              <Results segments={segments} onReset={handleReset} />
            </section>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-white/10 py-3 px-6 text-center text-xs text-white/25">
        Audio Splitter &mdash; files are deleted from the server after 1 hour
      </footer>
    </div>
  );
}
