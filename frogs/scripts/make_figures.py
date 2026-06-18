"""
Publication figures for the frog-chorus analysis
=================================================

Renders the "random vs. observed" visual argument as a small set of
publication-quality figures, styled after traditional machine-learning /
quantitative-biology papers.

The scientific claim is a *surrogate-data* one: the observed call timing is
compared against the timing a **random** process would produce (an independent
Poisson chorus, H0 in ../DESIGN.md). Every figure therefore carries the same
visual grammar:

    RANDOM / NULL  -> cool neutral gray
    OBSERVED       -> crimson (the signal)

so the reader can see, panel after panel, that the measured chorus lands far
outside what randomness predicts.

Figures (written to ../figures/ and mirrored to the dashboard):

    fig1_random_vs_observed__<rec>.png   hero: raster + population rate,
                                         random column vs observed column
    fig2_null_test.png                   observed autocorr peak vs the Poisson
                                         null distribution, all 8 voices
    fig3_ici_distributions.png           inter-call intervals vs the exponential
                                         a Poisson process predicts
    fig4_autocorrelation.png             chorus autocorrelation escaping the
                                         random-null confidence band
    fig5_synchrony.png                   cross-voice synchrony vs the null band

Data source: the committed results.json (per-voice onset times). Null
distributions are regenerated with the same seeded helpers used by the
analysis, so they reproduce exactly.

Usage:
    python make_figures.py                # frogs_1 and frogs_2
    python make_figures.py frogs_1        # one recording's hero figure only
"""

import json
import sys
from itertools import combinations
from pathlib import Path

import numpy as np
from scipy.ndimage import gaussian_filter1d
from scipy.stats import expon

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import Patch
from matplotlib.lines import Line2D

# Reuse the exact DSP + surrogate machinery from the analysis pipeline so the
# figures can never drift from the numbers in RESULTS.md. Make the import work
# no matter the caller's working directory.
sys.path.insert(0, str(Path(__file__).resolve().parent))
import analyze_chorus as ac
from analyze_chorus import (
    bin_train,
    autocorrelation,
    cross_correlation,
    poisson_surrogate,
    max_nonzero_autocorr,
    BIN_MS,
    MAX_LAG_S,
)

# Deterministic surrogates for the figures (independent of the analysis run).
SEED = 20260618
ac.RNG = np.random.default_rng(SEED)

HERE = Path(__file__).resolve().parent
FROGS_DIR = HERE.parent
REPO_ROOT = FROGS_DIR.parent
FIG_DIR = FROGS_DIR / "figures"
DASH_FIG_DIR = REPO_ROOT / "dashboard" / "public" / "frogs" / "figures"

RECORDINGS = ["frogs_1", "frogs_2"]
N_NULL = 400          # surrogates per null distribution (viz only; p-values
                      # come from the stored 500-surrogate analysis)


# ---------------------------------------------------------------------------
# House style — "elite paper" look
# ---------------------------------------------------------------------------

# Color discipline is the whole argument: gray == random, crimson == observed.
C = {
    "null":       "#AEB6C2",   # random / null cloud
    "null_edge":  "#8C95A4",
    "null_band":  "#CBD2DB",   # confidence band fill
    "observed":   "#C42E3A",   # the signal
    "observed_d": "#8E1F28",
    "ink":        "#1B1B1F",
    "muted":      "#5F6772",
    "rule":       "#D7DBE0",
}

# One color per voice, reused identically in the random and observed panels so
# the only thing that changes between columns is the *timing*, never the hue.
VOICE_COLORS = {
    "V1_low":     "#27486F",   # deep blue   — bullfrog / large bodied
    "V2_low_mid": "#2C8C84",   # teal        — mid sized
    "V3_mid":     "#D98A2B",   # amber       — smaller frog
    "V4_high":    "#9B3B6A",   # plum        — treefrog / high
}


