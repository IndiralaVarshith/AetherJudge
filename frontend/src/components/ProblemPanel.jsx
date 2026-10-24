import Icon from './Icon.jsx';

export default function ProblemPanel({ problem, loading, error }) {
  if (loading) return <section className="description-panel"><div className="description-heading"><h2 className="section-title">Problem</h2></div><div className="description-body"><div className="loading-line"><span className="spinner" />Loading problem details…</div></div></section>;
  if (error) return <section className="description-panel"><div className="description-heading"><h2 className="section-title">Problem</h2></div><div className="description-body"><div className="inline-error" role="alert">{error}</div></div></section>;
  if (!problem) return <section className="description-panel"><div className="description-heading"><h2 className="section-title">Problem</h2></div><div className="empty-state">Choose a problem to get started.</div></section>;

  const difficulty = (problem.difficulty || 'easy').toLowerCase();
  const testCases = problem.test_cases || [];
  const samples = testCases.filter(testCase => testCase.is_sample);
  const examples = (samples.length ? samples : testCases)
    .filter((testCase, index, all) => all.findIndex(item => item.input === testCase.input && item.expected_output === testCase.expected_output) === index)
    .slice(0, 2);
  return (
    <section className="description-panel" aria-label="Problem description">
      <div className="description-heading"><h2 className="section-title">Description</h2><span className="section-meta">#{problem.id}</span></div>
      <div className="description-body">
        <h1 className="problem-title">{problem.title}</h1>
        <div className="problem-badges">
          <span className={`badge ${difficulty}`}>{difficulty}</span>
          <span className="badge"><Icon name="clock" size={11} /> {problem.time_limit || 5}s</span>
          <span className="badge"><Icon name="memory" size={11} /> {Math.round((problem.memory_limit || 128000) / 1024)} MB</span>
        </div>
        <div className="problem-description">{problem.description || 'No description is available for this problem yet.'}</div>
        {examples.length > 0 && (
          <section className="detail-section" aria-labelledby="examples-heading">
            <h3 id="examples-heading">Examples</h3>
            {examples.map((testCase, index) => (
              <article className="example-card" key={testCase.id || `${problem.id}-${index}`}>
                <div className="example-head"><span>Example {index + 1}</span>{testCase.is_sample && <span>Sample</span>}</div>
                <div className="example-body">
                  <div className="example-part"><span>Input</span><pre>{testCase.input}</pre></div>
                  <div className="example-part"><span>Output</span><pre>{testCase.expected_output}</pre></div>
                </div>
              </article>
            ))}
          </section>
        )}
      </div>
    </section>
  );
}
