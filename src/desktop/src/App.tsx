import { Routes, Route, NavLink } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { LayoutDashboard, Server, Settings as SettingsIcon, Wifi, WifiOff, Rocket, Box, GitBranch } from 'lucide-react';
import { Dashboard, NodeControl, Settings, SubmitJob, Modules, Deploy, FlowBuilder } from './pages';
import { GlitchText } from './components';
import { ModuleProvider } from './context/ModuleContext';

function App() {
  const [connected, setConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  useEffect(() => {
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
  }, []);

  return (
    <ModuleProvider>
      <div className="app-container">
        {/* Animated Background */}
        <div className="cyber-grid" />
        <div className="scanlines" />

        {/* Header */}
        <header className="cyber-header">
          <div className="cyber-logo">
            <div className="cyber-logo-icon">
              <Server size={20} style={{ color: 'var(--neon-cyan)' }} />
            </div>
            <GlitchText
              text="MODCHAIN"
              as="h1"
              className="glitch-hover"
            />
          </div>

          <nav className="cyber-nav">
            <NavLink
              to="/"
              className={({ isActive }) => `cyber-nav-link ${isActive ? 'active' : ''}`}
            >
              <LayoutDashboard size={14} style={{ marginRight: '0.5rem', verticalAlign: 'middle' }} />
              DASHBOARD
            </NavLink>
            <NavLink
              to="/deploy"
              className={({ isActive }) => `cyber-nav-link ${isActive ? 'active' : ''}`}
            >
              <Rocket size={14} style={{ marginRight: '0.5rem', verticalAlign: 'middle' }} />
              DEPLOY
            </NavLink>
            <NavLink
              to="/flow"
              className={({ isActive }) => `cyber-nav-link ${isActive ? 'active' : ''}`}
            >
              <GitBranch size={14} style={{ marginRight: '0.5rem', verticalAlign: 'middle' }} />
              FLOW
            </NavLink>
            <NavLink
              to="/modules"
              className={({ isActive }) => `cyber-nav-link ${isActive ? 'active' : ''}`}
            >
              <Box size={14} style={{ marginRight: '0.5rem', verticalAlign: 'middle' }} />
              MODULES
            </NavLink>
            <NavLink
              to="/node"
              className={({ isActive }) => `cyber-nav-link ${isActive ? 'active' : ''}`}
            >
              <Server size={14} style={{ marginRight: '0.5rem', verticalAlign: 'middle' }} />
              NODE
            </NavLink>
            <NavLink
              to="/settings"
              className={({ isActive }) => `cyber-nav-link ${isActive ? 'active' : ''}`}
            >
              <SettingsIcon size={14} style={{ marginRight: '0.5rem', verticalAlign: 'middle' }} />
              SETTINGS
            </NavLink>
          </nav>

          <div className="status-indicator">
            {connected ? (
              <>
                <Wifi size={14} style={{ color: 'var(--neon-green)' }} />
                <span className="status-dot online" />
                <span style={{ color: 'var(--neon-green)' }}>CONNECTED</span>
                {lastUpdate && (
                  <span style={{ marginLeft: '0.5rem', opacity: 0.5 }}>
                    {lastUpdate.toLocaleTimeString('en-US', { hour12: false })}
                  </span>
                )}
              </>
            ) : (
              <>
                <WifiOff size={14} style={{ color: 'var(--neon-red)' }} />
                <span className="status-dot offline" />
                <span style={{ color: 'var(--neon-red)' }}>DISCONNECTED</span>
              </>
            )}
          </div>
        </header>

        {/* Main Content */}
        <main className="cyber-main">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/deploy" element={<Deploy />} />
            <Route path="/flow" element={<FlowBuilder />} />
            <Route path="/submit" element={<SubmitJob />} />
            <Route path="/modules" element={<Modules />} />
            <Route path="/node" element={<NodeControl />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>
      </div>
    </ModuleProvider>
  );
}

export default App;