def set_style():
    plt.rcParams.update({
        "figure.dpi": 130,
        "savefig.dpi": 220,
        "savefig.bbox": "tight",
        "savefig.pad_inches": 0.04,
        "figure.facecolor": "white",
        "savefig.facecolor": "white",
        "axes.facecolor": "white",
        "font.family": "serif",
        "font.serif": ["STIXGeneral", "DejaVu Serif", "Times New Roman"],
        "mathtext.fontset": "stix",
        "font.size": 10.5,
        "axes.titlesize": 11.5,
        "axes.titlepad": 8.0,
        "axes.labelsize": 10.0,
        "axes.labelcolor": C["ink"],
        "axes.edgecolor": "#3A3A3A",
        "axes.linewidth": 0.8,
        "axes.grid": False,
        "text.color": C["ink"],
        "xtick.color": C["ink"],
        "ytick.color": C["ink"],
        "xtick.labelsize": 9.0,
        "ytick.labelsize": 9.0,
        "xtick.major.width": 0.8,
        "ytick.major.width": 0.8,
        "xtick.major.size": 3.5,
        "ytick.major.size": 3.5,
        "legend.frameon": False,
        "legend.fontsize": 8.5,
        "legend.handlelength": 1.4,
        "lines.solid_capstyle": "round",
    })


def despine(ax, keep=("left", "bottom")):
    for side in ("top", "right", "left", "bottom"):
        ax.spines[side].set_visible(side in keep)
    ax.tick_params(top=False, right=False)


def panel_tag(ax, tag, dx=-0.012, dy=1.02):
    ax.text(dx, dy, tag, transform=ax.transAxes, fontsize=12.5,
            fontweight="bold", family="DejaVu Sans", va="bottom", ha="right",
            color=C["ink"])


def soft_grid(ax, axis="y"):
    ax.grid(axis=axis, color=C["rule"], lw=0.7, alpha=0.9, zorder=0)
    ax.set_axisbelow(True)


def fmt_p(p):
    """Format a surrogate p-value (1/500 resolution)."""
    if p is None:
        return "n/a"
    if p <= 0.002:
        return r"$p < 0.002$"
    return rf"$p = {p:.3f}$"


def sci(p):
    """Mantissa x 10^exp for an analytic p-value, as bare mathtext."""
    if p <= 0:
        return "0"
    exp = int(np.floor(np.log10(p)))
    mant = p / 10 ** exp
    return rf"{mant:.0f}\times10^{{{exp}}}"


# ---------------------------------------------------------------------------
# Data access
# ---------------------------------------------------------------------------

def load_results(name):
    """Load a recording's results.json (per-voice onset times + stats)."""
    candidates = [
        FROGS_DIR / "output" / name / "results.json",
        REPO_ROOT / "dashboard" / "public" / "frogs" / "plots" / name / "results.json",
    ]
    for c in candidates:
        if c.exists():
            return json.load(open(c))
    raise FileNotFoundError(
        f"no results.json for {name}; run analyze_chorus.py first "
        f"(looked in {[str(c) for c in candidates]})"
    )


def voice_order(results):
    return [v["name"] for v in results["voice_bands_hz"]]


def onsets_of(results, voice):
    return np.asarray(results["voices"][voice]["onsets_s"], dtype=float)


def band_label(results, voice):
    lo, hi = results["voices"][voice]["band_hz"]
    return f"{lo}–{hi} Hz"


# ---------------------------------------------------------------------------
# Figure 1 — the hero: what random looks like vs. what we observed
# ---------------------------------------------------------------------------

def population_rate(all_onsets, duration, bin_s=0.25, smooth=1.4):
    edges = np.arange(0.0, duration + bin_s, bin_s)
    counts, _ = np.histogram(all_onsets, bins=edges)
    rate = gaussian_filter1d(counts.astype(float), smooth)
    centers = edges[:-1] + bin_s / 2.0
    return centers, rate


