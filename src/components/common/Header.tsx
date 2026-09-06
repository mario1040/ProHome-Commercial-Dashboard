import React from 'react';
import { Menu, RefreshCw, Calendar } from 'lucide-react';

interface HeaderProps {
  title: string;
  subtitle?: string;
  selectedMonth?: string;
  onMonthChange?: (month: string) => void;
  availableMonths?: string[];
  onRefresh?: () => void;
  isRefreshing?: boolean;
  onOpenMobileSidebar: () => void;
  actions?: React.ReactNode;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  selectedMonth,
  onMonthChange,
  availableMonths = ['2026-09', '2026-08', '2026-07'],
  onRefresh,
  isRefreshing = false,
  onOpenMobileSidebar,
  actions,
}) => {
  return (
    <header className="sticky top-0 z-20 bg-[#09090b]/80 backdrop-blur-md border-b border-slate-800 px-4 lg:px-8 py-4 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMobileSidebar}
          className="lg:hidden p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800/60 transition-colors"
          aria-label="Open navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl lg:text-2xl font-light tracking-tight text-slate-100">
            {title.includes('Commercial') ? (
              <>
                {title.replace('Commercial', '')} <span className="font-semibold text-white">Commercial</span>
              </>
            ) : (
              <span className="font-semibold text-white">{title}</span>
            )}
          </h1>
          {subtitle && <p className="text-xs text-slate-400 hidden sm:block mt-0.5">{subtitle}</p>}
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Market / System Status */}
        <div className="hidden xl:flex flex-col items-end pr-3 border-r border-slate-800">
          <span className="text-[10px] text-slate-500 font-bold tracking-widest uppercase">System Status</span>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
            <span className="text-xs font-medium text-slate-300">Live Active</span>
          </div>
        </div>

        {selectedMonth && onMonthChange && (
          <div className="flex items-center gap-2 bg-slate-900/60 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200">
            <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="text-slate-400 text-[11px] hidden sm:inline font-medium">Period:</span>
            <select
              id="global-month-selector"
              value={selectedMonth}
              onChange={(e) => onMonthChange(e.target.value)}
              className="bg-transparent border-none text-xs font-semibold text-white focus:outline-hidden cursor-pointer"
            >
              {availableMonths.map((m) => (
                <option key={m} value={m} className="bg-slate-900 text-white">
                  {m}
                </option>
              ))}
            </select>
          </div>
        )}

        {onRefresh && (
          <button
            id="global-refresh-button"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="p-2.5 text-slate-400 hover:text-white bg-slate-900/60 hover:bg-slate-800 border border-slate-800 rounded-xl transition-all shadow-xs disabled:opacity-50"
            title="Refresh data"
            aria-label="Refresh data"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-indigo-400' : ''}`} />
          </button>
        )}

        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
};
