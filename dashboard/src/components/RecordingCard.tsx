import React from 'react';
import type { ManifestFile } from '../types';
import MiniFreqGraph from './MiniFreqGraph';
import AudioPlayer from './AudioPlayer';
import ResonationMeter, { RESONATION_THRESHOLD } from './ResonationMeter';
import { useAudioPlayback } from './useAudioPlayback';
import { interpolateFreq, interpolateRms, freqToNote } from './pitchUtils';
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

  // Interpolate real-time RMS level
  const currentRms =
    isActive && ts && ts.rms_levels && ts.rms_levels.length > 0
      ? interpolateRms(ts.times, ts.rms_levels, currentTime, duration)
      : -40;

  const isResonating = isThisPlaying && currentRms > RESONATION_THRESHOLD;

  // Real-time note info
  const currentNote = currentFreq > 0 ? freqToNote(currentFreq) : null;

  // Resonant frequencies for this track
  const resonantFreqs = file.resonant_freqs_hz;

  return (
    <div
      className={`chart-card recording-card ${isResonating ? 'resonating' : ''}`}
      onClick={() => onShowDetail(file)}
    >
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

      {/* Resonant frequency display */}
      {resonantFreqs && resonantFreqs.length > 0 && (
        <div className="resonant-freq-display">
          {resonantFreqs.map((f, i) => (
            <span key={i} className={`resonant-freq-badge ${file.has_sustained_resonation ? '' : 'inactive'}`}>
              {f} Hz
            </span>
          ))}
        </div>
      )}

      {/* Real-time Hz and note — visible during playback */}
      {isThisPlaying && currentFreq > 0 && (
        <div className="realtime-pitch">
          <span className="realtime-hz">{Math.round(currentFreq)} Hz</span>
          {currentNote && (
            <span className="realtime-note">
              {currentNote.fullName}
            </span>
          )}
        </div>
      )}

      {/* Real-time intensity meter — shows resonation state */}
      {isThisPlaying && currentFreq > 0 && (
        <ResonationMeter rmsLevel={currentRms} compact />
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