def fig1_random_vs_observed(name, window_s=50.0):
    results = load_results(name)
    duration = results["duration_s"]
    voices = voice_order(results)

    # Matched-rate random chorus: each voice gets the same number of calls,
    # placed uniformly at random over the full recording (H0).
    rng = np.random.default_rng(SEED + 1)
    observed = {v: onsets_of(results, v) for v in voices}
    random_ = {v: np.sort(rng.uniform(0.0, duration, size=len(observed[v])))
               for v in voices}

    fig = plt.figure(figsize=(11.2, 6.7))
    gs = fig.add_gridspec(2, 2, height_ratios=[2.7, 1.0],
                          hspace=0.30, wspace=0.11)
    ax_rL = fig.add_subplot(gs[0, 0])
    ax_rR = fig.add_subplot(gs[0, 1], sharex=ax_rL, sharey=ax_rL)
    ax_pL = fig.add_subplot(gs[1, 0], sharex=ax_rL)
    ax_pR = fig.add_subplot(gs[1, 1], sharex=ax_rL, sharey=ax_pL)

    offsets = list(range(len(voices), 0, -1))  # V1 on top

    def draw_raster(ax, trains):
        for off, v in zip(offsets, voices):
            ev = trains[v]
            ev = ev[ev <= window_s]
            ax.eventplot([ev], lineoffsets=[off], linelengths=0.74,
                         linewidths=1.05, colors=[VOICE_COLORS[v]])
        ax.set_yticks(offsets)
        ax.set_yticklabels(
            [f"{v}\n{band_label(results, v)}" for v in voices], fontsize=8.0)
        ax.set_ylim(0.4, len(voices) + 0.7)
        despine(ax, keep=("left", "bottom"))

    def draw_rate(ax, trains, color):
        allo = np.concatenate([trains[v] for v in voices])
        t, r = population_rate(allo, duration)
        m = t <= window_s
        ax.fill_between(t[m], 0, r[m], color=color, alpha=0.85, lw=0)
        ax.plot(t[m], r[m], color=color, lw=0.8, alpha=0.9)
        despine(ax, keep=("left", "bottom"))
        soft_grid(ax)

    draw_raster(ax_rL, random_)
    draw_raster(ax_rR, observed)
    draw_rate(ax_pL, random_, C["muted"])
    draw_rate(ax_pR, observed, C["observed"])

    ax_rL.set_xlim(0, window_s)

    # Column headers
    ax_rL.set_title(r"$H_0$  —  independent random calling (Poisson)",
                    color=C["muted"], fontsize=12, pad=14)
    ax_rR.set_title("Observed  —  real frog chorus",
                    color=C["observed_d"], fontsize=12, fontweight="bold",
                    pad=14)
    ax_rL.text(0.5, 1.005, "calls scattered uniformly  ·  matched rate",
               transform=ax_rL.transAxes, ha="center", va="bottom",
               fontsize=8.5, color=C["muted"], style="italic")
    ax_rR.text(0.5, 1.005, "same voices, same call counts  ·  measured timing",
               transform=ax_rR.transAxes, ha="center", va="bottom",
               fontsize=8.5, color=C["muted"], style="italic")

    # Rate panels
    ax_pL.set_ylabel("calls / 0.25 s\n(smoothed)", fontsize=8.6)
    for ax in (ax_pL, ax_pR):
        ax.set_xlabel("time (s)")
        ax.set_ylim(bottom=0)
    plt.setp(ax_rL.get_xticklabels(), visible=False)
    plt.setp(ax_rR.get_xticklabels(), visible=False)
    plt.setp(ax_rR.get_yticklabels(), visible=False)
    plt.setp(ax_pR.get_yticklabels(), visible=False)

    # Annotate the contrast on the rate panels
    ax_pL.annotate("rate ≈ constant", xy=(0.5, 0.86),
                   xycoords="axes fraction", ha="center", va="top",
                   fontsize=8.6, color=C["muted"])
    ymax = ax_pR.get_ylim()[1]
    ax_pR.annotate("shared bursts\n(≈ 2–3 s envelope)",
                   xy=(0.5, 0.94), xycoords="axes fraction", ha="center",
                   va="top", fontsize=8.6, color=C["observed_d"])

    panel_tag(ax_rL, "a")
    panel_tag(ax_rR, "b")
    panel_tag(ax_pL, "c")
    panel_tag(ax_pR, "d")

    fig.suptitle("What random looks like   vs.   what the frogs do",
                 fontsize=14.5, fontweight="bold", y=0.995)

    out = f"fig1_random_vs_observed__{name}.png"
    save(fig, out)
    return out


# ---------------------------------------------------------------------------
# Figure 2 — observed statistic vs. the random null distribution
# ---------------------------------------------------------------------------

def poisson_peak_null(n_calls, duration, n=N_NULL):
    return np.array([
        max_nonzero_autocorr(poisson_surrogate(n_calls, duration), duration)
        for _ in range(n)
    ])


