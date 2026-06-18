"""
Frog Chorus Analysis
====================

Tests whether call timing in a multi-frog chorus is non-random
(i.e., self-organized) as a necessary condition for the
entropy-reduction-as-communication hypothesis.

See ../DESIGN.md for the experimental framing.

Pipeline:
  1. m4a -> mono wav via ffmpeg
  2. Spectrogram + band-energy inspection
  3. Per-voice (per-band) onset detection
  4. Per-voice inter-call interval (ICI) analysis vs Poisson
  5. Autocorrelation of binned call train
  6. Cross-voice cross-correlation (turn-taking / synchrony)
  7. Surrogate-data significance tests:
     - Poisson surrogates (matched rate)
     - Shuffled-ICI surrogates (preserves ICI marginal, destroys order)
  8. Permutation entropy of ICI sequence

Outputs per recording:
  output/<name>/spectrogram.png
  output/<name>/onsets.png
  output/<name>/ici_distributions.png
  output/<name>/autocorrelation.png
  output/<name>/cross_correlation.png
  output/<name>/surrogate_test.png
  output/<name>/results.json

Usage:
  python analyze_chorus.py <path_to_audio.m4a> [more.m4a ...]
"""

import json
import math
import os
import struct
import subprocess
import sys
import tempfile
import wave
from itertools import combinations, permutations
from pathlib import Path

import numpy as np
from scipy import signal
from scipy.stats import kstest, expon

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt


RNG = np.random.default_rng(42)

# Voice bands tuned for typical anuran calls. The lowest band catches large
# bullfrog calls (broad <300 Hz); the upper bands catch smaller frogs and
# treefrogs. We inspect the spectrogram before trusting these bands and
# annotate them in the plot.
VOICE_BANDS_HZ = [
    ("V1_low",      80,   300),   # bullfrog / large-bodied
    ("V2_low_mid",  300,  800),   # mid-sized frog
    ("V3_mid",      800,  2000),  # smaller frog
    ("V4_high",     2000, 5000),  # treefrog / high-pitched
]

BIN_MS = 50           # autocorrelation bin size
MAX_LAG_S = 5.0       # autocorrelation max lag
REFRACTORY_MS = 120   # min spacing between detected onsets in a voice
N_SURROGATES = 500
PE_ORDER = 3          # permutation entropy embedding dimension


# ---------------------------------------------------------------------------
# IO
# ---------------------------------------------------------------------------

def to_wav(input_path: str, sr: int = 22050) -> str:
    """Convert input audio to a temporary mono wav at the given sample rate."""
    tmp = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
    tmp.close()
    result = subprocess.run(
        [
            "ffmpeg", "-y", "-i", input_path,
            "-ar", str(sr), "-ac", "1", "-sample_fmt", "s16",
            tmp.name,
        ],
        capture_output=True,
    )
    if result.returncode != 0:
        raise RuntimeError(f"ffmpeg failed: {result.stderr.decode()[-400:]}")
    return tmp.name


def read_wav(wav_path: str):
    """Read a mono 16-bit wav into a float numpy array in [-1, 1]."""
    with wave.open(wav_path, "r") as w:
        n_frames = w.getnframes()
        sr = w.getframerate()
        sw = w.getsampwidth()
        raw = w.readframes(n_frames)
    if sw != 2:
        raise ValueError(f"expected 16-bit wav, got sample width {sw}")
    samples = np.array(struct.unpack(f"<{n_frames}h", raw), dtype=np.float64)
    samples /= 32768.0
    return samples, sr


# ---------------------------------------------------------------------------
# Spectrogram
# ---------------------------------------------------------------------------

def plot_spectrogram(x, sr, out_path):
    f, t, Sxx = signal.spectrogram(
        x, fs=sr, nperseg=2048, noverlap=1536, scaling="spectrum"
    )
    Sxx_db = 10.0 * np.log10(Sxx + 1e-12)
    fig, ax = plt.subplots(figsize=(12, 5))
    ax.pcolormesh(t, f, Sxx_db, shading="auto", cmap="magma", vmin=-90, vmax=-30)
    ax.set_ylim(0, 6000)
    ax.set_xlabel("time (s)")
    ax.set_ylabel("Hz")
    ax.set_title("Spectrogram with voice bands")
    for name, lo, hi in VOICE_BANDS_HZ:
        ax.axhline(lo, color="cyan", lw=0.5, ls="--", alpha=0.6)
        ax.axhline(hi, color="cyan", lw=0.5, ls="--", alpha=0.6)
        ax.text(t[-1] * 0.99, (lo + hi) / 2, name, color="cyan",
                ha="right", va="center", fontsize=8)
    fig.tight_layout()
    fig.savefig(out_path, dpi=120)
    plt.close(fig)


