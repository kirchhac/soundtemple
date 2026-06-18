"""
Batch Audio Analyzer for Sound Dome Project
============================================
Processes all .m4a audio files and outputs:
1. Per-file JSON with time-series frequency data (for interactive plots)
2. A combined manifest.json with summary metrics for all files
3. Spectrogram data arrays for heatmap rendering

Output is optimized for a React dashboard with Plotly.js charts.

Usage:
    python batch_analyze.py <audio_dir> <output_dir>
"""

import sys
import os
import re
import json
import math
import subprocess
import tempfile
import wave
import struct
import numpy as np
from scipy import signal
from scipy.fft import rfft, rfftfreq
from pathlib import Path


# ── Site classification from filename ──

SITE_PATTERNS = [
    (r'(?i)shih.i.zinda|shah.i.zinda', 'Shah-i-Zinda Necropolis', 'Samarkand', 'Uzbekistan'),
    (r'(?i)registrar.square|regishtran', 'Registan Square', 'Samarkand', 'Uzbekistan'),
    (r'(?i)north.star|north.pole|NS.back', 'North Star Complex', 'Khiva', 'Uzbekistan'),
    (r'(?i)khiva|khvia', 'Khiva Dome', 'Khiva', 'Uzbekistan'),
    (r'(?i)bhukara|bukhara', 'Bukhara Dome', 'Bukhara', 'Uzbekistan'),
    (r'(?i)itchan.kala', 'Itchan Kala', 'Khiva', 'Uzbekistan'),
    (r'(?i)ark.lotus', 'Ark Lotus Guest House', 'Khiva', 'Uzbekistan'),
    (r'(?i)humayun', "Humayun's Tomb", 'Delhi', 'India'),
    (r'(?i)ohm.temple', 'Ohm Temple', 'Varanasi', 'India'),
    (r'(?i)surya.temple', 'Surya Temple', 'Varanasi', 'India'),
    (r'(?i)ganga.aditya|sun.temple.varanasi', 'Ganga Aditya Sun Temple', 'Varanasi', 'India'),
    (r'(?i)brahmapuri', 'Brahmapuri Temple', 'Rajasthan', 'India'),
]

NOTE_PATTERN = re.compile(r'([A-G])(\d).?(flat|sharp)?', re.IGNORECASE)


def classify_site(filename):
    """Extract site info from filename."""
    for pattern, site, city, country in SITE_PATTERNS:
        if re.search(pattern, filename):
            return {'site': site, 'city': city, 'country': country}
    return {'site': 'Unknown', 'city': 'Unknown', 'country': 'Unknown'}


def extract_labeled_note(filename):
    """Try to extract a note label from the filename (e.g. 'G2', 'A2-flat')."""
    m = NOTE_PATTERN.search(filename)
    if m:
        note = m.group(1).upper()
        octave = m.group(2)
        modifier = m.group(3)
        if modifier and modifier.lower() == 'flat':
            note += 'b'
        elif modifier and modifier.lower() == 'sharp':
            note += '#'
        return f"{note}{octave}"
    return None


def convert_to_wav(input_path):
    tmp = tempfile.NamedTemporaryFile(suffix='.wav', delete=False)
    tmp.close()
    result = subprocess.run([
        'ffmpeg', '-y', '-i', input_path,
        '-ar', '48000', '-ac', '1', '-sample_fmt', 's16',
        tmp.name
    ], capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"ffmpeg failed: {result.stderr[:200]}")
    return tmp.name


def read_wav(wav_path):
    with wave.open(wav_path, 'r') as w:
        n_frames = w.getnframes()
        sample_rate = w.getframerate()
        n_channels = w.getnchannels()
        sample_width = w.getsampwidth()
        raw = w.readframes(n_frames)

    if sample_width == 2:
        fmt = f'<{n_frames * n_channels}h'
    elif sample_width == 4:
        fmt = f'<{n_frames * n_channels}i'
    else:
        raise ValueError(f"Unsupported sample width: {sample_width}")

    samples = np.array(struct.unpack(fmt, raw), dtype=np.float64)
    if n_channels > 1:
        samples = samples[::n_channels]
    samples /= 2 ** (sample_width * 8 - 1)
    return samples, sample_rate