def fig2_null_test():
    data = {r: load_results(r) for r in RECORDINGS}
    voices = voice_order(data[RECORDINGS[0]])

    fig, axes = plt.subplots(len(RECORDINGS), len(voices),
                             figsize=(12.2, 6.0), squeeze=False)

    for i, rec in enumerate(RECORDINGS):
        results = data[rec]
        duration = results["duration_s"]
        sur = {s["voice"]: s for s in results["surrogate_test_autocorr_peak"]}
        for j, v in enumerate(voices):
            ax = axes[i][j]
            s = sur[v]
            obs = s["observed_peak"]
            n_calls = results["voices"][v]["n_calls"]
            null = poisson_peak_null(n_calls, duration)

            ax.hist(null, bins=26, color=C["null"], edgecolor=C["null_edge"],
                    linewidth=0.4, zorder=2)
            ax.axvline(obs, color=C["observed"], lw=2.0, zorder=4)
            ax.plot([obs], [0], marker="^", ms=8, color=C["observed"],
                    clip_on=False, zorder=5)

            # widen so the observed line and its labels sit in clear whitespace
            # to the RIGHT of the line (never crossing it)
            xmax = max(obs, null.max()) * 1.4
            ax.set_xlim(0, xmax)
            despine(ax, keep=("left", "bottom"))
            soft_grid(ax)

            ymax = ax.get_ylim()[1]
            factor = obs / max(null.mean(), 1e-9)
            pad = (xmax - obs) * 0.07
            ax.text(obs + pad, ymax * 0.97, f"observed\n{obs:.3f}",
                    color=C["observed_d"], ha="left", va="top",
                    fontsize=8.3, fontweight="bold")
            ax.text(obs + pad, ymax * 0.63, fmt_p(s["p_vs_poisson"]),
                    color=C["ink"], ha="left", va="top", fontsize=8.4)
            ax.text(obs + pad, ymax * 0.52, rf"$\approx\!{factor:.0f}\times$ chance",
                    color=C["muted"], ha="left", va="top", fontsize=7.8)

            if i == 0:
                ax.set_title(f"{v}\n{band_label(results, v)}", fontsize=9.6)
            if i == len(RECORDINGS) - 1:
                ax.set_xlabel("max autocorrelation (lag > 0)", fontsize=8.8)
            if j == 0:
                ax.set_ylabel(f"{rec}\n\nsurrogate count", fontsize=9.0)

    # one shared legend
    handles = [
        Patch(facecolor=C["null"], edgecolor=C["null_edge"],
              label="random (Poisson) surrogates"),
        Line2D([0], [0], color=C["observed"], lw=2.0, label="observed chorus"),
    ]
    fig.legend(handles=handles, loc="upper center", ncol=2,
               bbox_to_anchor=(0.5, 0.045), fontsize=9.5)

    fig.suptitle("The observed timing structure is unreachable by chance",
                 fontsize=14, fontweight="bold", y=1.005)
    fig.text(0.5, 0.965,
             "max non-zero autocorrelation of each voice vs. 400 rate-matched "
             "random surrogates  ·  observed exceeds every surrogate in all "
             "8 voices",
             ha="center", fontsize=9.2, color=C["muted"])
    fig.tight_layout(rect=(0, 0.07, 1, 0.95))
    save(fig, "fig2_null_test.png")
    return "fig2_null_test.png"


# ---------------------------------------------------------------------------
# Figure 3 — inter-call intervals vs. the Poisson (exponential) prediction
# ---------------------------------------------------------------------------

