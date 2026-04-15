import { useState } from 'react';

// Quick-select presets. The starred one is highlighted as "your default".
const PRESETS = [
  { label: '15 min', value: 15 },
  { label: '29 min', value: 29, starred: true },
  { label: '30 min', value: 30 },
  { label: '60 min', value: 60 },
];

/**
 * Controls — segment duration input + trim silence checkbox + split button.
 *
 * Props:
 *   file                 - File object (null if none selected)
 *   duration             - Total audio duration in seconds (may be null)
 *   onSplit(mins)        - Called when user clicks Split
 *   onPreviewChange(mins)- Called on every valid duration change (live timeline)
 *   loading              - Whether a split is in progress
 *   trimSilence          - Controlled from parent
 *   onTrimSilenceChange  - Setter from parent
 */
export default function Controls({
  file, duration, onSplit, onPreviewChange,
  loading, trimSilence, onTrimSilenceChange,
}) {
  const [minutes, setMinutes] = useState('29');

  const mins = parseFloat(minutes);
  const isValid = !isNaN(mins) && mins >= 1 && mins <= 120;

  const segmentCount =
    duration && isValid ? Math.ceil(duration / (mins * 60)) : null;

  // Update both local display and parent preview
  const applyMinutes = (val) => {
    setMinutes(String(val));
    const m = parseFloat(val);
    if (!isNaN(m) && m >= 1 && m <= 120) onPreviewChange?.(m);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isValid && file && !loading) onSplit(mins);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">

      {/* ── Segment duration ───────────────────────────────────────── */}
      <div>
        <label className="block text-sm font-medium text-white/70 mb-2">
          Duración de cada segmento (minutos)
        </label>

        {/* Preset chips */}
        <div className="flex flex-wrap gap-2 mb-3">
          {PRESETS.map((p) => {
            const active = parseFloat(minutes) === p.value;
            return (
              <button
                key={p.value}
                type="button"
                disabled={loading}
                onClick={() => applyMinutes(p.value)}
                className={`relative px-3 py-1 rounded-lg text-sm font-medium transition-all border
                  ${active
                    ? 'bg-brand text-white border-brand shadow-sm shadow-brand/30'
                    : 'bg-white/5 text-white/60 border-white/10 hover:border-brand/50 hover:text-white'}
                  disabled:opacity-50`}
              >
                {p.label}
                {p.starred && !active && (
                  <span className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-brand rounded-full border-2 border-surface" />
                )}
              </button>
            );
          })}
        </div>

        {/* Numeric input + slider */}
        <div className="flex items-center gap-3">
          <input
            type="number"
            min="1"
            max="120"
            step="0.5"
            value={minutes}
            onChange={(e) => applyMinutes(e.target.value)}
            disabled={loading}
            className="w-24 bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-center text-lg font-semibold focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand disabled:opacity-50 transition"
          />
          <input
            type="range"
            min="1"
            max="60"
            step="1"
            value={Math.min(parseFloat(minutes) || 1, 60)}
            onChange={(e) => applyMinutes(e.target.value)}
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

      {/* ── Trim silence — hidden in v1 (needs persistent job store for Render restarts)
      <label>…</label>
      ── */}

      {/* ── Split button ───────────────────────────────────────────── */}
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
            Procesando…
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
