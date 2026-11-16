import { useEffect, useRef, useState } from 'react';
import Editor from '@monaco-editor/react';
import { Group, Panel, Separator } from 'react-resizable-panels';
import { AnimatePresence, motion } from 'motion/react';
import { CircleCheck, CircleX, LoaderCircle, Maximize2, Minimize2, Minus, Pause, Play, Plus, RotateCcw, Send, Terminal, Timer, TimerReset } from 'lucide-react';
import { prettyVerdict } from '../lib/meta.js';
import { MOD } from '../lib/keys.js';

// Versions are what the Judge0 image provides (see backend/src/languages.js).
const LANGS = [
  { id: 'python', label: 'Python 3.8', ext: 'py' },
  { id: 'c', label: 'C (C17)', ext: 'c' },
  { id: 'cpp', label: 'C++17', ext: 'cpp' },
  { id: 'java', label: 'Java 13', ext: 'java' },
];

function defineThemes(monaco) {
  monaco.editor.defineTheme('aether-dark', {
    base: 'vs-dark', inherit: true,
    rules: [
      { token: 'keyword', foreground: 'ff79e0' }, { token: 'string', foreground: 'c6ff3d' },
      { token: 'number', foreground: 'ffb86b' }, { token: 'comment', foreground: '6f6890', fontStyle: 'italic' },
      { token: 'type', foreground: '7dd3fc' }, { token: 'identifier', foreground: 'f4f1ff' },
    ],
    colors: {
      'editor.background': '#0c0a17', 'editor.lineHighlightBackground': '#1a1530', 'editorLineNumber.foreground': '#4a4366',
      'editorLineNumber.activeForeground': '#c4b5fd', 'editorCursor.foreground': '#ff4fd8', 'editor.selectionBackground': '#8b5cf655',
      'editorIndentGuide.background1': '#1f1a35', 'editorGutter.background': '#0c0a17', 'scrollbarSlider.background': '#ffffff14',
    },
  });
  monaco.editor.defineTheme('aether-light', {
    base: 'vs', inherit: true,
    rules: [{ token: 'keyword', foreground: 'c026d3' }, { token: 'string', foreground: '4d7c0f' }, { token: 'comment', foreground: '8a83a6', fontStyle: 'italic' }],
    colors: { 'editor.background': '#fdfcff', 'editor.lineHighlightBackground': '#f3efff', 'editorCursor.foreground': '#7c3aed', 'editor.selectionBackground': '#c4b5fd66' },
  });
}

// Stopwatch. The parent keys it by problem id, so it starts fresh on every problem.
function Stopwatch() {
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(false);
  useEffect(() => {
    if (!running) return undefined;
    const timer = setInterval(() => setSeconds(value => value + 1), 1000);
    return () => clearInterval(timer);
  }, [running]);
  const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
  const ss = String(seconds % 60).padStart(2, '0');
  return (
    <div className={`stopwatch${running ? ' running' : ''}`}>
      <button type="button" className="mini-button" onClick={() => setRunning(value => !value)} aria-label={running ? 'Pause timer' : 'Start timer'}>
        {running ? <Pause size={13} /> : seconds ? <Play size={13} /> : <Timer size={13} />}
      </button>
      <span className="stopwatch-time" aria-live="off">{mm}:{ss}</span>
      {seconds > 0 && !running && <button type="button" className="mini-button" onClick={() => setSeconds(0)} aria-label="Reset timer"><TimerReset size={13} /></button>}
    </div>
  );
}

function Verdict({ submission, vibeLine }) {
  const { verdict, status, passed_tests: passed = 0, total_tests: total = 0 } = submission;
  const pending = !verdict && !['completed', 'failed', 'rejected'].includes(status);
  const accepted = verdict === 'accepted';
  const tone = pending ? 'pending' : accepted ? 'good' : 'bad';
  return (
    <motion.div className={`verdict verdict-${tone}`} initial={{ opacity: 0, y: 10, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 24 }}>
      <div className="verdict-top">
        <span className="verdict-icon">{pending ? <LoaderCircle size={22} className="spin" /> : accepted ? <CircleCheck size={22} /> : <CircleX size={22} />}</span>
        <div>
          <div className="verdict-title">{pending ? (status === 'processing' ? 'Judging…' : 'In the queue…') : prettyVerdict(verdict || status)}</div>
          <div className="verdict-sub">{pending ? 'Running your code against every test' : vibeLine}</div>
        </div>
        <span className="verdict-count">{passed}/{total || '?'}</span>
      </div>
      <div className="test-dots" aria-label={`${passed} of ${total} tests passed`}>
        {Array.from({ length: Math.max(total, pending ? 6 : 0) }, (_, index) => (
          <motion.span key={index} className={`test-dot${index < passed ? ' pass' : !pending && index === passed ? ' fail' : ''}`} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: index * 0.04 }} />
        ))}
      </div>
    </motion.div>
  );
}

