import React, { useEffect, useState, useMemo, useCallback } from 'react';
import Plot from 'react-plotly.js';
import type { Manifest, ManifestFile, FileDetail } from '../types';
import { AudioPlaybackProvider } from '../components/useAudioPlayback';
import RecordingCard from '../components/RecordingCard';
import DetailOverlayContent, { REFERENCE_LINES } from '../components/DetailOverlay';

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
