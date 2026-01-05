import { LucideIcon } from 'lucide-react';

interface StatsCardProps {
  value: string | number;
  label: string;
  icon?: LucideIcon;
  color?: 'primary' | 'secondary' | 'success' | 'warning';
  pulse?: boolean;
}

const colorStyles = {
  primary: { color: 'var(--primary)' },
  secondary: { color: 'var(--primary-light)' },
  success: { color: 'var(--success)' },
  warning: { color: 'var(--warning)' },
};

export function StatsCard({ value, label, icon: Icon, color = 'primary', pulse }: StatsCardProps) {
  const style = colorStyles[color];

  return (
    <div className={`stat-card hover-lift`}>
      <div className="stat-value" style={{ color: style.color }}>
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
