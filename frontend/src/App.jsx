import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Group, Panel, Separator } from 'react-resizable-panels';
import { toast } from 'sonner';
import EditorPanel from './components/EditorPanel.jsx';
import ProblemPanel from './components/ProblemPanel.jsx';
import ProblemSidebar from './components/ProblemSidebar.jsx';
import { api, errorMessage, API_BASE } from './api.js';
import { useApp } from './lib/useApp.js';
import { celebrate } from './lib/celebrate.js';
import { draftKey, load, remove, save } from './lib/storage.js';
import { levelFor, vibe, XP_FOR } from './lib/meta.js';

// Beginner-friendly starter code: read from standard input, print the answer.
const TEMPLATES = {
  python: [
    '# Read the input with input(), print the answer with print().',
    '# Example: n = int(input())',
    '',
    '',
  ].join('\n'),
  c: [
    '#include <stdio.h>',
    '',
    'int main(void) {',
    '    // Read the input with scanf, print the answer with printf.',
    '    // Example: int n; scanf("%d", &n); printf("%d\\n", n);',
    '',
    '    return 0;',
    '}',
    '',
  ].join('\n'),
  cpp: [
    '#include <iostream>',
    'using namespace std;',
    '',
    'int main() {',
    '    // Read the input with cin, print the answer with cout.',
    '    // Example: int n; cin >> n; cout << n << endl;',
    '',
    '    return 0;',
    '}',
    '',
  ].join('\n'),
  java: [
    'import java.util.Scanner;',
    '',
    'public class Main {',
    '    public static void main(String[] args) {',
    '        Scanner sc = new Scanner(System.in);',
    '        // Read the input with sc.nextInt(), sc.next() or sc.nextLine().',
    '        // Print the answer with System.out.println(...).',
    '',
    '    }',
    '}',
    '',
  ].join('\n'),
};

