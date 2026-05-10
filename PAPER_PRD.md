# PAPER_PRD.md — Archaeoacoustics Paper Requirements Document

> **Purpose**: This document details all core sections, data, charts, audio files, OBJ files, metrics, statistics, calculation methods, hypotheses, and key findings needed to write a publication-quality archaeoacoustics paper for the Sound Temple website.

---

## Title (Working)

**"Vocal Resonance Modes in Shaybanid-Era Domed Chambers: A Preliminary Acoustic Survey of Bukhara"**

or

**"Field Recordings from 11 Central Asian Domed Chambers Reveal a Recurring Low-Baritone Resonance Cluster"**

*Avoid*: anything with "sacred," "holy frequency," "secret," or "ancient knowledge." These signal pseudoscience even when the underlying work is solid.

---

## The Core Finding

This is a striking dataset — you've essentially replicated, in Shaybanid-Timurid Islamic dome architecture, the central frequency finding that Jahn, Devereux, Watson, and the Hypogeum researchers reported across Neolithic stone chambers. That's a non-trivial cross-cultural result.

### What Jumps Out

The dominant band measured — **86–119 Hz, centered on G2–Ab2 (98–103 Hz)** — sits squarely inside the 95–120 Hz "low baritone" cluster that the megalithic literature has been arguing about for thirty years.

- **111 Hz (A2)** appearing in 11 tracks is the exact frequency reported for the Hal Saflieni Oracle Room and is one tone above the Newgrange/Wayland's Smithy cluster.
- 111 Hz shows up across the most distinct chambers (11 tracks) but isn't the longest sustained (only 69 s, vs. 240 s at 103 Hz) — this suggests **111 Hz is a recurring dimensional sweet spot across multiple buildings**, while 103 Hz is the strongest single-chamber resonance encountered.

### The Harmonic Structure — Room Modes, Not Artifacts

What makes this dataset persuasive (rather than confirmation-biased noise) is the harmonic relationship between the two clusters:

| Band | Frequencies | Notes |
|------|-------------|-------|
| **Fundamental** | 86, 90, 98, 103, 111, 115, 119 Hz | F2–Bb2 |
| **Second cluster** | 209, 216, 232, 240 Hz | Ab3–B3 |

- 209 Hz is the octave of 103 Hz (the dominant)
- 232 Hz is the octave of 115–116 Hz
- 216 Hz is the octave of ~108 Hz (between A2 and Ab2 peaks)

This is exactly what you'd expect from **axial dome modes** — a fundamental and its 2:1 harmonic, both excited by sung tones at the right pitch. It's not random; it's the modal signature of hard-walled, roughly hemispherical chambers in the 5–8 m diameter range.

The continuity from F2 through Bb2 — hitting essentially every semitone — tells you: **you were measuring a family of similar-scale chambers** whose fundamental modes spread across a narrow band determined by Shaybanid construction conventions (chamber dimensions, dome rise, brick and ganch wall properties). That's a more interesting and more defensible finding than "all the domes resonate at exactly 111 Hz."

---

## Hypothesis Structure

### Primary Null Hypothesis (to reject)
"Resonance peaks are uniformly distributed across the audible spectrum we measured."

**Test**: Chi-square goodness-of-fit on the observed peak distribution vs. uniform. If the F2–Bb2 cluster is real, this should reject decisively.

### Secondary Hypothesis
"Peak frequencies cluster at octave intervals."

**Test**: Check that 209/103, 232/115, 216/108 ratios fall within a narrow tolerance (±3%) of 2.0.

### Tertiary Hypothesis (the interesting one)
"The dominant cluster falls within the human male baritone fundamental range (87–175 Hz)."

**Test**: Descriptive — but worth stating because it sets up the ritual-architecture interpretation.

### Effect Sizes
"11 of 11 chambers exhibit a detectable peak in the 86–119 Hz band" is the strongest sentence. Effect sizes and confidence intervals beat raw counts.

---

## Main Selling Points