def hz_to_note(freq):
    if freq <= 0:
        return {'name': '—', 'cents': 0, 'midi': 0}
    note_names = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']
    semitones_from_a4 = 12 * math.log2(freq / 440.0)
    midi_note = round(semitones_from_a4) + 69
    cents = (semitones_from_a4 - round(semitones_from_a4)) * 100
    note_idx = midi_note % 12
    octave = (midi_note // 12) - 1
    return {
        'name': f"{note_names[note_idx]}{octave}",
        'cents': round(cents, 1),
        'midi': midi_note,
    }


def analyze_file(audio_path, segment_duration=1.0, overlap=0.5):
    """
    Full analysis of one audio file.
    Returns a dict with all metrics and time-series data.
    """
    wav_path = convert_to_wav(audio_path)
    try:
        samples, sample_rate = read_wav(wav_path)
    finally:
        os.unlink(wav_path)

    duration = len(samples) / sample_rate
    seg_samples = int(segment_duration * sample_rate)
    hop_samples = int(seg_samples * (1 - overlap))

    # Time-series arrays for the dashboard
    times = []
    dominant_freqs = []
    rms_levels = []
    peak_magnitudes = []
    all_spectra = []
    top3_per_segment = []

    freq_axis = None
    pos = 0

    while pos + seg_samples <= len(samples):
        segment = samples[pos:pos + seg_samples]
        t_center = (pos + seg_samples / 2) / sample_rate

        windowed = segment * np.hanning(len(segment))
        spectrum = np.abs(rfft(windowed))
        freqs = rfftfreq(len(windowed), 1.0 / sample_rate)

        # 30-500 Hz band
        mask = (freqs >= 30) & (freqs <= 500)
        freqs_band = freqs[mask]
        spectrum_band = spectrum[mask]

        if freq_axis is None:
            freq_axis = freqs_band.tolist()

        if len(spectrum_band) == 0:
            pos += hop_samples
            continue

        rms = np.sqrt(np.mean(segment ** 2))
        rms_db = 20 * math.log10(rms + 1e-10)

        peak_idx = np.argmax(spectrum_band)
        peak_freq = float(freqs_band[peak_idx])
        peak_mag = float(spectrum_band[peak_idx])

        # Top 3 peaks
        peak_indices = signal.argrelextrema(spectrum_band, np.greater, order=5)[0]
        if len(peak_indices) == 0:
            peak_indices = [np.argmax(spectrum_band)]
        sorted_peaks = sorted(peak_indices, key=lambda i: spectrum_band[i], reverse=True)[:3]
        top3 = [{'freq': round(float(freqs_band[i]), 1), 'mag': round(float(spectrum_band[i]), 1)} for i in sorted_peaks]

        times.append(round(t_center, 2))
        dominant_freqs.append(round(peak_freq, 1))
        rms_levels.append(round(rms_db, 1))
        peak_magnitudes.append(round(peak_mag, 1))
        top3_per_segment.append(top3)

        # Downsample spectrum for spectrogram (every 2nd bin to save space)
        all_spectra.append(spectrum_band[::2].tolist())

        pos += hop_samples

    if not times:
        return None

    # Time-averaged spectrum
    avg_spectrum = np.mean(np.array([spectrum_band for spectrum_band in
                                       [np.abs(rfft(samples[i:i+seg_samples] * np.hanning(seg_samples)))[mask]
                                        for i in range(0, len(samples) - seg_samples, hop_samples)]]),
                            axis=0) if len(samples) > seg_samples else np.zeros(1)

    # Find peaks in averaged spectrum
    avg_peak_indices = signal.argrelextrema(avg_spectrum, np.greater, order=10)[0]
    if len(avg_peak_indices) == 0:
        avg_peak_indices = [np.argmax(avg_spectrum)]
    top_avg = sorted(avg_peak_indices, key=lambda i: avg_spectrum[i], reverse=True)[:8]

    spectral_peaks = []
    for i in top_avg:
        f = float(freqs_band[i])
        m = float(avg_spectrum[i])
        note = hz_to_note(f)
        spectral_peaks.append({
            'freq_hz': round(f, 1),
            'magnitude': round(m, 1),
            'note': note['name'],
            'cents': note['cents'],
        })

    # Overall stats
    dom_freq_arr = np.array(dominant_freqs)
    weighted_avg = float(np.average(dom_freq_arr, weights=np.array(peak_magnitudes)))
    note_info = hz_to_note(weighted_avg)

    # Strongest moment
    strongest_idx = int(np.argmax(peak_magnitudes))

    # Harmonic analysis: check if peaks form integer ratios from fundamental
    if spectral_peaks:
        fundamental = spectral_peaks[0]['freq_hz']
        for p in spectral_peaks:
            ratio = p['freq_hz'] / fundamental if fundamental > 0 else 0
            p['ratio_to_fundamental'] = round(ratio, 2)

    return {
        'dominant_freq_hz': round(weighted_avg, 1),
        'dominant_note': note_info['name'],
        'dominant_cents': note_info['cents'],
        'freq_std_hz': round(float(np.std(dom_freq_arr)), 1),
        'freq_stability': 'very_stable' if np.std(dom_freq_arr) < 5 else
                          'stable' if np.std(dom_freq_arr) < 15 else
                          'moderate' if np.std(dom_freq_arr) < 40 else 'variable',
        'duration_s': round(duration, 1),
        'strongest_time_s': times[strongest_idx],
        'strongest_freq_hz': dominant_freqs[strongest_idx],
        'strongest_magnitude': peak_magnitudes[strongest_idx],
        'spectral_peaks': spectral_peaks,
        'time_series': {
            'times': times,
            'dominant_freqs': dominant_freqs,
            'rms_levels': rms_levels,
            'peak_magnitudes': peak_magnitudes,
            'top3_per_segment': top3_per_segment,
        },
        'spectrogram': {
            'freq_axis': freq_axis[::2] if freq_axis else [],
            'time_axis': times,
            'data': all_spectra,
        },
        'avg_spectrum': {
            'freqs': [round(float(f), 1) for f in freqs_band],
            'magnitudes': [round(float(m), 1) for m in avg_spectrum],
        },
    }


def main():
    if len(sys.argv) < 3:
        print("Usage: python batch_analyze.py <audio_dir> <output_dir>")
        sys.exit(1)

    audio_dir = Path(sys.argv[1])
    output_dir = Path(sys.argv[2])
    output_dir.mkdir(parents=True, exist_ok=True)

    audio_files = sorted(audio_dir.glob('*.m4a'))
    print(f"Found {len(audio_files)} audio files in {audio_dir}\n")

    manifest = []
    errors = []

    for idx, audio_path in enumerate(audio_files):
        filename = audio_path.name
        file_id = re.sub(r'[^a-zA-Z0-9]', '_', audio_path.stem).strip('_')

        site_info = classify_site(filename)
        labeled_note = extract_labeled_note(filename)

        print(f"[{idx+1}/{len(audio_files)}] {filename}")
        print(f"  Site: {site_info['site']} ({site_info['city']}, {site_info['country']})")
        if labeled_note:
            print(f"  Labeled note: {labeled_note}")

        try:
            result = analyze_file(str(audio_path))
            if result is None:
                print(f"  SKIP: no analyzable content\n")
                errors.append({'file': filename, 'error': 'no content'})
                continue

            # Save per-file JSON (with full time-series for interactive plots)
            file_json = {
                'id': file_id,
                'filename': filename,
                **site_info,
                'labeled_note': labeled_note,
                **result,
            }
            per_file_path = output_dir / f"{file_id}.json"
            with open(per_file_path, 'w') as f:
                json.dump(file_json, f)

            # Manifest entry (summary only, no large arrays)
            manifest_entry = {
                'id': file_id,
                'filename': filename,
                **site_info,
                'labeled_note': labeled_note,
                'dominant_freq_hz': result['dominant_freq_hz'],
                'dominant_note': result['dominant_note'],
                'dominant_cents': result['dominant_cents'],
                'freq_std_hz': result['freq_std_hz'],
                'freq_stability': result['freq_stability'],
                'duration_s': result['duration_s'],
                'strongest_time_s': result['strongest_time_s'],
                'strongest_freq_hz': result['strongest_freq_hz'],
                'strongest_magnitude': result['strongest_magnitude'],
                'spectral_peaks': result['spectral_peaks'][:3],  # top 3 only
            }
            manifest.append(manifest_entry)

            print(f"  → {result['dominant_freq_hz']} Hz ({result['dominant_note']} {result['dominant_cents']:+.1f}c) "
                  f"| stability: {result['freq_stability']} | duration: {result['duration_s']}s")

        except Exception as e:
            print(f"  ERROR: {e}")
            errors.append({'file': filename, 'error': str(e)})

        print()

    # Save manifest
    manifest_path = output_dir / 'manifest.json'
    with open(manifest_path, 'w') as f:
        json.dump({
            'total_files': len(audio_files),
            'analyzed': len(manifest),
            'errors': len(errors),
            'files': manifest,
            'error_list': errors,
        }, f, indent=2)

    print(f"{'='*60}")
    print(f"BATCH COMPLETE")
    print(f"  Analyzed: {len(manifest)}/{len(audio_files)}")
    print(f"  Errors: {len(errors)}")
    print(f"  Manifest: {manifest_path}")
    print(f"  Per-file JSON: {output_dir}/")

    # Print frequency summary
    if manifest:
        print(f"\n{'='*60}")
        print("FREQUENCY SUMMARY BY SITE")
        print(f"{'='*60}")
        by_site = {}
        for m in manifest:
            key = f"{m['site']} ({m['city']})"
            if key not in by_site:
                by_site[key] = []
            by_site[key].append(m['dominant_freq_hz'])

        for site, freqs in sorted(by_site.items()):
            avg = sum(freqs) / len(freqs)
            note = hz_to_note(avg)
            print(f"  {site}:")
            print(f"    n={len(freqs)}, avg={avg:.1f} Hz ({note['name']} {note['cents']:+.1f}c)")
            print(f"    range: {min(freqs):.1f}–{max(freqs):.1f} Hz")


if __name__ == '__main__':
    main()