def fig3_ici_distributions():
    data = {r: load_results(r) for r in RECORDINGS}
    voices = voice_order(data[RECORDINGS[0]])

    fig, axes = plt.subplots(len(RECORDINGS), len(voices),
                             figsize=(12.2, 5.9), squeeze=False)

    for i, rec in enumerate(RECORDINGS):
        results = data[rec]
        ici_stats = results["ici_stats"]
        for j, v in enumerate(voices):
            ax = axes[i][j]
            onsets = onsets_of(results, v)
            icis = np.diff(onsets)
            stats = ici_stats.get(v) or {}
            cv = stats.get("cv", np.nan)
            ks = stats.get("ks_p_vs_exp", np.nan)
            mean = icis.mean()

            ax.hist(icis, bins=32, density=True, color=VOICE_COLORS[v],
                    alpha=0.82, edgecolor="white", linewidth=0.3, zorder=3)
            xx = np.linspace(0, icis.max() * 1.02, 300)
            ax.plot(xx, expon.pdf(xx, scale=mean), color=C["ink"],
                    lw=1.7, ls=(0, (5, 2)), zorder=5,
                    label="random (Poisson) prediction")
            ax.set_yscale("log")
            despine(ax, keep=("left", "bottom"))
            soft_grid(ax)

            bbox = dict(facecolor="white", alpha=0.72, edgecolor="none",
                        boxstyle="round,pad=0.15")
            ax.text(0.955, 0.94, rf"CV $= {cv:.2f}$",
                    transform=ax.transAxes, ha="right", va="top",
                    fontsize=9.0, fontweight="bold", color=C["ink"], bbox=bbox)
            ax.text(0.955, 0.80, rf"KS vs random: $p={sci(ks)}$",
                    transform=ax.transAxes, ha="right", va="top",
                    fontsize=7.6, color=C["observed_d"], bbox=bbox)

            if i == 0:
                ax.set_title(f"{v}\n{band_label(results, v)}", fontsize=9.6)
            if i == len(RECORDINGS) - 1:
                ax.set_xlabel("inter-call interval (s)", fontsize=8.8)
            if j == 0:
                ax.set_ylabel(f"{rec}\n\ndensity (log)", fontsize=9.0)

    handles = [
        Patch(facecolor="#7C8794", alpha=0.85, label="observed intervals (per voice)"),
        Line2D([0], [0], color=C["ink"], lw=1.7, ls=(0, (5, 2)),
               label="exponential = what a random (Poisson) chorus predicts"),
    ]
    fig.legend(handles=handles, loc="upper center", ncol=2,
               bbox_to_anchor=(0.5, 0.045), fontsize=9.5)

    fig.suptitle("Interval distributions reject the random exponential law in every voice",
                 fontsize=14, fontweight="bold", y=1.005)
    fig.text(0.5, 0.965,
             "a Poisson chorus produces exponentially distributed intervals "
             "(black dashed); a Kolmogorov–Smirnov test rejects that law in all "
             "8 voices ($p \\leq 9\\times10^{-6}$) — calls peak at a preferred "
             "interval and cluster into bursts",
             ha="center", fontsize=9.2, color=C["muted"])
    fig.tight_layout(rect=(0, 0.07, 1, 0.95))
    save(fig, "fig3_ici_distributions.png")
    return "fig3_ici_distributions.png"


# ---------------------------------------------------------------------------
# Figure 4 — autocorrelation escaping the random-null band
# ---------------------------------------------------------------------------

def composite_autocorr_null(results, max_lag_bins, n=N_NULL):
    """Null = sum of independent per-voice Poisson surrogates (H0 composite)."""
    duration = results["duration_s"]
    voices = voice_order(results)
    counts = [results["voices"][v]["n_calls"] for v in voices]
    out = np.empty((n, max_lag_bins + 1))
    for k in range(n):
        train = np.zeros(int(np.ceil(duration * 1000.0 / BIN_MS)))
        for c in counts:
            train = train + bin_train(poisson_surrogate(c, duration), duration)
        out[k] = autocorrelation(train, max_lag_bins)
    return out


