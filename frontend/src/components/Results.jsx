import { formatBytes } from './Upload';

/**
 * Build an absolute download URL from the relative path the backend returns.
 * This ensures all requests go through the Netlify proxy (same origin)
 * instead of hitting the Render backend directly.
 */
function toDownloadUrl(seg) {
  return window.location.origin + seg.downloadPath;
}

/**
 * Results — downloadable segment list.
 *
 * Props:
 *   segments  - Array of { index, filename, downloadPath, size }
 *   onReset() - Clear results and start over
 */
export default function Results({ segments, onReset }) {
  if (!segments?.length) return null;

  const handleDownloadAll = () => {
    segments.forEach((seg, i) => {
      // Stagger downloads to avoid browser blocking
      setTimeout(() => {
        const a = document.createElement('a');
        a.href = toDownloadUrl(seg);
        a.download = seg.filename;
        a.click();
      }, i * 300);
    });
  };

  return (
    <div className="w-full flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">
            Ready to download
          </h2>
          <p className="text-sm text-white/50">
            {segments.length} segment{segments.length !== 1 ? 's' : ''} created
          </p>
        </div>
        <button onClick={handleDownloadAll} className="btn-primary text-sm py-2 px-4">
          Download All
        </button>
      </div>

      {/* Segment list */}
      <ul className="flex flex-col gap-2">
        {segments.map((seg) => (
          <li
            key={seg.index}
            className="flex items-center justify-between bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl px-4 py-3 transition-colors"
          >
            <div className="flex items-center gap-3">
              {/* Index badge */}
              <span className="w-8 h-8 rounded-full bg-brand/20 text-brand text-sm font-bold flex items-center justify-center shrink-0">
                {seg.index}
              </span>
              <div>
                <p className="text-sm font-medium text-white">{seg.filename}</p>
                {seg.size && (
                  <p className="text-xs text-white/40">{formatBytes(seg.size)}</p>
                )}
              </div>
            </div>

            <a
              href={toDownloadUrl(seg)}
              download={seg.filename}
              className="flex items-center gap-1.5 text-sm text-brand hover:text-brand-dark font-medium transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              Download
            </a>
          </li>
        ))}
      </ul>

      {/* Reset */}
      <button
        onClick={onReset}
        className="btn-secondary text-sm self-center mt-2"
      >
        Split another file
      </button>
    </div>
  );
}