# ---------------------------------------------------------------------------
# Onset detection
# ---------------------------------------------------------------------------

def bandpass(x, sr, lo, hi, order=4):
    nyq = sr / 2.0
    sos = signal.butter(order, [lo / nyq, hi / nyq], btype="band", output="sos")
    return signal.sosfiltfilt(sos, x)


def envelope(x, sr, smooth_ms=30.0):
    """Hilbert envelope, low-pass smoothed."""
    analytic = signal.hilbert(x)
    env = np.abs(analytic)
    win = max(1, int(sr * smooth_ms / 1000.0))
    kernel = np.ones(win) / win
    return np.convolve(env, kernel, mode="same")


def detect_onsets(env, sr, refractory_ms=REFRACTORY_MS, k_mad=6.0):
    """Adaptive threshold = median + k * MAD; refractory by sample count."""
    med = np.median(env)
    mad = np.median(np.abs(env - med)) + 1e-12
    thresh = med + k_mad * mad
    distance = int(sr * refractory_ms / 1000.0)
    peaks, _ = signal.find_peaks(env, height=thresh, distance=distance)
    return peaks / sr  # seconds


def detect_voices(x, sr):
    voices = {}
    for name, lo, hi in VOICE_BANDS_HZ:
        xb = bandpass(x, sr, lo, hi)
        env = envelope(xb, sr)
        onsets = detect_onsets(env, sr)
        voices[name] = {
            "band_hz": (lo, hi),
            "onsets_s": onsets.tolist(),
            "n_calls": int(len(onsets)),
            "envelope": env,
        }
    return voices


def plot_onsets(x, sr, voices, out_path, duration_s):
    fig, axes = plt.subplots(len(voices) + 1, 1, figsize=(12, 8), sharex=True)
    t = np.arange(len(x)) / sr
    axes[0].plot(t, x, color="0.4", lw=0.4)
    axes[0].set_ylabel("waveform")
    axes[0].set_title("Detected onsets per voice band")
    for ax, (name, info) in zip(axes[1:], voices.items()):
        env = info["envelope"]
        te = np.arange(len(env)) / sr
        ax.plot(te, env, color="steelblue", lw=0.5)
        for o in info["onsets_s"]:
            ax.axvline(o, color="crimson", lw=0.6, alpha=0.5)
        ax.set_ylabel(f"{name}\n{info['band_hz'][0]}–{info['band_hz'][1]} Hz\n"
                      f"n={info['n_calls']}", fontsize=8)
    axes[-1].set_xlabel("time (s)")
    axes[-1].set_xlim(0, duration_s)
    fig.tight_layout()
    fig.savefig(out_path, dpi=120)
    plt.close(fig)


# ---------------------------------------------------------------------------
# ICI analysis
# ---------------------------------------------------------------------------

def ici_stats(onsets_s):
    if len(onsets_s) < 5:
        return None
    icis = np.diff(np.asarray(onsets_s))
    mean = float(icis.mean())
    std = float(icis.std())
    cv = std / mean if mean > 0 else float("nan")
    # KS test vs exponential with fitted scale
    scale = mean
    ks_stat, ks_p = kstest(icis, "expon", args=(0, scale))
    return {
        "n_intervals": int(len(icis)),
        "mean_s": mean,
        "std_s": std,
        "cv": float(cv),
        "ks_stat_vs_exp": float(ks_stat),
        "ks_p_vs_exp": float(ks_p),
        "icis": icis,
    }


def plot_ici_distributions(voices_ici, out_path):
    valid = [(n, s) for n, s in voices_ici.items() if s is not None]
    if not valid:
        return
    fig, axes = plt.subplots(1, len(valid), figsize=(4 * len(valid), 4),
                             squeeze=False)
    for ax, (name, s) in zip(axes[0], valid):
        icis = s["icis"]
        ax.hist(icis, bins=30, density=True, color="steelblue", alpha=0.7,
                label="observed")
        xx = np.linspace(0, icis.max() * 1.05, 200)
        ax.plot(xx, expon.pdf(xx, scale=s["mean_s"]), "r--",
                label=f"exp(scale={s['mean_s']:.2f})")
        ax.set_title(f"{name}\nCV={s['cv']:.2f}  KS p={s['ks_p_vs_exp']:.3g}")
        ax.set_xlabel("inter-call interval (s)")
        ax.set_ylabel("density")
        ax.legend(fontsize=7)
    fig.tight_layout()
    fig.savefig(out_path, dpi=120)
    plt.close(fig)


