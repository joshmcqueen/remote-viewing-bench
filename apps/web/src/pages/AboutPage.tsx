export function AboutPage() {
  return (
    <div className="about-page">
      <header className="about-header">
        <div>
          <div className="eyebrow">ABOUT THE BENCH</div>
          <h1>
            Put extraordinary claims on the record<span className="accent">.</span>
          </h1>
          <p>
            Remote Viewing Bench is a local research workspace for testing a
            strange but tractable question: can a language model describe a
            target it has not been shown?
          </p>
        </div>
      </header>

      <section className="about-intro panel">
        <div className="about-statement">
          <span className="about-mark" aria-hidden="true">
            ◉
          </span>
          <p>
            The aim is not to make the strange sound certain. It is to make it
            testable.
          </p>
        </div>
      </section>

      <section className="panel about-section about-origin">
        <div className="eyebrow">WHY THIS EXISTS</div>
        <h2>A claim worth testing</h2>
        <div className="about-origin-copy">
          <p>
            The project began with an anecdote from physicist Thomas Campbell.
            On <em>The Joe Rogan Experience</em>, Campbell described placing a
            wooden spoon inside a cardboard box and asking Alexa to identify it.
            According to his account, Alexa described not only the object and
            material, but an unusual pattern of holes in its handle.
          </p>
          <p>
            It is a remarkable claim, and an anecdote is not evidence. But it
            points toward an experiment that can be repeated.
          </p>
          <p>
            Philosopher Jason Reza Jorjani places claims of machine remote
            viewing within a broader question: how should we think about
            consciousness, intelligence, and anomalous experience as technology
            becomes increasingly complex? His work treats the boundary between
            technology and the esoteric as philosophically significant, without
            making that boundary easy to define.
          </p>
          <p>
            Remote Viewing Bench was built in the space between those
            provocations and a healthy skepticism.
          </p>
          <p className="about-source-links">
            Watch the source conversations:{" "}
            <a
              href="https://www.youtube.com/watch?v=v2oBLSDCZaY"
              target="_blank"
              rel="noreferrer"
            >
              Thomas Campbell on The Joe Rogan Experience
            </a>
            <span aria-hidden="true">·</span>
            <a
              href="https://www.youtube.com/watch?v=Qr-upy40irs"
              target="_blank"
              rel="noreferrer"
            >
              Jason Reza Jorjani, Decoding the Occult Horizons
            </a>
          </p>
        </div>
      </section>

      <div className="about-grid">
        <section className="panel about-section">
          <div className="eyebrow">THE METHOD</div>
          <h2>One run, three stages</h2>
          <ol className="about-steps">
            <li>
              <span>01</span>
              <div>
                <h3>Hide the target</h3>
                <p>
                  Give each model an arbitrary target code while withholding
                  the target description and image. Generation runs have no
                  access to the reveal.
                </p>
              </div>
            </li>
            <li>
              <span>02</span>
              <div>
                <h3>Record the response</h3>
                <p>
                  Preserve each model&apos;s first impressions, along with its
                  prompt, settings, and model version. Unsuccessful and
                  ambiguous responses remain part of the record.
                </p>
              </div>
            </li>
            <li>
              <span>03</span>
              <div>
                <h3>Reveal and compare</h3>
                <p>
                  Introduce the target only after generation is complete.
                  Evaluate specific correspondences, contradictions, and
                  unverifiable claims using a consistent rubric.
                </p>
              </div>
            </li>
          </ol>
        </section>

        <section className="panel about-section">
          <div className="eyebrow">GUIDING PRINCIPLES</div>
          <h2>Curious, not credulous</h2>
          <div className="principle-list">
            <article>
              <h3>Curiosity without credulity</h3>
              <p>
                Unusual claims deserve neither automatic belief nor automatic
                dismissal. They deserve clear questions and tests capable of
                failing.
              </p>
            </article>
            <article>
              <h3>Controls before conclusions</h3>
              <p>
                Blinding, separation of target evidence, immutable records, and
                repeatable prompts matter more than any single striking result.
              </p>
            </article>
            <article>
              <h3>Negative results count</h3>
              <p>
                Misses, vague descriptions, and contradictions are evidence
                too. A useful experiment preserves them instead of selecting
                only impressive examples.
              </p>
            </article>
            <article>
              <h3>Correspondence is not consciousness</h3>
              <p>
                Even an unusual match would not, by itself, demonstrate remote
                viewing, psi, or machine consciousness. It would identify a
                result worth reproducing under stronger controls.
              </p>
            </article>
          </div>
        </section>
      </div>

      <section className="about-note">
        <span>EXPERIMENTAL · V1.0</span>
        <p>
          This is personal research software for exploring an open question at
          the intersection of artificial intelligence, consciousness, and
          anomalous cognition. Its scores are structured comparison aids, not
          probabilities or statistical proof. Stronger conclusions require
          repeated trials, comparison targets, preregistered methods,
          statistical analysis, and independent replication.
        </p>
      </section>
    </div>
  );
}
