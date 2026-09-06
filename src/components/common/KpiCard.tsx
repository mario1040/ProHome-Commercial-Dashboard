import React from 'react';
import { LucideIcon } from 'lucide-react';

interface KpiCardProps {
  id?: string;
  label: string;
  value: string | number;
  subtext?: string;
  trend?: {
    direction: 'up' | 'down' | 'neutral';
    text: string;
  };
  icon?: LucideIcon;
  variant?: 'default' | 'accent' | 'warning' | 'muted';
}

export const KpiCard: React.FC<KpiCardProps> = ({
  id,
  label,
  value,
  subtext,
  trend,
  icon: Icon,
  variant = 'default',
}) => {
  const borderHighlight = {
    default: 'border-slate-800/80 bg-slate-900/40 hover:border-slate-700',
    accent: 'border-slate-800/90 bg-slate-900/50 hover:border-indigo-500/50 shadow-[0_0_15px_rgba(99,102,241,0.05)]',
    warning: 'border-slate-800/90 bg-slate-900/40 hover:border-amber-500/40',
    muted: 'border-slate-800/50 bg-slate-900/20 text-slate-400',
  }[variant];

  return (
    <div
      id={id}
      className={`p-5 rounded-2xl border text-slate-100 flex flex-col justify-between transition-all relative overflow-hidden backdrop-blur-xs ${borderHighlight}`}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500 truncate mr-1">
          {label}
        </span>
        {Icon && (
          <div className="p-2 rounded-xl bg-slate-800/50 text-indigo-400 border border-slate-700/50 shrink-0">
            <Icon className="w-4 h-4" />
          </div>
        )}
      </div>

      <div className="my-1">
        <div className="text-2xl font-bold tracking-tight text-white">{value}</div>
      </div>

      {(subtext || trend) && (
        <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-slate-800/60 text-xs text-slate-400">
          {subtext && <span className="truncate text-slate-500 text-[11px]">{subtext}</span>}
          {trend && (
            <span
              className={`font-semibold font-mono text-[11px] ${
                trend.direction === 'up'
                  ? 'text-emerald-400'
                  : trend.direction === 'down'
                  ? 'text-rose-400'
                  : 'text-slate-400'
              }`}
            >
              {trend.text}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
