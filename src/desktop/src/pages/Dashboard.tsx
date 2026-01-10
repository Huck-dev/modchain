import { useState, useEffect, useCallback } from 'react';
import { Server, Cpu, Zap, DollarSign, Activity, BarChart3 } from 'lucide-react';
import { StatsCard, NodeList, JobList, ActivityLog } from '../components';

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

interface ActivityItem {
  time: string;
  message: string;
  type: 'info' | 'success' | 'error';
}

export function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [paymentStats, setPaymentStats] = useState<PaymentStats | null>(null);
  const [nodes, setNodes] = useState<NodeInfo[]>([]);
  const [jobs, setJobs] = useState<JobInfo[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);

  const addActivity = useCallback((message: string, type: 'info' | 'success' | 'error' = 'info') => {
    const time = new Date().toLocaleTimeString('en-US', { hour12: false });
    setActivity(prev => [{ time, message, type }, ...prev].slice(0, 50));
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const [statsRes, nodesRes, jobsRes, paymentsRes] = await Promise.all([
        fetch('/api/v1/stats'),
        fetch('/api/v1/nodes'),
        fetch('/api/v1/jobs'),
        fetch('/api/v1/payments/stats'),
      ]);

      if (statsRes.ok) {
        const data = await statsRes.json() as Stats;
        setStats(data);
      }

      if (nodesRes.ok) {
        const data = await nodesRes.json() as { nodes: NodeInfo[] };
        const prevCount = nodes.length;
        setNodes(data.nodes);
        if (data.nodes.length !== prevCount && prevCount > 0) {
          addActivity(
            `Node count: ${prevCount} → ${data.nodes.length}`,
            data.nodes.length > prevCount ? 'success' : 'info'
          );
        }
      }

      if (jobsRes.ok) {
        const data = await jobsRes.json() as { jobs: JobInfo[] };
        setJobs(data.jobs);
      }

      if (paymentsRes.ok) {
        const data = await paymentsRes.json() as PaymentStats;
        setPaymentStats(data);
      }
    } catch (err) {
      addActivity(`Connection error: ${err}`, 'error');
    }
  }, [nodes.length, addActivity]);

  useEffect(() => {
    fetchData();
    addActivity('Dashboard initialized', 'success');
    const interval = setInterval(fetchData, 2000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const interval = setInterval(fetchData, 2000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const formatCurrency = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  return (
    <div className="fade-in">
      {/* Stats Row */}
      <div className="stats-row">
        <StatsCard
          value={stats?.nodes.total_nodes ?? 0}
          label="NODES ONLINE"
          icon={Server}
          color="primary"
        />
        <StatsCard
          value={stats?.nodes.total_gpus ?? 0}
          label="TOTAL GPUS"
          icon={Zap}
          color="secondary"
        />
        <StatsCard
          value={stats?.jobs.running_jobs ?? 0}
          label="JOBS RUNNING"
          icon={Activity}
          color="success"
        />
        <StatsCard
          value={formatCurrency(paymentStats?.total_volume_cents ?? 0)}
          label="TOTAL VOLUME"
          icon={DollarSign}
          color="warning"
        />
      </div>

      {/* Main Grid */}
      <div className="cyber-grid-layout">
        {/* Nodes Card */}
        <div className="cyber-card">
          <div className="cyber-card-header">
            <span className="cyber-card-title">
              <Server size={14} style={{ marginRight: '0.5rem', verticalAlign: 'middle' }} />
              CONNECTED NODES
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              {stats?.nodes.available_nodes ?? 0} AVAILABLE
            </span>
          </div>
          <div className="cyber-card-body">
            <NodeList nodes={nodes} />
          </div>
        </div>

        {/* Jobs Card */}
        <div className="cyber-card">
          <div className="cyber-card-header">
            <span className="cyber-card-title">
              <Activity size={14} style={{ marginRight: '0.5rem', verticalAlign: 'middle' }} />
              JOB QUEUE
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              {stats?.jobs.total_jobs ?? 0} TOTAL
            </span>
          </div>
          <div className="cyber-card-body">
            <JobList jobs={jobs} />
          </div>
        </div>

        {/* Job Stats */}
        <div className="cyber-card">
          <div className="cyber-card-header">
            <span className="cyber-card-title">
              <BarChart3 size={14} style={{ marginRight: '0.5rem', verticalAlign: 'middle' }} />
              JOB METRICS
            </span>
          </div>
          <div className="cyber-card-body">
            <div className="hardware-grid">
              <div className="hardware-item">
                <div className="hardware-label">PENDING</div>
                <div className="hardware-value" style={{ color: 'var(--warning)' }}>
                  {stats?.jobs.pending_jobs ?? 0}
                </div>
              </div>
              <div className="hardware-item">
                <div className="hardware-label">RUNNING</div>
                <div className="hardware-value" style={{ color: 'var(--primary)' }}>
                  {stats?.jobs.running_jobs ?? 0}
                </div>
              </div>
              <div className="hardware-item">
                <div className="hardware-label">COMPLETED</div>
                <div className="hardware-value" style={{ color: 'var(--success)' }}>
                  {stats?.jobs.completed_jobs ?? 0}
                </div>
              </div>
              <div className="hardware-item">
                <div className="hardware-label">FAILED</div>
                <div className="hardware-value" style={{ color: 'var(--error)' }}>
                  {stats?.jobs.failed_jobs ?? 0}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Network Resources */}
        <div className="cyber-card">
          <div className="cyber-card-header">
            <span className="cyber-card-title">
              <Cpu size={14} style={{ marginRight: '0.5rem', verticalAlign: 'middle' }} />
              NETWORK RESOURCES
            </span>
          </div>
          <div className="cyber-card-body">
            <div className="hardware-grid">
              <div className="hardware-item">
                <div className="hardware-label">GPU CORES</div>
                <div className="hardware-value">{stats?.nodes.total_gpus ?? 0}</div>
              </div>
              <div className="hardware-item">
                <div className="hardware-label">CPU THREADS</div>
                <div className="hardware-value">{stats?.nodes.total_cpu_cores ?? 0}</div>
              </div>
              <div className="hardware-item">
                <div className="hardware-label">MEMORY (GB)</div>
                <div className="hardware-value">{stats?.nodes.total_memory_gb ?? 0}</div>
              </div>
              <div className="hardware-item">
                <div className="hardware-label">PLATFORM FEES</div>
                <div className="hardware-value" style={{ color: 'var(--success)' }}>
                  {formatCurrency(paymentStats?.platform_fees_cents ?? 0)}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Activity Log */}
        <div className="cyber-card" style={{ gridColumn: '1 / -1' }}>
          <div className="cyber-card-header">
            <span className="cyber-card-title">
              <Activity size={14} style={{ marginRight: '0.5rem', verticalAlign: 'middle' }} />
              SYSTEM LOG
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--success)' }}>
              LIVE
            </span>
          </div>
          <div className="cyber-card-body">
            <ActivityLog entries={activity} />
          </div>
        </div>
      </div>
    </div>
  );
}
