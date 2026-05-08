import React from 'react';
import { freqToNote } from './pitchUtils';

interface PitchDisplayProps {
  freq: number;
  compact?: boolean;
}

function tuneColor(cents: number): string {
  const a = Math.abs(cents);
  if (a < 8) return '#34d399';   // green — in tune
  if (a < 20) return '#fbbf24';  // yellow — slightly off
  return '#f87171';              // red — off pitch
}

export default function PitchDisplay({ freq, compact }: PitchDisplayProps) {
  if (freq <= 0) return null;

  const { letter, accidental, octave, cents } = freqToNote(freq);
  const color = tuneColor(cents);

  // Indicator position: 50% = center, ±25¢ = full scale (like Pitch App)
  const clamped = Math.max(-25, Math.min(25, cents));
  const indicatorPct = 50 + (clamped / 25) * 42; // 8%–92% range

  if (compact) {
    return (
      <div className="pitch-compact">
        <div className="pitch-compact-tuner">
          <div className="pitch-tuner-track" />
          <div className="pitch-tuner-center" />
          <div className="pitch-tuner-indicator" style={{ left: `${indicatorPct}%`, backgroundColor: color }} />
        </div>
        <div className="pitch-compact-info">
          <span className="pitch-compact-note">
            {letter}
            {accidental && <sup>{accidental}</sup>}
            <sub>{octave}</sub>
          </span>
          <span className="pitch-compact-hz">{freq.toFixed(1)} Hz</span>
          <span className="pitch-compact-cents" style={{ color }}>
            {cents >= 0 ? '+' : ''}{cents.toFixed(1)}¢
          </span>
        </div>
      </div>
    );
  }

  // Full-size (detail overlay)
  return (
    <div className="pitch-full">
      {/* Tuning bar */}
      <div className="pitch-full-tuner">
        <div className="pitch-tuner-track" />
        <div className="pitch-tuner-center" />
        <div className="pitch-tuner-indicator-full" style={{ left: `${indicatorPct}%`, backgroundColor: color }} />
      </div>

      {/* Note display */}
      <div className="pitch-full-note">
        <span className="pitch-full-letter">{letter}</span>
        {accidental && <sup className="pitch-full-accidental">{accidental}</sup>}
        <sub className="pitch-full-octave">{octave}</sub>
      </div>
      <div className="pitch-full-cents" style={{ color }}>
        {cents >= 0 ? '+' : ''}{cents.toFixed(1)}¢
      </div>
      <div className="pitch-full-hz">{freq.toFixed(1)} Hz</div>
    </div>
  );
}
