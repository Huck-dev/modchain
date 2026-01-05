import { LucideIcon } from 'lucide-react';

interface CyberButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'default' | 'primary' | 'danger' | 'success';
  icon?: LucideIcon;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
}

export function CyberButton({
  children,
  onClick,
  variant = 'default',
  icon: Icon,
  disabled,
  loading,
  className = '',
}: CyberButtonProps) {
  return (
    <button
      className={`cyber-btn ${variant} ${className}`}
      onClick={onClick}
      disabled={disabled || loading}
      style={{ opacity: disabled ? 0.5 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }}
    >
      {loading ? (
        <span className="spin" style={{ display: 'inline-block', marginRight: '0.5rem' }}>⟳</span>
      ) : Icon ? (
        <Icon size={14} style={{ marginRight: '0.5rem', verticalAlign: 'middle' }} />
      ) : null}
      {children}
    </button>
  );
}
