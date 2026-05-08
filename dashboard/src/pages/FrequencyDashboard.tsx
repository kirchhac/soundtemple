import React, { useEffect, useState, useMemo, useCallback } from 'react';
import Plot from 'react-plotly.js';
import type { Manifest, ManifestFile, FileDetail } from '../types';
import { AudioPlaybackProvider, useAudioPlayback } from '../components/useAudioPlayback';
import RecordingCard from '../components/RecordingCard';
import AudioPlayer from '../components/AudioPlayer';
import PitchDisplay from '../components/PitchDisplay';
import { interpolateFreq } from '../components/pitchUtils';

const SITE_COLORS: Record<string, string> = {
  'Shah-i-Zinda Necropolis': '#a855f7',
  'Registan Square': '#f59e0b',
  'North Star Complex': '#00d4ff',
  'Khiva Dome': '#06b6d4',
  'Bukhara Dome': '#ec4899',
  'Itchan Kala': '#22d3ee',
  'Ark Lotus Guest House': '#64748b',
  "Humayun's Tomb": '#f87171',
  'Ohm Temple': '#34d399',
  'Surya Temple': '#fbbf24',
  'Ganga Aditya Sun Temple': '#fb923c',
  'Brahmapuri Temple': '#4ade80',
  'Unknown': '#64748b',
};

const REFERENCE_LINES = [
  { freq: 93, label: 'Gb2 (93 Hz)', color: '#00d4ff' },
  { freq: 104, label: 'Ab2 (104 Hz)', color: '#34d399' },
  { freq: 110, label: 'A2 (110 Hz)', color: '#fbbf24' },
  { freq: 120, label: 'Bb2 (120 Hz)', color: '#f87171' },
  { freq: 233, label: 'Bb3 (233 Hz)', color: '#a855f7' },
];

/* ─── Detail overlay (separate component so it can use audio context) ─── */

