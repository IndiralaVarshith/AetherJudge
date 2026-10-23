import { useState, useEffect, useRef } from "react";
import Editor from "@monaco-editor/react";
import axios from "axios";

const API_BASE = "http://localhost:80/api";

function App() {
  const [problems, setProblems] = useState([]);
  const [selectedProblem, setSelectedProblem] = useState(null);
  const [code, setCode] = useState("");
  const [language, setLanguage] = useState("python");
  const [verdict, setVerdict] = useState(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [error, setError] = useState(null);
  const [showCustomTest, setShowCustomTest] = useState(false);
  const [customInput, setCustomInput] = useState("");
  const [customOutput, setCustomOutput] = useState("");
  const [activeTab, setActiveTab] = useState("description");
  
  const eventSourceRef = useRef(null);

  useEffect(() => {
    fetchProblems();
    fetchHistory();
    return () => { if (eventSourceRef.current) eventSourceRef.current.close(); };
  }, []);

  const fetchProblems = async () => {
    try {
      const res = await axios.get(`${API_BASE}/problems`);
      setProblems(res.data);
      if (res.data.length > 0) {
        setSelectedProblem(res.data[0]);
        setCode(getDefaultCode(res.data[0].id, "python"));
      }
    } catch (err) { setError("Failed to load problems"); }
  };

  const fetchHistory = async () => {
    try {
      const res = await axios.get(`${API_BASE}/submissions/history?userId=1`);
      setHistory(res.data);
    } catch (err) { console.warn("History fetch failed"); }
  };

  const getDefaultCode = (problemId, lang) => {
    const templates = {
      python: `import sys

def main():
    # Read input
    data = sys.stdin.read().strip().split('\\n')
    
    # TODO: Implement your solution here
    # Example:
    # nums = list(map(int, data[0].split()))
    # target = int(data[1])
    
    # Print your result
    # print(result)

if __name__ == "__main__":
    main()`,
      cpp: `#include <iostream>
#include <vector>
#include <string>
using namespace std;

int main() {
    // Read input and implement solution
    return 0;
}`,
      java: `import java.util.*;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        // Read input and implement solution
    }
}`
    };
    return templates[lang] || "";
  };

  const handleSubmit = async () => {
    if (!selectedProblem) { setError("Select a problem"); return; }
    if (!code.trim()) { setError("Write some code"); return; }

    setLoading(true);
    setError(null);
    setVerdict(null);

    try {
      const res = await axios.post(`${API_BASE}/submit`, {
        code, language, problemId: selectedProblem.id, userId: 1
      });
      startVerdictStreaming(res.data.submissionId);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
      setLoading(false);
    }
  };

  const startVerdictStreaming = (id) => {
    if (eventSourceRef.current) eventSourceRef.current.close();
    const es = new EventSource(`${API_BASE}/submissions/${id}/stream`);
    eventSourceRef.current = es;

    es.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (data.verdict) {
        setVerdict(data);
        fetchHistory();
        setLoading(false);
        if (["completed", "failed"].includes(data.status)) es.close();
      }
    };
    es.onerror = () => { console.warn("SSE lost"); es.close(); };
  };

  const handleCustomTest = async () => {
    if (!code.trim()) { setError("Write code first"); return; }
    setLoading(true);
    setCustomOutput("⏳ Running...");

    try {
      const response = await axios.post("http://localhost:2358/submissions?wait=true", {
        source_code: code,
        language_id: language === "python" ? 71 : language === "cpp" ? 54 : 62,
        stdin: customInput || "2 7\n9",
        expected_output: null
      }, { headers: { "Content-Type": "application/json" } });

      const stdout = response.data.stdout ? atob(response.data.stdout) : "";
      const stderr = response.data.stderr ? atob(response.data.stderr) : "";
      
      if (response.data.status.id === 3) {
        setCustomOutput(`✅ Output:\n${stdout}\n\n⏱ Time: ${response.data.time}s\n💾 Memory: ${response.data.memory} KB`);
      } else {
        setCustomOutput(`❌ ${response.data.status.description}\n${stderr}`);
      }
      setLoading(false);
    } catch (err) {
      setCustomOutput(`❌ Error: ${err.message}`);
      setLoading(false);
    }
  };

  const getVerdictColor = (v) => {
    const colors = {
      accepted: "#22c55e",
      wrong_answer: "#ef4444",
      time_limit_exceeded: "#f97316",
      runtime_error: "#8b5cf6",
      compilation_error: "#64748b"
    };
    return colors[v?.toLowerCase()] || "#64748b";
  };

  const getDifficultyColor = (d) => {
    const colors = { easy: "#22c55e", medium: "#f97316", hard: "#ef4444" };
    return colors[d?.toLowerCase()] || "#64748b";
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "#0f172a", color: "#e2e8f0", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      
      {/* Top Navigation */}
      <div style={{ height: "48px", background: "#1e293b", borderBottom: "1px solid #334155", display: "flex", alignItems: "center", padding: "0 1rem", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <div style={{ fontSize: "1.25rem", fontWeight: 700, color: "#38bdf8" }}>🧠 AetherJudge</div>
          <select 
            value={selectedProblem?.id || ""} 
            onChange={(e) => {
              const prob = problems.find(p => p.id == e.target.value);
              setSelectedProblem(prob);
              setCode(getDefaultCode(prob.id, language));
            }}
            style={{ padding: "0.375rem 0.75rem", background: "#0f172a", color: "#fff", border: "1px solid #334155", borderRadius: "6px", fontSize: "0.875rem" }}
          >
            {problems.map(p => (
              <option key={p.id} value={p.id} style={{ background: "#0f172a" }}>{p.id}. {p.title}</option>
            ))}
          </select>
        </div>
        
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <select 
            value={language} 
            onChange={(e) => {
              setLanguage(e.target.value);
              setCode(getDefaultCode(selectedProblem?.id, e.target.value));
            }}
            style={{ padding: "0.375rem 0.75rem", background: "#0f172a", color: "#fff", border: "1px solid #334155", borderRadius: "6px", fontSize: "0.875rem" }}
          >
            <option value="python" style={{ background: "#0f172a" }}>🐍 Python</option>
            <option value="cpp" style={{ background: "#0f172a" }}>⚡ C++</option>
            <option value="java" style={{ background: "#0f172a" }}>☕ Java</option>
          </select>
          
          <button 
            onClick={handleSubmit}
            disabled={loading}
            style={{ padding: "0.375rem 1.5rem", background: loading ? "#475569" : "#22c55e", color: "white", border: "none", borderRadius: "6px", cursor: loading ? "not-allowed" : "pointer", fontWeight: 600, fontSize: "0.875rem" }}
          >
            {loading ? "⏳ Running..." : "▶ Submit"}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        
        {/* Left Panel: Problem Description */}
        <div style={{ width: "40%", borderRight: "1px solid #334155", display: "flex", flexDirection: "column", background: "#1e293b" }}>
          <div style={{ display: "flex", borderBottom: "1px solid #334155" }}>
            {["description", "submissions"].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  flex: 1,
                  padding: "0.75rem",
                  background: activeTab === tab ? "#0f172a" : "transparent",
                  border: "none",
                  borderBottom: activeTab === tab ? "2px solid #38bdf8" : "2px solid transparent",
                  cursor: "pointer",
                  color: activeTab === tab ? "#fff" : "#94a3b8",
                  fontWeight: 600,
                  fontSize: "0.875rem",
                  textTransform: "capitalize"
                }}
              >
                {tab}
              </button>
            ))}
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: "1.5rem" }}>
            {activeTab === "description" && selectedProblem && (
              <div>
                <h1 style={{ margin: "0 0 0.75rem 0", fontSize: "1.5rem", color: "#fff" }}>{selectedProblem.title}</h1>
                
                <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1.5rem", alignItems: "center" }}>
                  <span style={{ 
                    padding: "0.25rem 0.75rem", 
                    borderRadius: "9999px",
                    background: getDifficultyColor(selectedProblem.difficulty),
                    color: "white",
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    textTransform: "uppercase"
                  }}>
                    {selectedProblem.difficulty}
                  </span>
                  <span style={{ color: "#94a3b8", fontSize: "0.875rem" }}>
                    ⏱ {selectedProblem.time_limit}s • 💾 {Math.round(selectedProblem.memory_limit/1024)}MB
                  </span>
                </div>

                <div style={{ color: "#cbd5e1", lineHeight: 1.7, whiteSpace: "pre-wrap", fontSize: "0.9375rem" }}>
                  {selectedProblem.description}
                </div>

                <div style={{ marginTop: "2rem", padding: "1.25rem", background: "#0f172a", borderRadius: "8px", border: "1px solid #334155" }}>
                  <h3 style={{ margin: "0 0 0.75rem 0", color: "#38bdf8", fontSize: "1rem" }}>Example:</h3>
                  <div style={{ fontFamily: "monospace", fontSize: "0.875rem" }}>
                    <div style={{ marginBottom: "0.5rem" }}><span style={{ color: "#94a3b8" }}>Input:</span> <span style={{ color: "#e2e8f0" }}>2 7<br/>9</span></div>
                    <div><span style={{ color: "#94a3b8" }}>Output:</span> <span style={{ color: "#e2e8f0" }}>0 1</span></div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "submissions" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {history.length === 0 ? (
                  <div style={{ textAlign: "center", color: "#64748b", padding: "2rem" }}>No submissions yet</div>
                ) : (
                  history.map(sub => (
                    <div key={sub.id} style={{
                      padding: "1rem",
                      background: "#0f172a",
                      borderRadius: "8px",
                      border: `1px solid ${getVerdictColor(sub.verdict)}`,
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center"
                    }}>
                      <div>
                        <div style={{ color: getVerdictColor(sub.verdict), fontWeight: 700, marginBottom: "0.25rem" }}>
                          {sub.verdict?.toUpperCase()}
                        </div>
                        <div style={{ fontSize: "0.75rem", color: "#64748b" }}>
                          {sub.language} • Tests: {sub.passed_tests}/{sub.total_tests}
                        </div>
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "#64748b" }}>
                        {new Date(sub.created_at).toLocaleTimeString()}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Custom Test Panel */}
          <div style={{ borderTop: "1px solid #334155", padding: "1rem", background: "#0f172a" }}>
            <button 
              onClick={() => setShowCustomTest(!showCustomTest)}
              style={{ background: "#334155", color: "white", border: "none", padding: "0.5rem 1rem", borderRadius: "6px", cursor: "pointer", marginBottom: "0.75rem", fontSize: "0.875rem" }}
            >
              {showCustomTest ? "▲ Hide" : "▼ Run Custom Test"}
            </button>
            
            {showCustomTest && (
              <div>
                <textarea
                  value={customInput}
                  onChange={(e) => setCustomInput(e.target.value)}
                  placeholder="Enter custom input..."
                  style={{ width: "100%", height: "80px", background: "#1e293b", color: "#e2e8f0", border: "1px solid #334155", borderRadius: "6px", padding: "0.75rem", fontFamily: "monospace", fontSize: "0.875rem", resize: "none", boxSizing: "border-box" }}
                />
                <button 
                  onClick={handleCustomTest}
                  disabled={loading}
                  style={{ marginTop: "0.75rem", width: "100%", background: loading ? "#475569" : "#3b82f6", color: "white", border: "none", padding: "0.625rem", borderRadius: "6px", cursor: loading ? "not-allowed" : "pointer", fontWeight: 600 }}
                >
                  {loading ? "⏳ Running..." : "▶ Run"}
                </button>
                {customOutput && (
                  <pre style={{ marginTop: "0.75rem", padding: "0.75rem", background: "#1e293b", borderRadius: "6px", fontSize: "0.8125rem", whiteSpace: "pre-wrap", color: "#cbd5e1", border: "1px solid #334155", maxHeight: "200px", overflowY: "auto" }}>
                    {customOutput}
                  </pre>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Panel: Code Editor */}
        <div style={{ width: "60%", display: "flex", flexDirection: "column", background: "#0f172a" }}>
          <div style={{ flex: 1, minHeight: 0 }}>
            <Editor
              height="100%"
              defaultLanguage={language}
              language={language}
              value={code}
              onChange={(val) => setCode(val || "")}
              theme="vs-dark"
              options={{
                minimap: { enabled: false },
                fontSize: 14,
                scrollBeyondLastLine: false,
                automaticLayout: true,
                wordWrap: "on",
                padding: { top: 16 },
                fontFamily: "'Fira Code', 'Cascadia Code', monospace",
                fontLigatures: true
              }}
            />
          </div>

          {/* Verdict Banner */}
          {verdict && (
            <div style={{
              padding: "1rem 1.5rem",
              background: getVerdictColor(verdict.verdict),
              color: "white",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontWeight: 700,
              fontSize: "1rem",
              boxShadow: "0 -4px 6px -1px rgba(0, 0, 0, 0.1)"
            }}>
              <span>{verdict.verdict?.toUpperCase()}</span>
              <span style={{ fontSize: "0.875rem", opacity: 0.9 }}>
                Tests: {verdict.passed_tests}/{verdict.total_tests} • {verdict.status}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;