export default function Workspace() {
  const { theme, stats, solvedIds, refreshStats, user } = useApp();
  const navigate = useNavigate();
  // The URL holds the album and problem (/app?album=strings&problem=12), so the Albums,
  // Guide and ⌘K palette can link straight to them.
  const [searchParams, setSearchParams] = useSearchParams();
  const album = searchParams.get('album') || '';
  const problemParam = Number(searchParams.get('problem')) || null;

  const [albums, setAlbums] = useState([]);
  const [problems, setProblems] = useState([]);
  const [problem, setProblem] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [problemsLoading, setProblemsLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [problemError, setProblemError] = useState('');
  const [pageError, setPageError] = useState('');
  const [language, setLanguage] = useState(() => load('aj:lang', 'python'));
  const [code, setCode] = useState(TEMPLATES.python);
  const [customInput, setCustomInput] = useState('');
  const [activeTab, setActiveTab] = useState('tests');
  const [history, setHistory] = useState([]);
  const [runOutput, setRunOutput] = useState(null);
  const [runError, setRunError] = useState('');
  const [submission, setSubmission] = useState(null);
  const [vibeLine, setVibeLine] = useState('');
  const [busy, setBusy] = useState(false);
  const [zen, setZen] = useState(false);
  const streamRef = useRef(null);
  const languageRef = useRef(language); // read inside fetchProblem without re-creating it

  const fetchHistory = useCallback(async () => {
    try {
      const response = await api.get('/submissions/history');
      setHistory(response.data);
    } catch { /* history is a nice-to-have */ }
  }, []);

  const fetchProblem = useCallback(async id => {
    setSelectedId(id);
    setDetailLoading(true);
    setProblemError('');
    setSubmission(null);
    setRunOutput(null);
    setRunError('');
    try {
      const response = await api.get(`/problems/${id}`);
      const lang = languageRef.current;
      setProblem(response.data);
      setCode(load(draftKey(response.data.id, lang), TEMPLATES[lang])); // saved draft, or the starter code
      const sample = response.data.test_cases?.find(test => test.is_sample);
      setCustomInput(sample?.input || '');
    } catch (error) {
      setProblem(null);
      setProblemError(errorMessage(error, 'Could not load this problem. Try again.'));
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => { api.get('/albums').then(response => setAlbums(response.data)).catch(() => {}); }, []);
  useEffect(() => () => streamRef.current?.close(), []);

  // Reload the list when the album changes; open the problem from the URL, else the first.
  useEffect(() => {
    let active = true;
    (async () => {
      setProblemsLoading(true);
      try {
        const query = album ? `?album=${encodeURIComponent(album)}` : '';
        const [response] = await Promise.all([api.get(`/problems${query}`), fetchHistory()]);
        if (!active) return;
        setProblems(response.data);
        setPageError('');
        const wanted = problemParam || response.data[0]?.id;
        if (wanted) fetchProblem(wanted);
      } catch (error) {
        if (active) setPageError(errorMessage(error, 'Could not reach AetherJudge. Is the API running?'));
      } finally {
        if (active) setProblemsLoading(false);
      }
    })();
    return () => { active = false; };
    // problemParam is handled by the effect below once the list has loaded
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [album, fetchHistory, fetchProblem]);

  // Follow ?problem= changes made from elsewhere (⌘K palette, guide links, back button).
  // This syncs with the URL, an external source, so loading the problem here is intended.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (problemParam && !problemsLoading && Number(problemParam) !== Number(selectedId)) fetchProblem(problemParam);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [problemParam]);

  const changeLanguage = next => {
    languageRef.current = next;
    setLanguage(next);
    save('aj:lang', next);
    if (problem) setCode(load(draftKey(problem.id, next), TEMPLATES[next]));
  };

  // Autosave the draft shortly after typing stops.
  useEffect(() => {
    if (!problem) return undefined;
    const timer = setTimeout(() => {
      if (code === TEMPLATES[language]) remove(draftKey(problem.id, language));
      else save(draftKey(problem.id, language), code);
    }, 500);
    return () => clearTimeout(timer);
  }, [code, problem, language]);

  const index = problems.findIndex(item => Number(item.id) === Number(selectedId));
  const selectProblem = useCallback(item => {
    setSearchParams(album ? { album, problem: String(item.id) } : { problem: String(item.id) }, { replace: true });
    fetchProblem(item.id);
  }, [album, fetchProblem, setSearchParams]);
  const step = delta => { const next = problems[index + delta]; if (next) selectProblem(next); };
  const randomProblem = () => {
    const pool = problems.filter(item => !solvedIds.has(Number(item.id)) && Number(item.id) !== Number(selectedId));
    const list = pool.length ? pool : problems;
    if (list.length) selectProblem(list[Math.floor(Math.random() * list.length)]);
  };
  const changeAlbum = nextAlbum => setSearchParams(nextAlbum ? { album: nextAlbum } : {});

  const resetCode = () => {
    if (!problem) return;
    remove(draftKey(problem.id, language));
    setCode(TEMPLATES[language]);
    toast('Fresh start. Starter code restored 🧼');
  };

  const runCode = useCallback(async input => {
    if (!code.trim()) { setRunError('Write some code first 😅'); setActiveTab('result'); return; }
    setBusy(true);
    setRunError('');
    setRunOutput(null);
    setSubmission(null);
    setActiveTab('result');
    try {
      const response = await api.post('/run', { code, language, stdin: input });
      setRunOutput(response.data);
    } catch (error) {
      setRunError(errorMessage(error, 'Could not run your code. Is Judge0 running?'));
    } finally {
      setBusy(false);
    }
  }, [code, language]);

  const onAccepted = useCallback(async solvedProblem => {
    celebrate(solvedProblem.difficulty);
    if (!user) {
      toast.success(`${solvedProblem.title} solved!`, {
        description: 'Create a free account to save your XP and streak.',
        action: { label: 'Join free', onClick: () => navigate('/login') },
        duration: 8000,
      });
      return;
    }
    const firstTime = !solvedIds.has(Number(solvedProblem.id));
    const before = levelFor(stats.xp).level;
    const fresh = await refreshStats();
    if (firstTime) {
      toast.success(`+${XP_FOR[solvedProblem.difficulty] || 10} XP · ${solvedProblem.title} solved!`, { description: fresh?.streak ? `🔥 ${fresh.streak}-day streak` : undefined });
      if (fresh && levelFor(fresh.xp).level > before) {
        const level = levelFor(fresh.xp);
        setTimeout(() => toast(`LEVEL UP → Lv ${level.level} · ${level.title} 🚀`, { duration: 6000 }), 900);
      }
    } else {
      toast.success('Solved again. Muscle memory unlocked 💪');
    }
  }, [navigate, refreshStats, solvedIds, stats.xp, user]);

  const submitCode = useCallback(async () => {
    if (!problem) return;
    if (!code.trim()) { setRunError('Write some code first 😅'); setActiveTab('result'); return; }
    setBusy(true);
    setRunError('');
    setRunOutput(null);
    setActiveTab('result');
    setSubmission({ status: 'pending', verdict: null, passed_tests: 0, total_tests: 0 });
    const submittedProblem = problem;
    try {
      const response = await api.post('/submit', { code, language, problemId: problem.id });
      const source = new EventSource(`${API_BASE}/submissions/${response.data.submissionId}/stream`, { withCredentials: true });
      streamRef.current?.close();
      streamRef.current = source;
      source.onmessage = event => {
        let data;
        try { data = JSON.parse(event.data); } catch { return; }
        if (data.error) {
          setRunError(data.error);
          setBusy(false);
          source.close();
        } else if (data.verdict || ['completed', 'failed', 'rejected'].includes(data.status)) {
          setSubmission(data);
          setVibeLine(vibe(data.verdict));
          setBusy(false);
          source.close();
          fetchHistory();
          if (data.verdict === 'accepted') onAccepted(submittedProblem);
        } else if (data.status && data.status !== 'connected') {
          setSubmission(current => ({ ...current, ...data }));
        }
      };
      source.onerror = () => {
        setRunError('Lost the live connection to the judge. Check Submissions for the result.');
        setBusy(false);
        source.close();
        fetchHistory();
      };
    } catch (error) {
      setRunError(errorMessage(error, 'Submission failed. Check your connection and try again.'));
      setSubmission(null);
      setBusy(false);
    }
  }, [code, fetchHistory, language, onAccepted, problem]);

  useEffect(() => {
    const onKeyDown = event => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') { event.preventDefault(); submitCode(); }
      else if (event.altKey && event.key === 'Enter') { event.preventDefault(); runCode(customInput); }
      else if (event.altKey && event.code === 'KeyZ') { event.preventDefault(); setZen(value => !value); }
      else if (event.key === 'Escape' && zen) setZen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [customInput, runCode, submitCode, zen]);

  return (
    <main className={`workspace${zen ? ' zen' : ''}`}>
      {pageError && <div className="alert banner" role="alert">{pageError}</div>}
      <Group orientation="horizontal" className="workspace-panels">
        {!zen && (
          <>
            <Panel id="sidebar" defaultSize="20" minSize="14" maxSize="32" collapsible collapsedSize="0">
              <ProblemSidebar problems={problems} albums={albums} album={album} onAlbumChange={changeAlbum} selectedId={selectedId} onSelect={selectProblem} onRandom={randomProblem} loading={problemsLoading} />
            </Panel>
            <Separator className="resize-handle vertical" />
            <Panel id="problem" defaultSize="36" minSize="22">
              <ProblemPanel problem={problem} loading={detailLoading} error={problemError} position={index + 1} count={problems.length} onPrev={() => step(-1)} onNext={() => step(1)} albums={albums} />
            </Panel>
            <Separator className="resize-handle vertical" />
          </>
        )}
        <Panel id="editor" defaultSize={zen ? '100' : '44'} minSize="30">
          <EditorPanel
            code={code} onCodeChange={setCode} language={language} onLanguageChange={changeLanguage} onReset={resetCode}
            onRun={runCode} onSubmit={submitCode} busy={busy} activeTab={activeTab} onTabChange={setActiveTab}
            problem={problem} customInput={customInput} onCustomInputChange={setCustomInput}
            runOutput={runOutput} submission={submission} vibeLine={vibeLine} history={history} runError={runError}
            theme={theme} zen={zen} onToggleZen={() => setZen(value => !value)}
          />
        </Panel>
      </Group>
      {zen && <div className="zen-hint">Zen mode · <kbd className="kbd">esc</kbd> to exit</div>}
    </main>
  );
}
