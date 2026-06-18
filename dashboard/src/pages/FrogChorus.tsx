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

const PLOTS = [
  { key: 'spectrogram', title: 'Spectrogram with voice bands' },
  { key: 'onsets', title: 'Detected onsets per voice band' },
  { key: 'autocorrelation', title: 'Per-voice autocorrelation' },
  { key: 'cross_correlation', title: 'Cross-voice cross-correlation' },
  { key: 'surrogate_test', title: 'Surrogate-data significance test' },
  { key: 'ici_distributions', title: 'Inter-call interval vs Poisson' },
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
    ).then(entries => {
      setResults(Object.fromEntries(entries));
    });
  }, []);

  return (
    <div className="frog-chorus">
      <header className="frog-header">
        <h2>Frog Chorus — Communication as Entropy Reduction</h2>
        <p className="frog-sub">
          Do chorusing frogs collectively self-organize their calls to reduce
          uncertainty about the environment? A first-pass test: are the call
          sequences anywhere distinguishable from random?
        </p>
      </header>

      <section className="frog-section">
        <h3>The Hypothesis</h3>
        <p>
          The standard sexual-selection account treats anuran chorusing as
          competing male advertisement calls. An alternative (non-exclusive)
          account: the chorus is a <em>collective sensor and broadcast</em>.
          Each call is an honest "I am alive and not currently being eaten"
          token; the aggregate train is a continuous stream of all-clear
          signals across many emitters. If calls are independent Poisson
          events, the chorus carries no more information than the sum of its
          parts. If calls are temporally structured — turn-taking, antiphony,
          rhythmic locking — the chorus has self-organized into a higher-order
          communicative unit and is reducing environmental uncertainty for
          listeners.
        </p>
        <p>
          This page tests the <em>necessary precondition</em>: are the calls
          non-random? Rejecting Poisson independence is consistent with the
          entropy-reduction account but does not by itself prove it over
          alternative mechanisms (sexual-selection rhythm, mutual acoustic
          masking, shared external entrainment). See{' '}
          <code>frogs/DESIGN.md</code> in the repo for the full framing.
        </p>
      </section>

      <section className="frog-section">
        <h3>The Recordings</h3>
        <div className="frog-recordings">
          {RECORDINGS.map(r => (
            <div key={r.id} className="frog-recording-card">
              <div className="frog-recording-title">
                {r.title}{' '}
                <span className="frog-recording-duration">{r.duration}</span>
              </div>
              <audio
                controls
                preload="metadata"
                src={`/frogs/audio/${r.id}.m4a`}
              />
            </div>
          ))}
        </div>
      </section>

      <section className="frog-section">
        <h3>Results — Is the Chorus Random?</h3>
        {RECORDINGS.map(r => {
          const data = results[r.id];
          if (!data)
            return (
              <div key={r.id} className="frog-results-loading">
                Loading {r.title}…
              </div>
            );
          return (
            <div key={r.id} className="frog-recording-results">
              <h4>{r.title}</h4>
              <table className="frog-table">
                <thead>
                  <tr>
                    <th>Voice (Hz)</th>
                    <th>n calls</th>
                    <th>CV (ICI)</th>
                    <th>p vs Poisson</th>
                    <th>p vs Shuffled-ICI</th>
                    <th>PE p-value</th>
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
                          <span className="frog-band">
                            {voice.band_hz[0]}–{voice.band_hz[1]}
                          </span>
                        </td>
                        <td>{voice.n_calls}</td>
                        <td>{ici ? ici.cv.toFixed(2) : '—'}</td>
                        <td className="frog-mono">
                          {formatP(sr.p_vs_poisson)}
                        </td>
                        <td className="frog-mono">
                          {formatP(sr.p_vs_shuffled_ici)}
                        </td>
                        <td className="frog-mono">
                          {pe ? formatP(pe.p_observed_below_null) : '—'}
                        </td>
                        <td>
                          <VerdictBadge p={sr.p_vs_poisson} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          );
        })}
      </section>

      <section className="frog-section">
        <h3>Headline</h3>
        <ul className="frog-takeaways">
          <li>
            <strong>Poisson independence is decisively rejected</strong>{' '}
            (p &lt; 0.002) in every voice in both recordings. Calls cluster
            into bursts no random process would produce.
          </li>
          <li>
            <strong>Inter-call interval ordering is non-random</strong> in 6 of
            8 voice/recording combinations (permutation entropy below
            shuffled-ICI null at p ≤ 0.01). The sequence of long/short
            intervals carries structure beyond their marginal distribution.
          </li>
          <li>
            <strong>Voices co-fire in synchrony</strong>, not turn-taking. The
            cross-correlation plot shows a strong positive peak at lag = 0 for
            every voice pair — the chorus cycles between "all calling" and
            "all silent" together, on a shared ~2–3 s envelope.
          </li>
          <li>
            <strong>What we cannot yet claim:</strong> that this
            self-organization exists <em>for the purpose of</em> reducing
            environmental entropy. Shared external entrainment, chorus-leader
            effects, and sexual-selection rhythm preferences all predict
            similar structure. See{' '}
            <code>frogs/RESULTS.md §5</code> for disambiguating experiments.
          </li>
        </ul>
      </section>

      <section className="frog-section">
        <h3>Plots</h3>
        {RECORDINGS.map(r => (
          <div key={r.id} className="frog-plot-group">
            <h4>{r.title}</h4>
            <div className="frog-plot-grid">
              {PLOTS.map(p => (
                <figure key={p.key} className="frog-plot">
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
    </div>
  );
}
