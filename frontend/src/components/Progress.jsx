import { useState, useEffect } from 'react';

function formatElapsed(seconds) {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s.toString().padStart(2, '0')}s`;
}

/**
 * Progress indicator shown while audio is being processed.
 *
 * Props:
 *   message  - Primary status text
 *   hint     - Optional secondary hint (shown smaller below message)
 */
export default function Progress({ message = 'Procesando audio…', hint }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="w-full flex flex-col items-center gap-4 py-8">

      {/* Animated waveform */}
      <div className="flex items-end gap-1 h-10">
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className="w-1.5 bg-brand rounded-full"
            style={{
              height: `${30 + Math.sin(i * 0.8) * 20}%`,
              animation: `wavePulse 900ms ${i * 80}ms ease-in-out infinite alternate`,
            }}
          />
        ))}
      </div>

      {/* Indeterminate bar */}
      <div className="w-full max-w-sm h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div
          className="h-full bg-brand rounded-full"
          style={{ animation: 'slideBar 1.4s ease-in-out infinite' }}
        />
      </div>

      {/* Messages */}
      <div className="text-center">
        <p className="text-sm text-white/70 font-medium">{message}</p>
        {hint && <p className="text-xs text-white/40 mt-1">{hint}</p>}
      </div>

      {/* Elapsed time */}
      <div className="flex items-center gap-1.5 text-xs text-white/30">
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <circle cx="12" cy="12" r="10" /><path strokeLinecap="round" d="M12 6v6l4 2" />
        </svg>
        Tiempo transcurrido: {formatElapsed(elapsed)}
      </div>

      <style>{`
        @keyframes slideBar {
          0%   { width: 0%;   margin-left: 0%; }
          50%  { width: 60%;  margin-left: 40%; }
          100% { width: 0%;   margin-left: 100%; }
        }
        @keyframes wavePulse {
          from { opacity: 0.4; transform: scaleY(0.6); }
          to   { opacity: 1;   transform: scaleY(1.2); }
        }
      `}</style>
    </div>
  );
}
