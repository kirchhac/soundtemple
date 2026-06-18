"""
Sound Dome Audio Analyzer
=========================
Analyzes field recordings from dome interiors to extract:
1. Dominant frequencies over time (spectrogram)
2. Peak resonant frequency and when it occurs
3. Intensity envelope — when resonance is strongest
4. Frequency stability analysis

Requires: numpy, scipy, matplotlib, ffmpeg (for m4a->wav conversion)

Usage:
    python analyze_audio.py <path_to_audio>
"""

import sys
import os
import subprocess
import tempfile
import wave
import struct
import math
import numpy as np
from scipy import signal
from scipy.fft import rfft, rfftfreq
import matplotlib
matplotlib.use('Agg')  # non-interactive backend
import matplotlib.pyplot as plt


def convert_to_wav(input_path):
    """Convert m4a/mp3/etc to wav using ffmpeg."""
    tmp = tempfile.NamedTemporaryFile(suffix='.wav', delete=False)
    tmp.close()
    subprocess.run([
        'ffmpeg', '-y', '-i', input_path,
        '-ar', '48000', '-ac', '1', '-sample_fmt', 's16',
        tmp.name
    ], capture_output=True)
    return tmp.name


def read_wav(wav_path):
    """Read wav file into numpy array."""
    with wave.open(wav_path, 'r') as w:
        n_frames = w.getnframes()
        sample_rate = w.getframerate()
        n_channels = w.getnchannels()
        sample_width = w.getsampwidth()
        raw = w.readframes(n_frames)

    if sample_width == 2:
        fmt = f'<{n_frames * n_channels}h'
        samples = np.array(struct.unpack(fmt, raw), dtype=np.float64)
    elif sample_width == 4:
        fmt = f'<{n_frames * n_channels}i'
        samples = np.array(struct.unpack(fmt, raw), dtype=np.float64)
    else:
        raise ValueError(f"Unsupported sample width: {sample_width}")

    if n_channels > 1:
        samples = samples[::n_channels]  # take first channel

    # Normalize to [-1, 1]
    samples /= 2 ** (sample_width * 8 - 1)
    return samples, sample_rate


