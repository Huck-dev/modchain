import { useState, useEffect, useCallback } from 'react';

interface NodeInfo {
  id: string;
  available: boolean;
  current_jobs: number;
  capabilities: {
    gpus: number;
    cpu_cores: number;
    memory_mb: number;
  };
  reputation?: number;
}

interface JobInfo {
  id: string;
  status: string;
  created_at: string;
}

interface Stats {
  nodes: {
    total_nodes: number;
    available_nodes: number;
    total_gpus: number;
    total_cpu_cores: number;
    total_memory_gb: number;
  };
  jobs: {
    total_jobs: number;
    pending_jobs: number;
    running_jobs: number;
    completed_jobs: number;
    failed_jobs: number;
  };
}

interface PaymentStats {
  total_accounts: number;
  total_balance_cents: number;
  total_payments: number;
  total_volume_cents: number;
  platform_fees_cents: number;
}

interface ActivityItem {
  time: string;
  message: string;
  type: 'info' | 'success' | 'error';
}

function App() {
  const [connected, setConnected] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const [nodes, setNodes] = useState<NodeInfo[]>([]);
  const [jobs, setJobs] = useState<JobInfo[]>([]);
  const [paymentStats, setPaymentStats] = useState<PaymentStats | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const addActivity = useCallback((message: string, type: 'info' | 'success' | 'error' = 'info') => {
    const now = new Date();
    const time = now.toLocaleTimeString();
    setActivity(prev => [{time, message, type}, ...prev].slice(0, 50));
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const [healthRes, statsRes, nodesRes, jobsRes, paymentsRes] = await Promise.all([
        fetch('/health'),
        fetch('/api/v1/stats'),
        fetch('/api/v1/nodes'),
        fetch('/api/v1/jobs'),
        fetch('/api/v1/payments/stats'),
      ]);

      if (healthRes.ok) {
        setConnected(true);
        setLastUpdate(new Date());
      } else {
        setConnected(false);
      }

      if (statsRes.ok) {
        const data = await statsRes.json();
        setStats(data);
      }

      if (nodesRes.ok) {
        const data = await nodesRes.json();
        const prevNodes = nodes.length;
        setNodes(data.nodes);
        if (data.nodes.length !== prevNodes && prevNodes > 0) {
          addActivity(`Node count changed: ${prevNodes} -> ${data.nodes.length}`,
            data.nodes.length > prevNodes ? 'success' : 'info');
        }
      }

      if (jobsRes.ok) {
        const data = await jobsRes.json();
        setJobs(data.jobs);
      }

      if (paymentsRes.ok) {
        const data = await paymentsRes.json();
        setPaymentStats(data);
      }
    } catch (error) {
      setConnected(false);
      addActivity(`Connection error: ${error}`, 'error');
    }
  }, [addActivity, nodes.length]);

  // Initial fetch and polling
  useEffect(() => {
    fetchData();
    addActivity('Dashboard connected', 'success');

    const interval = setInterval(fetchData, 2000);
    return () => clearInterval(interval);
  }, []);

  // Re-run fetchData when the callback changes (but not on every render)
  useEffect(() => {
    const interval = setInterval(fetchData, 2000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const formatBytes = (mb: number) => {
    if (mb >= 1024) {
      return `${(mb / 1024).toFixed(1)} GB`;
    }
    return `${mb} MB`;
  };

  const formatCurrency = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return '⏳';
      case 'assigned': return '📋';
      case 'running': return '⚡';
      case 'completed': return '✅';
      case 'failed': return '❌';
      case 'cancelled': return '🚫';
      default: return '❓';
    }
  };

  return (
    <div className="app">
      <header className="header">
        <h1>Modchain Dashboard</h1>
        <div className={`status-badge ${connected ? 'online' : 'offline'}`}>
          <span className={`status-dot ${connected ? 'online' : 'offline'}`}></span>
          {connected ? 'Connected' : 'Disconnected'}
          {lastUpdate && connected && (
            <span style={{ marginLeft: '0.5rem', opacity: 0.7 }}>
              (updated {lastUpdate.toLocaleTimeString()})
            </span>
          )}
        </div>
      </header>

      {/* Top Stats Row */}
      <div style={{ padding: '2rem 2rem 0', maxWidth: '1600px', margin: '0 auto', width: '100%' }}>
        <div className="stats-row">
          <div className="stat-card">
            <div className="stat-value">{stats?.nodes.total_nodes ?? 0}</div>
            <div className="stat-label">Nodes Online</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats?.nodes.total_gpus ?? 0}</div>
            <div className="stat-label">GPUs Available</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats?.jobs.running_jobs ?? 0}</div>
            <div className="stat-label">Jobs Running</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{ color: 'var(--success)' }}>
              {formatCurrency(paymentStats?.total_volume_cents ?? 0)}
            </div>
            <div className="stat-label">Total Volume</div>
          </div>
        </div>
      </div>

      <main className="main">
        {/* Nodes Card */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Connected Nodes</span>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
              {stats?.nodes.available_nodes ?? 0} available
            </span>
          </div>
          <div className="card-body">
            {nodes.length === 0 ? (
              <div className="empty-state">
                No nodes connected
                <br />
                <span style={{ fontSize: '0.75rem', marginTop: '0.5rem', display: 'block' }}>
                  Run <code>cargo run -- start</code> to connect a node
                </span>
              </div>
            ) : (
              <div className="node-list">
                {nodes.map((node) => (
                  <div key={node.id} className="node-item">
                    <div className={`node-status ${node.available ? 'available' : 'busy'}`}></div>
                    <div className="node-info">
                      <div className="node-id">{node.id.slice(0, 12)}...</div>
                      <div className="node-specs">
                        {node.capabilities.gpus} GPU{node.capabilities.gpus !== 1 ? 's' : ''} |
                        {node.capabilities.cpu_cores} cores |
                        {formatBytes(node.capabilities.memory_mb)}
                      </div>
                    </div>
                    <div className="node-jobs">
                      {node.current_jobs} job{node.current_jobs !== 1 ? 's' : ''}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Jobs Card */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Recent Jobs</span>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
              {stats?.jobs.total_jobs ?? 0} total
            </span>
          </div>
          <div className="card-body">
            {jobs.length === 0 ? (
              <div className="empty-state">
                No jobs submitted yet
                <br />
                <span style={{ fontSize: '0.75rem', marginTop: '0.5rem', display: 'block' }}>
                  Use the CLI to submit a job
                </span>
              </div>
            ) : (
              <div className="job-list">
                {jobs.slice(0, 10).map((job) => (
                  <div key={job.id} className="job-item">
                    <span className="job-status-icon">{getStatusIcon(job.status)}</span>
                    <span className="job-id">{job.id.slice(0, 8)}</span>
                    <span className={`job-status-text ${job.status}`}>{job.status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Job Stats Card */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Job Statistics</span>
          </div>
          <div className="card-body">
            <div className="stats-grid">
              <div className="stat">
                <div className="stat-value" style={{ color: 'var(--warning)' }}>
                  {stats?.jobs.pending_jobs ?? 0}
                </div>
                <div className="stat-label">Pending</div>
              </div>
              <div className="stat">
                <div className="stat-value" style={{ color: 'var(--info)' }}>
                  {stats?.jobs.running_jobs ?? 0}
                </div>
                <div className="stat-label">Running</div>
              </div>
              <div className="stat">
                <div className="stat-value" style={{ color: 'var(--success)' }}>
                  {stats?.jobs.completed_jobs ?? 0}
                </div>
                <div className="stat-label">Completed</div>
              </div>
              <div className="stat">
                <div className="stat-value" style={{ color: 'var(--error)' }}>
                  {stats?.jobs.failed_jobs ?? 0}
                </div>
                <div className="stat-label">Failed</div>
              </div>
            </div>
          </div>
        </div>

        {/* Payment Stats Card */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Payment Stats</span>
          </div>
          <div className="card-body">
            <div className="payment-stats">
              <div className="payment-stat">
                <span className="payment-label">Total Accounts</span>
                <span className="payment-value">{paymentStats?.total_accounts ?? 0}</span>
              </div>
              <div className="payment-stat">
                <span className="payment-label">Total Balance</span>
                <span className="payment-value">
                  {formatCurrency(paymentStats?.total_balance_cents ?? 0)}
                </span>
              </div>
              <div className="payment-stat">
                <span className="payment-label">Payments Completed</span>
                <span className="payment-value">{paymentStats?.total_payments ?? 0}</span>
              </div>
              <div className="payment-stat">
                <span className="payment-label">Platform Fees</span>
                <span className="payment-value positive">
                  {formatCurrency(paymentStats?.platform_fees_cents ?? 0)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Network Resources Card */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Network Resources</span>
          </div>
          <div className="card-body">
            <div className="stats-grid">
              <div className="stat">
                <div className="stat-value">{stats?.nodes.total_gpus ?? 0}</div>
                <div className="stat-label">Total GPUs</div>
              </div>
              <div className="stat">
                <div className="stat-value">{stats?.nodes.total_cpu_cores ?? 0}</div>
                <div className="stat-label">CPU Cores</div>
              </div>
              <div className="stat">
                <div className="stat-value">{stats?.nodes.total_memory_gb ?? 0}</div>
                <div className="stat-label">RAM (GB)</div>
              </div>
              <div className="stat">
                <div className="stat-value">{stats?.nodes.available_nodes ?? 0}</div>
                <div className="stat-label">Available</div>
              </div>
            </div>
          </div>
        </div>

        {/* Activity Log Card */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Activity Log</span>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
              Live updates
            </span>
          </div>
          <div className="card-body">
            {activity.length === 0 ? (
              <div className="empty-state">Waiting for activity...</div>
            ) : (
              <div className="activity-log">
                {activity.map((item, i) => (
                  <div key={i} className="activity-item">
                    <span className="activity-time">{item.time}</span>
                    <span className={`activity-message ${item.type}`}>{item.message}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
