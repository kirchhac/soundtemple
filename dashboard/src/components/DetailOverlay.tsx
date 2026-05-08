import React from 'react';
import Plot from 'react-plotly.js';
import type { FileDetail } from '../types';
import { useAudioPlayback } from './useAudioPlayback';
import AudioPlayer from './AudioPlayer';
import PitchDisplay from './PitchDisplay';
import { interpolateFreq } from './pitchUtils';

export const REFERENCE_LINES = [
  { freq: 93, label: 'Gb2 (93 Hz)', color: '#00d4ff' },
  { freq: 104, label: 'Ab2 (104 Hz)', color: '#34d399' },
  { freq: 110, label: 'A2 (110 Hz)', color: '#fbbf24' },
  { freq: 120, label: 'Bb2 (120 Hz)', color: '#f87171' },
  { freq: 233, label: 'Bb3 (233 Hz)', color: '#a855f7' },
];

export default function DetailOverlayContent({
  file,
  onClose,
}: {
  file: FileDetail;
  onClose: () => void;
}) {
  const { currentFileId, isPlaying, currentTime, duration } = useAudioPlayback();

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

        {/* Pitch display + audio player */}
        <div className="detail-audio-section" onClick={e => e.stopPropagation()}>
          {isActive && isPlaying && currentFreq > 0 ? (
            <PitchDisplay freq={currentFreq} />
          ) : (
            <PitchDisplay freq={file.dominant_freq_hz} />
          )}
          <AudioPlayer fileId={file.id} audioUrl={audioUrl} />
        </div>

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
                size: 5,
                colorbar: {
                  title: 'Magnitude',
                  titlefont: { color: '#8888a0' },
                  tickfont: { color: '#8888a0' },
                  x: 1.08,
                },
              },
              name: 'Dominant Freq',
              yaxis: 'y',
              hovertemplate: 't=%{x:.1f}s<br>%{y:.1f} Hz<br>mag=%{marker.color:.0f}<extra></extra>',
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
            },
          ]}
          layout={{
            title: { text: 'Frequency & Intensity Over Time', font: { color: '#e8e8f0', size: 13 } },
            paper_bgcolor: 'transparent',
            plot_bgcolor: 'rgba(26,26,46,0.5)',
            font: { color: '#8888a0' },
            xaxis: { title: 'Time (s)', gridcolor: 'rgba(42,42,62,0.5)' },
            yaxis: {
              title: 'Frequency (Hz)',
              titlefont: { color: '#00d4ff' },
              tickfont: { color: '#00d4ff' },
              gridcolor: 'rgba(42,42,62,0.5)',
              range: [30, 500],
              side: 'left',
            },
            yaxis2: {
              title: 'Intensity (dB)',
              titlefont: { color: '#4682b4' },
              tickfont: { color: '#4682b4' },
              overlaying: 'y',
              side: 'right',
              showgrid: false,
            },
            shapes: [
              // Reference note lines
              ...REFERENCE_LINES.map(r => ({
                type: 'line' as const,
                x0: 0, x1: 1, xref: 'paper' as const,
                y0: r.freq, y1: r.freq,
                line: { color: r.color, width: 1, dash: 'dot' as const },
              })),
              // Playback tracking line — uses data coordinates so it aligns perfectly
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
            margin: { t: 50, r: 100, b: 50, l: 60 },
            height: 420,
          }}
          config={{ responsive: true }}
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
            title: { text: 'Time-Averaged Spectrum (30-500 Hz)', font: { color: '#e8e8f0', size: 13 } },
            paper_bgcolor: 'transparent',
            plot_bgcolor: 'rgba(26,26,46,0.5)',
            font: { color: '#8888a0' },
            xaxis: { title: 'Frequency (Hz)', gridcolor: 'rgba(42,42,62,0.5)' },
            yaxis: { title: 'Magnitude', gridcolor: 'rgba(42,42,62,0.5)' },
            shapes: REFERENCE_LINES.map(r => ({
              type: 'line' as const,
              x0: r.freq, x1: r.freq,
              y0: 0, y1: 1, yref: 'paper' as const,
              line: { color: r.color, width: 1, dash: 'dot' as const },
            })),
            margin: { t: 40, r: 40, b: 50, l: 60 },
            height: 300,
          }}
          config={{ responsive: true }}
          style={{ width: '100%' }}
        />

        {/* Spectral peaks table */}
        <h3 style={{ marginTop: 24, marginBottom: 8 }}>Spectral Peaks (Overtone Structure)</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #2a2a3e' }}>
              <th style={{ padding: '8px', textAlign: 'left', color: '#8888a0' }}>Rank</th>
              <th style={{ padding: '8px', textAlign: 'left', color: '#8888a0' }}>Frequency</th>
              <th style={{ padding: '8px', textAlign: 'left', color: '#8888a0' }}>Note</th>
              <th style={{ padding: '8px', textAlign: 'left', color: '#8888a0' }}>Magnitude</th>
              <th style={{ padding: '8px', textAlign: 'left', color: '#8888a0' }}>Ratio</th>
            </tr>
          </thead>
          <tbody>
            {file.spectral_peaks.map((peak, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #1a1a2e' }}>
                <td style={{ padding: '8px' }}>{i + 1}</td>
                <td style={{ padding: '8px', color: '#00d4ff', fontWeight: 600 }}>{peak.freq_hz} Hz</td>
                <td style={{ padding: '8px' }}>{peak.note} ({peak.cents > 0 ? '+' : ''}{peak.cents}c)</td>
                <td style={{ padding: '8px' }}>{peak.magnitude.toFixed(0)}</td>
                <td style={{ padding: '8px', color: '#a855f7' }}>
                  {peak.ratio_to_fundamental ? `${peak.ratio_to_fundamental}x` : '1x (fundamental)'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
