import { useState, useEffect } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Link,
  useNavigate,
} from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import CandidateDashboard from "./pages/CandidateDashboard";
import RecruiterDashboard from "./pages/RecruiterDashboard";
import CandidateProfile from "./pages/CandidateProfile";
import RecruiterProfile from "./pages/RecruiterProfile";
import Jobs from "./pages/Jobs";
import JobDetails from "./pages/JobDetails";
import MyJobs from "./pages/MyJobs";
import CreateJob from "./pages/CreateJob";
import MyApplications from "./pages/MyApplications";
import ApplicationDetails from "./pages/ApplicationDetails";
import RecruiterApplications from "./pages/RecruiterApplications";
import Reports from "./pages/Reports";
import Messages from "./pages/Messages";
import api from "./services/api";

function Home() {
  const { user, loading: authLoading, login, register, logout } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState("login"); // 'login' | 'register'
  const [healthStatus, setHealthStatus] = useState(null);
  const [healthLoading, setHealthLoading] = useState(true);
  const [healthError, setHealthError] = useState(null);

  // Form states
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [registerForm, setRegisterForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "candidate",
  });

  const [authError, setAuthError] = useState("");
  const [authSuccess, setAuthSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Check backend health on mount
  useEffect(() => {
    const checkHealth = async () => {
      try {
        setHealthLoading(true);
        const response = await api.get("/health");
        setHealthStatus(response.data);
        setHealthError(null);
      } catch (err) {
        setHealthError(
          err.response?.data?.message ||
            err.message ||
            "Failed to connect to API",
        );
      } finally {
        setHealthLoading(false);
      }
    };

    checkHealth();
  }, []);

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setAuthError("");
    setAuthSuccess("");
    setSubmitting(true);
    try {
      const res = await login(loginForm.email, loginForm.password);
      setAuthSuccess("Login successful!");
      if (res.user?.role === "candidate") {
        navigate("/candidate/dashboard");
      } else if (res.user?.role === "recruiter") {
        navigate("/recruiter/dashboard");
      }
    } catch (err) {
      setAuthError(
        err.response?.data?.message || err.message || "Login failed",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setAuthError("");
    setAuthSuccess("");
    setSubmitting(true);
    try {
      const res = await register(registerForm);
      setAuthSuccess(
        res.message || "Registration successful! You can now log in.",
      );
      setActiveTab("login");
      setLoginForm({ email: registerForm.email, password: "" });
    } catch (err) {
      setAuthError(
        err.response?.data?.message || err.message || "Registration failed",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem 1rem",
      }}
    >
      <div
        className="card"
        style={{ maxWidth: "480px", width: "100%", margin: "0 auto" }}
      >
        <h1 className="title">CareerConnect</h1>
        <p className="subtitle">
          Connecting Top Talent with Leading Opportunities
        </p>

        {authLoading ? (
          <p
            className="status-value status-checking"
            style={{ textAlign: "center" }}
          >
            Initializing authentication session...
          </p>
        ) : user ? (
          <div className="user-profile-badge">
            <h3
              style={{
                color: "#f8fafc",
                fontSize: "1.2rem",
                marginBottom: "0.25rem",
              }}
            >
              Welcome back, {user.name}!
            </h3>
            <p style={{ color: "#94a3b8", fontSize: "0.9rem" }}>{user.email}</p>
            <div>
              <span className="badge-role">{user.role}</span>
            </div>

            <div
              style={{
                marginTop: "1.5rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.75rem",
              }}
            >
              {user.role === "candidate" ? (
                <Link
                  to="/candidate/dashboard"
                  className="submit-btn"
                  style={{ textDecoration: "none", textAlign: "center" }}
                >
                  Open Candidate Dashboard →
                </Link>
              ) : (
                <Link
                  to="/recruiter/dashboard"
                  className="submit-btn"
                  style={{ textDecoration: "none", textAlign: "center" }}
                >
                  Open Recruiter Dashboard →
                </Link>
              )}

              <button className="logout-btn" onClick={logout}>
                Logout
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div className="tabs">
              <button
                className={`tab-btn ${activeTab === "login" ? "active" : ""}`}
                onClick={() => {
                  setActiveTab("login");
                  setAuthError("");
                  setAuthSuccess("");
                }}
                style={{ flex: 1, textAlign: "center" }}
              >
                Sign In
              </button>
              <button
                className={`tab-btn ${activeTab === "register" ? "active" : ""}`}
                onClick={() => {
                  setActiveTab("register");
                  setAuthError("");
                  setAuthSuccess("");
                }}
                style={{ flex: 1, textAlign: "center" }}
              >
                Register
              </button>
            </div>

            {authError && (
              <div className="alert-message alert-error">{authError}</div>
            )}
            {authSuccess && (
              <div className="alert-message alert-success">{authSuccess}</div>
            )}

            {activeTab === "login" ? (
              <form onSubmit={handleLoginSubmit}>
                <div className="form-group">
                  <label>Email Address</label>
                  <input
                    type="email"
                    required
                    placeholder="user@example.com"
                    value={loginForm.email}
                    onChange={(e) =>
                      setLoginForm({ ...loginForm, email: e.target.value })
                    }
                  />
                </div>

                <div className="form-group">
                  <label>Password</label>
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={loginForm.password}
                    onChange={(e) =>
                      setLoginForm({ ...loginForm, password: e.target.value })
                    }
                  />
                </div>

                <button
                  type="submit"
                  className="submit-btn"
                  disabled={submitting}
                >
                  {submitting ? "Logging in..." : "Sign In"}
                </button>
              </form>
            ) : (
              <form onSubmit={handleRegisterSubmit}>
                <div className="form-group">
                  <label>Full Name</label>
                  <input
                    type="text"
                    required
                    placeholder="username"
                    value={registerForm.name}
                    onChange={(e) =>
                      setRegisterForm({ ...registerForm, name: e.target.value })
                    }
                  />
                </div>

                <div className="form-group">
                  <label>Email Address</label>
                  <input
                    type="email"
                    required
                    placeholder="user@example.com"
                    value={registerForm.email}
                    onChange={(e) =>
                      setRegisterForm({
                        ...registerForm,
                        email: e.target.value,
                      })
                    }
                  />
                </div>

                <div className="form-group">
                  <label>Password (min 6 characters)</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    placeholder="••••••••"
                    value={registerForm.password}
                    onChange={(e) =>
                      setRegisterForm({
                        ...registerForm,
                        password: e.target.value,
                      })
                    }
                  />
                </div>

                <div className="form-group">
                  <label>Role</label>
                  <select
                    value={registerForm.role}
                    onChange={(e) =>
                      setRegisterForm({ ...registerForm, role: e.target.value })
                    }
                  >
                    <option value="candidate">Candidate</option>
                    <option value="recruiter">Recruiter</option>
                  </select>
                </div>

                <button
                  type="submit"
                  className="submit-btn"
                  disabled={submitting}
                >
                  {submitting ? "Registering..." : "Create Account"}
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />

        {/* Candidate Routes */}
        <Route path="/candidate/dashboard" element={<CandidateDashboard />} />
        <Route path="/candidate/profile" element={<CandidateProfile />} />
        <Route path="/jobs" element={<Jobs />} />
        <Route path="/jobs/:id" element={<JobDetails />} />
        <Route path="/applications" element={<MyApplications />} />
        <Route path="/applications/:id" element={<ApplicationDetails />} />

        {/* Common Messaging Route */}
        <Route path="/messages" element={<Messages />} />

        {/* Recruiter Routes */}
        <Route path="/recruiter/dashboard" element={<RecruiterDashboard />} />
        <Route path="/recruiter/profile" element={<RecruiterProfile />} />
        <Route path="/recruiter/jobs" element={<MyJobs />} />
        <Route path="/recruiter/jobs/create" element={<CreateJob />} />
        <Route path="/recruiter/jobs/:id/edit" element={<CreateJob />} />
        <Route
          path="/recruiter/applications"
          element={<RecruiterApplications />}
        />
        <Route
          path="/recruiter/applications/:id"
          element={<ApplicationDetails />}
        />
        <Route path="/recruiter/reports" element={<Reports />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
