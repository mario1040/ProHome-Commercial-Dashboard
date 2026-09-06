import React, { useEffect, useState } from 'react';
import {
  DollarSign,
  ShoppingBag,
  TrendingUp,
  Percent,
  Truck,
  Megaphone,
  Target as TargetIcon,
  Globe,
  Award,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import { api } from '../services/api';
import { DashboardMetrics, ProductMixItem, MonthlyPerformanceRecord } from '../types';
import { formatEgp, formatPercent, formatNumber, formatRatio } from '../utils/format';
import { KpiCard } from '../components/common/KpiCard';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';

interface DashboardPageProps {
  selectedMonth: string;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ selectedMonth }) => {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [productMix, setProductMix] = useState<ProductMixItem[]>([]);
  const [performanceHistory, setPerformanceHistory] = useState<MonthlyPerformanceRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [dashRes, perfRes] = await Promise.all([
        api.dashboard.get(selectedMonth),
        api.performance.get(),
      ]);

      if (dashRes.success && dashRes.data) {
        setMetrics(dashRes.data.metrics);
        setProductMix(dashRes.data.productMix);
      } else {
        setError(dashRes.error?.message || 'Failed to load dashboard data');
      }

      if (perfRes.success && perfRes.data) {
        setPerformanceHistory(perfRes.data);
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred fetching dashboard metrics');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [selectedMonth]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px] text-slate-400">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-slate-800 border-t-indigo-500 rounded-full animate-spin shadow-[0_0_12px_rgba(99,102,241,0.5)]" />
          <span className="text-xs font-medium text-slate-400">Computing commercial metrics...</span>
        </div>
      </div>
    );
  }

  if (error || !metrics) {
    return (
      <div className="p-6 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-rose-300 text-xs">
        {error || 'Unable to load dashboard metrics'}
      </div>
    );
  }

  // Format historical chart data
  const trendData = performanceHistory.map((item) => ({
    month: item.month,
    sales: item.sales,
    orders: item.orders_count,
    target: item.sales_target || 0,
    profit: item.net_profit,
    cogs: item.cogs,
  }));

  // Top products from product mix (filter items with sales > 0)
  const topSellers = productMix.filter((p) => p.units_sold > 0).slice(0, 5);

  return (
    <div className="space-y-8">
      {/* Target vs Actual Executive Widget */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-6 lg:p-8 relative overflow-hidden backdrop-blur-md shadow-lg">
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-800/80 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <TargetIcon className="w-4 h-4 text-indigo-400" />
              <h2 className="text-base font-semibold text-white tracking-tight">Commercial Target vs Actual ({metrics.month})</h2>
            </div>
            <p className="text-xs text-slate-400">
              Comparison of confirmed completed sales against monthly financial targets
            </p>
          </div>

          <div className="flex items-center gap-6">
            {metrics.target ? (
              <>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-0.5">Sales Target</div>
                  <div className="text-base font-bold text-white tracking-tight">{formatEgp(metrics.target.sales_target)}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-0.5">Target Margin</div>
                  <div className="text-base font-bold text-slate-200">
                    {metrics.target.profit_margin_min}% – {metrics.target.profit_margin_max}%
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-0.5">Achievement</div>
                  <div
                    className={`text-base font-bold font-mono ${
                      (metrics.sales_achievement_rate || 0) >= 100
                        ? 'text-emerald-400'
                        : (metrics.sales_achievement_rate || 0) >= 80
                        ? 'text-amber-400'
                        : 'text-slate-300'
                    }`}
                  >
                    {metrics.sales_achievement_rate !== null
                      ? formatPercent(metrics.sales_achievement_rate)
                      : 'N/A'}
                  </div>
                </div>
              </>
            ) : (
              <div className="text-xs text-amber-400 font-medium">No target configured for {metrics.month}</div>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        {metrics.target && metrics.target.sales_target > 0 && (
          <div className="mt-5 pt-1 relative z-10">
            <div className="flex justify-between text-xs mb-2">
              <span className="text-slate-400">
                Actual Sales: <strong className="text-white font-mono">{formatEgp(metrics.sales)}</strong>
              </span>
              <span className="text-slate-400">
                Target: <strong className="text-white font-mono">{formatEgp(metrics.target.sales_target)}</strong>
              </span>
            </div>
            <div className="w-full h-2.5 bg-slate-950 border border-slate-800/80 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 shadow-[0_0_10px_rgba(99,102,241,0.5)] ${
                  (metrics.sales_achievement_rate || 0) >= 100
                    ? 'bg-gradient-to-r from-indigo-500 to-emerald-400'
                    : (metrics.sales_achievement_rate || 0) >= 75
                    ? 'bg-gradient-to-r from-indigo-500 to-amber-400'
                    : 'bg-indigo-500'
                }`}
                style={{ width: `${Math.min(100, metrics.sales_achievement_rate || 0)}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Primary KPI Grid (11 Required Metrics) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
        <KpiCard
          id="kpi-monthly-sales"
          label="Monthly Sales"
          value={formatEgp(metrics.sales)}
          subtext="Completed sales"
          icon={DollarSign}
          variant="accent"
        />
        <KpiCard
          id="kpi-orders-count"
          label="Orders"
          value={formatNumber(metrics.orders_count)}
          subtext="Delivered orders"
          icon={ShoppingBag}
        />
        <KpiCard
          id="kpi-aov"
          label="Average Order Value"
          value={formatEgp(metrics.aov)}
          subtext="Sales / Orders"
          icon={Award}
        />
        <KpiCard
          id="kpi-cogs"
          label="COGS"
          value={formatEgp(metrics.cogs)}
          subtext="Product costs"
          icon={Layers}
        />
        <KpiCard
          id="kpi-marketing-cost"
          label="Marketing Cost"
          value={formatEgp(metrics.marketing_cost)}
          subtext="Campaign spend"
          icon={Megaphone}
        />
        <KpiCard
          id="kpi-delivery-cost"
          label="Delivery Cost"
          value={formatEgp(metrics.delivery_cost)}
          subtext="Fulfilled orders"
          icon={Truck}
        />
        <KpiCard
          id="kpi-net-profit"
          label="Net Profit"
          value={formatEgp(metrics.net_profit)}
          subtext="Sales - Costs"
          icon={TrendingUp}
          variant={metrics.net_profit >= 0 ? 'accent' : 'warning'}
        />
        <KpiCard
          id="kpi-net-margin"
          label="Net Margin"
          value={formatPercent(metrics.net_margin)}
          subtext={
            metrics.target
              ? `Target: ${metrics.target.profit_margin_min}-${metrics.target.profit_margin_max}%`
              : 'Margin %'
          }
          icon={Percent}
        />
        <KpiCard
          id="kpi-web-conversion"
          label="Website Conversion"
          value={metrics.website_conversion_rate}
          subtext="Requires session data"
          icon={Globe}
          variant="muted"
        />
        <KpiCard
          id="kpi-cost-per-order"
          label="Cost per Order"
          value={formatEgp(metrics.cost_per_order)}
          subtext="Spend / Orders gen."
          icon={ShoppingBag}
        />
        <KpiCard
          id="kpi-roas"
          label="ROAS"
          value={formatRatio(metrics.roas)}
          subtext="Revenue / Spend"
          icon={TrendingUp}
        />
      </div>

      {/* Visual Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sales & Orders Trend */}
        <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-6 backdrop-blur-md">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-[10px] uppercase tracking-[0.15em] text-slate-500 font-bold mb-1">Performance Curve</div>
              <h3 className="text-sm font-semibold text-white">Commercial Sales Trend</h3>
            </div>
            <span className="text-[11px] text-slate-500">Sales vs Target (EGP)</span>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="month" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={11} tickFormatter={(val) => `${val / 1000}k`} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#09090b', borderColor: '#334155', borderRadius: '12px', fontSize: '12px', color: '#f1f5f9', boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }}
                  formatter={(val: any) => [`${formatEgp(Number(val))}`, '']}
                />
                <Legend wrapperStyle={{ fontSize: '11px', color: '#94a3b8' }} />
                <Line type="monotone" dataKey="sales" name="Actual Sales" stroke="#6366f1" strokeWidth={3} dot={{ r: 4, fill: '#6366f1' }} activeDot={{ r: 6, stroke: '#fff', strokeWidth: 2 }} />
                <Line type="monotone" dataKey="target" name="Sales Target" stroke="#94a3b8" strokeWidth={2} strokeDasharray="5 5" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Monthly Profitability Breakdown */}
        <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-6 backdrop-blur-md">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-[10px] uppercase tracking-[0.15em] text-slate-500 font-bold mb-1">Financial Composition</div>
              <h3 className="text-sm font-semibold text-white">Monthly Profitability Breakdown</h3>
            </div>
            <span className="text-[11px] text-slate-500">EGP</span>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trendData} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="month" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={11} tickFormatter={(val) => `${val / 1000}k`} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#09090b', borderColor: '#334155', borderRadius: '12px', fontSize: '12px', color: '#f1f5f9', boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }}
                  formatter={(val: any) => [`${formatEgp(Number(val))}`, '']}
                />
                <Legend wrapperStyle={{ fontSize: '11px', color: '#94a3b8' }} />
                <Bar dataKey="sales" name="Sales" fill="#6366f1" radius={[6, 6, 0, 0]} />
                <Bar dataKey="cogs" name="COGS" fill="#334155" radius={[6, 6, 0, 0]} />
                <Bar dataKey="profit" name="Net Profit" fill="#10b981" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Product Mix Ranking */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-6 lg:p-8 backdrop-blur-md">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="text-[10px] uppercase tracking-[0.15em] text-slate-500 font-bold mb-1">Catalog Performance</div>
            <h3 className="text-base font-semibold text-white">Product Mix & Commercial Performance</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Derived from completed orders, historical unit prices, and unit product costing
            </p>
          </div>
          <div className="text-xs text-slate-400 bg-slate-900/80 px-3 py-1.5 rounded-xl border border-slate-800">
            Active SKUs: <strong className="text-white">{productMix.length}</strong>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-[10px] uppercase tracking-widest text-slate-500 font-bold">
                <th className="py-3 px-4">Product Name</th>
                <th className="py-3 px-4">SKU</th>
                <th className="py-3 px-4 text-right">Units Sold</th>
                <th className="py-3 px-4 text-right">Revenue</th>
                <th className="py-3 px-4 text-right">Product Cost</th>
                <th className="py-3 px-4 text-right">Profit</th>
                <th className="py-3 px-4 text-right">Margin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {productMix.map((p) => (
                <tr key={p.product_id} className="hover:bg-slate-800/20 transition-all text-slate-300">
                  <td className="py-3.5 px-4 font-semibold text-white">{p.product_name}</td>
                  <td className="py-3.5 px-4 font-mono text-slate-400 text-[11px]">{p.sku}</td>
                  <td className="py-3.5 px-4 text-right text-slate-200 font-mono font-semibold">{formatNumber(p.units_sold)}</td>
                  <td className="py-3.5 px-4 text-right text-white font-mono font-medium">{formatEgp(p.revenue)}</td>
                  <td className="py-3.5 px-4 text-right text-slate-400 font-mono">{formatEgp(p.product_cost)}</td>
                  <td className="py-3.5 px-4 text-right text-emerald-400 font-mono font-semibold">{formatEgp(p.profit)}</td>
                  <td className="py-3.5 px-4 text-right font-medium">
                    <span
                      className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-mono font-bold ${
                        p.margin >= 30
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : p.margin >= 25
                          ? 'bg-slate-800 text-slate-300 border border-slate-700'
                          : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      }`}
                    >
                      {formatPercent(p.margin)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
