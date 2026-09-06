export function AboutPage() {
  return (
    <div className="about-page">
      <header className="about-header">
        <div>
          <div className="eyebrow">ABOUT THE BENCH</div>
          <h1>
            A record of the experiment<span className="accent">.</span>
          </h1>
          <p>
            Remote Viewing Bench is a local workspace for running, comparing,
            and refining blinded remote-viewing experiments with language
            models.
          </p>
        </div>
      </header>

      <section className="about-intro panel">
        <div className="about-statement">
          <span className="about-mark" aria-hidden="true">
            ◉
          </span>
          <p>
            The bench keeps the target out of the initial prompt, records each
            model’s first impressions, and introduces the reveal only when it is
            time to evaluate correspondence.
          </p>
        </div>
      </section>

      <div className="about-grid">
        <section className="panel about-section">
          <div className="eyebrow">THE WORKFLOW</div>
          <h2>One run, three stages</h2>
          <ol className="about-steps">
            <li>
              <span>01</span>
              <div>
                <h3>Prepare</h3>
                <p>
                  Choose an envelope code, project scope, prompt version, and
                  the models you want to compare.
                </p>
              </div>
            </li>
            <li>
              <span>02</span>
              <div>
                <h3>Record</h3>
                <p>
                  Capture independent responses before any target description or
                  image is added to the run.
                </p>
              </div>
            </li>
            <li>
              <span>03</span>
              <div>
                <h3>Reveal & evaluate</h3>
                <p>
                  Add the actual target, then compare responses with a
                  structured 0–7 correspondence rubric.
                </p>
              </div>
            </li>
          </ol>
        </section>

        <section className="panel about-section">
          <div className="eyebrow">GUIDING PRINCIPLES</div>
          <h2>Built for careful iteration</h2>
          <div className="principle-list">
            <article>
              <h3>Local by design</h3>
              <p>
                Experiment records and target images stay in the local
                workspace. Model and tracing requests use the connections you
                configure.
              </p>
            </article>
            <article>
              <h3>Versioned evidence</h3>
              <p>
                Prompts, responses, reveals, corrections, and evaluation batches
                remain attached to the history that produced them.
              </p>
            </article>
            <article>
              <h3>Scores need context</h3>
              <p>
                The correspondence score is a qualitative research aid, not a
                percentage, probability, or statistical test.
              </p>
            </article>
          </div>
        </section>
      </div>

      <section className="about-note">
        <span>EXPERIMENTAL · V1.0</span>
        <p>
          This is personal research software for documenting a method as it
          evolves. It does not claim to establish scientific validity.
        </p>
      </section>
    </div>
  );
}