export default function EditorPanel({
  code, onCodeChange, language, onLanguageChange, onReset, onRun, onSubmit, busy,
  activeTab, onTabChange, problem, customInput, onCustomInputChange,
  runOutput, submission, vibeLine, history, runError, theme, zen, onToggleZen,
}) {
  const [fontSize, setFontSize] = useState(() => Number(localStorage.getItem('aj:font')) || 14);
  // The editor swallows ⌘↵ / ⌥↵ itself, so the shortcuts are registered as editor
  // commands. Refs keep them pointing at the latest run/submit handlers.
  const actionsRef = useRef({ onRun, onSubmit, customInput });
  useEffect(() => { actionsRef.current = { onRun, onSubmit, customInput }; });
  const handleMount = (editor, monaco) => {
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => actionsRef.current.onSubmit());
    editor.addCommand(monaco.KeyMod.Alt | monaco.KeyCode.Enter, () => actionsRef.current.onRun(actionsRef.current.customInput));
  };
  useEffect(() => { try { localStorage.setItem('aj:font', String(fontSize)); } catch { /* ignore */ } }, [fontSize]);

  const samples = (problem?.test_cases || []).filter(test => test.is_sample).slice(0, 4);
  const ext = LANGS.find(item => item.id === language)?.ext || 'txt';
  const mine = history.filter(item => Number(item.problem_id) === Number(problem?.id));

  return (
    <section className="pane editor-pane" aria-label="Code editor">
      <div className="editor-bar">
        <div className="editor-file"><span className="file-dot" />solution.{ext}</div>
        <div className="editor-tools">
          <select className="field select compact" value={language} onChange={event => onLanguageChange(event.target.value)} aria-label="Language">
            {LANGS.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
          <div className="font-stepper" role="group" aria-label="Font size">
            <button type="button" className="mini-button" onClick={() => setFontSize(size => Math.max(11, size - 1))} aria-label="Smaller font"><Minus size={12} /></button>
            <span>{fontSize}</span>
            <button type="button" className="mini-button" onClick={() => setFontSize(size => Math.min(22, size + 1))} aria-label="Larger font"><Plus size={12} /></button>
          </div>
          <Stopwatch key={problem?.id ?? 'none'} />
          <button type="button" className="mini-button" onClick={onReset} title="Reset to starter code" aria-label="Reset code"><RotateCcw size={14} /></button>
          <button type="button" className="mini-button" onClick={onToggleZen} title={`Zen mode (Alt Z)`} aria-label={zen ? 'Exit zen mode' : 'Enter zen mode'}>{zen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}</button>
        </div>
      </div>

      <Group orientation="vertical" className="editor-split">
        <Panel defaultSize="64" minSize="25">
          <div className="editor-mount">
            <Editor
              height="100%"
              language={language}
              value={code}
              onChange={value => onCodeChange(value || '')}
              beforeMount={defineThemes}
              onMount={handleMount}
              theme={theme === 'light' ? 'aether-light' : 'aether-dark'}
              loading={<div className="editor-loading"><span className="loader-orb" /> Warming up the editor…</div>}
              options={{
                minimap: { enabled: false }, fontSize, lineHeight: Math.round(fontSize * 1.6),
                fontFamily: "'JetBrains Mono Variable', ui-monospace, monospace", fontLigatures: true,
                scrollBeyondLastLine: false, automaticLayout: true, smoothScrolling: true,
                padding: { top: 14, bottom: 14 }, cursorBlinking: 'phase', cursorSmoothCaretAnimation: 'on',
                renderLineHighlight: 'all', bracketPairColorization: { enabled: true }, guides: { bracketPairs: true },
                tabSize: 4, roundedSelection: true, stickyScroll: { enabled: false },
              }}
            />
          </div>
        </Panel>
        <Separator className="resize-handle horizontal" />
        <Panel defaultSize="36" minSize="14">
          <div className="console">
            <div className="console-bar">
              <div className="console-tabs" role="tablist">
                {[['tests', 'Testcase'], ['result', 'Result'], ['submissions', `Submissions${mine.length ? ` · ${mine.length}` : ''}`]].map(([id, label]) => (
                  <button key={id} type="button" role="tab" aria-selected={activeTab === id} className={`console-tab${activeTab === id ? ' active' : ''}`} onClick={() => onTabChange(id)}>
                    {activeTab === id && <motion.span layoutId="console-pill" className="console-pill" transition={{ type: 'spring', stiffness: 500, damping: 36 }} />}
                    <span>{label}</span>
                  </button>
                ))}
              </div>
              <div className="console-actions">
                <span className="shortcut-hint"><kbd className="kbd">⌥ ↵</kbd> run · <kbd className="kbd">{MOD} ↵</kbd> submit</span>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => onRun(customInput)} disabled={busy}><Play size={14} /> Run</button>
                <button type="button" className="btn btn-primary btn-sm" onClick={onSubmit} disabled={busy}>
                  {busy ? <LoaderCircle size={14} className="spin" /> : <Send size={14} />} Submit
                </button>
              </div>
            </div>

            <div className="console-body">
              {activeTab === 'tests' && (
                <div className="testcase">
                  {samples.length > 0 && (
                    <div className="sample-chips">
                      {samples.map((test, index) => (
                        <button key={test.id || index} type="button" className={`sample-chip${customInput === test.input ? ' active' : ''}`} onClick={() => onCustomInputChange(test.input)}>Case {index + 1}</button>
                      ))}
                    </div>
                  )}
                  <label className="label" htmlFor="stdin">stdin</label>
                  <textarea id="stdin" className="stdin" value={customInput} onChange={event => onCustomInputChange(event.target.value)} placeholder="Input passed to your program…" spellCheck={false} />
                </div>
              )}

              {activeTab === 'result' && (
                <div className="result" aria-live="polite">
                  <AnimatePresence>{submission && <Verdict key={`${submission.verdict}-${submission.status}`} submission={submission} vibeLine={vibeLine} />}</AnimatePresence>
                  {runError && <div className="alert" role="alert">{runError}</div>}
                  {busy && !submission && <div className="loading-row"><LoaderCircle size={16} className="spin" /> Running your code…</div>}
                  {runOutput && (
                    <div className="run-output">
                      <div className="run-head">
                        <span className={`run-status ${runOutput.status?.id === 3 ? 'ok' : 'bad'}`}>{runOutput.status?.description || 'Output'}</span>
                        {runOutput.time && <span className="run-perf">{Math.round(Number(runOutput.time) * 1000)} ms · {Math.round((runOutput.memory || 0) / 1024 * 10) / 10} MB</span>}
                      </div>
                      {runOutput.compile_output && <><div className="label">Compiler</div><pre className="out err">{runOutput.compile_output}</pre></>}
                      {runOutput.stderr && <><div className="label">stderr</div><pre className="out err">{runOutput.stderr}</pre></>}
                      <div className="label">stdout</div>
                      <pre className="out">{runOutput.stdout || '(no output)'}</pre>
                    </div>
                  )}
                  {!busy && !runOutput && !submission && !runError && <div className="empty small"><Terminal size={18} /> Run or submit to see results here.</div>}
                </div>
              )}

              {activeTab === 'submissions' && (
                <div className="subs">
                  {mine.length === 0 && <div className="empty small">No submissions for this problem yet. Your first W is waiting 👀</div>}
                  {mine.map(item => (
                    <div key={item.id} className={`sub-row ${item.verdict === 'accepted' ? 'good' : item.verdict ? 'bad' : ''}`}>
                      <span className="sub-verdict">{prettyVerdict(item.verdict || item.status)}</span>
                      <span className="sub-lang">{item.language}</span>
                      <span className="sub-tests">{item.passed_tests || 0}/{item.total_tests || 0}</span>
                      <span className="sub-time">{item.created_at ? new Date(item.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : `#${item.id}`}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Panel>
      </Group>
    </section>
  );
}
