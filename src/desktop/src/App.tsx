import { Routes, Route, NavLink } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { LayoutDashboard, Server, Settings as SettingsIcon, Wifi, WifiOff, Rocket, Box, GitBranch } from 'lucide-react';
import { Dashboard, NodeControl, Settings, SubmitJob, Modules, Deploy, FlowBuilder } from './pages';
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
        {/* Header */}
        <header className="app-header">
          <div className="header-logo">
            <div className="logo-icon">
              <Server size={20} />
            </div>
            <h1 className="logo-text">RhizOS</h1>
          </div>

          <nav className="header-nav">
            <NavLink to="/" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <LayoutDashboard size={16} />
              <span>Dashboard</span>
            </NavLink>
            <NavLink to="/deploy" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <Rocket size={16} />
              <span>Deploy</span>
            </NavLink>
            <NavLink to="/flow" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <GitBranch size={16} />
              <span>Flow</span>
            </NavLink>
            <NavLink to="/modules" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <Box size={16} />
              <span>Modules</span>
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
          </div>
        </header>

        {/* Main Content */}
        <main className="app-main">
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
