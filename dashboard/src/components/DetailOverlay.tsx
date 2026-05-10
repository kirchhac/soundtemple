import React, { useState, useLayoutEffect } from 'react';
import Plot from 'react-plotly.js';
import type { FileDetail } from '../types';
import { useAudioPlayback } from './useAudioPlayback';
import AudioPlayer from './AudioPlayer';
import ResonationMeter, { RESONATION_THRESHOLD } from './ResonationMeter';
import { interpolateFreq, interpolateRms, freqToNote } from './pitchUtils';

function useIsMobile(breakpoint = 768) {
  const [mobile, setMobile] = useState(() => window.innerWidth <= breakpoint);
  useLayoutEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const handler = (e: MediaQueryListEvent) => setMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [breakpoint]);
  return mobile;
}

export const REFERENCE_LINES = [
  { freq: 93, label: 'Gb2 (93 Hz)', color: '#00d4ff' },
  { freq: 104, label: 'Ab2 (104 Hz)', color: '#34d399' },
  { freq: 110, label: 'A2 (110 Hz)', color: '#fbbf24' },
  { freq: 120, label: 'Bb2 (120 Hz)', color: '#f87171' },
  { freq: 233, label: 'Bb3 (233 Hz)', color: '#a855f7' },
];

// Detect resonation regions: segments where intensity exceeds threshold
// and frequency is near the dome's resonant frequency
function detectResonation(file: FileDetail) {
  const { times, dominant_freqs, rms_levels } = file.time_series;
  const RMS_THRESHOLD = RESONATION_THRESHOLD; // -16.5 dB — resonation audible above this
  const FREQ_TOLERANCE = 10; // Hz — how close to dominant freq counts

  const resonantFreq = file.strongest_freq_hz;
  const regions: { start: number; end: number }[] = [];
  let regionStart: number | null = null;

  for (let i = 0; i < times.length; i++) {
    const isResonating =
      rms_levels[i] > RMS_THRESHOLD &&
      Math.abs(dominant_freqs[i] - resonantFreq) <= FREQ_TOLERANCE;

    if (isResonating && regionStart === null) {
      regionStart = times[i];
    } else if (!isResonating && regionStart !== null) {
      regions.push({ start: regionStart, end: times[i - 1] });
      regionStart = null;
    }
  }
  // Close final region
  if (regionStart !== null) {
    regions.push({ start: regionStart, end: times[times.length - 1] });
  }

  return { regions, resonantFreq, threshold: RMS_THRESHOLD };
}


