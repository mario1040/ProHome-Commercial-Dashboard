import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  Calendar,
  DollarSign,
  Layers,
  Truck,
  Megaphone,
  Percent,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import { api } from '../services/api';
import { MonthlyPerformanceRecord } from '../types';
import { formatEgp, formatPercent, formatNumber } from '../utils/format';
import { useToast } from '../components/common/Toast';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';

export const PerformancePage: React.FC = () => {
  const { error } = useToast();
  const [records, setRecords] = useState<MonthlyPerformanceRecord[]>([]);
  const [selectedYear, setSelectedYear] = useState<string>('2026');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchPerformance = async () => {
    setIsLoading(true);
    try {
      const res = await api.performance.get(selectedYear);
      if (res.success && res.data) {
        setRecords(res.data);
      }
    } catch (err: any) {
      error('Failed to load monthly performance data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPerformance();
  }, [selectedYear]);

  // Aggregate yearly totals
  const totalSales = records.reduce((s, r) => s + r.sales, 0);
  const totalCogs = records.reduce((s, r) => s + r.cogs, 0);
  const totalMarketing = records.reduce((s, r) => s + r.marketing_cost, 0);
  const totalDelivery = records.reduce((s, r) => s + r.delivery_cost, 0);
  const totalNetProfit = records.reduce((s, r) => s + r.net_profit, 0);
  const totalMargin = totalSales > 0 ? (totalNetProfit / totalSales) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Top Header & Year Filter */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-5 flex flex-col sm:flex-row gap-4 justify-between items-stretch sm:items-center backdrop-blur-md">
        <div>
          <h2 className="text-sm font-semibold text-white">Monthly Commercial Performance & Target Variance</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Derives actual financial metrics from completed orders, product costings, and marketing spend
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-slate-400" />
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-semibold text-white focus:outline-hidden focus:border-indigo-500/60"
          >
            <option value="2026">Year 2026</option>
            <option value="2025">Year 2025</option>
            <option value="">All Historical Periods</option>
          </select>
        </div>
      </div>

      {/* Yearly Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-5 bg-slate-900/40 border border-slate-800 rounded-2xl backdrop-blur-md">
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block mb-1">Total Sales</span>
          <div className="text-lg font-bold font-mono text-white">{formatEgp(totalSales)}</div>
        </div>
        <div className="p-5 bg-slate-900/40 border border-slate-800 rounded-2xl backdrop-blur-md">
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block mb-1">Total COGS</span>
          <div className="text-lg font-bold font-mono text-slate-300">{formatEgp(totalCogs)}</div>
        </div>
        <div className="p-5 bg-slate-900/40 border border-slate-800 rounded-2xl backdrop-blur-md">
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block mb-1">Marketing Cost</span>
          <div className="text-lg font-bold font-mono text-rose-400">{formatEgp(totalMarketing)}</div>
        </div>
        <div className="p-5 bg-slate-900/40 border border-slate-800 rounded-2xl backdrop-blur-md">
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block mb-1">Delivery Cost</span>
          <div className="text-lg font-bold font-mono text-slate-300">{formatEgp(totalDelivery)}</div>
        </div>
        <div className="p-5 bg-slate-900/40 border border-slate-800 rounded-2xl backdrop-blur-md">
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block mb-1">Net Profit</span>
          <div className="text-lg font-bold font-mono text-emerald-400">{formatEgp(totalNetProfit)}</div>
        </div>
        <div className="p-5 bg-slate-900/40 border border-slate-800 rounded-2xl backdrop-blur-md">
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block mb-1">Avg Net Margin</span>
          <div className="text-lg font-bold font-mono text-indigo-400">{formatPercent(totalMargin)}</div>
        </div>
      </div>

      {/* Profitability Trend Visualization */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-6 backdrop-blur-md">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-white">Monthly Commercial Breakdown</h3>
            <p className="text-xs text-slate-400 mt-0.5">Sales vs Costs vs Resulting Net Profit across months</p>
          </div>
        </div>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={records} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="month" stroke="#64748b" fontSize={11} />
              <YAxis stroke="#64748b" fontSize={11} tickFormatter={(val) => `${val / 1000}k`} />
              <Tooltip
                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '12px' }}
                formatter={(val: any) => [formatEgp(Number(val)), '']}
              />
              <Legend wrapperStyle={{ fontSize: '11px', color: '#94a3b8' }} />
              <Bar dataKey="sales" name="Sales" fill="#6366f1" radius={[6, 6, 0, 0]} />
              <Bar dataKey="cogs" name="COGS" fill="#64748b" radius={[6, 6, 0, 0]} />
              <Bar dataKey="marketing_cost" name="Marketing" fill="#f43f5e" radius={[6, 6, 0, 0]} />
              <Bar dataKey="net_profit" name="Net Profit" fill="#10b981" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Detailed Monthly Performance Table */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-3xl overflow-hidden backdrop-blur-md">
        <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center text-xs text-slate-400">
          <div>Monthly breakdown of commercial performance and targets</div>
          <div className="text-[11px] text-slate-500 font-medium">
            Net Profit = Sales - COGS - Marketing - Delivery
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-[10px] uppercase tracking-widest text-slate-500 font-bold bg-slate-950/40">
                <th className="py-3.5 px-4 font-bold">Month</th>
                <th className="py-3.5 px-4 font-bold text-right">Sales</th>
                <th className="py-3.5 px-4 font-bold text-right">COGS</th>
                <th className="py-3.5 px-4 font-bold text-right">Marketing</th>
                <th className="py-3.5 px-4 font-bold text-right">Delivery</th>
                <th className="py-3.5 px-4 font-bold text-right">Net Profit</th>
                <th className="py-3.5 px-4 font-bold text-right">Net Margin</th>
                <th className="py-3.5 px-4 font-bold text-right">Target</th>
                <th className="py-3.5 px-4 font-bold text-right">Variance</th>
                <th className="py-3.5 px-4 font-bold text-right">Achievement</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {records.map((r) => (
                <tr key={r.month} className="hover:bg-slate-800/20 transition-colors">
                  <td className="py-3.5 px-4 font-semibold text-white font-mono">{r.month}</td>
                  <td className="py-3.5 px-4 text-right font-mono font-medium text-white">{formatEgp(r.sales)}</td>
                  <td className="py-3.5 px-4 text-right font-mono text-slate-400">{formatEgp(r.cogs)}</td>
                  <td className="py-3.5 px-4 text-right font-mono text-slate-400">{formatEgp(r.marketing_cost)}</td>
                  <td className="py-3.5 px-4 text-right font-mono text-slate-400">{formatEgp(r.delivery_cost)}</td>
                  <td className="py-3.5 px-4 text-right font-mono font-semibold text-emerald-400">
                    {formatEgp(r.net_profit)}
                  </td>
                  <td className="py-3.5 px-4 text-right font-medium">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                        r.net_margin >= 25
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      }`}
                    >
                      {formatPercent(r.net_margin)}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono text-slate-300">
                    {r.sales_target !== null ? formatEgp(r.sales_target) : 'No target'}
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    {r.variance !== null ? (
                      <span
                        className={`font-mono font-medium ${
                          r.variance >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {r.variance >= 0 ? '+' : ''}
                        {formatEgp(r.variance)}
                      </span>
                    ) : (
                      <span className="text-slate-600">-</span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    {r.achievement_pct !== null ? (
                      <span
                        className={`font-mono font-bold ${
                          r.achievement_pct >= 100
                            ? 'text-emerald-400'
                            : r.achievement_pct >= 80
                            ? 'text-amber-400'
                            : 'text-slate-400'
                        }`}
                      >
                        {formatPercent(r.achievement_pct)}
                      </span>
                    ) : (
                      <span className="text-slate-600">-</span>
                    )}
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