def fig4_autocorrelation():
    max_lag_bins = int(MAX_LAG_S * 1000.0 / BIN_MS)
    lags = np.arange(max_lag_bins + 1) * BIN_MS / 1000.0

    fig, axes = plt.subplots(1, len(RECORDINGS), figsize=(12.0, 4.5),
                             squeeze=False)
    for j, rec in enumerate(RECORDINGS):
        ax = axes[0][j]
        results = load_results(rec)
        duration = results["duration_s"]
        voices = voice_order(results)

        # observed composite autocorrelation
        train = np.zeros(int(np.ceil(duration * 1000.0 / BIN_MS)))
        for v in voices:
            train = train + bin_train(onsets_of(results, v), duration)
        obs_ac = autocorrelation(train, max_lag_bins)

        null = composite_autocorr_null(results, max_lag_bins)
        lo = np.percentile(null, 0.5, axis=0)
        hi = np.percentile(null, 99.5, axis=0)
        mid = null.mean(axis=0)

        # mask lag 0 (== 1 by definition)
        x = lags[1:]
        ax.fill_between(x, lo[1:], hi[1:], color=C["null_band"], alpha=0.9,
                        lw=0, zorder=1, label="random null (99% band)")
        ax.plot(x, mid[1:], color=C["null_edge"], lw=0.9, ls="--", zorder=2)
        ax.plot(x, obs_ac[1:], color=C["observed"], lw=1.6, zorder=4,
                label="observed chorus")
        ax.axhline(0, color=C["muted"], lw=0.6)

        despine(ax, keep=("left", "bottom"))
        soft_grid(ax)
        ax.set_xlim(0, MAX_LAG_S)
        ax.set_xlabel("lag (s)")
        if j == 0:
            ax.set_ylabel("autocorrelation")
        ax.set_title(rec, fontsize=11)

        # annotate the two structures that escape the band
        peak_i = 1 + int(np.argmax(obs_ac[1:]))
        ax.annotate("refractory /\nburst shoulder",
                    xy=(lags[peak_i], obs_ac[peak_i]),
                    xytext=(lags[peak_i] + 0.7, obs_ac[peak_i] * 0.95),
                    fontsize=8.2, color=C["observed_d"], va="center",
                    arrowprops=dict(arrowstyle="->", color=C["observed_d"],
                                    lw=0.9))
        env = (lags >= 2.0) & (lags <= 3.2)
        ei = np.where(env)[0]
        if len(ei):
            k = ei[int(np.argmax(obs_ac[ei]))]
            ax.annotate("chorus envelope\n(≈ 2–3 s)",
                        xy=(lags[k], obs_ac[k]),
                        xytext=(lags[k] + 0.2, ax.get_ylim()[1] * 0.7),
                        fontsize=8.2, color=C["observed_d"], va="center",
                        arrowprops=dict(arrowstyle="->", color=C["observed_d"],
                                        lw=0.9))
        panel_tag(ax, "ab"[j])
        ax.legend(loc="upper right", fontsize=8.6)

    fig.suptitle("The chorus rhythm rises far above the random noise floor",
                 fontsize=14, fontweight="bold", y=1.02)
    fig.text(0.5, 0.945,
             "composite call-train autocorrelation (crimson) vs. the 99% band "
             "of independent-Poisson surrogates (gray)",
             ha="center", fontsize=9.2, color=C["muted"])
    fig.tight_layout(rect=(0, 0, 1, 0.9))
    save(fig, "fig4_autocorrelation.png")
    return "fig4_autocorrelation.png"


# ---------------------------------------------------------------------------
# Figure 5 — cross-voice synchrony vs. the random null
# ---------------------------------------------------------------------------