# ---------------------------------------------------------------------------
# Spike-train binning, autocorrelation, cross-correlation
# ---------------------------------------------------------------------------

def bin_train(onsets_s, duration_s, bin_ms=BIN_MS):
    n_bins = int(np.ceil(duration_s * 1000.0 / bin_ms))
    train = np.zeros(n_bins, dtype=np.float64)
    if len(onsets_s) == 0:
        return train
    idx = np.minimum((np.asarray(onsets_s) * 1000.0 / bin_ms).astype(int),
                     n_bins - 1)
    np.add.at(train, idx, 1.0)
    return train


def autocorrelation(train, max_lag_bins):
    """Unbiased autocorrelation, normalized to [-1, 1]."""
    x = train - train.mean()
    denom = (x * x).sum()
    if denom <= 0:
        return np.zeros(max_lag_bins + 1)
    ac = np.zeros(max_lag_bins + 1)
    for k in range(max_lag_bins + 1):
        if k == 0:
            ac[k] = 1.0
        else:
            ac[k] = (x[:-k] * x[k:]).sum() / denom
    return ac


def cross_correlation(a, b, max_lag_bins):
    a = a - a.mean()
    b = b - b.mean()
    denom = math.sqrt((a * a).sum() * (b * b).sum())
    if denom <= 0:
        return np.zeros(2 * max_lag_bins + 1)
    lags = np.arange(-max_lag_bins, max_lag_bins + 1)
    cc = np.zeros(len(lags))
    for i, k in enumerate(lags):
        if k == 0:
            cc[i] = (a * b).sum() / denom
        elif k > 0:
            cc[i] = (a[:-k] * b[k:]).sum() / denom
        else:
            cc[i] = (a[-k:] * b[:k]).sum() / denom
    return cc


def plot_autocorr(voices, duration_s, out_path):
    max_lag_bins = int(MAX_LAG_S * 1000.0 / BIN_MS)
    lags_s = np.arange(max_lag_bins + 1) * BIN_MS / 1000.0
    fig, ax = plt.subplots(figsize=(10, 5))
    for name, info in voices.items():
        train = bin_train(info["onsets_s"], duration_s)
        ac = autocorrelation(train, max_lag_bins)
        ac[0] = np.nan  # mask self-correlation
        ax.plot(lags_s, ac, label=name, lw=1.2)
    ax.axhline(0, color="0.5", lw=0.5)
    ax.set_xlabel("lag (s)")
    ax.set_ylabel("autocorrelation")
    ax.set_title("Per-voice autocorrelation (lag=0 masked)")
    ax.legend(fontsize=8)
    fig.tight_layout()
    fig.savefig(out_path, dpi=120)
    plt.close(fig)


def plot_cross_corr(voices, duration_s, out_path):
    voice_names = list(voices.keys())
    trains = {n: bin_train(voices[n]["onsets_s"], duration_s)
              for n in voice_names}
    max_lag_bins = int(2.0 * 1000.0 / BIN_MS)
    lags_s = np.arange(-max_lag_bins, max_lag_bins + 1) * BIN_MS / 1000.0
    pairs = list(combinations(voice_names, 2))
    if not pairs:
        return
    fig, axes = plt.subplots(1, len(pairs), figsize=(4 * len(pairs), 4),
                             squeeze=False)
    for ax, (a, b) in zip(axes[0], pairs):
        cc = cross_correlation(trains[a], trains[b], max_lag_bins)
        ax.plot(lags_s, cc, color="purple", lw=1.0)
        ax.axhline(0, color="0.5", lw=0.5)
        ax.axvline(0, color="0.5", lw=0.5)
        ax.set_title(f"{a} × {b}")
        ax.set_xlabel("lag (s)")
        ax.set_ylabel("cross-corr")
    fig.tight_layout()
    fig.savefig(out_path, dpi=120)
    plt.close(fig)


# ---------------------------------------------------------------------------
# Surrogate-data significance test
# ---------------------------------------------------------------------------

def poisson_surrogate(n_events: int, duration_s: float):
    if n_events <= 0:
        return np.array([])
    onsets = RNG.uniform(0.0, duration_s, size=n_events)
    onsets.sort()
    return onsets


def shuffled_ici_surrogate(onsets_s):
    if len(onsets_s) < 2:
        return np.asarray(onsets_s, dtype=float).copy()
    onsets = np.asarray(onsets_s, dtype=float)
    icis = np.diff(onsets)
    RNG.shuffle(icis)
    return np.concatenate([[onsets[0]], onsets[0] + np.cumsum(icis)])


