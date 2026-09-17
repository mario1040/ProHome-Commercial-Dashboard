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
      <div className="bg-[#161412]/85 border border-[#26231F] rounded-3xl p-5 flex flex-col sm:flex-row gap-4 justify-between items-stretch sm:items-center backdrop-blur-md">
        <div>
          <h2 className="text-sm font-semibold text-[#FBF9F5]">Monthly Commercial Performance & Target Variance</h2>
          <p className="text-xs text-[#A8A096] mt-0.5">
            Derives actual financial metrics from completed orders, product costings, and marketing spend
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-[#8C8275]" />
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="px-3.5 py-2 bg-[#100F0E] border border-[#2E2A25] rounded-xl text-xs font-semibold text-[#FBF9F5] focus:outline-hidden focus:border-[#EDE1D3]/70"
          >
            <option value="2026">Year 2026</option>
            <option value="2025">Year 2025</option>
            <option value="">All Historical Periods</option>
          </select>
        </div>
      </div>

      {/* Yearly Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-5 bg-[#161412]/85 border border-[#26231F] rounded-2xl backdrop-blur-md">
          <span className="text-[10px] uppercase font-bold tracking-wider text-[#8C8275] block mb-1">Total Sales</span>
          <div className="text-lg font-bold font-mono text-[#FBF9F5]">{formatEgp(totalSales)}</div>
        </div>
        <div className="p-5 bg-[#161412]/85 border border-[#26231F] rounded-2xl backdrop-blur-md">
          <span className="text-[10px] uppercase font-bold tracking-wider text-[#8C8275] block mb-1">Total COGS</span>
          <div className="text-lg font-bold font-mono text-[#B5ACA2]">{formatEgp(totalCogs)}</div>
        </div>
        <div className="p-5 bg-[#161412]/85 border border-[#26231F] rounded-2xl backdrop-blur-md">
          <span className="text-[10px] uppercase font-bold tracking-wider text-[#8C8275] block mb-1">Marketing Cost</span>
          <div className="text-lg font-bold font-mono text-[#C5A059]">{formatEgp(totalMarketing)}</div>
        </div>
        <div className="p-5 bg-[#161412]/85 border border-[#26231F] rounded-2xl backdrop-blur-md">
          <span className="text-[10px] uppercase font-bold tracking-wider text-[#8C8275] block mb-1">Delivery Cost</span>
          <div className="text-lg font-bold font-mono text-[#B5ACA2]">{formatEgp(totalDelivery)}</div>
        </div>
        <div className="p-5 bg-[#161412]/85 border border-[#26231F] rounded-2xl backdrop-blur-md">
          <span className="text-[10px] uppercase font-bold tracking-wider text-[#8C8275] block mb-1">Net Profit</span>
          <div className="text-lg font-bold font-mono text-[#52C48D]">{formatEgp(totalNetProfit)}</div>
        </div>
        <div className="p-5 bg-[#161412]/85 border border-[#26231F] rounded-2xl backdrop-blur-md">
          <span className="text-[10px] uppercase font-bold tracking-wider text-[#8C8275] block mb-1">Avg Net Margin</span>
          <div className="text-lg font-bold font-mono text-[#EDE1D3]">{formatPercent(totalMargin)}</div>
        </div>
      </div>

      {/* Profitability Trend Visualization */}
      <div className="bg-[#161412]/85 border border-[#26231F] rounded-3xl p-6 backdrop-blur-md">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-[#FBF9F5]">Monthly Commercial Breakdown</h3>
            <p className="text-xs text-[#A8A096] mt-0.5">Sales vs Costs vs Resulting Net Profit across months</p>
          </div>
        </div>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={records} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#26231F" />
              <XAxis dataKey="month" stroke="#8C8275" fontSize={11} />
              <YAxis stroke="#8C8275" fontSize={11} tickFormatter={(val) => `${val / 1000}k`} />
              <Tooltip
                contentStyle={{ backgroundColor: '#141210', borderColor: '#332F2A', borderRadius: '12px', fontSize: '12px', color: '#FBF9F5', boxShadow: '0 10px 25px rgba(0,0,0,0.6)' }}
                formatter={(val: any) => [formatEgp(Number(val)), '']}
              />
              <Legend wrapperStyle={{ fontSize: '11px', color: '#B5ACA2' }} />
              <Bar dataKey="sales" name="Sales" fill="#EDE1D3" radius={[6, 6, 0, 0]} />
              <Bar dataKey="cogs" name="COGS" fill="#3D3731" radius={[6, 6, 0, 0]} />
              <Bar dataKey="marketing_cost" name="Marketing" fill="#C5A059" radius={[6, 6, 0, 0]} />
              <Bar dataKey="net_profit" name="Net Profit" fill="#52C48D" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Detailed Monthly Performance Table */}
      <div className="bg-[#161412]/85 border border-[#26231F] rounded-3xl overflow-hidden backdrop-blur-md">
        <div className="px-6 py-4 border-b border-[#26231F] flex justify-between items-center text-xs text-[#A8A096]">
          <div>Monthly breakdown of commercial performance and targets</div>
          <div className="text-[11px] text-[#787066] font-medium">
            Net Profit = Sales - COGS - Marketing - Delivery
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#26231F] text-[10px] uppercase tracking-widest text-[#8C8275] font-bold bg-[#100F0E]/60">
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
            <tbody className="divide-y divide-[#26231F]/50">
              {records.map((r) => (
                <tr key={r.month} className="hover:bg-[#201D1A]/30 transition-colors">
                  <td className="py-3.5 px-4 font-semibold text-[#FBF9F5] font-mono">{r.month}</td>
                  <td className="py-3.5 px-4 text-right font-mono font-medium text-[#FBF9F5]">{formatEgp(r.sales)}</td>
                  <td className="py-3.5 px-4 text-right font-mono text-[#A8A096]">{formatEgp(r.cogs)}</td>
                  <td className="py-3.5 px-4 text-right font-mono text-[#C5A059]">{formatEgp(r.marketing_cost)}</td>
                  <td className="py-3.5 px-4 text-right font-mono text-[#A8A096]">{formatEgp(r.delivery_cost)}</td>
                  <td className="py-3.5 px-4 text-right font-mono font-semibold text-[#52C48D]">
                    {formatEgp(r.net_profit)}
                  </td>
                  <td className="py-3.5 px-4 text-right font-medium">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                        r.net_margin >= 25
                          ? 'bg-[#52C48D]/10 text-[#52C48D] border border-[#52C48D]/25'
                          : 'bg-[#E6AF55]/10 text-[#E6AF55] border border-[#E6AF55]/25'
                      }`}
                    >
                      {formatPercent(r.net_margin)}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono text-[#EDE1D3]">
                    {r.sales_target !== null ? formatEgp(r.sales_target) : 'No target'}
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    {r.variance !== null ? (
                      <span
                        className={`font-mono font-medium ${
                          r.variance >= 0 ? 'text-[#52C48D]' : 'text-[#E06A6A]'
                        }`}
                      >
                        {r.variance >= 0 ? '+' : ''}
                        {formatEgp(r.variance)}
                      </span>
                    ) : (
                      <span className="text-[#5C554D]">-</span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    {r.achievement_pct !== null ? (
                      <span
                        className={`font-mono font-bold ${
                          r.achievement_pct >= 100
                            ? 'text-[#52C48D]'
                            : r.achievement_pct >= 80
                            ? 'text-[#E6AF55]'
                            : 'text-[#A8A096]'
                        }`}
                      >
                        {formatPercent(r.achievement_pct)}
                      </span>
                    ) : (
                      <span className="text-[#5C554D]">-</span>
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
