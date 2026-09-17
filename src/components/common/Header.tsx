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
    <header className="sticky top-0 z-20 bg-[#0C0B0A]/85 backdrop-blur-md border-b border-[#26231F] px-4 lg:px-8 py-4 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMobileSidebar}
          className="lg:hidden p-2 text-[#8C8275] hover:text-[#EDE1D3] rounded-xl hover:bg-[#1C1916] transition-colors cursor-pointer"
          aria-label="Open navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl lg:text-2xl font-light tracking-tight text-[#FBF9F5]">
            {title.includes('Commercial') ? (
              <>
                {title.replace('Commercial', '')} <span className="font-semibold text-[#EDE1D3]">Commercial</span>
              </>
            ) : (
              <span className="font-semibold text-[#EDE1D3]">{title}</span>
            )}
          </h1>
          {subtitle && <p className="text-xs text-[#A8A096] hidden sm:block mt-0.5">{subtitle}</p>}
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Market / System Status */}
        <div className="hidden xl:flex flex-col items-end pr-3 border-r border-[#26231F]">
          <span className="text-[10px] text-[#787066] font-bold tracking-widest uppercase">System Status</span>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-[#52C48D] rounded-full animate-pulse shadow-[0_0_8px_rgba(82,196,141,0.8)]" />
            <span className="text-xs font-medium text-[#EDE1D3]">Live Active</span>
          </div>
        </div>

        {selectedMonth && onMonthChange && (
          <div className="flex items-center gap-2 bg-[#161412] border border-[#2E2A25] rounded-xl px-3 py-2 text-xs text-[#FBF9F5]">
            <Calendar className="w-3.5 h-3.5 text-[#8C8275] shrink-0" />
            <span className="text-[#8C8275] text-[11px] hidden sm:inline font-medium">Period:</span>
            <select
              id="global-month-selector"
              value={selectedMonth}
              onChange={(e) => onMonthChange(e.target.value)}
              className="bg-transparent border-none text-xs font-semibold text-[#EDE1D3] focus:outline-hidden cursor-pointer"
            >
              {availableMonths.map((m) => (
                <option key={m} value={m} className="bg-[#161412] text-[#FBF9F5]">
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
            className="p-2.5 text-[#8C8275] hover:text-[#EDE1D3] bg-[#161412] hover:bg-[#201D1A] border border-[#2E2A25] rounded-xl transition-all shadow-xs disabled:opacity-50 cursor-pointer"
            title="Refresh data"
            aria-label="Refresh data"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-[#EDE1D3]' : ''}`} />
          </button>
        )}

        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
};