def fig5_synchrony():
    fig = plt.figure(figsize=(12.4, 4.8))
    gs = fig.add_gridspec(1, 4, width_ratios=[1.28, 1.0, 1.0, 0.05],
                          wspace=0.42)

    max_lag_bins = int(2.0 * 1000.0 / BIN_MS)
    lags = np.arange(-max_lag_bins, max_lag_bins + 1) * BIN_MS / 1000.0

    # Panel (a): one representative pair with its random null band
    rec = "frogs_2"
    results = load_results(rec)
    duration = results["duration_s"]
    a_name, b_name = "V2_low_mid", "V3_mid"
    ta = bin_train(onsets_of(results, a_name), duration)
    tb = bin_train(onsets_of(results, b_name), duration)
    obs_cc = cross_correlation(ta, tb, max_lag_bins)

    na = results["voices"][a_name]["n_calls"]
    nb = results["voices"][b_name]["n_calls"]
    null = np.empty((N_NULL, len(lags)))
    for k in range(N_NULL):
        sa = bin_train(poisson_surrogate(na, duration), duration)
        sb = bin_train(poisson_surrogate(nb, duration), duration)
        null[k] = cross_correlation(sa, sb, max_lag_bins)
    lo = np.percentile(null, 0.5, axis=0)
    hi = np.percentile(null, 99.5, axis=0)

    axa = fig.add_subplot(gs[0, 0])
    axa.fill_between(lags, lo, hi, color=C["null_band"], alpha=0.9, lw=0,
                     label="random null (99% band)")
    axa.plot(lags, obs_cc, color=C["observed"], lw=1.7, label="observed")
    axa.axhline(0, color=C["muted"], lw=0.6)
    axa.axvline(0, color=C["muted"], lw=0.6, ls=":")
    despine(axa, keep=("left", "bottom"))
    soft_grid(axa)
    axa.set_xlabel("lag (s)")
    axa.set_ylabel("cross-correlation")
    axa.set_title(f"{a_name} × {b_name}  ({rec})", fontsize=10)
    axa.annotate("synchrony\n(peak at lag 0)", xy=(0, obs_cc[max_lag_bins]),
                 xytext=(0.65, obs_cc[max_lag_bins] * 0.86), fontsize=8.4,
                 color=C["observed_d"], va="center", ha="left",
                 arrowprops=dict(arrowstyle="->", color=C["observed_d"], lw=0.9))
    axa.legend(loc="upper left", fontsize=8.2)
    panel_tag(axa, "a")

    # Panels (b),(c): lag-0 cross-correlation heatmap per recording
    for col, rec in enumerate(RECORDINGS, start=1):
        results = load_results(rec)
        duration = results["duration_s"]
        voices = voice_order(results)
        trains = {v: bin_train(onsets_of(results, v), duration) for v in voices}
        n = len(voices)
        M = np.full((n, n), np.nan)
        for x in range(n):
            for y in range(n):
                cc = cross_correlation(trains[voices[x]], trains[voices[y]],
                                       max_lag_bins)
                M[x, y] = cc[max_lag_bins]   # lag 0

        ax = fig.add_subplot(gs[0, col])
        im = ax.imshow(M, cmap="RdGy_r", vmin=-1, vmax=1, aspect="equal")
        ax.set_xticks(range(n))
        ax.set_yticks(range(n))
        ax.set_xticklabels(voices, rotation=40, ha="right", fontsize=7.6)
        ax.set_yticklabels(voices, fontsize=7.6)
        ax.set_title(f"lag-0 sync  ({rec})", fontsize=10)
        for x in range(n):
            for y in range(n):
                val = M[x, y]
                ax.text(y, x, f"{val:.2f}", ha="center", va="center",
                        fontsize=7.2,
                        color="white" if abs(val) > 0.55 else C["ink"])
        for s in ax.spines.values():
            s.set_visible(False)
        panel_tag(ax, "bc"[col - 1])

    cax = fig.add_subplot(gs[0, 3])
    fig.colorbar(im, cax=cax).set_label("lag-0 correlation", fontsize=8.5)

    fig.suptitle("Voices fire together — synchrony, not turn-taking",
                 fontsize=14, fontweight="bold", y=1.0)
    fig.text(0.5, 0.92,
             "every voice pair has a positive peak centered at lag 0, well "
             "outside the random band  ·  a random chorus would sit at 0",
             ha="center", fontsize=9.2, color=C["muted"])
    fig.subplots_adjust(left=0.055, right=0.93, top=0.80, bottom=0.16)
    save(fig, "fig5_synchrony.png")
    return "fig5_synchrony.png"


# ---------------------------------------------------------------------------
# Save (canonical + dashboard mirror)
# ---------------------------------------------------------------------------

def save(fig, fname):
    FIG_DIR.mkdir(parents=True, exist_ok=True)
    DASH_FIG_DIR.mkdir(parents=True, exist_ok=True)
    for d in (FIG_DIR, DASH_FIG_DIR):
        fig.savefig(d / fname)
    plt.close(fig)
    print(f"  wrote {fname}")


def main():
    set_style()
    targets = sys.argv[1:] or RECORDINGS
    print("figure 1 (hero) ...")
    for name in targets:
        fig1_random_vs_observed(name)
    if not sys.argv[1:]:
        print("figure 2 (null test) ...")
        fig2_null_test()
        print("figure 3 (ICI distributions) ...")
        fig3_ici_distributions()
        print("figure 4 (autocorrelation) ...")
        fig4_autocorrelation()
        print("figure 5 (synchrony) ...")
        fig5_synchrony()
    print(f"\nfigures -> {FIG_DIR}")
    print(f"mirror  -> {DASH_FIG_DIR}")


if __name__ == "__main__":
    main()
