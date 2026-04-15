import { useState } from 'react';

/**
 * Controls — segment duration input + trim silence checkbox + split button.
 *
 * Props:
 *   file                 - File object (null if none selected)
 *   duration             - Total audio duration in seconds (may be null)
 *   onSplit(mins)        - Called when user clicks Split
 *   loading              - Whether a split is in progress
 *   trimSilence          - Controlled value from parent
 *   onTrimSilenceChange  - Setter from parent
 */
export default function Controls({ file, duration, onSplit, loading, trimSilence, onTrimSilenceChange }) {
  const [minutes, setMinutes] = useState('5');

  const mins = parseFloat(minutes);
  const isValid = !isNaN(mins) && mins >= 1 && mins <= 120;

  // Preview how many segments would be created
  const segmentCount =
    duration && isValid ? Math.ceil(duration / (mins * 60)) : null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isValid && file && !loading) onSplit(mins);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">

      {/* ── Segment duration ────────────────────────────────────────── */}
      <div>
        <label className="block text-sm font-medium text-white/70 mb-1.5">
          Duración de cada segmento (minutos)
        </label>
        <div className="flex items-center gap-3">
          <input
            type="number"
            min="1"
            max="120"
            step="0.5"
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            disabled={loading}
            className="w-28 bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-center text-lg font-semibold focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand disabled:opacity-50 transition"
          />
          <input
            type="range"
            min="1"
            max="60"
            step="1"
            value={Math.min(parseFloat(minutes) || 1, 60)}
            onChange={(e) => setMinutes(e.target.value)}
            disabled={loading}
            className="flex-1 accent-brand disabled:opacity-50"
          />
        </div>

        {segmentCount !== null && (
          <p className="mt-2 text-sm text-white/50">
            Se crearán{' '}
            <span className="text-brand font-semibold">{segmentCount}</span>{' '}
            segmento{segmentCount !== 1 ? 's' : ''}.
          </p>
        )}

        {!isValid && minutes !== '' && (
          <p className="mt-1 text-xs text-red-400">Ingresa un valor entre 1 y 120.</p>
        )}
      </div>

      {/* ── Trim silence checkbox ────────────────────────────────────── */}
      <label className={`flex items-start gap-3 cursor-pointer rounded-xl border p-3 transition-colors
        ${trimSilence
          ? 'border-brand/40 bg-brand/8'
          : 'border-white/10 bg-white/5 hover:bg-white/8'}
        ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        {/* Custom checkbox */}
        <div className="relative shrink-0 mt-0.5">
          <input
            type="checkbox"
            checked={trimSilence}
            onChange={(e) => onTrimSilenceChange(e.target.checked)}
            disabled={loading}
            className="sr-only"
          />
          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all
            ${trimSilence ? 'border-brand bg-brand' : 'border-white/30 bg-transparent'}`}
          >
            {trimSilence && (
              <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none">
                <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.8"
                  strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </div>
        </div>

        {/* Label text */}
        <div>
          <p className="text-sm font-medium text-white leading-snug">
            Recortar silencio inicial
          </p>
          <p className="text-xs text-white/45 mt-0.5 leading-relaxed">
            Elimina los segundos o minutos de silencio al inicio de la grabación.
            El proceso tarda un poco más y la calidad puede variar levemente.
          </p>
        </div>
      </label>

      {/* ── Split button ─────────────────────────────────────────────── */}
      <button
        type="submit"
        disabled={!file || !isValid || loading}
        className="btn-primary flex items-center justify-center gap-2 py-3 text-base"
      >
        {loading ? (
          <>
            <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
            {trimSilence ? 'Procesando (modo silencio)…' : 'Procesando…'}
          </>
        ) : (
          <>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 3M21 7.5H7.5" />
            </svg>
            Dividir audio
          </>
        )}
      </button>
    </form>
  );
}