def hz_to_note(freq):
    """Convert frequency in Hz to musical note name + cents offset."""
    if freq <= 0:
        return "—"
    note_names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
    # A4 = 440 Hz
    semitones_from_a4 = 12 * math.log2(freq / 440.0)
    midi_note = round(semitones_from_a4) + 69
    cents = (semitones_from_a4 - round(semitones_from_a4)) * 100

    note_idx = midi_note % 12
    octave = (midi_note // 12) - 1
    note_name = note_names[note_idx]

    # Use flats for common notes
    flat_map = {'C#': 'Db', 'D#': 'Eb', 'F#': 'Gb', 'G#': 'Ab', 'A#': 'Bb'}
    if note_name in flat_map:
        note_display = f"{note_name}/{flat_map[note_name]}"
    else:
        note_display = note_name

    return f"{note_display}{octave} ({cents:+.1f}c)"


def analyze_segments(samples, sample_rate, segment_duration=2.0, overlap=0.5):
    """
    Analyze audio in overlapping segments.
    Returns time-series of dominant frequencies and their intensities.
    """
    seg_samples = int(segment_duration * sample_rate)
    hop_samples = int(seg_samples * (1 - overlap))

    results = []
    pos = 0

    while pos + seg_samples <= len(samples):
        segment = samples[pos:pos + seg_samples]
        t_center = (pos + seg_samples / 2) / sample_rate

        # Apply Hanning window
        windowed = segment * np.hanning(len(segment))

        # FFT
        spectrum = np.abs(rfft(windowed))
        freqs = rfftfreq(len(windowed), 1.0 / sample_rate)

        # Focus on 30-500 Hz range (dome resonance range)
        mask = (freqs >= 30) & (freqs <= 500)
        freqs_band = freqs[mask]
        spectrum_band = spectrum[mask]

        if len(spectrum_band) == 0:
            pos += hop_samples
            continue

        # RMS energy in the segment
        rms = np.sqrt(np.mean(segment ** 2))
        rms_db = 20 * math.log10(rms + 1e-10)

        # Peak frequency
        peak_idx = np.argmax(spectrum_band)
        peak_freq = freqs_band[peak_idx]
        peak_magnitude = spectrum_band[peak_idx]

        # Top 5 peaks (find local maxima)
        peak_indices = signal.argrelextrema(spectrum_band, np.greater, order=5)[0]
        if len(peak_indices) == 0:
            peak_indices = [np.argmax(spectrum_band)]

        top_peaks = sorted(peak_indices, key=lambda i: spectrum_band[i], reverse=True)[:5]
        top_freqs = [(freqs_band[i], spectrum_band[i]) for i in top_peaks]

        results.append({
            'time_s': round(t_center, 2),
            'rms_db': round(rms_db, 1),
            'peak_freq_hz': round(peak_freq, 1),
            'peak_magnitude': round(peak_magnitude, 1),
            'top_freqs': top_freqs,
            'spectrum_band': spectrum_band,
            'freqs_band': freqs_band,
        })

        pos += hop_samples

    return results


def find_resonance_peaks(results):
    """Identify the moments of strongest resonance."""
    if not results:
        return []

    # Sort by peak magnitude (strongest spectral peak)
    by_intensity = sorted(results, key=lambda r: r['peak_magnitude'], reverse=True)
    return by_intensity[:10]  # top 10 moments


def compute_average_spectrum(results):
    """Compute the time-averaged spectrum across all segments."""
    if not results:
        return None, None
    all_spectra = np.array([r['spectrum_band'] for r in results])
    avg_spectrum = np.mean(all_spectra, axis=0)
    freqs = results[0]['freqs_band']
    return freqs, avg_spectrum


def generate_plots(results, avg_freqs, avg_spectrum, output_dir, filename_stem):
    """Generate analysis plots."""

    fig, axes = plt.subplots(4, 1, figsize=(14, 16))
    fig.suptitle(f'Sound Dome Audio Analysis: {filename_stem}', fontsize=14, fontweight='bold')

    times = [r['time_s'] for r in results]
    peak_freqs = [r['peak_freq_hz'] for r in results]
    rms_dbs = [r['rms_db'] for r in results]
    peak_mags = [r['peak_magnitude'] for r in results]

    # 1. Dominant frequency over time
    ax = axes[0]
    ax.scatter(times, peak_freqs, c=peak_mags, cmap='hot', s=8, alpha=0.7)
    ax.set_ylabel('Dominant Freq (Hz)')
    ax.set_title('Dominant Frequency Over Time')
    ax.set_ylim(30, 300)
    ax.axhline(y=93, color='cyan', linestyle='--', alpha=0.7, label='93 Hz (Gb2)')
    ax.axhline(y=110, color='green', linestyle='--', alpha=0.5, label='110 Hz (A2)')
    ax.axhline(y=120, color='orange', linestyle='--', alpha=0.5, label='120 Hz (Bb2)')
    ax.axhline(y=233, color='red', linestyle='--', alpha=0.5, label='233 Hz (Bb3)')
    ax.legend(loc='upper right', fontsize=8)
    cbar = plt.colorbar(ax.collections[0], ax=ax)
    cbar.set_label('Magnitude')

    # 2. Intensity (RMS) over time
    ax = axes[1]
    ax.plot(times, rms_dbs, color='steelblue', linewidth=1)
    ax.fill_between(times, min(rms_dbs), rms_dbs, alpha=0.3, color='steelblue')
    ax.set_ylabel('RMS Level (dB)')
    ax.set_title('Intensity Over Time (louder = more resonance energy)')

    # Mark top 5 intensity moments
    top5 = sorted(range(len(peak_mags)), key=lambda i: peak_mags[i], reverse=True)[:5]
    for rank, idx in enumerate(top5):
        ax.axvline(x=times[idx], color='red', alpha=0.5, linestyle=':')
        ax.annotate(f'#{rank+1}', (times[idx], rms_dbs[idx]), fontsize=8, color='red')

    # 3. Peak spectral magnitude over time
    ax = axes[2]
    ax.plot(times, peak_mags, color='darkred', linewidth=1)
    ax.fill_between(times, 0, peak_mags, alpha=0.2, color='darkred')
    ax.set_ylabel('Peak Spectral Mag')
    ax.set_title('Peak Resonance Strength Over Time')

    # 4. Time-averaged spectrum
    ax = axes[3]
    ax.plot(avg_freqs, avg_spectrum, color='purple', linewidth=1)
    ax.fill_between(avg_freqs, 0, avg_spectrum, alpha=0.2, color='purple')
    ax.set_xlabel('Frequency (Hz)')
    ax.set_ylabel('Avg Magnitude')
    ax.set_title('Time-Averaged Spectrum (30–500 Hz)')

    # Mark known reference frequencies
    for freq, label, color in [(93, 'Gb2\n93Hz', 'cyan'), (110, 'A2\n110Hz', 'green'),
                                (120, 'Bb2\n120Hz', 'orange'), (233, 'Bb3\n233Hz', 'red')]:
        ax.axvline(x=freq, color=color, linestyle='--', alpha=0.6)
        ax.annotate(label, (freq, max(avg_spectrum) * 0.9), fontsize=7, color=color,
                    ha='center', rotation=0)

    # Find and annotate actual peaks in averaged spectrum
    peak_indices = signal.argrelextrema(avg_spectrum, np.greater, order=10)[0]
    top_avg_peaks = sorted(peak_indices, key=lambda i: avg_spectrum[i], reverse=True)[:5]
    for i in top_avg_peaks:
        ax.annotate(f'{avg_freqs[i]:.0f} Hz', (avg_freqs[i], avg_spectrum[i]),
                    textcoords="offset points", xytext=(5, 10), fontsize=8,
                    arrowprops=dict(arrowstyle='->', color='black', lw=0.5))

    for ax in axes:
        ax.grid(True, alpha=0.3)

    axes[-1].set_xlabel('Time (s)')

    plt.tight_layout()
    plot_path = os.path.join(output_dir, f'{filename_stem}_analysis.png')
    plt.savefig(plot_path, dpi=150, bbox_inches='tight')
    plt.close()
    return plot_path


def main():
    if len(sys.argv) < 2:
        print("Usage: python analyze_audio.py <path_to_audio>")
        sys.exit(1)

    audio_path = sys.argv[1]
    filename_stem = os.path.splitext(os.path.basename(audio_path))[0]
    output_dir = os.path.dirname(audio_path)

    print(f"Analyzing: {audio_path}")
    print(f"Output dir: {output_dir}\n")

    # Convert to wav
    print("Converting to WAV...")
    wav_path = convert_to_wav(audio_path)

    # Read samples
    print("Reading audio data...")
    samples, sample_rate = read_wav(wav_path)
    duration = len(samples) / sample_rate
    print(f"  Sample rate: {sample_rate} Hz")
    print(f"  Duration: {duration:.1f}s")
    print(f"  Samples: {len(samples):,}")

    # Analyze in segments
    print("\nAnalyzing frequency content (2s windows, 50% overlap)...")
    results = analyze_segments(samples, sample_rate, segment_duration=2.0, overlap=0.5)
    print(f"  Segments analyzed: {len(results)}")

    # Overall dominant frequency
    all_peak_freqs = [r['peak_freq_hz'] for r in results]
    freq_counts = {}
    for f in all_peak_freqs:
        # Bin to nearest 1 Hz
        binned = round(f)
        freq_counts[binned] = freq_counts.get(binned, 0) + 1

    most_common_freq = max(freq_counts, key=freq_counts.get)
    freq_occurrences = freq_counts[most_common_freq]

    print(f"\n{'='*70}")
    print("OVERALL DOMINANT FREQUENCY")
    print(f"{'='*70}")
    print(f"  Most frequent peak: {most_common_freq} Hz — {hz_to_note(most_common_freq)}")
    print(f"  Appears in {freq_occurrences}/{len(results)} segments ({100*freq_occurrences/len(results):.0f}%)")

    # Weighted average frequency (weighted by magnitude)
    weighted_sum = sum(r['peak_freq_hz'] * r['peak_magnitude'] for r in results)
    weight_total = sum(r['peak_magnitude'] for r in results)
    weighted_avg_freq = weighted_sum / weight_total if weight_total > 0 else 0
    print(f"  Magnitude-weighted avg: {weighted_avg_freq:.1f} Hz — {hz_to_note(weighted_avg_freq)}")

    # Average spectrum peaks
    avg_freqs, avg_spectrum = compute_average_spectrum(results)
    if avg_freqs is not None:
        peak_indices = signal.argrelextrema(avg_spectrum, np.greater, order=10)[0]
        top_avg_peaks = sorted(peak_indices, key=lambda i: avg_spectrum[i], reverse=True)[:8]

        print(f"\n{'='*70}")
        print("TIME-AVERAGED SPECTRAL PEAKS")
        print(f"{'='*70}")
        print(f"  {'Rank':>4}  {'Freq (Hz)':>10}  {'Magnitude':>10}  {'Note':>20}")
        print(f"  {'-'*50}")
        for rank, i in enumerate(top_avg_peaks):
            print(f"  {rank+1:>4}  {avg_freqs[i]:>10.1f}  {avg_spectrum[i]:>10.1f}  {hz_to_note(avg_freqs[i]):>20}")

    # Resonance intensity timeline
    print(f"\n{'='*70}")
    print("TOP 10 MOMENTS OF STRONGEST RESONANCE")
    print(f"{'='*70}")
    top_moments = find_resonance_peaks(results)
    print(f"  {'Rank':>4}  {'Time':>8}  {'Freq (Hz)':>10}  {'Magnitude':>10}  {'RMS (dB)':>10}  {'Note':>20}")
    print(f"  {'-'*70}")
    for rank, r in enumerate(top_moments):
        t = r['time_s']
        mins = int(t // 60)
        secs = t % 60
        print(f"  {rank+1:>4}  {mins:>2d}:{secs:05.2f}  {r['peak_freq_hz']:>10.1f}  "
              f"{r['peak_magnitude']:>10.1f}  {r['rms_db']:>10.1f}  {hz_to_note(r['peak_freq_hz']):>20}")

    # Frequency stability analysis
    print(f"\n{'='*70}")
    print("FREQUENCY STABILITY")
    print(f"{'='*70}")
    freq_std = np.std(all_peak_freqs)
    freq_mean = np.mean(all_peak_freqs)
    print(f"  Mean dominant freq: {freq_mean:.1f} Hz")
    print(f"  Std deviation: {freq_std:.1f} Hz")
    print(f"  Coefficient of variation: {100*freq_std/freq_mean:.1f}%")
    if freq_std < 5:
        print(f"  Assessment: VERY STABLE — dome locks voice to resonant frequency")
    elif freq_std < 15:
        print(f"  Assessment: STABLE — clear resonant mode with some drift")
    elif freq_std < 40:
        print(f"  Assessment: MODERATE — multiple modes or vocal exploration")
    else:
        print(f"  Assessment: VARIABLE — broad frequency content, no single dominant mode")

    # Generate plots
    print(f"\nGenerating analysis plots...")
    plot_path = generate_plots(results, avg_freqs, avg_spectrum, output_dir, filename_stem)
    print(f"  Plot saved: {plot_path}")

    # Clean up temp wav
    os.unlink(wav_path)
    print("\nDone.")


if __name__ == '__main__':
    main()
