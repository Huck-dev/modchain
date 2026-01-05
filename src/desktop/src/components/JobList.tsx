import { Clock, CheckCircle, XCircle, Loader, PlayCircle } from 'lucide-react';

interface JobInfo {
  id: string;
  status: string;
  created_at: string;
}

interface JobListProps {
  jobs: JobInfo[];
  maxItems?: number;
}

const statusConfig: Record<string, { icon: typeof Clock; color: string }> = {
  pending: { icon: Clock, color: 'var(--neon-yellow)' },
  assigned: { icon: PlayCircle, color: 'var(--neon-cyan)' },
  running: { icon: Loader, color: 'var(--neon-cyan)' },
  completed: { icon: CheckCircle, color: 'var(--neon-green)' },
  failed: { icon: XCircle, color: 'var(--neon-red)' },
  cancelled: { icon: XCircle, color: 'var(--text-muted)' },
};

export function JobList({ jobs, maxItems = 10 }: JobListProps) {
  if (jobs.length === 0) {
    return (
      <div className="empty-state">
        <Clock size={32} style={{ marginBottom: '0.5rem', opacity: 0.3 }} />
        <div>NO JOBS IN QUEUE</div>
        <div style={{ fontSize: '0.7rem', marginTop: '0.5rem' }}>
          Submit via <code>POST /api/v1/jobs</code>
        </div>
      </div>
    );
  }

  return (
    <div className="stagger-children">
      {jobs.slice(0, maxItems).map((job) => {
        const config = statusConfig[job.status] || statusConfig.pending;
        const Icon = config.icon;

        return (
          <div key={job.id} className="job-item">
            <Icon
              size={16}
              style={{ color: config.color }}
              className={job.status === 'running' ? 'spin' : ''}
            />
            <span className="job-id">
              <span style={{ color: 'var(--neon-magenta)' }}>#</span>
              {job.id.slice(0, 8)}
            </span>
            <span className={`job-status ${job.status}`}>
              {job.status.toUpperCase()}
            </span>
          </div>
        );
      })}
    </div>
  );
}
