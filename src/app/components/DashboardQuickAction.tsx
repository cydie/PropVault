import type { ComponentType } from 'react';
import type { View } from '@/lib/rbac';
import { comingSoon } from '@/lib/uiActions';
import { toast } from 'sonner';

const variantCls = {
  primary: 'bg-blue-600 hover:bg-blue-700 text-white',
  secondary: 'bg-secondary hover:bg-secondary/80 text-foreground',
  success: 'bg-emerald-600 hover:bg-emerald-700 text-white',
  danger: 'bg-red-600 hover:bg-red-700 text-white',
} as const;

type Props = {
  label: string;
  icon: ComponentType<{ size?: number; className?: string }>;
  variant?: keyof typeof variantCls;
  navigateTo?: View;
  onNavigate?: (view: View) => void;
  onClick?: () => void;
  feature?: string;
  className?: string;
};

export function DashboardQuickAction({
  label,
  icon: Icon,
  variant = 'secondary',
  navigateTo,
  onNavigate,
  onClick,
  feature,
  className = '',
}: Props) {
  const handleClick = () => {
    if (onClick) {
      onClick();
      return;
    }
    if (navigateTo && onNavigate) {
      onNavigate(navigateTo);
      toast.success(`Opened ${label.replace(/^View |^Open /, '')}`);
      return;
    }
    comingSoon(feature || label);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-50 ${variantCls[variant]} ${className}`}
    >
      <Icon size={14} />
      <span>{label}</span>
    </button>
  );
}
