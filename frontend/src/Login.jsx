import { useState } from "react";
import axios from "axios";

function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const apiBase = import.meta.env.VITE_API_BASE || "http://localhost:5000/api";
      const res = await axios.post(`${apiBase}/auth/login`, {
        email,
        password
      });
      localStorage.setItem("token", res.data.token);
      onLogin();
    } catch (err) {
      setError(err.response?.data?.error || "Login failed");
    }
  };

  return (
    <div style={{ 
      height: "100vh", 
      display: "flex", 
      alignItems: "center", 
      justifyContent: "center",
      background: "#1e1e1e"
    }}>
      <form onSubmit={handleLogin} style={{ 
        padding: "2rem", 
        background: "#2d2d2d",
        borderRadius: "12px",
        width: "400px"
      }}>
        <h1 style={{ color: "#fff", marginBottom: "1.5rem", textAlign: "center" }}>🧠 AetherJudge</h1>
        {error && <div style={{ color: "#f87171", marginBottom: "1rem" }}>{error}</div>}
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ 
            width: "100%", 
            padding: "0.75rem", 
            marginBottom: "1rem",
            background: "#1e1e1e",
            border: "1px solid #404040",
            color: "#fff",
            borderRadius: "6px"
          }}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ 
            width: "100%", 
            padding: "0.75rem", 
            marginBottom: "1rem",
            background: "#1e1e1e",
            border: "1px solid #404040",
            color: "#fff",
            borderRadius: "6px"
          }}
        />
        <button type="submit" style={{ 
          width: "100%", 
          padding: "0.75rem",
          background: "#22c55e",
          color: "white",
          border: "none",
          borderRadius: "6px",
          cursor: "pointer",
          fontWeight: 600
        }}>
          Login
        </button>
      </form>
    </div>
  );
}

export default Login;