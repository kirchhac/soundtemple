# Frog Chorus as Environmental Entropy Reduction

A design doc for analyzing two ~2 min field recordings of a multi-frog chorus to
test whether the call timing is structured (non-random) — a necessary condition
for treating the chorus as a *self-organizing communication system* that
reduces uncertainty about the local environment.

## 1. Motivation

The standard sexual-selection account treats anuran chorusing as overlapping
male advertisement calls competing for female attention. Calls are loud, costly,
and conspicuous — energetically wasteful if their only purpose is individual
display.

An alternative (non-exclusive) account: a chorus is a **collective sensor and
broadcast**. While any individual frog is calling, it is committing to a costly
signal that is honest about local safety — a calling frog is a frog not being
eaten *right now*. The aggregate call train is a continuous stream of
"all-clear" tokens distributed across many emitters. Non-calling individuals
(and other species sharing the habitat) can passively listen and use the
presence, density, and structure of the chorus as evidence about predator
presence, weather, social composition, and rival groups.

Framed in information-theoretic terms: each call event reduces a listener's
uncertainty over the state of the environment. If the calls are independent
Poisson events, the per-call information is bounded; if they are temporally
structured (turn-taking, alternation, antiphony, rhythmic locking), the chorus
carries *more* information than the sum of independent emitters — i.e., the
group has self-organized into a higher-order communicative unit.

## 2. Hypothesis

**H1 (entropy reduction via self-organization):** Frog calls in the chorus are
*not* independent Poisson events. Inter-call timing exhibits structure —
periodicity, turn-taking between voices, antiphony, or rhythmic locking — that
cannot be explained by each frog calling independently at its own rate.

**H0 (null, random independence):** Each frog calls according to an independent
Poisson process at its own characteristic rate. The composite call train is a
superposition of independent processes; inter-call intervals are
exponentially distributed; cross-voice timing is uncorrelated.

This experiment can only *falsify H0*. Rejecting H0 is consistent with H1 (and
with the entropy-reduction interpretation) but does not by itself prove the
entropy-reduction account over alternative structured accounts (e.g., simple
acoustic mutual avoidance — frogs pause when they hear another frog, purely
mechanically). We discuss disambiguating tests in §6.

## 3. The Data

Two field recordings made on an iPhone Voice Memo, ~2 min each, ~4 distinguishable
frog voices by ear, with one large bullfrog and several smaller frogs.

- `audio/frogs_1.m4a` — 2:57 total
- `audio/frogs_2.m4a` — 2:32 total
- `screenshots/*.png` — Voice Memo waveform views at multiple time windows;
  visible amplitude modulation and clear discrete call events

The waveform screenshots already show that the chorus is *not* a flat texture:
there are clear bursts, troughs, and recurring envelopes. The question is
whether that visible structure beats chance.

## 4. Methods

### 4.1 Voice separation by frequency band

Different frog species (and different-sized individuals) call at different
fundamental frequencies. A bullfrog's *jug-o-rum* is ~100–250 Hz; smaller
treefrog calls run 1–4 kHz. We split the signal into 3–5 frequency bands
(determined by inspecting the spectrogram), then treat each band as a separate
"voice."

**Output:** one onset train per voice band.

### 4.2 Onset detection per voice

Within each band, detect call onsets via:

1. Band-pass filter to the voice band
2. Hilbert-envelope (or rectified short-time energy)
3. Local maxima exceeding adaptive threshold (median + k·MAD)
4. Refractory period to avoid double-counting

**Output:** `{voice_id: [onset_time_seconds, ...]}` per recording.

### 4.3 Inter-call interval (ICI) distributions

For each voice, compute the distribution of intervals between successive call
onsets and compare to an exponential distribution (the Poisson-process
prediction).

- Kolmogorov–Smirnov test against best-fit exponential
- Coefficient of variation (CV = σ/μ); CV ≈ 1 for Poisson, CV < 1 implies
  refractoriness/regularity, CV > 1 implies bursting

### 4.4 Autocorrelation of the call train

For each voice's onset train (binned at, e.g., 50 ms), compute autocorrelation
up to a lag of 5 s. Peaks at non-zero lags indicate periodicity.

For the *composite* (all-voice) train, autocorrelation peaks reveal whole-chorus
rhythm.

### 4.5 Cross-voice coordination

