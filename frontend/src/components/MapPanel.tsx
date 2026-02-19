/**
 * MapPanel — Placeholder for the global situation map.
 * Step 1: Renders a styled empty panel with SVG grid lines
 * to suggest lat/lon coordinates. MapLibre GL will replace
 * this in a future step.
 */

export default function MapPanel() {
  return (
    <div className="glow-border rounded-lg bg-panel flex flex-col items-center justify-center min-h-[400px] relative overflow-hidden">
      {/* ── SVG grid lines (lat/lon illusion) ─────────────────── */}
      <div className="absolute inset-0 opacity-20">
        <svg
          width="100%"
          height="100%"
          xmlns="http://www.w3.org/2000/svg"
          className="absolute inset-0"
        >
          {/* Horizontal lines */}
          {Array.from({ length: 9 }, (_, i) => (
            <line
              key={`h${i}`}
              x1="0"
              y1={`${(i + 1) * 10}%`}
              x2="100%"
              y2={`${(i + 1) * 10}%`}
              stroke="#2D7BFF"
              strokeWidth="0.5"
              strokeDasharray="4 6"
            />
          ))}
          {/* Vertical lines */}
          {Array.from({ length: 15 }, (_, i) => (
            <line
              key={`v${i}`}
              x1={`${(i + 1) * 6.25}%`}
              y1="0"
              x2={`${(i + 1) * 6.25}%`}
              y2="100%"
              stroke="#2D7BFF"
              strokeWidth="0.5"
              strokeDasharray="4 6"
            />
          ))}
          {/* Center crosshair */}
          <line
            x1="50%"
            y1="0"
            x2="50%"
            y2="100%"
            stroke="#2D7BFF"
            strokeWidth="1"
            opacity="0.4"
          />
          <line
            x1="0"
            y1="50%"
            x2="100%"
            y2="50%"
            stroke="#2D7BFF"
            strokeWidth="1"
            opacity="0.4"
          />
          {/* Corner markers */}
          <text x="3%" y="8%" fill="#2D7BFF" fontSize="9" fontFamily="monospace" opacity="0.5">
            60°N
          </text>
          <text x="3%" y="50%" fill="#2D7BFF" fontSize="9" fontFamily="monospace" opacity="0.5">
            0°
          </text>
          <text x="3%" y="92%" fill="#2D7BFF" fontSize="9" fontFamily="monospace" opacity="0.5">
            60°S
          </text>
          <text x="48%" y="98%" fill="#2D7BFF" fontSize="9" fontFamily="monospace" opacity="0.5">
            0°
          </text>
          <text x="90%" y="98%" fill="#2D7BFF" fontSize="9" fontFamily="monospace" opacity="0.5">
            120°E
          </text>
        </svg>
      </div>

      {/* ── Animated pulse dots (simulated hotspots) ──────────── */}
      <div className="absolute w-3 h-3 rounded-full bg-negative/60 animate-pulse" style={{ top: "30%", left: "55%" }} />
      <div className="absolute w-2 h-2 rounded-full bg-warning/60 animate-pulse" style={{ top: "45%", left: "30%" }} />
      <div className="absolute w-2.5 h-2.5 rounded-full bg-accent/60 animate-pulse" style={{ top: "35%", left: "75%" }} />

      {/* ── Label ────────────────────────────────────────────── */}
      <div className="z-10 text-center">
        <h2 className="text-accent font-mono text-sm font-bold tracking-widest uppercase mb-2">
          Global Situation Map
        </h2>
        <p className="text-muted text-xs font-mono tracking-wider">
          [ MAP FEED PENDING // STEP 2 ]
        </p>
      </div>
    </div>
  );
}
