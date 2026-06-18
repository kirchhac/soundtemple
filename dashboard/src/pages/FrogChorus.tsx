import React, { useEffect, useState } from 'react';
import './FrogChorus.css';

type SurrogateResult = {
  voice: string;
  observed_peak: number | null;
  p_vs_poisson: number | null;
  p_vs_shuffled_ici: number | null;
  note?: string;
};

type IciStats = {
  n_intervals: number;
  mean_s: number;
  cv: number;
  ks_stat_vs_exp: number;
  ks_p_vs_exp: number;
} | null;

type PeResult = {
  observed_norm_pe: number;
  null_mean: number;
  p_observed_below_null: number;
} | null;

type Results = {
  recording: string;
  duration_s: number;
  voices: Record<string, { band_hz: [number, number]; n_calls: number }>;
  ici_stats: Record<string, IciStats>;
  surrogate_test_autocorr_peak: SurrogateResult[];
  permutation_entropy: Record<string, PeResult>;
};

const RECORDINGS = [
  { id: 'frogs_1', title: 'Frogs #1', duration: '2:57' },
  { id: 'frogs_2', title: 'Frogs #2', duration: '2:32' },
];

// Publication figures (frogs/scripts/make_figures.py), each with a plain-language
// "what it shows / how to read it / why it matters" reading guide.
const FIGURES = [
  {
    src: 'fig1_random_vs_observed__frogs_1.png',
    title: 'What random looks like vs. what the frogs do',
    shows:
      'The same calls and the same four voices over a 50-second window, under ' +
      'random timing (left) and as actually recorded (right).',
    howRead:
      'The top rows are call rasters — each vertical tick is one detected call, ' +
      'one coloured row per frequency-band voice. The bottom row is the combined ' +
      'call-rate of all voices over time. The left column is a simulation of the ' +
      'null hypothesis (each voice fires independently and at random, keeping its ' +
      'real call count); the right column is the measured recording. Throughout the ' +
      'paper, grey marks what randomness predicts and crimson marks the observed chorus.',
    why:
      'Under randomness the calls spread out evenly and the combined rate is shapeless ' +
      'noise. In the recording the calls instead collapse into shared bursts separated ' +
      'by near-silence — structure you can see by eye, before any statistics.',
  },
  {
    src: 'fig2_null_test.png',
    title: 'The observed timing structure is unreachable by chance',
    shows:
      'How rhythmic each voice is, compared against the rhythmicity a random chorus ' +
      'produces, for all eight voices (four per recording).',
    howRead:
      'The horizontal axis is the strongest non-zero peak of each voice’s ' +
      'autocorrelation — a single number for "how rhythmic." The grey histogram is ' +
      '400 random (Poisson) surrogates with that voice’s call count; the crimson line ' +
      'is the value actually observed. "≈ N× chance" is how many times the average ' +
      'random score the observation reaches.',
    why:
      'In every panel the observed value sits far to the right of the entire grey ' +
      'cloud: none of 500 random surrogates ever matched it (p < 0.002 in all eight ' +
      'voices). This is the formal rejection of the random null — the load-bearing result.',
  },
  {
    src: 'fig3_ici_distributions.png',
    title: 'Intervals reject the random (exponential) law',
    shows:
      'The distribution of gaps between one call and the next, against the ' +
      'distribution a random chorus would produce.',
    howRead:
      'The horizontal axis is the inter-call interval in seconds; the vertical axis is ' +
      'density on a log scale. Coloured bars are the observed gaps; the black dashed ' +
      'curve is the exponential distribution predicted by an independent-Poisson ' +
      'process. CV is the coefficient of variation (exactly 1 for a random process), ' +
      'and the KS p-value tests whether the observed gaps could have come from that ' +
      'exponential.',
    why:
      'A random process gives a smooth exponential decay. The frogs instead pile up at ' +
      'a preferred interval and carry a heavy tail of long silences, and a ' +
      'Kolmogorov–Smirnov test rejects the exponential in every voice (p ≤ 9×10⁻⁶) — ' +
      'a second, independent line of evidence against randomness.',
  },
  {
    src: 'fig4_autocorrelation.png',
    title: 'The chorus rhythm rises above the random noise floor',
    shows:
      'How self-similar the whole chorus is at each time delay, against the range a ' +
      'random chorus stays within.',
    howRead:
      'The horizontal axis is the time lag in seconds; the vertical axis is the ' +
      'autocorrelation of the combined call train. The crimson line is observed; the ' +
      'grey band is the 99% range of independent-Poisson surrogates. Anywhere the ' +
      'crimson rises above the grey band marks genuine repeating structure.',
    why:
      'A random chorus would stay pinned inside the thin grey band at zero. The real ' +
      'chorus escapes it twice — a sharp refractory/burst shoulder at short lag and a ' +
      'broad ≈ 2–3 second envelope — pinpointing where in time the rhythm lives.',
  },
  {
    src: 'fig5_synchrony.png',
    title: 'Voices fire together — synchrony, not turn-taking',
    shows:
      'Whether the voices alternate (take turns) or call at the same moments.',
    howRead:
      'Panel (a) is the cross-correlation of one voice pair: a peak at lag 0 means the ' +
      'two call simultaneously, a dip at lag 0 would mean turn-taking, and the grey band ' +
      'is the random range. Panels (b) and (c) give the lag-0 correlation for every ' +
      'voice pair in each recording (red = call together, grey ≈ unrelated).',
    why:
      'Every pair peaks at lag 0 and sits well above the random band: the chorus cycles ' +
      'between "all calling" and "all silent" in phase. That collective, in-phase ' +
      'self-organization is exactly what the entropy-reduction account predicts.',
  },
];