For each pair of voices `(i, j)`, compute cross-correlation. Negative
correlation at small lags indicates turn-taking (when voice i is on, voice j is
silent); positive correlation at small lags indicates synchrony.

### 4.6 Surrogate-data significance tests (the key test)

This is the load-bearing analysis. For each summary statistic computed on the
real data (autocorrelation peak height, KS distance, cross-correlation), build
a null distribution by recomputing the same statistic on many surrogate
datasets that preserve the marginal call rate but destroy temporal structure:

1. **Poisson surrogate:** generate a Poisson process with the same total
   number of calls and duration
2. **Shuffled-ICI surrogate:** permute the inter-call intervals of the real
   train; preserves the ICI marginal distribution but destroys order
3. **Jittered surrogate:** add Gaussian jitter (σ = 200 ms) to each real onset
   time; destroys fine-scale timing while preserving coarse rate

If the observed statistic falls in the extreme tail of the surrogate
distribution (p < 0.05 after Bonferroni correction across voices), we reject
H0 *for that statistic*.

### 4.7 Permutation entropy

Symbolize the inter-call interval sequence into ordinal patterns of length 3–4
and compute permutation entropy. Compare to shuffled-ICI surrogate. Lower
entropy than surrogate means the ordering of intervals is non-random — i.e.,
the chorus is sequenced, not just rate-modulated.

## 5. Predictions

If H1 is correct, we expect (any one of these is interesting; multiple
together is strong):

- ICI distributions for at least one voice will be significantly non-exponential
  (KS p < 0.05), with CV materially below 1 (regularity) or with multimodal
  peaks (rhythmic call+pause)
- Autocorrelation of at least one voice has a peak at non-zero lag exceeding
  the 99th percentile of Poisson surrogates
- At least one voice pair has a cross-correlation extremum significantly
  outside surrogate range (either turn-taking or synchrony)
- Permutation entropy of ICIs is significantly below shuffled-ICI surrogate

If H0 cannot be rejected on any of the above, the chorus may still be doing
work (the *content* of each call is informative independently), but we cannot
claim self-organization from this dataset.

## 6. Limitations and disambiguating future work

Rejecting Poisson independence is consistent with several mechanisms:

1. **Honest-signal advertisement under mutual acoustic interference** —
   frogs pause when another frog is calling because they cannot be heard over
   it. This is selfish, not communicative. *Disambiguation:* if turn-taking is
   between specific pairs (not generic "whoever is loudest right now"), and
   persists across playback experiments where one voice is artificially
   silenced, this is harder to explain by mutual masking.
2. **Female-choice rhythmic preference** — choruses lock to a rhythm because
   females prefer rhythmic males. *Disambiguation:* not addressable from
   recording alone; requires choice experiments.
3. **Self-organization for predator vigilance / collective sensing (H1).**
   *Disambiguation:* would predict that chorus structure changes in response
   to brief disturbances (e.g., a passing predator silhouette), not just to
   rival male presence. Not addressable from these two recordings, but a
   future protocol could collect recordings before/after controlled
   disturbances.

For this design doc the goal is the *necessary first step*: show the chorus is
not random.

## 7. Deliverables

- `scripts/analyze_chorus.py` — full pipeline
- `output/{recording_name}/` — per-recording plots:
  - `spectrogram.png` — annotated with voice bands
  - `onsets.png` — waveform with detected onsets per voice
  - `ici_distributions.png` — per-voice ICI vs exponential fit
  - `autocorrelation.png` — per-voice and composite
  - `cross_correlation.png` — voice-pair matrix
  - `surrogate_test.png` — observed statistic vs null distribution
- `output/{recording_name}/results.json` — machine-readable summary with
  p-values and test statistics
- `RESULTS.md` — human-readable summary tying findings back to H1/H0
- `scripts/make_figures.py` + `figures/` — publication-style "random vs
  observed" figures for the visual argument; captioned in `FIGURES.md`

## 8. Reproducibility

```
cd /Users/drew/soundtemple
.venv/bin/python frogs/scripts/analyze_chorus.py frogs/audio/frogs_1.m4a
.venv/bin/python frogs/scripts/analyze_chorus.py frogs/audio/frogs_2.m4a
```

Random seeds for surrogate generation are fixed (seed=42) so re-runs give
identical p-values.
