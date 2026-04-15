import { formatDuration } from './Upload';

const COLORS = [
  '#16c784', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6',
  '#06b6d4', '#f97316', '#84cc16', '#e11d48', '#14b8a6',
];

/**
 * Timeline preview — shows colored bars for each segment.
 *
 * Props:
 *   duration        - Total audio duration in seconds
 *   segmentMinutes  - Segment duration in minutes
 */
export default function Preview({ duration, segmentMinutes }) {
  if (!duration || !segmentMinutes) return null;

  const segSecs = segmentMinutes * 60;
  const count = Math.ceil(duration / segSecs);
  const segments = Array.from({ length: count }, (_, i) => {
    const start = i * segSecs;
    const end = Math.min((i + 1) * segSecs, duration);
    const widthPct = ((end - start) / duration) * 100;
    return { index: i + 1, start, end, widthPct, color: COLORS[i % COLORS.length] };
  });

  return (
    <div className="w-full">
      <p className="text-sm font-medium text-white/60 mb-3">
        Timeline preview &mdash;{' '}
        <span className="text-white">{count} segment{count !== 1 ? 's' : ''}</span>{' '}
        of {formatDuration(segSecs)} each
      </p>

      {/* Bar */}
      <div className="flex w-full h-10 rounded-lg overflow-hidden border border-white/10">
        {segments.map((seg) => (
          <div
            key={seg.index}
            style={{ width: `${seg.widthPct}%`, backgroundColor: seg.color }}
            className="relative group cursor-default flex items-center justify-center transition-opacity hover:opacity-80"
          >
            {/* Label — only show if segment is wide enough */}
            {seg.widthPct > 8 && (
              <span className="text-xs font-bold text-white/90 select-none drop-shadow">
                {seg.index}
              </span>
            )}

            {/* Tooltip */}
            <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-surface border border-white/20 rounded-lg px-2 py-1 text-xs text-white whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none z-10 shadow-lg transition-opacity">
              Part {seg.index}: {formatDuration(seg.start)} – {formatDuration(seg.end)}
            </div>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap gap-2">
        {segments.map((seg) => (
          <div key={seg.index} className="flex items-center gap-1.5 text-xs text-white/60">
            <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: seg.color }} />
            Part {seg.index} ({formatDuration(seg.end - seg.start)})
          </div>
        ))}
      </div>
    </div>
  );
}
