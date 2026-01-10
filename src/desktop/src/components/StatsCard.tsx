import { LucideIcon } from 'lucide-react';

interface StatsCardProps {
  value: string | number;
  label: string;
  icon?: LucideIcon;
  color?: string;
  pulse?: boolean;
}

function getColor(color?: string): string {
  switch (color) {
    case 'primary': return 'var(--primary)';
    case 'secondary': return 'var(--primary-light)';
    case 'success': return 'var(--success)';
    case 'warning': return 'var(--warning)';
    default: return 'var(--primary)';
  }
}

export function StatsCard({ value, label, icon: Icon, color, pulse }: StatsCardProps) {
  return (
    <div className="stat-card hover-lift">
      <div className="stat-value" style={{ color: getColor(color) }}>
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
