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
    default: 'border-[#26231F] bg-[#161412]/85 hover:border-[#38332D]',
    accent: 'border-[#EDE1D3]/30 bg-[#1C1916]/90 hover:border-[#EDE1D3]/50 shadow-[0_4px_20px_rgba(0,0,0,0.3)]',
    warning: 'border-[#E6AF55]/30 bg-[#161412]/85 hover:border-[#E6AF55]/50',
    muted: 'border-[#26231F]/60 bg-[#12100E]/40 text-[#787066]',
  }[variant];

  return (
    <div
      id={id}
      className={`p-5 rounded-2xl border text-[#FBF9F5] flex flex-col justify-between transition-all relative overflow-hidden backdrop-blur-xs ${borderHighlight}`}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#8C8275] truncate mr-1">
          {label}
        </span>
        {Icon && (
          <div className="p-2 rounded-xl bg-[#201D1A] text-[#EDE1D3] border border-[#332F2A] shrink-0">
            <Icon className="w-4 h-4" />
          </div>
        )}
      </div>

      <div className="my-1">
        <div className="text-2xl font-bold tracking-tight text-[#FBF9F5] font-mono">{value}</div>
      </div>

      {(subtext || trend) && (
        <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-[#26231F] text-xs text-[#A8A096]">
          {subtext && <span className="truncate text-[#787066] text-[11px]">{subtext}</span>}
          {trend && (
            <span
              className={`font-semibold font-mono text-[11px] ${
                trend.direction === 'up'
                  ? 'text-[#52C48D]'
                  : trend.direction === 'down'
                  ? 'text-[#E06A6A]'
                  : 'text-[#8C8275]'
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
