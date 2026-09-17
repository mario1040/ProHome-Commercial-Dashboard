import React from 'react';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Calculator,
  Megaphone,
  TrendingUp,
  Settings,
  LogOut,
  X,
  Layers,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export type PageTab =
  | 'dashboard'
  | 'orders'
  | 'products'
  | 'costing'
  | 'marketing'
  | 'performance'
  | 'settings';

interface SidebarProps {
  currentTab: PageTab;
  onSelectTab: (tab: PageTab) => void;
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  isOpen,
  onClose,
}) => {
  const { user, logout } = useAuth();

  const navItems = [
    { id: 'dashboard' as PageTab, label: 'Executive Dashboard', icon: LayoutDashboard },
    { id: 'orders' as PageTab, label: 'Sales & Orders', icon: ShoppingCart },
    { id: 'products' as PageTab, label: 'Products Catalog', icon: Package },
    { id: 'costing' as PageTab, label: 'Costing & Margins', icon: Calculator },
    { id: 'marketing' as PageTab, label: 'Marketing Efficiency', icon: Megaphone },
    { id: 'performance' as PageTab, label: 'Monthly Performance', icon: TrendingUp },
    { id: 'settings' as PageTab, label: 'Settings & Database', icon: Settings },
  ];

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        id="app-sidebar"
        className={`fixed top-0 bottom-0 left-0 z-40 w-64 bg-[#12100E] border-r border-[#26231F] flex flex-col transition-transform duration-200 lg:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
      >
        {/* Brand Header */}
        <div className="flex items-center justify-between px-6 py-6 border-b border-[#26231F]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 flex items-center justify-center p-0.5 rounded-lg bg-[#1B1815] border border-[#332F2A]">
              <img
                src="/logo.png"
                alt="PROHOME Logo"
                className="w-full h-full object-contain drop-shadow-[0_0_12px_rgba(237,225,211,0.35)]"
              />
            </div>

            <div>
              <div className="text-lg font-bold tracking-tighter text-[#EDE1D3]">
                PROHOME
              </div>

              <div className="text-[10px] font-bold text-[#8C8275] tracking-[0.15em] uppercase">
                Commercial V1
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="lg:hidden text-[#8C8275] hover:text-[#EDE1D3] p-1 rounded-lg hover:bg-[#1C1916] transition-colors"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-6 overflow-y-auto">
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-[#787066] font-bold mb-3 px-3">
              Commercial Operations
            </div>
            <ul className="space-y-1.5">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = currentTab === item.id;
                return (
                  <li key={item.id}>
                    <button
                      id={`nav-item-${item.id}`}
                      onClick={() => {
                        onSelectTab(item.id);
                        onClose();
                      }}
                      className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs transition-all relative cursor-pointer ${isActive
                          ? 'text-[#EDE1D3] font-semibold bg-[#1F1C18] border border-[#EDE1D3]/25 shadow-[0_0_15px_rgba(237,225,211,0.06)]'
                          : 'text-[#A8A096] hover:text-[#FBF9F5] hover:bg-[#181614]'
                        }`}
                    >
                      {isActive && (
                        <div className="w-1 h-4 bg-[#EDE1D3] rounded-full shadow-[0_0_8px_rgba(237,225,211,0.7)] -ml-1 mr-0.5 shrink-0" />
                      )}
                      <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-[#EDE1D3]' : 'text-[#8C8275]'}`} />
                      <span className="truncate">{item.label}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </nav>

        {/* Persistence Status Badge */}
        <div className="px-4 py-3 border-t border-[#26231F] bg-[#12100E]">
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#181614] border border-[#2E2A25] text-[11px] text-[#EDE1D3]">
            <div className="w-1.5 h-1.5 rounded-full bg-[#52C48D] shrink-0 animate-pulse shadow-[0_0_6px_rgba(82,196,141,0.6)]" />
            <span className="truncate font-mono text-[10px] text-[#A8A096]">Google Sheets Sync Live</span>
          </div>
        </div>

        {/* User profile & Logout */}
        <div className="p-4 border-t border-[#26231F] bg-[#12100E]">
          <div className="flex items-center justify-between p-2.5 bg-[#181614] rounded-2xl border border-[#2E2A25]">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="w-8 h-8 rounded-full bg-[#26221D] border border-[#423D37] flex items-center justify-center text-xs font-bold text-[#EDE1D3] shadow-[0_0_10px_rgba(237,225,211,0.15)] shrink-0">
                {user?.username?.substring(0, 2).toUpperCase() || 'AD'}
              </div>
              <div className="truncate">
                <div className="text-xs font-semibold text-[#FBF9F5] truncate">{user?.username || 'Admin'}</div>
                <div className="text-[10px] text-[#52C48D] font-mono capitalize">{user?.role || 'Administrator'}</div>
              </div>
            </div>
            <button
              id="sidebar-logout-button"
              onClick={logout}
              className="p-1.5 text-[#8C8275] hover:text-[#E06A6A] hover:bg-[#221F1C] rounded-lg transition-colors ml-1 cursor-pointer"
              title="Sign out"
              aria-label="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
