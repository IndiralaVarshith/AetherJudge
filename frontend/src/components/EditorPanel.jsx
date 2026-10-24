import Editor from '@monaco-editor/react';
import Icon from './Icon.jsx';

const tabs = [
  { id: 'tests', label: 'Test cases' },
  { id: 'console', label: 'Console' },
  { id: 'submissions', label: 'Submissions' },
];

export default function EditorPanel({
  code, onCodeChange, language, onLanguageChange, onRun, onSubmit, busy,
  activeTab, onTabChange, problem, customInput, onCustomInputChange,
  runOutput, submission, history, runError, theme,
}) {
  const cases = problem?.test_cases || [];
  const samples = cases.filter(testCase => testCase.is_sample);
  const examples = (samples.length ? samples : cases)
    .filter((testCase, index, all) => all.findIndex(item => item.input === testCase.input && item.expected_output === testCase.expected_output) === index)
    .slice(0, 3);
  const run = () => onRun(customInput);

  return (
    <section className="editor-column" aria-label="Code workspace">
      <div className="editor-toolbar">
        <div className="editor-file"><span className="file-dot" /><Icon name="file" size={13} /> solution.{language === 'python' ? 'py' : language === 'cpp' ? 'cpp' : 'java'}</div>
        <div className="editor-tools">
          <select className="language-select" value={language} onChange={event => onLanguageChange(event.target.value)} aria-label="Programming language">
            <option value="python">Python 3</option><option value="cpp">C++</option><option value="java">Java</option>
          </select>
          <button type="button" className="toolbar-button run" onClick={run} disabled={busy}><Icon name="play" size={12} /> Run</button>
          <button type="button" className="toolbar-button submit" onClick={onSubmit} disabled={busy}><Icon name="send" size={12} /> {busy ? 'Working…' : 'Submit'}</button>
        </div>
      </div>
      <div className="editor-mount">
        <Editor
          height="100%"
          language={language === 'cpp' ? 'cpp' : language}
          value={code}
          onChange={value => onCodeChange(value || '')}
          theme={theme === 'light' ? 'light' : 'vs-dark'}
          options={{
            minimap: { enabled: false }, fontSize: 13, lineHeight: 21,
            scrollBeyondLastLine: false, automaticLayout: true, wordWrap: 'on',
            padding: { top: 16, bottom: 12 }, fontFamily: "'SFMono-Regular', Consolas, monospace",
            fontLigatures: true, smoothScrolling: true, renderLineHighlight: 'gutter',
            cursorBlinking: 'smooth', bracketPairColorization: { enabled: true },
          }}
        />
      </div>
      <div className="execution-panel">
        <div className="execution-tabs" role="tablist" aria-label="Execution panel">
          {tabs.map(tab => <button key={tab.id} type="button" className={`execution-tab${activeTab === tab.id ? ' active' : ''}`} role="tab" aria-selected={activeTab === tab.id} onClick={() => onTabChange(tab.id)}>{tab.label}{tab.id === 'submissions' && history.length > 0 ? ` (${history.length})` : ''}</button>)}
        </div>
        <div className="execution-content">
          {activeTab === 'tests' && (
            <>
              <div className="case-toolbar"><span className="case-hint">Choose a sample or enter custom input.</span><button className="quiet-button" type="button" onClick={run} disabled={busy}><Icon name="play" size={12} /> Run with input</button></div>
              {examples.length > 0 && <div className="case-grid">{examples.map((testCase, index) => <button className="case-card" type="button" key={testCase.id || index} onClick={() => onCustomInputChange(testCase.input)} aria-label={`Load sample input ${index + 1}`}><span className="case-card-head"><span>Sample {index + 1}</span><span>Use input</span></span><pre>{testCase.input}</pre></button>)}</div>}
              <label className="field-label" htmlFor="custom-stdin" style={{ marginTop: 10 }}>Custom stdin</label>
              <textarea id="custom-stdin" className="code-input" value={customInput} onChange={event => onCustomInputChange(event.target.value)} placeholder="Enter input passed to your program…" />
            </>
          )}
          {activeTab === 'console' && (
            <div className="console-output" aria-live="polite">
              {submission && <div className={`result-banner ${submission.verdict === 'accepted' ? 'accepted' : 'failed'}`}>
                <span><strong className="result-title">{(submission.verdict || submission.status || 'Processing').replaceAll('_', ' ').toUpperCase()}</strong><small className="result-subtitle">{submission.status === 'completed' ? 'Submission finished' : submission.status === 'processing' || submission.status === 'pending' ? 'Judge is evaluating your code' : 'Review the verdict and try again'}</small></span>
                <span className="result-icon"><Icon name={submission.verdict === 'accepted' ? 'check' : 'alert'} size={18} /></span>
                <span className="result-subtitle">{submission.passed_tests ?? 0}/{submission.total_tests ?? 0} tests</span>
              </div>}
              {busy && <div className="loading-line"><span className="spinner" />{submission ? 'Evaluating submission…' : 'Running your code…'}</div>}
              {runError && <div className="inline-error" role="alert">{runError}</div>}
              {runOutput && <><div className="case-card-head"><span>{runOutput.status?.description || runOutput.status || 'Execution output'}</span>{runOutput.time && <span>{runOutput.time}s · {runOutput.memory} KB</span>}</div><pre>{runOutput.stdout || runOutput.stderr || runOutput.compile_output || runOutput.message || 'No output'}</pre></>}
              {!busy && !runOutput && !submission && !runError && <div className="console-placeholder"><Icon name="terminal" size={18} />Run your code to see output here.</div>}
            </div>
          )}
          {activeTab === 'submissions' && (
            <div>
              {history.length === 0 && <div className="empty-state">Your submissions will appear here.</div>}
              {history.map(item => <div className="submission-row" key={item.id}>
                <div><div className="submission-verdict">{item.verdict ? item.verdict.replaceAll('_', ' ').toUpperCase() : item.status.toUpperCase()}</div><div className="submission-info">{item.language} · {item.passed_tests || 0}/{item.total_tests || 0} tests</div></div>
                <span className="submission-state">{item.created_at ? new Date(item.created_at).toLocaleString() : `#${item.id}`}</span>
              </div>)}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