function DetailOverlayContent({
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

/* ─── Main dashboard ─── */

export default function FrequencyDashboard() {
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [selectedSite, setSelectedSite] = useState<string>('all');
  const [selectedFile, setSelectedFile] = useState<FileDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/data/manifest.json')
      .then(r => r.json())
      .then((data: Manifest) => {
        setManifest(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load manifest:', err);
        setLoading(false);
      });
  }, []);

  const sites = useMemo(() => {
    if (!manifest) return [];
    const s = new Set(manifest.files.map(f => f.site));
    return Array.from(s).sort();
  }, [manifest]);

  const filteredFiles = useMemo(() => {
    if (!manifest) return [];
    if (selectedSite === 'all') return manifest.files;
    return manifest.files.filter(f => f.site === selectedSite);
  }, [manifest, selectedSite]);

  const loadFileDetail = useCallback(async (file: ManifestFile) => {
    try {
      const resp = await fetch(`/data/${file.id}.json`);
      const data: FileDetail = await resp.json();
      setSelectedFile(data);
    } catch (err) {
      console.error('Failed to load file detail:', err);
    }
  }, []);

  if (loading) return <div className="loading">Loading acoustic data</div>;
  if (!manifest) return <div className="loading">Failed to load data</div>;

  const stableCounts = manifest.files.reduce((acc, f) => {
    acc[f.freq_stability] = (acc[f.freq_stability] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div>
      <div className="dashboard-header">
        <h2>Frequency Analysis</h2>
        <p>{manifest.analyzed} recordings across {sites.length} sites &mdash; India, Uzbekistan, Egypt</p>
      </div>

      {/* Stats */}
      <div className="stats-row">
        <div className="stat-card">
          <div className="stat-value cyan">{manifest.analyzed}</div>
          <div className="stat-label">Recordings</div>
        </div>
        <div className="stat-card">
          <div className="stat-value orange">{sites.length}</div>
          <div className="stat-label">Sites</div>
        </div>
        <div className="stat-card">
          <div className="stat-value green">{stableCounts.very_stable || 0}</div>
          <div className="stat-label">Very Stable</div>
        </div>
        <div className="stat-card">
          <div className="stat-value purple">
            {Math.round(manifest.files.reduce((s, f) => s + f.duration_s, 0) / 60)}m
          </div>
          <div className="stat-label">Total Audio</div>
        </div>
      </div>

      {/* Overview scatter: all recordings, freq vs site */}
      <div className="overview-chart">
        <Plot
          data={sites.map(site => {
            const siteFiles = manifest.files.filter(f => f.site === site);
            return {
              x: siteFiles.map(f => f.site),
              y: siteFiles.map(f => f.dominant_freq_hz),
              text: siteFiles.map(f =>
                `${f.filename}<br>${f.dominant_note} (${f.dominant_cents > 0 ? '+' : ''}${f.dominant_cents}c)<br>${f.dominant_freq_hz} Hz<br>Stability: ${f.freq_stability}`
              ),
              mode: 'markers' as const,
              type: 'scatter' as const,
              name: site,
              marker: {
                color: SITE_COLORS[site] || '#64748b',
                size: siteFiles.map(f => Math.max(6, Math.min(20, f.duration_s / 5))),
                opacity: 0.8,
                line: { width: 1, color: 'rgba(255,255,255,0.2)' },
              },
              hoverinfo: 'text' as const,
            };
          })}
          layout={{
            title: { text: 'Dominant Frequency by Site', font: { color: '#e8e8f0', size: 14 } },
            paper_bgcolor: 'transparent',
            plot_bgcolor: 'rgba(26,26,46,0.5)',
            font: { color: '#8888a0', size: 11 },
            xaxis: {
              tickangle: -30,
              gridcolor: 'rgba(42,42,62,0.5)',
            },
            yaxis: {
              title: 'Frequency (Hz)',
              gridcolor: 'rgba(42,42,62,0.5)',
              range: [50, 420],
            },
            shapes: REFERENCE_LINES.map(r => ({
              type: 'line' as const,
              x0: 0, x1: 1, xref: 'paper' as const,
              y0: r.freq, y1: r.freq,
              line: { color: r.color, width: 1, dash: 'dot' as const },
            })),
            annotations: REFERENCE_LINES.map(r => ({
              x: 1, xref: 'paper' as const, xanchor: 'left' as const,
              y: r.freq, yanchor: 'middle' as const,
              text: r.label,
              showarrow: false,
              font: { size: 9, color: r.color },
            })),
            showlegend: true,
            legend: { font: { size: 9 }, bgcolor: 'transparent' },
            margin: { t: 40, r: 120, b: 100, l: 60 },
            height: 400,
          }}
          config={{ responsive: true, displayModeBar: true }}
          style={{ width: '100%' }}
        />
      </div>

      {/* Frequency histogram */}
      <div className="overview-chart">
        <Plot
          data={[{
            x: manifest.files.map(f => f.dominant_freq_hz),
            type: 'histogram' as const,
            marker: { color: 'rgba(0,212,255,0.6)', line: { color: '#00d4ff', width: 1 } },
            xbins: { start: 50, end: 420, size: 10 },
            hovertemplate: '%{x:.0f} Hz: %{y} recordings<extra></extra>',
          }]}
          layout={{
            title: { text: 'Frequency Distribution (all recordings)', font: { color: '#e8e8f0', size: 14 } },
            paper_bgcolor: 'transparent',
            plot_bgcolor: 'rgba(26,26,46,0.5)',
            font: { color: '#8888a0', size: 11 },
            xaxis: { title: 'Dominant Frequency (Hz)', gridcolor: 'rgba(42,42,62,0.5)' },
            yaxis: { title: 'Count', gridcolor: 'rgba(42,42,62,0.5)' },
            shapes: REFERENCE_LINES.map(r => ({
              type: 'line' as const,
              x0: r.freq, x1: r.freq,
              y0: 0, y1: 1, yref: 'paper' as const,
              line: { color: r.color, width: 1.5, dash: 'dot' as const },
            })),
            margin: { t: 40, r: 40, b: 60, l: 60 },
            height: 300,
          }}
          config={{ responsive: true }}
          style={{ width: '100%' }}
        />
      </div>

      {/* Site filter */}
      <div className="filters">
        <button
          className={`filter-btn ${selectedSite === 'all' ? 'active' : ''}`}
          onClick={() => setSelectedSite('all')}
        >
          All Sites ({manifest.files.length})
        </button>
        {sites.map(site => {
          const count = manifest.files.filter(f => f.site === site).length;
          return (
            <button
              key={site}
              className={`filter-btn ${selectedSite === site ? 'active' : ''}`}
              onClick={() => setSelectedSite(site)}
            >
              {site} ({count})
            </button>
          );
        })}
      </div>

      {/* AudioPlaybackProvider wraps both cards and detail overlay */}
      <AudioPlaybackProvider>
        {/* Individual file charts grid */}
        <div className="charts-section">
          <h3>Individual Recordings ({filteredFiles.length})</h3>
          <div className="chart-grid">
            {filteredFiles.map(file => (
              <RecordingCard key={file.id} file={file} onShowDetail={loadFileDetail} />
            ))}
          </div>
        </div>

        {/* Detail overlay */}
        {selectedFile && (
          <DetailOverlayContent file={selectedFile} onClose={() => setSelectedFile(null)} />
        )}
      </AudioPlaybackProvider>
    </div>
  );
}