1. **Non-European comparison set** — The thing the existing literature does not have. Reznikoff, Watson, Devereux, Jahn, Wolfe-Till — all working in Western European prehistoric or Maltese contexts. If the same band shows up in 16th-century Central Asian Islamic ritual architecture, the universalist reading of the megalithic finding gets stronger (it's about the human voice and dimensional conventions, not Neolithic ritual specifically).

2. **The 111 Hz cross-cultural hit** — Same frequency as Hal Saflieni Oracle Room, appearing independently in Islamic domed chambers built 4,000 years later on a different continent.

3. **Harmonic proof of room modes** — The octave relationship between the two frequency clusters is physical proof these are eigenmodes, not measurement artifacts.

4. **Dimensional convention, not intentional tuning** — A cleaner and more defensible claim than "sacred architecture." The spread across F2–Bb2 looks like a natural consequence of buildings being built in roughly the same human-scale dimensional vocabulary, not deliberate scale-tuning.

5. **Voice-architecture coupling** — The F2–Bb2 band is exactly the male baritone speaking and chanting range: where the adhan sits, Quranic recitation, Gregorian chant, Tibetan throat-chant fundamentals, Vedic udatta–anudatta recitation.

---

## How This Lands Against the Literature

### vs. Wolfe, Swanson & Till (2020) Hypogeum paper
They argued the chamber spectrum was *engineered* — peak frequencies evenly spaced like a whole-tone scale. Our data is interestingly different: the spread across F2–Bb2 looks more like a natural consequence of dimensional vocabulary. That's a cleaner null hypothesis. The megalithic results may actually be the same thing — a dimensional convention rather than acoustic intention.

### The 111 Hz claim
The defensible claim is NOT "Bukhara domes are tuned to the holy frequency"; it's **"the modal fundamentals of small Shaybanid domes fall within the human male baritone vocal range, and 111 Hz appears as a frequent recurring mode."** The first claim is mystical; the second is architectural physics.

### The universalist interpretation
The consistency of the 95–120 Hz band across radically different traditions (Neolithic Europe, Bronze Age Malta, Islamic Central Asia) suggests an **attractor in human ritual architecture** that doesn't require cultural transmission to explain. The room shape that "feels right" for chant ends up being roughly the same room shape worldwide because it's downstream of a single biological constraint: the resonant frequency of the male vocal tract and the dimensions of the human-scaled enclosed space that amplifies it.

---

## Required Sections & Analyses

### 1. Methodology — Make the Pipeline Reproducible

Document and publish the full signal processing chain:

- **Detection threshold rule**: Intensity > -16.5 dB. Specify: above what? (broadband RMS, per-octave-band?), over what time window, with what averaging?
- **Frequency extraction method**: FFT window length, hop size, windowing function (Hann/Blackman), frequency resolution. Need ≥1 Hz bin width to distinguish 111 from 115 Hz (standard 2048-sample windows at 44.1 kHz give ~21.5 Hz bins — too coarse; need ~16k–32k windows or parametric method).
- **Note quantization rule**: How continuous frequency → "A2 = 111 Hz." Snap to nearest equal-tempered semitone? Then "111 Hz" is actually anything from ~108 to ~114 Hz.
- **Sustain measurement**: What counts as "sustained"? Continuous presence above threshold for ≥X seconds, with what allowable gap?

**Pipeline diagram**: raw audio → preprocessing (HPF, normalization) → spectral analysis (method, parameters) → peak detection (criterion) → note quantization (rule) → aggregation (per-track and across-track stats).

### 2. Per-Chamber Metadata Table

| Chamber ID | Building | Approx. Interior Diameter | Approx. Dome Height | Wall Material | Recording Date | # Tracks | Detected Resonance Peaks (Hz) |
|------------|----------|--------------------------|---------------------|---------------|----------------|----------|-------------------------------|
| ... | ... | ... | ... | ... | ... | ... | ... |

Even rough estimates from photos and memory are better than nothing. Reviewers need to know the data isn't 11 recordings of the same room. Identify each chamber by name where possible.

The OBJ files being unreliable for cross-analysis is fine — disclose openly, use only for "approximate dimensions, ±0.5 m" claims, mark as supporting rather than primary evidence.

### 3. Statistical Framing

- Chi-square goodness-of-fit (peak distribution vs. uniform)
- Octave-ratio analysis (measured ratios vs. 2.0, within ±3%)
- Confidence intervals on peak frequency clusters
- Effect sizes rather than just counts

### 4. Harmonic Structure Analysis (Highest Priority)

For each chamber:
- Plot detected peaks on a **log-frequency axis**
- Annotate octave relationships
- Compute ratio of each higher peak to strongest fundamental
- Show whether chambers consistently exhibit f, 2f, (3f), (4f) structure

If clean octave relatives → room-mode behavior (confident claim). If not clean → tangential or oblique modes (chamber asymmetry story).

**This is the single most important addition.** It separates "I heard some resonant pitches" from "these are eigenmodes of a hard-walled cavity."

### 5. Decay-Time (RT60 / EDT) Measurements

Extract from existing audio using Schroeder backward-integration method:
- Use end of sustained sung notes (when singer stops, room decay is captured)
- Report RT60 at 125 Hz, 250 Hz, 500 Hz, 1 kHz octave bands
- Key finding: whether low-frequency RT60 >> mid-frequency RT60 (signature of hard-walled, undamped chamber)
- Tools: Pyroomacoustics, librosa, or scipy

### 6. Vocal-Range Overlay Figure (Hero Image)

A single chart overlaying:
- Our peak histogram (F2 through Bb3)
- Human male baritone speaking range (F2–F3, ~87–175 Hz)
- Quranic recitation fundamental range (~C2–G3)
- The 95–120 Hz "megalithic cluster" from Jahn/Devereux/Watson
- The 110–111 Hz Hal Saflieni peak

**This figure does the interpretive work for the reader in two seconds. It is the figure that gets cited.**

### 7. Comparison to Predicted Modes

Pick one chamber with rough dimensions (even ±1 m):
- Compute predicted axial and tangential modes using rectangular-room formula (first approximation)
- Refine for hemispherical geometry: lowest mode ≈ c / 4R for simplest axial standing wave
- Check if measured peaks fall within ~10% of predicted modes

If they do → physics-based confirmation of room-mode behavior. Ties measurement to first principles.

For a 7 m diameter, 7 m high chamber, expect fundamental in 24–50 Hz range and next strong modes climbing through observed band.

### 8. Limitations Section

Write before reviewers do:

- **OBJ unreliability** — disclose openly; audio is primary evidence, geometry is supporting
- **Recording equipment** — phone microphone vs. field recorder vs. calibrated? If uncalibrated, can't claim absolute SPL but can claim relative spectral content within a single recording
- **Vocal source variability** — different chambers excited by different sung notes biases what resonances found. The fact that 111 Hz reappears across 11 tracks despite source variation is actually *evidence the room is doing the work*
- **Sampling bias** — measured chambers that *felt* resonant (went looking). Proper survey would include non-resonant chambers as controls. State explicitly; suggest as future work
- **Single observer** — all measurements by one person, no inter-rater reliability
- **Causal interpretation** — data shows correlation between chamber type and frequency cluster, NOT that Shaybanid architects intentionally tuned the spaces

### 9. Cultural / Interpretive Frame

Anchor in what the data supports:

**Defensible**: "The dominant resonance band of these chambers (86–119 Hz) overlaps the fundamental frequency range of the human male singing voice. Whether or not Shaybanid architects intended this acoustic property, the rooms function as efficient amplifiers of chant within this register."

**Defensible**: "The recurrence of this band in our Bukhara measurements parallels published findings from prehistoric chambered structures (Newgrange, Wayland's Smithy, Hal Saflieni). This convergence may reflect a shared dimensional vocabulary in human ritual architecture rather than direct cultural transmission."

**Not defensible without evidence**: anything using "tuned," "designed for," "sacred frequency," or "knew about."

**Open question**: Whether the cross-cultural recurrence reflects the constraint that ritual chambers are sized to the human body and the human voice, and therefore converge on similar modal structure regardless of culture.

---

## Data Assets

### Audio Files (Primary Evidence)
All recordings in `/audio_files/` directory:
- 75 total recordings across multiple sites
- Format: .m4a
- Contains: vocal excitation recordings in domed chambers
- Key subset: 11 tracks showing 111 Hz resonance

### 3D Models (Supporting Evidence)
- `/dashboard/public/models_museum_box/` — Museum Box LiDAR scan
- `/dashboard/public/models_north_star/` — North Star Complex scans
- Use: approximate dimensions only (±0.5 m), not reliable for eigenmode computation
- Note: disclose unreliability in paper

### Processed Data
- `/dashboard/public/data/manifest.json` — master manifest with all computed metrics per track
- `/data/*.json` — individual track analysis files with:
  - Time series (frequencies, RMS levels, peak magnitudes)
  - Spectrograms
  - Average spectra
  - Spectral peaks
  - Resonant frequencies
  - Sustained resonation flags

### Analysis Scripts
- `/scripts/analyze_audio.py` — single-file analysis pipeline
- `/scripts/batch_analyze.py` — batch processing all recordings

---

## Charts & Figures Needed

1. **Frequency Distribution Histogram** — all recordings, showing F2–Bb2 clustering (exists in dashboard)
2. **Dominant Frequency by Site** scatter plot (exists in dashboard)
3. **Resonant Frequency Rankings** table — by sustained time and track count (exists in dashboard)
4. **Vocal-Range Overlay** figure (TO CREATE) — the hero image
5. **Harmonic Structure** plot — log-frequency axis with octave annotations (TO CREATE)
6. **RT60 Decay Curves** per chamber at octave bands (TO CREATE)
7. **Per-chamber modal comparison** — measured vs. predicted from dimensions (TO CREATE)
8. **Resonation Detection** timeline — showing threshold crossings per track (exists in dashboard)
9. **Chi-square distribution** plot showing significance of clustering (TO CREATE)

---

## Calculation Methods

### Resonation Detection
- **Threshold**: RMS intensity > -16.5 dB (relative to track peak)
- **Sustained**: Continuous segments above threshold for >1 second
- **Frequency at resonation**: Interpolated dominant frequency during above-threshold segments

### Resonant Frequency Clustering
- Sort all frequencies detected during resonation
- Group frequencies with ≤10 Hz gap into bands
- Average each band (weighted by duration)
- Report as center frequency ±3 Hz

### Harmonic Ratio Computation
- For each chamber: identify strongest fundamental peak
- Compute ratio of each higher peak to fundamental
- Report deviations from exact integer ratios

### RT60 Extraction (To Implement)
- Identify note-off moments in recordings
- Apply Schroeder backward integration
- Fit decay curve, report T60 at octave bands
- Tools: scipy signal processing

### Statistical Tests
- **Chi-square**: Expected uniform distribution across 50–420 Hz in 10 Hz bins vs. observed
- **Octave-ratio test**: Mean ratio ± SD vs. theoretical 2.0
- **Clustering significance**: Bootstrap resampling to establish p-value for F2–Bb2 concentration

---

## Web "Research" Section Structure

1. **Overview** — one paragraph, the headline finding: 11 Bukhara chambers, dominant resonance F2–Bb2, peak at A2/111 Hz
2. **The Dataset** — chambers, dates, recordings with audio embeds
3. **Method** — pipeline, threshold rule, frequency extraction
4. **Results** — tables, harmonic-structure plot, vocal-range overlay
5. **Comparison to Existing Literature** — megalithic, Ottoman, Persian
6. **Limitations**
7. **Open Questions / Future Work**
8. **Citations and Bibliography**
9. **Raw Data and Analysis Code** — link to GitHub (this is what gets you taken seriously by acousticians)

> The single best thing you can do for credibility is publish the audio files and the analysis script alongside the paper. Reviewers and acousticians will replicate, criticize, and ultimately cite something they can poke at; they'll ignore something they can't.

---

## Field Session Additions (Next Trip)

For the inevitable v2 dataset, additions to make:
- **Reference impulse** (balloon pop or starter pistol) per chamber for unambiguous RT60
- **Tape measure or laser rangefinder** for chamber dimensions
- **Sine sweep** from a small portable speaker (standard archaeoacoustic protocol) for controlled excitation
- **Recordings from multiple positions** per chamber (modal pressure varies by location)
- **Non-domed control chamber** — small square madrasa room with flat ceiling. If no cluster → dome geometry doing the work. If cluster → just chamber size.

---

## Key References

- Jahn, R.G., Devereux, P., Ibison, M. (1996). "Acoustical Resonances of Assorted Ancient Structures." *JASA* 99(2).
- Watson, A., Keating, D. (1999). "Architecture and Sound: An Acoustic Analysis of Megalithic Monuments." *Antiquity* 73.
- Reznikoff, I. (2006). "The Evidence of the Use of Sound Resonance from Palaeolithic to Medieval Times." *Archaeoacoustics*.
- Wolfe, J., Swanson, D., Till, R. (2020). "Acoustics of the Hal Saflieni Hypogeum." *JASA*.
- Fazenda, B., et al. (2017). "Cave Acoustics in Prehistory." *JASA* 142(3).
- Devereux, P., Jahn, R.G. (1996). "Preliminary Investigations and Cognitive Considerations of the Acoustical Resonances of Selected Archaeological Sites." *Antiquity* 70.

---

## Priority Order for Next Steps

1. **Harmonic structure analysis** (item 4) — highest leverage
2. **Per-chamber metadata table** (item 2) — transforms from pooled measurement to comparative study
3. **Vocal-range overlay figure** (item 6) — easy third add, hero image for publication
4. Statistical framing with chi-square tests
5. RT60 extraction from existing audio
6. Predicted mode comparison for one chamber
7. Write methodology section
8. Write limitations
9. Write interpretive frame
10. Structure as web research page

Everything else can be staged — write the v1 paper with what you have, get expert feedback, and let v2 incorporate RT60, dimensional checks, and a controlled-protocol return trip.
