import { LucideIcon } from 'lucide-react';

interface StatsCardProps {
  value: string | number;
  label: string;
  icon?: LucideIcon;
  color?: 'cyan' | 'magenta' | 'green' | 'yellow';
  pulse?: boolean;
}

const colorStyles = {
  cyan: { color: 'var(--neon-cyan)', shadow: 'var(--glow-cyan)' },
  magenta: { color: 'var(--neon-magenta)', shadow: 'var(--glow-magenta)' },
  green: { color: 'var(--neon-green)', shadow: 'var(--glow-green)' },
  yellow: { color: 'var(--neon-yellow)', shadow: '0 0 10px #ffff00, 0 0 20px #ffff0040' },
};

export function StatsCard({ value, label, icon: Icon, color = 'cyan', pulse }: StatsCardProps) {
  const style = colorStyles[color];

  return (
    <div className={`stat-card hover-lift ${pulse ? 'border-glow' : ''}`}>
      <div
        className="stat-value"
        style={{ color: style.color, textShadow: style.shadow }}
      >
        {value}
      </div>
      <div className="stat-label">{label}</div>
      {Icon && (
        <div className="stat-icon">
          <Icon size={48} />
        </div>
      )}
    </div>
  );
}
