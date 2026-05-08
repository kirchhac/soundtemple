import React from 'react';

interface MiniFreqGraphProps {
  times: number[];
  freqs: number[];
  currentTime: number;
  isActive: boolean;
  duration: number;
}

const W = 400;
const H = 80;
const PAD_L = 36;
const PAD_R = 4;
const PAD_T = 6;
const PAD_B = 14;
const PLOT_W = W - PAD_L - PAD_R;
const PLOT_H = H - PAD_T - PAD_B;

function MiniFreqGraphInner({ times, freqs, currentTime, isActive, duration }: MiniFreqGraphProps) {
  if (!times.length || !freqs.length) return null;

  const tMin = times[0];
  const tMax = times[times.length - 1];
  const fMin = Math.min(...freqs);
  const fMax = Math.max(...freqs);
  const fRange = fMax - fMin || 1;

  const toX = (t: number) => PAD_L + ((t - tMin) / (tMax - tMin || 1)) * PLOT_W;
  const toY = (f: number) => PAD_T + PLOT_H - ((f - fMin) / fRange) * PLOT_H;

  // Build polyline points
  const points = times.map((t, i) => `${toX(t)},${toY(freqs[i])}`).join(' ');

  // Polygon for fill area (close at bottom)
  const fillPoints = points + ` ${toX(tMax)},${PAD_T + PLOT_H} ${toX(tMin)},${PAD_T + PLOT_H}`;

  // Tracking ball position
  let ballX = 0;
  let ballY = 0;
  let showBall = false;

  if (isActive && currentTime > 0 && duration > 0) {
    // Map currentTime to the time series range
    const t = tMin + (currentTime / duration) * (tMax - tMin);
    if (t >= tMin && t <= tMax) {
      showBall = true;
      // Binary search for the right segment
      let lo = 0;
      let hi = times.length - 1;
      while (lo < hi - 1) {
        const mid = (lo + hi) >> 1;
        if (times[mid] <= t) lo = mid;
        else hi = mid;
      }
      // Linear interpolation
      const tSeg = times[hi] - times[lo] || 1;
      const frac = (t - times[lo]) / tSeg;
      const freq = freqs[lo] + frac * (freqs[hi] - freqs[lo]);
      ballX = toX(t);
      ballY = toY(freq);
    }
  }

  // Grid lines (3 horizontal)
  const gridFreqs = [fMin, fMin + fRange / 2, fMax];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', display: 'block' }}>
      <defs>
        <linearGradient id="freqFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#00d4ff" stopOpacity={0.3} />
          <stop offset="100%" stopColor="#00d4ff" stopOpacity={0.02} />
        </linearGradient>
      </defs>

      {/* Grid lines */}
      {gridFreqs.map((f, i) => (
        <line
          key={i}
          x1={PAD_L}
          y1={toY(f)}
          x2={W - PAD_R}
          y2={toY(f)}
          stroke="#2a2a3e"
          strokeWidth={0.5}
        />
      ))}

      {/* Y-axis labels */}
      <text x={PAD_L - 3} y={toY(fMax) + 3} textAnchor="end" fill="#8888a0" fontSize={7}>
        {Math.round(fMax)}
      </text>
      <text x={PAD_L - 3} y={toY(fMin) + 3} textAnchor="end" fill="#8888a0" fontSize={7}>
        {Math.round(fMin)}
      </text>

      {/* Hz label */}
      <text x={2} y={PAD_T + PLOT_H / 2 + 2} fill="#8888a0" fontSize={6} textAnchor="start">
        Hz
      </text>

      {/* Fill area */}
      <polygon points={fillPoints} fill="url(#freqFill)" />

      {/* Frequency line */}
      <polyline points={points} fill="none" stroke="#00d4ff" strokeWidth={1.5} strokeLinejoin="round" />

      {/* Tracking ball */}
      {showBall && (
        <>
          <line x1={ballX} y1={PAD_T} x2={ballX} y2={PAD_T + PLOT_H} stroke="#00d4ff" strokeWidth={0.5} opacity={0.5} />
          <circle cx={ballX} cy={ballY} r={4} fill="#00d4ff" stroke="#0a0a0f" strokeWidth={1.5} />
        </>
      )}

      {/* Time axis labels */}
      <text x={PAD_L} y={H - 2} fill="#8888a0" fontSize={7} textAnchor="start">
        0s
      </text>
      <text x={W - PAD_R} y={H - 2} fill="#8888a0" fontSize={7} textAnchor="end">
        {Math.round(tMax)}s
      </text>
    </svg>
  );
}

const MiniFreqGraph = React.memo(MiniFreqGraphInner);
export default MiniFreqGraph;
