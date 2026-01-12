import { Routes, Route, NavLink } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { LayoutDashboard, Server, Settings as SettingsIcon, Wifi, WifiOff, GitBranch, Users, LogOut } from 'lucide-react';
import { Dashboard, NodeControl, Settings, SubmitJob, FlowBuilder, Login } from './pages';
import { WorkspacePage } from './pages/Workspace';
import { WorkspaceDetail } from './pages/WorkspaceDetail';
import { ModuleProvider } from './context/ModuleContext';
import { CredentialProvider } from './context/CredentialContext';

// Helper to get auth token
function getToken(): string | null {
  return localStorage.getItem('rhizos_token');
}

// Helper to make authenticated fetch requests
export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = getToken();
  const headers = new Headers(options.headers);
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  return fetch(url, { ...options, headers });
}

function App() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [userName, setUserName] = useState<string>('');
  const [connected, setConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  // Check authentication on mount
  useEffect(() => {
    const checkAuth = async () => {
      const token = getToken();
      if (!token) {
        setAuthenticated(false);
        return;
      }

      try {
        const res = await fetch('/api/v1/auth/me', {
          headers: { 'Authorization': `Bearer ${token}` },
        });

        if (res.ok) {
          const data = await res.json();
          setAuthenticated(true);
          setUserName(data.name || 'User');
        } else {
          // Invalid token, clear it
          localStorage.removeItem('rhizos_token');
          setAuthenticated(false);
        }
      } catch {
        setAuthenticated(false);
      }
    };

    checkAuth();
  }, []);

  // Check connection status (only when authenticated)
  useEffect(() => {
    if (!authenticated) return;

    const checkConnection = async () => {
      try {
        const res = await fetch('/health');
        setConnected(res.ok);
        if (res.ok) setLastUpdate(new Date());
      } catch {
        setConnected(false);
      }
    };

    checkConnection();
    const interval = setInterval(checkConnection, 5000);
    return () => clearInterval(interval);
  }, [authenticated]);

  const handleLogin = (token: string) => {
    setAuthenticated(true);
    // Re-check to get user name
    fetch('/api/v1/auth/me', {
      headers: { 'Authorization': `Bearer ${token}` },
    })
      .then(res => res.json())
      .then(data => setUserName(data.name || 'User'))
      .catch(() => {});
  };

  const handleLogout = async () => {
    const token = getToken();
    if (token) {
      try {
        await fetch('/api/v1/auth/logout', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
        });
      } catch {}
    }
    localStorage.removeItem('rhizos_token');
    setAuthenticated(false);
    setUserName('');
  };

  // Show loading while checking auth
  if (authenticated === null) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0a0a0a',
        color: '#fff',
      }}>
        Loading...
      </div>
    );
  }

  // Show login if not authenticated
  if (!authenticated) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <CredentialProvider>
      <ModuleProvider>
        <div className="app-container">
        {/* Header */}
        <header className="app-header">
          <div className="header-logo">
            <div className="logo-icon">
              <Server size={20} />
            </div>
            <h1 className="logo-text">OtherThing</h1>
          </div>

          <nav className="header-nav">
            <NavLink to="/" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <LayoutDashboard size={16} />
              <span>Dashboard</span>
            </NavLink>
            <NavLink to="/workspace" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <Users size={16} />
              <span>Workspace</span>
            </NavLink>
            <NavLink to="/flow" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <GitBranch size={16} />
              <span>Flow</span>
            </NavLink>
            <NavLink to="/node" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <Server size={16} />
              <span>Node</span>
            </NavLink>
            <NavLink to="/settings" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <SettingsIcon size={16} />
              <span>Settings</span>
            </NavLink>
          </nav>

          <div className="header-status">
            {connected ? (
              <>
                <Wifi size={16} className="status-icon online" />
                <span className="status-dot online" />
                <span className="status-text online">Connected</span>
                {lastUpdate && (
                  <span className="status-time">
                    {lastUpdate.toLocaleTimeString('en-US', { hour12: false })}
                  </span>
                )}
              </>
            ) : (
              <>
                <WifiOff size={16} className="status-icon offline" />
                <span className="status-dot offline" />
                <span className="status-text offline">Disconnected</span>
              </>
            )}
            <span className="status-divider">|</span>
            <span className="status-user">{userName}</span>
            <button className="logout-btn" onClick={handleLogout} title="Logout">
              <LogOut size={16} />
            </button>
          </div>
        </header>

        {/* Main Content */}
        <main className="app-main">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/workspace" element={<WorkspacePage />} />
            <Route path="/workspace/:id" element={<WorkspaceDetail />} />
            <Route path="/flow" element={<FlowBuilder />} />
            <Route path="/submit" element={<SubmitJob />} />
            <Route path="/node" element={<NodeControl />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>
        </div>
      </ModuleProvider>
    </CredentialProvider>
  );
}

export default App;
