import { useState } from 'react';

/**
 * Controls — segment duration input + split button.
 *
 * Props:
 *   file           - File object (null if none selected)
 *   duration       - Total audio duration in seconds (may be null)
 *   onSplit(mins)  - Called with segment duration in minutes
 *   loading        - Whether a split is in progress
 */
export default function Controls({ file, duration, onSplit, loading }) {
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
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label className="block text-sm font-medium text-white/70 mb-1.5">
          Segment Duration (minutes)
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

        {/* Segment preview */}
        {segmentCount !== null && (
          <p className="mt-2 text-sm text-white/50">
            This will create{' '}
            <span className="text-brand font-semibold">{segmentCount}</span>{' '}
            segment{segmentCount !== 1 ? 's' : ''}.
          </p>
        )}

        {!isValid && minutes !== '' && (
          <p className="mt-1 text-xs text-red-400">Enter a value between 1 and 120.</p>
        )}
      </div>

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
            Processing…
          </>
        ) : (
          <>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 3M21 7.5H7.5" />
            </svg>
            Split Audio
          </>
        )}
      </button>
    </form>
  );
}