def max_nonzero_autocorr(onsets_s, duration_s):
    train = bin_train(onsets_s, duration_s)
    max_lag_bins = int(MAX_LAG_S * 1000.0 / BIN_MS)
    ac = autocorrelation(train, max_lag_bins)
    if len(ac) <= 1:
        return 0.0
    return float(np.nanmax(ac[1:]))


def surrogate_test(name, info, duration_s):
    """Two-tailed p: fraction of surrogates with autocorr peak >= observed.

    Returns dict with observed peak and Poisson + shuffled-ICI p-values.
    """
    onsets = info["onsets_s"]
    if len(onsets) < 10:
        return {
            "voice": name,
            "observed_peak": None,
            "p_vs_poisson": None,
            "p_vs_shuffled_ici": None,
            "note": "too few calls (n<10)",
        }
    observed = max_nonzero_autocorr(onsets, duration_s)

    poisson_peaks = np.array([
        max_nonzero_autocorr(poisson_surrogate(len(onsets), duration_s),
                             duration_s)
        for _ in range(N_SURROGATES)
    ])
    shuffled_peaks = np.array([
        max_nonzero_autocorr(shuffled_ici_surrogate(onsets), duration_s)
        for _ in range(N_SURROGATES)
    ])

    p_poisson = float((poisson_peaks >= observed).mean())
    p_shuffled = float((shuffled_peaks >= observed).mean())

    return {
        "voice": name,
        "observed_peak": float(observed),
        "p_vs_poisson": p_poisson,
        "p_vs_shuffled_ici": p_shuffled,
        "poisson_null_mean": float(poisson_peaks.mean()),
        "poisson_null_p95": float(np.percentile(poisson_peaks, 95)),
        "shuffled_null_mean": float(shuffled_peaks.mean()),
        "shuffled_null_p95": float(np.percentile(shuffled_peaks, 95)),
        "n_surrogates": N_SURROGATES,
    }


def plot_surrogate(surrogate_results, voices, duration_s, out_path):
    valid = [r for r in surrogate_results if r["observed_peak"] is not None]
    if not valid:
        return
    fig, axes = plt.subplots(1, len(valid), figsize=(4 * len(valid), 4),
                             squeeze=False)
    for ax, r in zip(axes[0], valid):
        # regenerate null distribution for plotting (cheap)
        name = r["voice"]
        info = voices[name]
        onsets = info["onsets_s"]
        poisson_peaks = np.array([
            max_nonzero_autocorr(poisson_surrogate(len(onsets), duration_s),
                                 duration_s)
            for _ in range(200)
        ])
        shuffled_peaks = np.array([
            max_nonzero_autocorr(shuffled_ici_surrogate(onsets), duration_s)
            for _ in range(200)
        ])
        ax.hist(poisson_peaks, bins=25, alpha=0.5, color="steelblue",
                label="Poisson null")
        ax.hist(shuffled_peaks, bins=25, alpha=0.5, color="orange",
                label="Shuffled-ICI null")
        ax.axvline(r["observed_peak"], color="crimson", lw=2,
                   label=f"observed={r['observed_peak']:.3f}")
        ax.set_title(f"{name}\np(Poisson)={r['p_vs_poisson']:.3g}  "
                     f"p(Shuf)={r['p_vs_shuffled_ici']:.3g}")
        ax.set_xlabel("max autocorr (lag>0)")
        ax.set_ylabel("count")
        ax.legend(fontsize=7)
    fig.tight_layout()
    fig.savefig(out_path, dpi=120)
    plt.close(fig)


# ---------------------------------------------------------------------------
# Permutation entropy
# ---------------------------------------------------------------------------

def permutation_entropy(seq, order=PE_ORDER):
    seq = np.asarray(seq)
    if len(seq) < order + 1:
        return None
    patterns = {p: 0 for p in permutations(range(order))}
    for i in range(len(seq) - order + 1):
        window = seq[i:i + order]
        rank = tuple(np.argsort(np.argsort(window)))
        patterns[rank] = patterns.get(rank, 0) + 1
    counts = np.array(list(patterns.values()), dtype=float)
    probs = counts[counts > 0] / counts.sum()
    h = -np.sum(probs * np.log2(probs))
    h_max = math.log2(math.factorial(order))
    return float(h / h_max)  # normalized to [0, 1]


