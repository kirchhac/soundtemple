import React, { useEffect, useState, useMemo, useCallback, useLayoutEffect } from 'react';
import Plot from 'react-plotly.js';
import type { Manifest, ManifestFile, FileDetail } from '../types';
import { AudioPlaybackProvider } from '../components/useAudioPlayback';
import RecordingCard from '../components/RecordingCard';
import DetailOverlayContent, { REFERENCE_LINES } from '../components/DetailOverlay';
import { freqToNote } from '../components/pitchUtils';

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

/* ─── Main dashboard ─── */

export default function FrequencyDashboard() {
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [selectedSite, setSelectedSite] = useState<string>('all');
  const [selectedFile, setSelectedFile] = useState<FileDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const isMobile = useIsMobile();

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
            title: { text: 'Dominant Frequency by Site', font: { color: '#e8e8f0', size: isMobile ? 12 : 14 } },
            paper_bgcolor: 'transparent',
            plot_bgcolor: 'rgba(26,26,46,0.5)',
            font: { color: '#8888a0', size: isMobile ? 9 : 11 },
            xaxis: {
              tickangle: isMobile ? -45 : -30,
              gridcolor: 'rgba(42,42,62,0.5)',
              ...(isMobile && { tickfont: { size: 8 } }),
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
            annotations: isMobile ? [] : REFERENCE_LINES.map(r => ({
              x: 1, xref: 'paper' as const, xanchor: 'left' as const,
              y: r.freq, yanchor: 'middle' as const,
              text: r.label,
              showarrow: false,
              font: { size: 9, color: r.color },
            })),
            showlegend: !isMobile,
            legend: { font: { size: 9 }, bgcolor: 'transparent' },
            margin: isMobile ? { t: 32, r: 16, b: 80, l: 40 } : { t: 40, r: 120, b: 100, l: 60 },
            height: isMobile ? 300 : 400,
          }}
          config={{ responsive: true, displayModeBar: !isMobile }}
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
            title: { text: 'Frequency Distribution (all recordings)', font: { color: '#e8e8f0', size: isMobile ? 12 : 14 } },
            paper_bgcolor: 'transparent',
            plot_bgcolor: 'rgba(26,26,46,0.5)',
            font: { color: '#8888a0', size: isMobile ? 9 : 11 },
            xaxis: { title: 'Dominant Frequency (Hz)', gridcolor: 'rgba(42,42,62,0.5)' },
            yaxis: { title: 'Count', gridcolor: 'rgba(42,42,62,0.5)' },
            shapes: REFERENCE_LINES.map(r => ({
              type: 'line' as const,
              x0: r.freq, x1: r.freq,
              y0: 0, y1: 1, yref: 'paper' as const,
              line: { color: r.color, width: 1.5, dash: 'dot' as const },
            })),
            margin: isMobile ? { t: 32, r: 12, b: 44, l: 36 } : { t: 40, r: 40, b: 60, l: 60 },
            height: isMobile ? 240 : 300,
          }}
          config={{ responsive: true, displayModeBar: !isMobile }}
          style={{ width: '100%' }}
        />
      </div>

      {/* Resonant Frequency Rankings */}
      <ResonantRankings files={manifest.files} />

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

/* ─── Resonant Frequency Rankings ─── */

interface RankingEntry {
  freqHz: number;
  note: string;
  totalSeconds: number;
  trackCount: number;
}

function ResonantRankings({ files }: { files: ManifestFile[] }) {
  const [sortBy, setSortBy] = useState<'time' | 'tracks'>('time');

  const rankings = useMemo(() => {
    // Collect all resonant frequencies from sustained tracks
    const freqMap = new Map<number, { seconds: number; tracks: Set<string> }>();

    for (const file of files) {
      if (!file.has_sustained_resonation || !file.resonant_freqs_hz) continue;

      // Estimate sustained time per frequency: distribute duration proportionally
      const sustainedDuration = file.duration_s * 0.4; // approximate — avg ~40% of track resonates
      const perFreq = sustainedDuration / file.resonant_freqs_hz.length;

      for (const freq of file.resonant_freqs_hz) {
        const existing = freqMap.get(freq) || { seconds: 0, tracks: new Set<string>() };
        existing.seconds += perFreq;
        existing.tracks.add(file.id);
        freqMap.set(freq, existing);
      }
    }

    // Merge nearby frequencies (within 5 Hz)
    const sortedFreqs = Array.from(freqMap.keys()).sort((a, b) => a - b);
    const used = new Set<number>();
    const merged: RankingEntry[] = [];

    for (const f of sortedFreqs) {
      if (used.has(f)) continue;
      const cluster = [f];
      for (const f2 of sortedFreqs) {
        if (f2 !== f && !used.has(f2) && Math.abs(f2 - f) <= 5) {
          cluster.push(f2);
        }
      }

      let totalSec = 0;
      const allTracks = new Set<string>();
      let weightedFreq = 0;

      for (const cf of cluster) {
        const entry = freqMap.get(cf)!;
        totalSec += entry.seconds;
        weightedFreq += cf * entry.seconds;
        entry.tracks.forEach(t => allTracks.add(t));
        used.add(cf);
      }

      merged.push({
        freqHz: Math.round(weightedFreq / totalSec),
        note: freqToNote(Math.round(weightedFreq / totalSec)).fullName,
        totalSeconds: Math.round(totalSec),
        trackCount: allTracks.size,
      });
    }

    return merged;
  }, [files]);

  const sorted = useMemo(() => {
    if (sortBy === 'time') {
      return [...rankings].sort((a, b) => b.totalSeconds - a.totalSeconds);
    }
    return [...rankings].sort((a, b) => b.trackCount - a.trackCount || b.totalSeconds - a.totalSeconds);
  }, [rankings, sortBy]);

  const sustainedCount = files.filter(f => f.has_sustained_resonation).length;

  return (
    <div className="resonant-rankings">
      <div className="rankings-header">
        <h3>Resonant Frequencies</h3>
        <p className="rankings-subtitle">
          {sustainedCount} of {files.length} recordings sustain resonation (&gt;1s above -16.5 dB)
        </p>
      </div>

      <div className="rankings-sort">
        <button
          className={`filter-btn ${sortBy === 'time' ? 'active' : ''}`}
          onClick={() => setSortBy('time')}
        >
          By Sustained Time
        </button>
        <button
          className={`filter-btn ${sortBy === 'tracks' ? 'active' : ''}`}
          onClick={() => setSortBy('tracks')}
        >
          By # Tracks
        </button>
      </div>

      <div className="rankings-table-wrap">
        <table className="rankings-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Frequency</th>
              <th>Note</th>
              <th>{sortBy === 'time' ? 'Sustained' : '# Tracks'}</th>
              <th>{sortBy === 'time' ? '# Tracks' : 'Sustained'}</th>
            </tr>
          </thead>
          <tbody>
            {sorted.slice(0, 20).map((entry, i) => (
              <tr key={entry.freqHz}>
                <td className="rank-num">{i + 1}</td>
                <td className="rank-freq">{entry.freqHz} ±3 Hz</td>
                <td className="rank-note">{entry.note}</td>
                <td className="rank-value">
                  {sortBy === 'time'
                    ? `${entry.totalSeconds}s`
                    : `${entry.trackCount} tracks`
                  }
                </td>
                <td className="rank-secondary">
                  {sortBy === 'time'
                    ? `${entry.trackCount} tracks`
                    : `${entry.totalSeconds}s`
                  }
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
