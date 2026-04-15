/**
 * Progress bar shown while audio is being split.
 *
 * Props:
 *   message - Status text to display
 */
export default function Progress({ message = 'Processing audio…' }) {
  return (
    <div className="w-full flex flex-col items-center gap-4 py-8">
      {/* Animated waveform */}
      <div className="flex items-end gap-1 h-10">
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className="w-1.5 bg-brand rounded-full animate-pulse"
            style={{
              height: `${30 + Math.sin(i * 0.8) * 20}%`,
              animationDelay: `${i * 80}ms`,
              animationDuration: '900ms',
            }}
          />
        ))}
      </div>

      {/* Indeterminate bar */}
      <div className="w-full max-w-sm h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div
          className="h-full bg-brand rounded-full"
          style={{
            width: '40%',
            animation: 'slide 1.4s ease-in-out infinite',
          }}
        />
      </div>

      <p className="text-sm text-white/60">{message}</p>

      <style>{`
        @keyframes slide {
          0%   { transform: translateX(-100%); }
          50%  { transform: translateX(250%); }
          100% { transform: translateX(-100%); }
        }
      `}</style>
    </div>
  );
}