def pe_significance(onsets_s, n_surrogates=N_SURROGATES, order=PE_ORDER):
    onsets = np.asarray(onsets_s, dtype=float)
    if len(onsets) < order + 2:
        return None
    icis = np.diff(onsets)
    observed = permutation_entropy(icis, order=order)
    if observed is None:
        return None
    null = []
    for _ in range(n_surrogates):
        shuffled = icis.copy()
        RNG.shuffle(shuffled)
        v = permutation_entropy(shuffled, order=order)
        if v is not None:
            null.append(v)
    null = np.array(null)
    p_below = float((null <= observed).mean())
    return {
        "observed_norm_pe": observed,
        "null_mean": float(null.mean()),
        "null_p05": float(np.percentile(null, 5)),
        "p_observed_below_null": p_below,
    }


# ---------------------------------------------------------------------------
# Orchestration
# ---------------------------------------------------------------------------

def analyze_file(audio_path: str, out_root: Path):
    name = Path(audio_path).stem
    out_dir = out_root / name
    out_dir.mkdir(parents=True, exist_ok=True)
    print(f"\n=== {name} ===")
    print(f"  converting {audio_path} -> wav ...")
    wav_path = to_wav(audio_path)
    try:
        x, sr = read_wav(wav_path)
    finally:
        os.unlink(wav_path)
    duration_s = len(x) / sr
    print(f"  duration={duration_s:.2f}s  sr={sr}")

    print("  spectrogram ...")
    plot_spectrogram(x, sr, out_dir / "spectrogram.png")

    print("  voice separation + onset detection ...")
    voices = detect_voices(x, sr)
    for name_, info in voices.items():
        print(f"    {name_:<10} ({info['band_hz'][0]:>4}-{info['band_hz'][1]:<5} Hz)"
              f"  n_calls={info['n_calls']}")

    plot_onsets(x, sr, voices, out_dir / "onsets.png", duration_s)

    print("  ICI distributions ...")
    voices_ici = {n: ici_stats(v["onsets_s"]) for n, v in voices.items()}
    plot_ici_distributions(voices_ici, out_dir / "ici_distributions.png")

    print("  autocorrelation ...")
    plot_autocorr(voices, duration_s, out_dir / "autocorrelation.png")

    print("  cross-correlation ...")
    plot_cross_corr(voices, duration_s, out_dir / "cross_correlation.png")

    print(f"  surrogate tests ({N_SURROGATES} surrogates per voice) ...")
    surrogate_results = []
    for n_, info in voices.items():
        r = surrogate_test(n_, info, duration_s)
        surrogate_results.append(r)
        if r["observed_peak"] is not None:
            print(f"    {n_:<10}  obs={r['observed_peak']:.3f}  "
                  f"p(Poisson)={r['p_vs_poisson']:.3g}  "
                  f"p(Shuf)={r['p_vs_shuffled_ici']:.3g}")
        else:
            print(f"    {n_:<10}  {r['note']}")
    plot_surrogate(surrogate_results, voices, duration_s,
                   out_dir / "surrogate_test.png")

    print("  permutation entropy ...")
    pe_results = {}
    for n_, info in voices.items():
        r = pe_significance(info["onsets_s"])
        pe_results[n_] = r
        if r is not None:
            print(f"    {n_:<10}  PE={r['observed_norm_pe']:.3f}  "
                  f"null_mean={r['null_mean']:.3f}  "
                  f"p(obs<=null)={r['p_observed_below_null']:.3g}")

    # serialize
    def clean_voices(vs):
        return {
            n: {
                "band_hz": list(info["band_hz"]),
                "n_calls": info["n_calls"],
                "onsets_s": [float(x) for x in info["onsets_s"]],
            }
            for n, info in vs.items()
        }

    def clean_ici(d):
        if d is None:
            return None
        return {k: (v if k != "icis" else None)
                for k, v in d.items()}

    results = {
        "recording": name,
        "duration_s": duration_s,
        "sample_rate_hz": sr,
        "bin_ms": BIN_MS,
        "max_lag_s": MAX_LAG_S,
        "n_surrogates": N_SURROGATES,
        "voice_bands_hz": [{"name": n, "low": lo, "high": hi}
                           for n, lo, hi in VOICE_BANDS_HZ],
        "voices": clean_voices(voices),
        "ici_stats": {n: clean_ici(v) for n, v in voices_ici.items()},
        "surrogate_test_autocorr_peak": surrogate_results,
        "permutation_entropy": pe_results,
    }
    with open(out_dir / "results.json", "w") as f:
        json.dump(results, f, indent=2, default=float)
    print(f"  -> wrote {out_dir/'results.json'}")
    return results


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    here = Path(__file__).resolve().parent
    out_root = here.parent / "output"
    out_root.mkdir(parents=True, exist_ok=True)
    for audio_path in sys.argv[1:]:
        analyze_file(audio_path, out_root)


if __name__ == "__main__":
    main()
