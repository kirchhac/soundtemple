import React from 'react';

const RESONATION_THRESHOLD = -16.5; // dB
const METER_MIN = -30; // dB (quiet end of useful range)
const METER_MAX = -8;  // dB (loudest expected)

interface ResonationMeterProps {
  /** Current RMS level in dB */
  rmsLevel: number;
  /** Whether to show the compact card version */
  compact?: boolean;
}

export default function ResonationMeter({ rmsLevel, compact }: ResonationMeterProps) {
  const displayDb = Math.round(rmsLevel);

  // Normalize rmsLevel to 0–100% within meter bounds
  const clamped = Math.max(METER_MIN, Math.min(METER_MAX, rmsLevel));
  const pct = ((clamped - METER_MIN) / (METER_MAX - METER_MIN)) * 100;

  // Threshold position as percentage
  const thresholdPct = ((RESONATION_THRESHOLD - METER_MIN) / (METER_MAX - METER_MIN)) * 100;

  const isResonating = rmsLevel > RESONATION_THRESHOLD;

  if (compact) {
    return (
      <div className={`resonation-meter compact ${isResonating ? 'active' : ''}`}>
        <div className="resonation-meter-label">
          <span className="resonation-meter-db">{displayDb} dB</span>
          {isResonating && <span className="resonation-meter-tag">RESONATING</span>}
        </div>
        <div className="resonation-meter-track">
          <div
            className="resonation-meter-threshold"
            style={{ left: `${thresholdPct}%` }}
          />
          <div
            className={`resonation-meter-fill ${isResonating ? 'resonating' : ''}`}
            style={{ width: `${pct}%` }}
          />
          <div
            className={`resonation-meter-indicator ${isResonating ? 'resonating' : ''}`}
            style={{ left: `${pct}%` }}
          />
        </div>
      </div>
    );
  }

  // Full size (detail overlay)
  return (
    <div className={`resonation-meter full ${isResonating ? 'active' : ''}`}>
      <div className="resonation-meter-header">
        <span className="resonation-meter-title">Intensity</span>
        <span className="resonation-meter-db">{displayDb} dB</span>
        {isResonating && <span className="resonation-meter-tag">RESONATING</span>}
      </div>
      <div className="resonation-meter-track">
        <div
          className="resonation-meter-threshold"
          style={{ left: `${thresholdPct}%` }}
        >
          <span className="resonation-meter-threshold-label">-17 dB</span>
        </div>
        <div
          className={`resonation-meter-fill ${isResonating ? 'resonating' : ''}`}
          style={{ width: `${pct}%` }}
        />
        <div
          className={`resonation-meter-indicator ${isResonating ? 'resonating' : ''}`}
          style={{ left: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export { RESONATION_THRESHOLD };
