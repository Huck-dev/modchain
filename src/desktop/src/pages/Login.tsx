import { useState } from 'react';
import { Server, User, Lock, AlertCircle, Loader2 } from 'lucide-react';

interface LoginProps {
  onLogin: (token: string) => void;
}

type AuthMode = 'login' | 'signup';

export function Login({ onLogin }: LoginProps) {
  const [mode, setMode] = useState<AuthMode>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!username.trim() || !password) {
      setError('Username and password are required');
      return;
    }

    if (mode === 'signup') {
      if (password !== confirmPassword) {
        setError('Passwords do not match');
        return;
      }
      if (password.length < 6) {
        setError('Password must be at least 6 characters');
        return;
      }
    }

    setLoading(true);

    try {
      const endpoint = mode === 'signup' ? '/api/v1/auth/signup' : '/api/v1/auth/login';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Authentication failed');
        setLoading(false);
        return;
      }

      // Store token and user info
      localStorage.setItem('rhizos_token', data.token);
      if (data.user) {
        localStorage.setItem('rhizos_user', JSON.stringify(data.user));
      }
      onLogin(data.token);
    } catch (err) {
      setError('Unable to connect to server');
      setLoading(false);
    }
  };

  const switchMode = () => {
    setMode(mode === 'login' ? 'signup' : 'login');
    setError('');
    setConfirmPassword('');
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <div className="login-logo">
            <Server size={32} />
          </div>
          <h1>OtherThing</h1>
          <p>{mode === 'login' ? 'Sign in to your account' : 'Create a new account'}</p>
          <p className="rhizos-hint">Install RhizOS to unlock more features</p>
        </div>

        <div className="auth-tabs">
          <button
            type="button"
            className={`auth-tab ${mode === 'login' ? 'active' : ''}`}
            onClick={() => { setMode('login'); setError(''); }}
          >
            Sign In
          </button>
          <button
            type="button"
            className={`auth-tab ${mode === 'signup' ? 'active' : ''}`}
            onClick={() => { setMode('signup'); setError(''); }}
          >
            Sign Up
          </button>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="input-group">
            <User size={18} className="input-icon" />
            <input
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={loading}
              autoFocus
              autoComplete="username"
            />
          </div>

          <div className="input-group">
            <Lock size={18} className="input-icon" />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            />
          </div>

          {mode === 'signup' && (
            <div className="input-group">
              <Lock size={18} className="input-icon" />
              <input
                type="password"
                placeholder="Confirm password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={loading}
                autoComplete="new-password"
              />
            </div>
          )}

          {error && (
            <div className="login-error">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <button type="submit" disabled={loading || !username.trim() || !password}>
            {loading ? (
              <>
                <Loader2 size={18} className="spin" />
                <span>{mode === 'signup' ? 'Creating account...' : 'Signing in...'}</span>
              </>
            ) : (
              <span>{mode === 'signup' ? 'Create Account' : 'Sign In'}</span>
            )}
          </button>
        </form>

        <div className="auth-switch">
          {mode === 'login' ? (
            <span>Don't have an account? <button type="button" onClick={switchMode}>Sign up</button></span>
          ) : (
            <span>Already have an account? <button type="button" onClick={switchMode}>Sign in</button></span>
          )}
        </div>
      </div>

      <style>{`
        .login-container {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 100%);
          padding: 20px;
        }

        .login-card {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 16px;
          padding: 40px;
          width: 100%;
          max-width: 400px;
          backdrop-filter: blur(10px);
        }

        .login-header {
          text-align: center;
          margin-bottom: 24px;
        }

        .login-logo {
          width: 64px;
          height: 64px;
          background: linear-gradient(135deg, #00d4ff 0%, #0099ff 100%);
          border-radius: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 16px;
          color: white;
        }

        .login-header h1 {
          color: #fff;
          font-size: 24px;
          font-weight: 600;
          margin: 0 0 8px;
        }

        .login-header p {
          color: rgba(255, 255, 255, 0.5);
          font-size: 14px;
          margin: 0;
        }

        .login-header .rhizos-hint {
          margin-top: 12px;
          padding: 8px 12px;
          background: rgba(0, 212, 255, 0.1);
          border: 1px solid rgba(0, 212, 255, 0.2);
          border-radius: 6px;
          color: #00d4ff;
          font-size: 12px;
        }

        .auth-tabs {
          display: flex;
          gap: 8px;
          margin-bottom: 24px;
        }

        .auth-tab {
          flex: 1;
          padding: 12px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          color: rgba(255, 255, 255, 0.5);
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        .auth-tab:hover {
          background: rgba(255, 255, 255, 0.08);
          color: rgba(255, 255, 255, 0.7);
        }

        .auth-tab.active {
          background: rgba(0, 212, 255, 0.15);
          border-color: rgba(0, 212, 255, 0.3);
          color: #00d4ff;
        }

        .login-form {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .input-group {
          position: relative;
        }

        .input-icon {
          position: absolute;
          left: 14px;
          top: 50%;
          transform: translateY(-50%);
          color: rgba(255, 255, 255, 0.3);
        }

        .input-group input {
          width: 100%;
          padding: 14px 14px 14px 44px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          color: #fff;
          font-size: 16px;
          transition: all 0.2s;
          box-sizing: border-box;
        }

        .input-group input:focus {
          outline: none;
          border-color: #00d4ff;
          background: rgba(255, 255, 255, 0.08);
        }

        .input-group input::placeholder {
          color: rgba(255, 255, 255, 0.3);
        }

        .login-error {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px;
          background: rgba(255, 59, 48, 0.1);
          border: 1px solid rgba(255, 59, 48, 0.3);
          border-radius: 8px;
          color: #ff3b30;
          font-size: 14px;
        }

        .login-form > button[type="submit"] {
          padding: 14px;
          background: linear-gradient(135deg, #00d4ff 0%, #0099ff 100%);
          border: none;
          border-radius: 8px;
          color: #fff;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }

        .login-form > button[type="submit"]:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 4px 20px rgba(0, 212, 255, 0.3);
        }

        .login-form > button[type="submit"]:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .auth-switch {
          margin-top: 20px;
          text-align: center;
          color: rgba(255, 255, 255, 0.5);
          font-size: 14px;
        }

        .auth-switch button {
          background: none;
          border: none;
          color: #00d4ff;
          font-size: 14px;
          cursor: pointer;
          padding: 0;
          text-decoration: underline;
        }

        .auth-switch button:hover {
          color: #33ddff;
        }

        .spin {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