// Legacy per-recording diagnostic plots from the original pipeline (Appendix).
const DIAG_PLOTS = [
  { key: 'spectrogram', title: 'Spectrogram with voice bands' },
  { key: 'onsets', title: 'Detected onsets per voice band' },
  { key: 'autocorrelation', title: 'Per-voice autocorrelation' },
  { key: 'cross_correlation', title: 'Cross-voice cross-correlation' },
  { key: 'surrogate_test', title: 'Surrogate-data significance test' },
  { key: 'ici_distributions', title: 'Inter-call interval vs Poisson' },
];

const REFERENCES = [
  'Friston, K. (2010). The free-energy principle: a unified brain theory? Nature Reviews Neuroscience, 11(2), 127–138.',
  'Shannon, C. E. (1948). A mathematical theory of communication. Bell System Technical Journal, 27, 379–423.',
  'Wells, K. D. (1977). The social behaviour of anuran amphibians. Animal Behaviour, 25, 666–693.',
  'Greenfield, M. D. (1994). Synchronous and alternating choruses in insects and anurans: common mechanisms and diverse functions. American Zoologist, 34(6), 605–615.',
  'Couzin, I. D. (2009). Collective cognition in animal groups. Trends in Cognitive Sciences, 13(1), 36–43.',
  'Strogatz, S. H. (2003). Sync: The Emerging Science of Spontaneous Order. Hyperion.',
  'Bandt, C., & Pompe, B. (2002). Permutation entropy: a natural complexity measure for time series. Physical Review Letters, 88(17), 174102.',
];

function formatP(p: number | null): string {
  if (p === null) return '—';
  if (p < 0.002) return '< 0.002';
  return p.toFixed(3);
}

function VerdictBadge({ p }: { p: number | null }) {
  if (p === null) return <span className="verdict verdict-skip">n/a</span>;
  if (p < 0.05)
    return <span className="verdict verdict-yes">reject random</span>;
  return <span className="verdict verdict-no">consistent w/ random</span>;
}

