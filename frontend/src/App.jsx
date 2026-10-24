import { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import EditorPanel from './components/EditorPanel.jsx';
import ProblemPanel from './components/ProblemPanel.jsx';
import ProblemSidebar from './components/ProblemSidebar.jsx';
import './App.css';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost/api';

const templates = {
  python: `import sys\n\ndef main():\n    data = sys.stdin.read().strip().split()\n    # Write your solution here\n\nif __name__ == "__main__":\n    main()`,
  cpp: `#include <iostream>\n#include <vector>\n#include <string>\nusing namespace std;\n\nint main() {\n    // Write your solution here\n    return 0;\n}`,
  java: `import java.util.*;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        // Write your solution here\n    }\n}`,
};

export default function App() {
  const [problems, setProblems] = useState([]);
  const [problem, setProblem] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [problemsLoading, setProblemsLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [problemError, setProblemError] = useState('');
  const [pageError, setPageError] = useState('');
  const [search, setSearch] = useState('');
  const [language, setLanguage] = useState('python');
  const [code, setCode] = useState(templates.python);
  const [customInput, setCustomInput] = useState('');
  const [activeTab, setActiveTab] = useState('tests');
  const [history, setHistory] = useState([]);
  const [runOutput, setRunOutput] = useState(null);
  const [runError, setRunError] = useState('');
  const [submission, setSubmission] = useState(null);
  const [busy, setBusy] = useState(false);
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme || 'dark');
  const streamRef = useRef(null);

  useEffect(() => {
    const observer = new MutationObserver(() => setTheme(document.documentElement.dataset.theme || 'dark'));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  const fetchHistory = useCallback(async () => {
    try {
      const userId = localStorage.getItem('userId') || 'null';
      const response = await axios.get(`${API_BASE}/submissions/history?userId=${encodeURIComponent(userId)}`);
      setHistory(response.data);
    } catch (error) {
      setPageError(error.response?.data?.error || 'Submission history is unavailable.');
    }
  }, []);

  const fetchProblem = useCallback(async id => {
    setSelectedId(id);
    setDetailLoading(true);
    setProblemError('');
    try {
      const response = await axios.get(`${API_BASE}/problems/${id}`);
      setProblem(response.data);
      const sample = response.data.test_cases?.find(testCase => testCase.is_sample);
      setCustomInput(sample?.input || '');
    } catch (error) {
      setProblem(null);
      setProblemError(error.response?.data?.error || 'Could not load this problem. Try again.');
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const [problemResponse] = await Promise.all([
          axios.get(`${API_BASE}/problems`),
          fetchHistory(),
        ]);
        if (!active) return;
        setProblems(problemResponse.data);
        if (problemResponse.data.length) fetchProblem(problemResponse.data[0].id);
      } catch (error) {
        if (active) setPageError(error.response?.data?.error || 'Could not connect to AetherJudge. Check that the API is running.');
      } finally {
        if (active) setProblemsLoading(false);
      }
    };
    load();
    return () => {
      active = false;
      streamRef.current?.close();
    };
  }, [fetchHistory, fetchProblem]);

  const runCode = useCallback(async input => {
    if (!code.trim()) {
      setRunError('Add some code before running it.');
      setActiveTab('console');
      return;
    }
    setBusy(true);
    setRunError('');
    setRunOutput(null);
    setSubmission(null);
    setActiveTab('console');
    try {
      const response = await axios.post(`${API_BASE}/run`, { code, language, stdin: input });
      setRunOutput(response.data);
    } catch (error) {
      setRunError(error.response?.data?.error || 'Could not run code. Check the API and Judge0 connection.');
    } finally {
      setBusy(false);
    }
  }, [code, language]);

  const submitCode = useCallback(async () => {
    if (!problem) {
      setRunError('Select a problem before submitting.');
      setActiveTab('console');
      return;
    }
    if (!code.trim()) {
      setRunError('Add some code before submitting.');
      setActiveTab('console');
      return;
    }
    setBusy(true);
    setRunError('');
    setRunOutput(null);
    setActiveTab('console');
    setSubmission({ status: 'pending', verdict: null, passed_tests: 0, total_tests: 0 });
    try {
      const response = await axios.post(`${API_BASE}/submit`, {
        code,
        language,
        problemId: problem.id,
        userId: Number(localStorage.getItem('userId')) || null,
      });
      const source = new EventSource(`${API_BASE}/submissions/${response.data.submissionId}/stream`);
      streamRef.current?.close();
      streamRef.current = source;
      source.onmessage = event => {
        try {
          const data = JSON.parse(event.data);
          if (data.error) {
            setRunError(data.error);
            setBusy(false);
            source.close();
          } else if (data.verdict || ['completed', 'failed', 'rejected'].includes(data.status)) {
            setSubmission(data);
            setBusy(false);
            source.close();
            fetchHistory();
          } else if (data.status && data.status !== 'connected') {
            setSubmission(current => ({ ...current, ...data }));
          }
        } catch {
          setRunError('Received an unreadable update from the judge.');
          setBusy(false);
          source.close();
        }
      };
      source.onerror = () => {
        setRunError('The live verdict connection was interrupted. Check Submissions for the latest status.');
        setBusy(false);
        source.close();
        fetchHistory();
      };
    } catch (error) {
      setRunError(error.response?.data?.error || 'Submission failed. Check your connection and try again.');
      setSubmission(null);
      setBusy(false);
    }
  }, [code, fetchHistory, language, problem]);

  useEffect(() => {
    const onKeyDown = event => {
      if (!(event.metaKey || event.ctrlKey) && !event.altKey) return;
      if (event.target instanceof HTMLElement && event.target.closest('input, select')) return;
      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
        event.preventDefault();
        submitCode();
      } else if (event.altKey && event.key === 'Enter') {
        event.preventDefault();
        runCode(customInput);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [customInput, runCode, submitCode]);

  const onLanguageChange = nextLanguage => {
    setLanguage(nextLanguage);
    setCode(templates[nextLanguage] || '');
  };
  const solvedIds = new Set(history.filter(item => item.verdict === 'accepted').map(item => Number(item.problem_id)));

  return (
    <main className="workspace">
      <div className="workspace-bar">
        <div className="workspace-context"><span className="crumb">Workspace</span><span className="crumb">/</span><span className="crumb-current">{problem?.title || 'Choose a problem'}</span></div>
        <div className="workspace-controls"><span className="workspace-hotkey">⌥↵ Run · ⌘↵ Submit</span><span className="badge">Practice</span></div>
      </div>
      {pageError && <div className="inline-error" role="status" style={{ margin: 0, borderRadius: 0 }}>{pageError}</div>}
      <div className="workspace-body">
        <ProblemSidebar problems={problems} selectedId={selectedId} onSelect={item => fetchProblem(item.id)} solvedIds={solvedIds} loading={problemsLoading} search={search} onSearch={setSearch} />
        <ProblemPanel problem={problem} loading={detailLoading} error={problemError} />
        <EditorPanel
          code={code}
          onCodeChange={setCode}
          language={language}
          onLanguageChange={onLanguageChange}
          onRun={runCode}
          onSubmit={submitCode}
          busy={busy}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          problem={problem}
          customInput={customInput}
          onCustomInputChange={setCustomInput}
          runOutput={runOutput}
          submission={submission}
          history={history}
          runError={runError}
          theme={theme}
        />
      </div>
    </main>
  );
}