export default function DetailOverlayContent({
  file,
  onClose,
}: {
  file: FileDetail;
  onClose: () => void;
}) {
  const { currentFileId, isPlaying, currentTime, duration } = useAudioPlayback();
  const isMobile = useIsMobile();

  const isActive = currentFileId === file.id;

  // Map audio currentTime to the data time axis
  const times = file.time_series.times;
  const tMin = times[0] || 0;
  const tMax = times[times.length - 1] || 1;
  const mappedTime =
    isActive && duration > 0
      ? tMin + (currentTime / duration) * (tMax - tMin)
      : 0;

  // Interpolate real-time frequency from full time series
  const currentFreq = isActive
    ? interpolateFreq(
        times,
        file.time_series.dominant_freqs,
        currentTime,
        duration,
      )
    : 0;

  // Interpolate real-time RMS level
  const currentRms = isActive
    ? interpolateRms(
        times,
        file.time_series.rms_levels,
        currentTime,
        duration,
      )
    : -40;

  // Resonation detection
  const resonation = React.useMemo(() => detectResonation(file), [file]);
  const currentlyResonating = isActive && isPlaying && currentRms > RESONATION_THRESHOLD;

  const audioUrl = `/audio/${file.filename}`;

  return (
    <div className="chart-overlay" onClick={onClose}>
      <div className="chart-overlay-content" onClick={e => e.stopPropagation()}>
        <button className="chart-overlay-close" onClick={onClose}>&times;</button>
        <h2 style={{ margin: '0 0 4px 0' }}>{file.filename.replace('.m4a', '')}</h2>
        <p style={{ color: '#8888a0', margin: '0 0 16px 0' }}>
          {file.site} &middot; {file.city}, {file.country} &middot;
          {file.dominant_freq_hz} Hz ({file.dominant_note} {file.dominant_cents > 0 ? '+' : ''}{file.dominant_cents}c)
        </p>

        {/* Real-time Hz + note + intensity meter + audio player */}
        <div className="detail-audio-section" onClick={e => e.stopPropagation()}>
          {isActive && isPlaying && currentFreq > 0 && (
            <div className="realtime-pitch large">
              <span className="realtime-hz">{Math.round(currentFreq)} Hz</span>
              <span className="realtime-note">{freqToNote(currentFreq).fullName}</span>
            </div>
          )}
          {isActive && isPlaying ? (
            <ResonationMeter rmsLevel={currentRms} />
          ) : (
            <ResonationMeter rmsLevel={-40} />
          )}
          <AudioPlayer fileId={file.id} audioUrl={audioUrl} />
        </div>

        {/* Resonation summary */}
        {file.resonant_freqs_hz && file.resonant_freqs_hz.length > 0 && (
          <div className="resonation-info">
            <span className="resonation-dot" />
            Resonant {file.resonant_freqs_hz.length > 1 ? 'frequencies' : 'frequency'}:{' '}
            {file.resonant_freqs_hz.map(f => `${f} Hz`).join(', ')}
            {' '}&mdash; intensity &gt; {RESONATION_THRESHOLD} dB
            ({resonation.regions.length} region{resonation.regions.length > 1 ? 's' : ''})
          </div>
        )}

        {/* Combined: frequency + intensity over time (dual y-axis) with tracking line */}
        <Plot
          data={[
            {
              x: file.time_series.times,
              y: file.time_series.dominant_freqs,
              type: 'scatter' as const,
              mode: 'markers' as const,
              marker: {
                color: file.time_series.peak_magnitudes,
                colorscale: 'Hot',
                size: isMobile ? 4 : 5,
                ...(isMobile ? {} : {
                  colorbar: {
                    title: 'Magnitude',
                    titlefont: { color: '#8888a0' },
                    tickfont: { color: '#8888a0' },
                    x: 1.08,
                  },
                }),
              },
              name: 'Dominant Freq',
              yaxis: 'y',
              hovertemplate: 't=%{x:.1f}s<br>%{y:.1f} Hz<br>mag=%{marker.color:.0f}<extra></extra>',
              showlegend: !isMobile,
            },
            {
              x: file.time_series.times,
              y: file.time_series.rms_levels,
              type: 'scatter' as const,
              mode: 'lines' as const,
              fill: 'tozeroy' as const,
              line: { color: '#4682b4', width: 1.5 },
              fillcolor: 'rgba(70,130,180,0.12)',
              name: 'Intensity (RMS)',
              yaxis: 'y2',
              hovertemplate: 't=%{x:.1f}s<br>%{y:.1f} dB<extra></extra>',
              showlegend: !isMobile,
            },
          ]}
          layout={{
            title: { text: 'Frequency & Intensity Over Time', font: { color: '#e8e8f0', size: isMobile ? 11 : 13 } },
            paper_bgcolor: 'transparent',
            plot_bgcolor: 'rgba(26,26,46,0.5)',
            font: { color: '#8888a0', size: isMobile ? 9 : 12 },
            xaxis: { title: isMobile ? undefined : 'Time (s)', gridcolor: 'rgba(42,42,62,0.5)' },
            yaxis: {
              title: isMobile ? 'Hz' : 'Frequency (Hz)',
              titlefont: { color: '#00d4ff' },
              tickfont: { color: '#00d4ff', size: isMobile ? 9 : 12 },
              gridcolor: 'rgba(42,42,62,0.5)',
              range: [30, 500],
              side: 'left',
            },
            yaxis2: {
              title: isMobile ? 'dB' : 'Intensity (dB)',
              titlefont: { color: '#4682b4' },
              tickfont: { color: '#4682b4', size: isMobile ? 9 : 12 },
              overlaying: 'y',
              side: 'right',
              showgrid: false,
            },
            shapes: [
              // Resonation highlight regions
              ...resonation.regions.map(r => ({
                type: 'rect' as const,
                x0: r.start, x1: r.end,
                y0: 0, y1: 1, yref: 'paper' as const,
                fillcolor: 'rgba(0, 255, 136, 0.08)',
                line: { width: 0 },
                layer: 'below' as const,
              })),
              // Resonation threshold line on intensity axis (-16.5 dB)
              {
                type: 'line' as const,
                x0: 0, x1: 1, xref: 'paper' as const,
                y0: RESONATION_THRESHOLD, y1: RESONATION_THRESHOLD,
                yref: 'y2' as const,
                line: { color: 'rgba(0, 255, 136, 0.7)', width: 2.5 },
              },
              // Reference note lines
              ...REFERENCE_LINES.map(r => ({
                type: 'line' as const,
                x0: 0, x1: 1, xref: 'paper' as const,
                y0: r.freq, y1: r.freq,
                line: { color: r.color, width: 1, dash: 'dot' as const },
              })),
              // Playback position line
              ...(isActive && mappedTime > tMin
                ? [{
                    type: 'line' as const,
                    x0: mappedTime, x1: mappedTime,
                    y0: 0, y1: 1, yref: 'paper' as const,
                    line: { color: '#00d4ff', width: 2 },
                  }]
                : []),
            ],
            legend: {
              x: 0, y: 1.12, orientation: 'h' as const,
              font: { size: 10 }, bgcolor: 'transparent',
            },
            margin: isMobile ? { t: 36, r: 40, b: 32, l: 40 } : { t: 50, r: 100, b: 50, l: 60 },
            height: isMobile ? 280 : 420,
          }}
          config={{ responsive: true, displayModeBar: !isMobile }}
          style={{ width: '100%' }}
        />

        {/* Time-averaged spectrum */}
        <Plot
          data={[
            {
              x: file.avg_spectrum.freqs,
              y: file.avg_spectrum.magnitudes,
              type: 'scatter' as const,
              mode: 'lines' as const,
              fill: 'tozeroy' as const,
              line: { color: '#a855f7', width: 1.5 },
              fillcolor: 'rgba(168,85,247,0.15)',
              name: 'Avg Spectrum',
              hovertemplate: '%{x:.0f} Hz<br>mag=%{y:.0f}<extra></extra>',
            },
          ]}
          layout={{
            title: { text: 'Time-Averaged Spectrum (30-500 Hz)', font: { color: '#e8e8f0', size: isMobile ? 11 : 13 } },
            paper_bgcolor: 'transparent',
            plot_bgcolor: 'rgba(26,26,46,0.5)',
            font: { color: '#8888a0', size: isMobile ? 9 : 12 },
            xaxis: { title: 'Frequency (Hz)', gridcolor: 'rgba(42,42,62,0.5)' },
            yaxis: { title: 'Magnitude', gridcolor: 'rgba(42,42,62,0.5)' },
            shapes: REFERENCE_LINES.map(r => ({
              type: 'line' as const,
              x0: r.freq, x1: r.freq,
              y0: 0, y1: 1, yref: 'paper' as const,
              line: { color: r.color, width: 1, dash: 'dot' as const },
            })),
            margin: isMobile ? { t: 32, r: 12, b: 40, l: 36 } : { t: 40, r: 40, b: 50, l: 60 },
            height: isMobile ? 220 : 300,
          }}
          config={{ responsive: true, displayModeBar: !isMobile }}
          style={{ width: '100%' }}
        />

        {/* Spectral peaks table */}
        <h3 style={{ marginTop: 24, marginBottom: 8 }}>Spectral Peaks (Overtone Structure)</h3>
        <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: isMobile ? '0.72rem' : '0.8rem', minWidth: isMobile ? 400 : undefined }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #2a2a3e' }}>
                <th style={{ padding: isMobile ? '6px' : '8px', textAlign: 'left', color: '#8888a0' }}>Rank</th>
                <th style={{ padding: isMobile ? '6px' : '8px', textAlign: 'left', color: '#8888a0' }}>Frequency</th>
                <th style={{ padding: isMobile ? '6px' : '8px', textAlign: 'left', color: '#8888a0' }}>Note</th>
                <th style={{ padding: isMobile ? '6px' : '8px', textAlign: 'left', color: '#8888a0' }}>Magnitude</th>
              </tr>
            </thead>
            <tbody>
              {file.spectral_peaks.map((peak, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #1a1a2e' }}>
                  <td style={{ padding: isMobile ? '6px' : '8px' }}>{i + 1}</td>
                  <td style={{ padding: isMobile ? '6px' : '8px', color: '#00d4ff', fontWeight: 600 }}>{peak.freq_hz} Hz</td>
                  <td style={{ padding: isMobile ? '6px' : '8px' }}>{peak.note} ({peak.cents > 0 ? '+' : ''}{peak.cents}c)</td>
                  <td style={{ padding: isMobile ? '6px' : '8px' }}>{peak.magnitude.toFixed(0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
