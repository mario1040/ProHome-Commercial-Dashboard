import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider, useToast } from './components/common/Toast';
import { Sidebar, PageTab } from './components/common/Sidebar';
import { Header } from './components/common/Header';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { OrdersPage } from './pages/OrdersPage';
import { ProductsPage } from './pages/ProductsPage';
import { CostingPage } from './pages/CostingPage';
import { MarketingPage } from './pages/MarketingPage';
import { PerformancePage } from './pages/PerformancePage';
import { SettingsPage } from './pages/SettingsPage';

const AppContent: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const { success } = useToast();
  const [currentTab, setCurrentTab] = useState<PageTab>('dashboard');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState('2026-09');
  const [refreshKey, setRefreshKey] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const availableMonths = [
    '2026-09',
    '2026-08',
    '2026-07',
    '2026-06',
    '2026-05',
    '2026-04',
  ];

  const handleRefresh = () => {
    setIsRefreshing(true);
    setRefreshKey((prev) => prev + 1);
    setTimeout(() => {
      setIsRefreshing(false);
      success('Dashboard data refreshed');
    }, 400);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0C0B0A] flex items-center justify-center text-[#EDE1D3]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-2 border-[#26231F] border-t-[#EDE1D3] rounded-full animate-spin shadow-[0_0_15px_rgba(237,225,211,0.25)]" />
          <div className="text-xs font-medium tracking-wide text-[#A8A096]">Initializing ProHome Commercial Dashboard...</div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  const getPageHeaderInfo = () => {
    switch (currentTab) {
      case 'dashboard':
        return {
          title: 'Executive Commercial Dashboard',
          subtitle: 'Real-time sales, order delivery velocity, COGS, marketing ROAS, and net margin',
        };
      case 'orders':
        return {
          title: 'Sales & Orders Management',
          subtitle: 'Process customer orders, status progression, and line-item historical prices',
        };
      case 'products':
        return {
          title: 'Products Catalog',
          subtitle: 'Active SKUs, selling prices, and unit manufacturing margin thresholds',
        };
      case 'costing':
        return {
          title: 'Costing & Unit Margin Calculator',
          subtitle: 'Direct component cost breakdown: materials, manufacturing, packaging, delivery, marketing',
        };
      case 'marketing':
        return {
          title: 'Marketing Acquisition & Efficiency',
          subtitle: 'Monthly ad spend, generated volume, cost per order (CPO), and ROAS',
        };
      case 'performance':
        return {
          title: 'Monthly Financial Performance',
          subtitle: 'Historical commercial performance, target achievement, and profit variance',
        };
      case 'settings':
        return {
          title: 'Settings & Cloud Database',
          subtitle: 'Monthly commercial target benchmarks and Google Sheets dual-persistence',
        };
    }
  };

  const headerInfo = getPageHeaderInfo();

  return (
    <div className="min-h-screen bg-[#0C0B0A] text-[#FBF9F5] flex font-sans selection:bg-[#EDE1D3]/20 selection:text-[#EDE1D3]">
      {/* Navigation Sidebar */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        isOpen={isMobileSidebarOpen}
        onClose={() => setIsMobileSidebarOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-64">
        <Header
          title={headerInfo.title}
          subtitle={headerInfo.subtitle}
          selectedMonth={currentTab === 'dashboard' ? selectedMonth : undefined}
          onMonthChange={setSelectedMonth}
          availableMonths={availableMonths}
          onRefresh={handleRefresh}
          isRefreshing={isRefreshing}
          onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto" key={refreshKey}>
          {currentTab === 'dashboard' && <DashboardPage selectedMonth={selectedMonth} />}
          {currentTab === 'orders' && <OrdersPage />}
          {currentTab === 'products' && <ProductsPage />}
          {currentTab === 'costing' && <CostingPage />}
          {currentTab === 'marketing' && <MarketingPage />}
          {currentTab === 'performance' && <PerformancePage />}
          {currentTab === 'settings' && <SettingsPage />}
        </main>
      </div>
    </div>
  );
};

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ToastProvider>
  );
}