export default function FrogChorus() {
  const [results, setResults] = useState<Record<string, Results | null>>({
    frogs_1: null,
    frogs_2: null,
  });

  useEffect(() => {
    Promise.all(
      RECORDINGS.map(r =>
        fetch(`/frogs/plots/${r.id}/results.json`)
          .then(res => res.json())
          .then((data: Results) => [r.id, data] as const)
          .catch(() => [r.id, null] as const),
      ),
    ).then(entries => setResults(Object.fromEntries(entries)));
  }, []);

  return (
    <article className="frog-paper">
      <header className="paper-head">
        <div className="paper-venue">Sound Temple · Archaeoacoustic Research</div>
        <h1 className="paper-title">
          Frog Chorus as Environmental Entropy Reduction
        </h1>
        <p className="paper-subtitle">
          Testing non-random call timing as a necessary precondition for
          collective communication
        </p>
        <div className="paper-authors">Drew Kirchhoff</div>
        <div className="paper-meta">
          June 2026 · Field study · two ~2–3 min multi-frog chorus recordings
        </div>
      </header>

      <section className="paper-abstract">
        <h2>Abstract</h2>
        <p>
          Why do frogs chorus? The standard account is sexual selection —
          overlapping male advertisement calls competing for mates. We explore a
          complementary, information-theoretic account motivated by the
          free-energy principle: organisms persist by minimizing uncertainty
          about their environment, and communication is a mechanism for doing so.
          A chorus may function as a <em>collective sensor</em> whose aggregate
          call train broadcasts continuous evidence about local safety — but only
          if its calls are temporally structured rather than independent. As the
          necessary precondition, we test whether call timing in two field
          recordings of a multi-frog chorus is non-random. Separating each chorus
          into four frequency-band voices and comparing against rate-matched
          surrogate data, we reject the independent-Poisson null in every voice
          (<em>p</em> &lt; 0.002), find inter-call-interval distributions that
          reject the exponential law (KS <em>p</em> ≤ 9×10⁻⁶), and show that
          voices co-fire in synchrony rather than taking turns. The chorus is
          decisively self-organized in time. We discuss why this is consistent
          with — but not yet proof of — the entropy-reduction hypothesis, and
          outline experiments that would disambiguate it.
        </p>
        <div className="paper-keywords">
          <strong>Keywords:</strong> bioacoustics · self-organization · free-energy
          principle · information theory · surrogate data · anuran chorus
        </div>
      </section>

      <nav className="paper-toc" aria-label="Contents">
        <span className="toc-label">Contents</span>
        <ol>
          <li><a href="#intro">1 Introduction</a></li>
          <li><a href="#methods">2 Data and Methods</a></li>
          <li><a href="#results">3 Results</a></li>
          <li><a href="#discussion">4 Discussion</a></li>
          <li><a href="#conclusion">5 Conclusion</a></li>
          <li><a href="#references">References</a></li>
        </ol>
      </nav>

      {/* ───────────────────────── 1. Introduction ───────────────────────── */}
      <section id="intro" className="paper-section">
        <h2>1. Introduction</h2>

        <h3>1.1 Entropy, self-organization, and the free-energy principle</h3>
        <p>
          Living systems persist by resisting the universal drift toward
          disorder: they hold themselves in a narrow set of low-entropy states
          far from thermodynamic equilibrium. Friston’s free-energy principle
          formalizes what this requires — any system that endures must minimize a
          variational bound on the <em>surprise</em> of its sensory states,
          which is equivalent to keeping its internal model’s uncertainty about
          the environment low. Put plainly: a system that predicts and reduces
          uncertainty about its surroundings occupies a smaller, more survivable
          region of state space, while one that does not is dispersed by entropy.
          Reducing environmental uncertainty is therefore not incidental to
          survival — it is close to a definition of it.
        </p>

        <h3>1.2 Communication as uncertainty reduction</h3>
        <p>
          If minimizing uncertainty raises survival odds, then any mechanism that
          imports reliable information about the environment is adaptive.
          Communication is such a mechanism. In Shannon’s terms a signal is
          valuable precisely insofar as it reduces a receiver’s uncertainty
          (entropy) over the state of the world. We propose reading a frog chorus
          as a <em>collective sensor and broadcast</em>: each call is a costly,
          honest token that its emitter is alive and un-predated at that instant,
          and the aggregate call train is a continuous stream of “all-clear”
          evidence, distributed across many emitters and audible to the whole
          pond. The key move is informational. If the calls are independent
          Poisson events, the chorus conveys no more than the sum of its parts.
          But if the calls are temporally structured — turn-taking, antiphony, or
          rhythmic locking — the group has self-organized into a higher-order unit
          that carries more information than its members do individually, and can
          track the environment more tightly than any frog alone. Whether such
          structure exists is an empirical question, and the one we test here.
        </p>

        <h3>1.3 Hypotheses</h3>
        <p>
          We frame the test as a contest between a structured account and a random
          null. This study can only <em>falsify the null</em>: rejecting it is
          necessary for the entropy-reduction account and consistent with it, but
          does not by itself prove it over alternatives (mutual acoustic masking,
          a sexual-selection rhythm preference, or a shared external driver). We
          return to these in the Discussion.
        </p>
        <div className="paper-hyp">
          <div className="hyp-row">
            <span className="hyp-tag h1">H1</span>
            <span>
              <strong>Entropy reduction via self-organization.</strong> Calls are
              not independent Poisson events; inter-call timing shows periodicity,
              turn-taking, or rhythmic locking that cannot be explained by each
              frog calling independently at its own rate.
            </span>
          </div>
          <div className="hyp-row">
            <span className="hyp-tag h0">H0</span>
            <span>
              <strong>Random independence (null).</strong> Each frog calls as an
              independent Poisson process at its own characteristic rate. The
              composite is a superposition of independent processes: inter-call
              intervals are exponentially distributed and cross-voice timing is
              uncorrelated.
            </span>
          </div>
        </div>
      </section>

      {/* ───────────────────────── 2. Methods ───────────────────────── */}
      <section id="methods" className="paper-section">
        <h2>2. Data and Methods</h2>

        <h3>2.1 Recordings</h3>
        <p>
          Two field recordings of a multi-frog chorus were captured on an iPhone
          Voice Memo, each roughly two to three minutes, with about four
          distinguishable frog voices by ear — one large bullfrog and several
          smaller frogs. The raw audio is below.
        </p>
        <div className="paper-recordings">
          {RECORDINGS.map(r => (
            <div key={r.id} className="paper-rec">
              <div className="paper-rec-title">
                {r.title} <span className="paper-rec-dur">{r.duration}</span>
              </div>
              <audio controls preload="metadata" src={`/frogs/audio/${r.id}.m4a`} />
            </div>
          ))}
        </div>

        <h3>2.2 Voice separation and onset detection</h3>
        <p>
          Different frog species and body sizes call at different fundamental
          frequencies, so we split each signal into four frequency bands — V1 (80–300 Hz),
          V2 (300–800 Hz), V3 (800–2000 Hz), V4 (2000–5000 Hz) — and treat each band
          as a separate “voice.” Within each band we take the Hilbert envelope and
          detect call onsets as envelope peaks above an adaptive threshold
          (median + 6·MAD), with a 120 ms refractory period to avoid
          double-counting. This yields one onset train per voice.
        </p>

        <h3>2.3 Surrogate-data significance tests</h3>
        <p>
          The load-bearing analysis is a surrogate-data test. For each statistic
          computed on the real data we build a null distribution by recomputing
          the same statistic on many random datasets that preserve the marginal
          call rate but destroy temporal structure:{' '}
          <strong>Poisson surrogates</strong> (the same number of calls placed
          uniformly at random) and <strong>shuffled-ICI surrogates</strong> (the
          observed intervals randomly re-ordered). We test the peak of each
          voice’s autocorrelation, the inter-call-interval distribution (against
          an exponential), cross-voice cross-correlation, and the permutation
          entropy of the interval sequence. Random seeds are fixed, so every
          p-value reproduces exactly. Full method in{' '}
          <code>frogs/DESIGN.md</code>; pipeline in{' '}
          <code>frogs/scripts/analyze_chorus.py</code>.
        </p>
      </section>

      {/* ───────────────────────── 3. Results ───────────────────────── */}
      <section id="results" className="paper-section">
        <h2>3. Results</h2>

        <h3>3.1 Per-voice significance</h3>
        <p>
          Across all four voices in both recordings the call train departs
          dramatically from an independent Poisson process. The table reports, per
          voice, the coefficient of variation of inter-call intervals, the
          p-value of the autocorrelation peak against Poisson and shuffled-ICI
          nulls, and the permutation-entropy p-value.
        </p>
        {RECORDINGS.map(r => {
          const data = results[r.id];
          if (!data)
            return (
              <div key={r.id} className="paper-loading">Loading {r.title}…</div>
            );
          return (
            <div key={r.id} className="paper-table-wrap">
              <div className="paper-table-cap">{r.title}</div>
              <table className="paper-table">
                <thead>
                  <tr>
                    <th>Voice (Hz)</th>
                    <th>n calls</th>
                    <th>CV</th>
                    <th>p vs Poisson</th>
                    <th>p vs Shuffled-ICI</th>
                    <th>PE p</th>
                    <th>Verdict</th>
                  </tr>
                </thead>
                <tbody>
                  {data.surrogate_test_autocorr_peak.map(sr => {
                    const voice = data.voices[sr.voice];
                    const ici = data.ici_stats[sr.voice];
                    const pe = data.permutation_entropy[sr.voice];
                    return (
                      <tr key={sr.voice}>
                        <td>
                          <strong>{sr.voice}</strong>
                          <br />
                          <span className="paper-band">
                            {voice.band_hz[0]}–{voice.band_hz[1]}
                          </span>
                        </td>
                        <td>{voice.n_calls}</td>
                        <td>{ici ? ici.cv.toFixed(2) : '—'}</td>
                        <td className="paper-mono">{formatP(sr.p_vs_poisson)}</td>
                        <td className="paper-mono">
                          {formatP(sr.p_vs_shuffled_ici)}
                        </td>
                        <td className="paper-mono">
                          {pe ? formatP(pe.p_observed_below_null) : '—'}
                        </td>
                        <td><VerdictBadge p={sr.p_vs_poisson} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          );
        })}
        <p className="paper-note">
          The Poisson null is rejected emphatically everywhere. The shuffled-ICI
          null is <em>not</em> rejected by the autocorrelation peak — informative,
          not a failure: it means the burstiness is already captured by the
          distribution of intervals, while permutation entropy (significant in 6
          of 8 voices) shows the <em>order</em> of intervals also carries
          structure.
        </p>

        <h3>3.2 Figures</h3>
        <p>
          Each figure below contrasts the random null (grey) with the observed
          chorus (crimson), and is followed by a short guide to what it shows, how
          to read it, and why it matters.
        </p>
        {FIGURES.map((f, i) => (
          <figure className="paper-figure" id={`fig${i + 1}`} key={f.src}>
            <img src={`/frogs/figures/${f.src}`} alt={f.title} loading="lazy" />
            <figcaption>
              <p className="fig-cap-title">
                <span className="fig-num">Figure {i + 1}.</span> {f.title}
              </p>
              <p>
                <span className="fig-lbl">What it shows.</span> {f.shows}
              </p>
              <p>
                <span className="fig-lbl">How to read it.</span> {f.howRead}
              </p>
              <p>
                <span className="fig-lbl">Why it matters.</span> {f.why}
              </p>
            </figcaption>
          </figure>
        ))}
      </section>

      {/* ───────────────────────── 4. Discussion ───────────────────────── */}
      <section id="discussion" className="paper-section">
        <h2>4. Discussion</h2>
        <p>
          The null of random independence is refuted decisively: the chorus has
          shared temporal structure across all four voice bands, the
          interval distributions are non-exponential, and the voices co-fire on a
          common ≈ 2–3 second envelope. This is the necessary first step for
          treating the chorus as a self-organized communicative unit, and it is
          consistent with the entropy-reduction account of Section 1.
        </p>
        <p>
          It does not, however, prove that account. Synchronous co-firing is{' '}
          <em>equally</em> consistent with at least three alternatives:{' '}
          <strong>shared external entrainment</strong> (wind, light, or ambient
          sound driving all frogs identically — a hidden common cause that mimics
          coordination without communication); an{' '}
          <strong>acoustic chorus-leader effect</strong> (one dominant individual
          sets a beat the others time to — communicative but hierarchical); and a{' '}
          <strong>sexual-selection rhythm preference</strong> (chorus rhythm as
          the equilibrium of competitive individual display). Distinguishing these
          requires intervention, not just observation.
        </p>
      </section>

      {/* ───────────────────────── 5. Conclusion ───────────────────────── */}
      <section id="conclusion" className="paper-section">
        <h2>5. Conclusion and future work</h2>
        <p>
          Two ~2-minute recordings are enough to show, conclusively, that this
          chorus is not random — a precondition the entropy-reduction hypothesis
          had to clear and did. To move from “self-organized” to “communicating to
          reduce environmental uncertainty,” the decisive next steps are{' '}
          <strong>playback experiments</strong> (does the natural chorus
          phase-lock to a hidden synthetic call?), <strong>disturbance
          experiments</strong> (does a brief predator cue trigger collective
          silence and structured re-emergence?), <strong>multi-microphone
          localization</strong> (separating individuals spatially rather than by
          band), and <strong>longer recordings</strong> for sharper ordinal
          statistics. Only intervention can separate a listening, self-organizing
          chorus from one merely entrained by a shared driver.
        </p>
      </section>

      {/* ───────────────────────── References ───────────────────────── */}
      <section id="references" className="paper-section">
        <h2>References</h2>
        <ol className="paper-refs">
          {REFERENCES.map((ref, i) => (
            <li key={i}>{ref}</li>
          ))}
        </ol>
      </section>

      {/* ───────────────────────── Appendix ───────────────────────── */}
      <section id="appendix" className="paper-section">
        <h2>Appendix A. Supplementary diagnostic plots</h2>
        <p className="paper-note">
          Raw per-recording diagnostics from the analysis pipeline, retained for
          completeness. The publication figures in Section 3.2 are the curated
          versions of these.
        </p>
        {RECORDINGS.map(r => (
          <div key={r.id} className="paper-appendix-group">
            <h3>{r.title}</h3>
            <div className="paper-appendix-grid">
              {DIAG_PLOTS.map(p => (
                <figure key={p.key} className="paper-appendix-plot">
                  <img
                    src={`/frogs/plots/${r.id}/${p.key}.png`}
                    alt={`${r.title} ${p.title}`}
                    loading="lazy"
                  />
                  <figcaption>{p.title}</figcaption>
                </figure>
              ))}
            </div>
          </div>
        ))}
      </section>
    </article>
  );
}
