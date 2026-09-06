import React, { useState, useEffect } from 'react';
import {
  Megaphone,
  Plus,
  Edit2,
  Trash2,
  DollarSign,
  TrendingUp,
  ShoppingBag,
  Award,
  Search,
} from 'lucide-react';
import { api } from '../services/api';
import { MarketingRecord } from '../types';
import { formatEgp, formatRatio, formatNumber } from '../utils/format';
import { Modal } from '../components/common/Modal';
import { ConfirmModal } from '../components/common/ConfirmModal';
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

export const MarketingPage: React.FC = () => {
  const { success, error } = useToast();
  const [records, setRecords] = useState<MarketingRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [activeRecord, setActiveRecord] = useState<MarketingRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MarketingRecord | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    month: new Date().toISOString().substring(0, 7),
    spend: 0,
    orders_generated: 0,
    revenue: 0,
  });

  const fetchMarketing = async () => {
    setIsLoading(true);
    try {
      const res = await api.marketing.list();
      if (res.success && res.data) {
        setRecords(res.data.sort((a, b) => b.month.localeCompare(a.month)));
      }
    } catch (err: any) {
      error('Failed to load marketing records');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMarketing();
  }, []);

  const filteredRecords = records.filter((r) =>
    !searchTerm ? true : r.month.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleOpenAdd = () => {
    setFormData({
      month: new Date().toISOString().substring(0, 7),
      spend: 20000,
      orders_generated: 8,
      revenue: 95000,
    });
    setIsAddModalOpen(true);
  };

  const handleOpenEdit = (rec: MarketingRecord) => {
    setActiveRecord(rec);
    setFormData({
      month: rec.month,
      spend: rec.spend,
      orders_generated: rec.orders_generated,
      revenue: rec.revenue,
    });
    setIsEditModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.month) {
      error('Month is required');
      return;
    }

    try {
      if (isEditModalOpen && activeRecord) {
        const res = await api.marketing.update(activeRecord.id, formData);
        if (res.success) {
          success(`Marketing record for ${formData.month} updated`);
          setIsEditModalOpen(false);
          fetchMarketing();
        } else {
          error(res.error?.message || 'Failed to update record');
        }
      } else {
        const res = await api.marketing.create(formData);
        if (res.success) {
          success(`Marketing record for ${formData.month} added`);
          setIsAddModalOpen(false);
          fetchMarketing();
        } else {
          error(res.error?.message || 'Failed to add record');
        }
      }
    } catch (err: any) {
      error(err.message || 'Error saving marketing record');
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      const res = await api.marketing.delete(deleteTarget.id);
      if (res.success) {
        success(`Marketing record for ${deleteTarget.month} deleted`);
        setDeleteTarget(null);
        fetchMarketing();
      } else {
        error(res.error?.message || 'Failed to delete record');
      }
    } catch (err: any) {
      error(err.message || 'Error deleting record');
    }
  };

  // Chart data sorted chronologically
  const chartData = [...records]
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((r) => {
      const cpo = r.orders_generated > 0 ? r.spend / r.orders_generated : 0;
      const roas = r.spend > 0 ? r.revenue / r.spend : 0;
      return {
        month: r.month,
        spend: r.spend,
        revenue: r.revenue,
        cpo: Math.round(cpo),
        roas: Number(roas.toFixed(2)),
      };
    });

  return (
    <div className="space-y-6">
      {/* Header Bar & Actions */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-5 flex flex-col sm:flex-row gap-4 justify-between items-stretch sm:items-center backdrop-blur-md">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Search by month (YYYY-MM)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-hidden focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/60 transition-all"
          />
        </div>

        <button
          id="add-marketing-btn"
          onClick={handleOpenAdd}
          className="px-5 py-2.5 bg-slate-50 hover:bg-white text-slate-950 font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_rgba(255,255,255,0.1)] shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Add Monthly Record
        </button>
      </div>

      {/* Historical Efficiency Comparison Chart */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-6 backdrop-blur-md">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-white">Marketing Spend vs Revenue & ROAS</h3>
            <p className="text-xs text-slate-400 mt-0.5">Track acquisition efficiency and Return on Ad Spend over time</p>
          </div>
        </div>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="month" stroke="#64748b" fontSize={11} />
              <YAxis stroke="#64748b" fontSize={11} tickFormatter={(val) => `${val / 1000}k`} />
              <Tooltip
                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '12px' }}
                formatter={(val: any, name: string) => [
                  name === 'ROAS' ? `${val}x` : formatEgp(Number(val)),
                  name,
                ]}
              />
              <Legend wrapperStyle={{ fontSize: '11px', color: '#94a3b8' }} />
              <Bar dataKey="spend" name="Marketing Spend" fill="#f43f5e" radius={[6, 6, 0, 0]} />
              <Bar dataKey="revenue" name="Attributed Revenue" fill="#6366f1" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Marketing Records Table */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-3xl overflow-hidden backdrop-blur-md">
        <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center text-xs text-slate-400">
          <div>
            Showing <strong className="text-white font-mono">{filteredRecords.length}</strong> monthly campaigns
          </div>
          <div className="text-[11px] text-slate-500 font-medium">
            Formulas: CPO = Spend / Orders Generated • ROAS = Revenue / Spend
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-[10px] uppercase tracking-widest text-slate-500 font-bold bg-slate-950/40">
                <th className="py-3.5 px-4 font-bold">Month</th>
                <th className="py-3.5 px-4 font-bold text-right">Marketing Spend</th>
                <th className="py-3.5 px-4 font-bold text-right">Orders Generated</th>
                <th className="py-3.5 px-4 font-bold text-right">Attributed Revenue</th>
                <th className="py-3.5 px-4 font-bold text-right">Cost Per Order (CPO)</th>
                <th className="py-3.5 px-4 font-bold text-right">ROAS</th>
                <th className="py-3.5 px-4 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {filteredRecords.map((r) => {
                const cpo = r.orders_generated > 0 ? r.spend / r.orders_generated : 0;
                const roas = r.spend > 0 ? r.revenue / r.spend : 0;

                return (
                  <tr key={r.id} className="hover:bg-slate-800/20 transition-colors">
                    <td className="py-3.5 px-4 font-semibold text-white font-mono">{r.month}</td>
                    <td className="py-3.5 px-4 text-right text-slate-300 font-mono font-medium">
                      {formatEgp(r.spend)}
                    </td>
                    <td className="py-3.5 px-4 text-right text-slate-200 font-mono">
                      {formatNumber(r.orders_generated)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-medium text-white">
                      {formatEgp(r.revenue)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-slate-400 font-medium">
                      {formatEgp(cpo)}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                          roas >= 4
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : roas >= 2.5
                            ? 'bg-slate-800 text-slate-300 border border-slate-700'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}
                      >
                        {formatRatio(roas)}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenEdit(r)}
                          className="p-2 text-slate-400 hover:text-amber-400 hover:bg-slate-800/60 rounded-xl transition-colors"
                          title="Edit record"
                          aria-label="Edit record"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(r)}
                          className="p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-800/60 rounded-xl transition-colors"
                          title="Delete record"
                          aria-label="Delete record"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Marketing Record Modal */}
      <Modal
        isOpen={isAddModalOpen || isEditModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setIsEditModalOpen(false);
        }}
        title={isEditModalOpen ? 'Edit Marketing Record' : 'Add Monthly Marketing Record'}
        subtitle="Record campaign spend and generated performance for efficiency reporting"
        maxWidth="md"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">Month (YYYY-MM) *</label>
            <input
              type="month"
              required
              value={formData.month}
              onChange={(e) => setFormData({ ...formData, month: e.target.value })}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-hidden focus:border-indigo-500/60"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">Marketing Spend (EGP) *</label>
            <input
              type="number"
              min="0"
              required
              value={formData.spend}
              onChange={(e) => setFormData({ ...formData, spend: Math.max(0, Number(e.target.value)) })}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono font-semibold text-white focus:outline-hidden focus:border-indigo-500/60"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">Orders Generated</label>
              <input
                type="number"
                min="0"
                value={formData.orders_generated}
                onChange={(e) =>
                  setFormData({ ...formData, orders_generated: Math.max(0, Number(e.target.value)) })
                }
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-white focus:outline-hidden focus:border-indigo-500/60"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">Attributed Revenue (EGP)</label>
              <input
                type="number"
                min="0"
                value={formData.revenue}
                onChange={(e) => setFormData({ ...formData, revenue: Math.max(0, Number(e.target.value)) })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono font-semibold text-white focus:outline-hidden focus:border-indigo-500/60"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={() => {
                setIsAddModalOpen(false);
                setIsEditModalOpen(false);
              }}
              className="px-5 py-2 text-xs font-semibold text-slate-300 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-bold text-slate-950 bg-slate-50 hover:bg-white rounded-xl transition-all shadow-[0_0_15px_rgba(255,255,255,0.1)] cursor-pointer"
            >
              {isEditModalOpen ? 'Save Changes' : 'Record Marketing Campaign'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete Marketing Record"
        message={`Are you sure you want to delete marketing data for ${deleteTarget?.month}? This will impact historical ROAS and Net Profit calculations for that month.`}
        confirmLabel="Delete Record"
        isDestructive={true}
      />
    </div>
  );
};
