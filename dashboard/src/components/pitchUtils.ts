const NOTE_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

export interface NoteInfo {
  letter: string;
  accidental: string; // '♭' or ''
  octave: number;
  cents: number;
  fullName: string; // e.g. "Gb2"
}

export function freqToNote(freq: number): NoteInfo {
  if (freq <= 0) return { letter: '-', accidental: '', octave: 0, cents: 0, fullName: '-' };
  const midi = 69 + 12 * Math.log2(freq / 440);
  const rounded = Math.round(midi);
  const cents = (midi - rounded) * 100;
  const noteIndex = ((rounded % 12) + 12) % 12;
  const octave = Math.floor(rounded / 12) - 1;
  const name = NOTE_NAMES[noteIndex];
  const letter = name[0];
  const accidental = name.length > 1 ? '♭' : '';
  return { letter, accidental, octave, cents, fullName: `${name}${octave}` };
}

/**
 * Interpolate a frequency value from a time series at a given playback time.
 * Uses binary search + linear interpolation.
 */
export function interpolateFreq(
  times: number[],
  freqs: number[],
  currentTime: number,
  duration: number,
): number {
  if (!times.length || !freqs.length || duration <= 0) return 0;
  const tMin = times[0];
  const tMax = times[times.length - 1];
  const t = tMin + (currentTime / duration) * (tMax - tMin);
  if (t <= tMin) return freqs[0];
  if (t >= tMax) return freqs[freqs.length - 1];
  let lo = 0;
  let hi = times.length - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (times[mid] <= t) lo = mid;
    else hi = mid;
  }
  const frac = (t - times[lo]) / (times[hi] - times[lo] || 1);
  return freqs[lo] + frac * (freqs[hi] - freqs[lo]);
}
