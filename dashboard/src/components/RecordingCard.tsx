import React from 'react';
import type { ManifestFile } from '../types';
import MiniFreqGraph from './MiniFreqGraph';
import AudioPlayer from './AudioPlayer';
import PitchDisplay from './PitchDisplay';
import { useAudioPlayback } from './useAudioPlayback';
import { interpolateFreq } from './pitchUtils';
import './RecordingCard.css';

interface RecordingCardProps {
  file: ManifestFile;
  onShowDetail: (file: ManifestFile) => void;
}

export default function RecordingCard({ file, onShowDetail }: RecordingCardProps) {
  const { currentFileId, isPlaying, currentTime, duration } = useAudioPlayback();
  const audioUrl = `/audio/${file.filename}`;

  const isActive = currentFileId === file.id;
  const isThisPlaying = isActive && isPlaying;

  // Interpolate real-time frequency from time series
  const ts = file.time_series_mini;
  const currentFreq =
    isActive && ts && ts.times.length > 0
      ? interpolateFreq(ts.times, ts.freqs, currentTime, duration)
      : 0;

  return (
    <div className="chart-card recording-card" onClick={() => onShowDetail(file)}>
      <div className="chart-card-header">
        <h4 className="chart-card-title" title={file.filename}>
          {file.filename.replace('.m4a', '')}
        </h4>
        <div className="chart-card-meta">
          <span className="badge badge-site">{file.city}</span>
          <span className={`badge badge-stability ${file.freq_stability}`}>
            {file.freq_stability.replace('_', ' ')}
          </span>
        </div>
      </div>

      <div className="freq-display">{file.dominant_freq_hz} Hz</div>
      <div className="freq-note">
        {file.dominant_note} ({file.dominant_cents > 0 ? '+' : ''}{file.dominant_cents}c)
        {file.labeled_note && <span> &mdash; labeled: {file.labeled_note}</span>}
      </div>

      {/* Real-time pitch display — appears when playing */}
      {isThisPlaying && currentFreq > 0 && (
        <PitchDisplay freq={currentFreq} compact />
      )}

      {/* Mini frequency graph */}
      {ts && ts.times.length > 0 && (
        <div className="recording-card-graph">
          <MiniFreqGraph
            times={ts.times}
            freqs={ts.freqs}
            currentTime={isActive ? currentTime : 0}
            isActive={isActive}
            duration={isActive ? duration : file.duration_s}
          />
        </div>
      )}

      {/* Audio player */}
      <AudioPlayer fileId={file.id} audioUrl={audioUrl} />

      {/* Footer metadata */}
      <div className="recording-card-footer">
        Duration: {file.duration_s.toFixed(1)}s &middot; Peaks: {file.spectral_peaks.map(p => `${p.freq_hz}Hz`).join(', ')}
      </div>
    </div>
  );
}
