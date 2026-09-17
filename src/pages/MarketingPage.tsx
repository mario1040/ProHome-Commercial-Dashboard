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
      <div className="bg-[#161412]/85 border border-[#26231F] rounded-3xl p-5 flex flex-col sm:flex-row gap-4 justify-between items-stretch sm:items-center backdrop-blur-md">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-[#787066] absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Search by month (YYYY-MM)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-[#100F0E] border border-[#2E2A25] rounded-xl text-xs text-[#FBF9F5] placeholder-[#5C554D] focus:outline-hidden focus:border-[#EDE1D3]/70 focus:ring-1 focus:ring-[#EDE1D3]/70 transition-all font-mono"
          />
        </div>

        <button
          id="add-marketing-btn"
          onClick={handleOpenAdd}
          className="px-5 py-2.5 bg-[#EDE1D3] hover:bg-[#F7EFE6] text-[#121110] font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-[0_4px_20px_rgba(237,225,211,0.18)] shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Add Monthly Record
        </button>
      </div>

      {/* Historical Efficiency Comparison Chart */}
      <div className="bg-[#161412]/85 border border-[#26231F] rounded-3xl p-6 backdrop-blur-md">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-[#FBF9F5]">Marketing Spend vs Revenue & ROAS</h3>
            <p className="text-xs text-[#A8A096] mt-0.5">Track acquisition efficiency and Return on Ad Spend over time</p>
          </div>
        </div>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#26231F" />
              <XAxis dataKey="month" stroke="#8C8275" fontSize={11} />
              <YAxis stroke="#8C8275" fontSize={11} tickFormatter={(val) => `${val / 1000}k`} />
              <Tooltip
                contentStyle={{ backgroundColor: '#141210', borderColor: '#332F2A', borderRadius: '12px', fontSize: '12px', color: '#FBF9F5', boxShadow: '0 10px 25px rgba(0,0,0,0.6)' }}
                formatter={(val: any, name: string) => [
                  name === 'ROAS' ? `${val}x` : formatEgp(Number(val)),
                  name,
                ]}
              />
              <Legend wrapperStyle={{ fontSize: '11px', color: '#B5ACA2' }} />
              <Bar dataKey="spend" name="Marketing Spend" fill="#C5A059" radius={[6, 6, 0, 0]} />
              <Bar dataKey="revenue" name="Attributed Revenue" fill="#EDE1D3" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Marketing Records Table */}
      <div className="bg-[#161412]/85 border border-[#26231F] rounded-3xl overflow-hidden backdrop-blur-md">
        <div className="px-6 py-4 border-b border-[#26231F] flex justify-between items-center text-xs text-[#A8A096]">
          <div>
            Showing <strong className="text-[#FBF9F5] font-mono">{filteredRecords.length}</strong> monthly campaigns
          </div>
          <div className="text-[11px] text-[#787066] font-medium">
            Formulas: CPO = Spend / Orders Generated • ROAS = Revenue / Spend
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#26231F] text-[10px] uppercase tracking-widest text-[#8C8275] font-bold bg-[#100F0E]/60">
                <th className="py-3.5 px-4 font-bold">Month</th>
                <th className="py-3.5 px-4 font-bold text-right">Marketing Spend</th>
                <th className="py-3.5 px-4 font-bold text-right">Orders Generated</th>
                <th className="py-3.5 px-4 font-bold text-right">Attributed Revenue</th>
                <th className="py-3.5 px-4 font-bold text-right">Cost Per Order (CPO)</th>
                <th className="py-3.5 px-4 font-bold text-right">ROAS</th>
                <th className="py-3.5 px-4 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#26231F]/50">
              {filteredRecords.map((r) => {
                const cpo = r.orders_generated > 0 ? r.spend / r.orders_generated : 0;
                const roas = r.spend > 0 ? r.revenue / r.spend : 0;

                return (
                  <tr key={r.id} className="hover:bg-[#201D1A]/30 transition-colors">
                    <td className="py-3.5 px-4 font-semibold text-[#FBF9F5] font-mono">{r.month}</td>
                    <td className="py-3.5 px-4 text-right text-[#EDE1D3] font-mono font-medium">
                      {formatEgp(r.spend)}
                    </td>
                    <td className="py-3.5 px-4 text-right text-[#FBF9F5] font-mono">
                      {formatNumber(r.orders_generated)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-medium text-[#FBF9F5]">
                      {formatEgp(r.revenue)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-[#A8A096] font-medium">
                      {formatEgp(cpo)}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                          roas >= 4
                            ? 'bg-[#52C48D]/10 text-[#52C48D] border border-[#52C48D]/25'
                            : roas >= 2.5
                            ? 'bg-[#181614] text-[#EDE1D3] border border-[#332F2A]'
                            : 'bg-[#E06A6A]/10 text-[#E06A6A] border border-[#E06A6A]/25'
                        }`}
                      >
                        {formatRatio(roas)}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenEdit(r)}
                          className="p-2 text-[#8C8275] hover:text-[#EDE1D3] hover:bg-[#201D1A] rounded-xl transition-colors cursor-pointer"
                          title="Edit record"
                          aria-label="Edit record"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(r)}
                          className="p-2 text-[#8C8275] hover:text-[#E06A6A] hover:bg-[#201D1A] rounded-xl transition-colors cursor-pointer"
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
            <label className="block text-[11px] font-medium text-[#A8A096] mb-1">Month (YYYY-MM) *</label>
            <input
              type="month"
              required
              value={formData.month}
              onChange={(e) => setFormData({ ...formData, month: e.target.value })}
              className="w-full px-3 py-2 bg-[#100F0E] border border-[#2E2A25] rounded-xl text-xs text-[#FBF9F5] focus:outline-hidden focus:border-[#EDE1D3]/70 font-mono"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-[#A8A096] mb-1">Marketing Spend (EGP) *</label>
            <input
              type="number"
              min="0"
              required
              value={formData.spend}
              onChange={(e) => setFormData({ ...formData, spend: Math.max(0, Number(e.target.value)) })}
              className="w-full px-3 py-2 bg-[#100F0E] border border-[#2E2A25] rounded-xl text-xs font-mono font-semibold text-[#FBF9F5] focus:outline-hidden focus:border-[#EDE1D3]/70"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-[#A8A096] mb-1">Orders Generated</label>
              <input
                type="number"
                min="0"
                value={formData.orders_generated}
                onChange={(e) =>
                  setFormData({ ...formData, orders_generated: Math.max(0, Number(e.target.value)) })
                }
                className="w-full px-3 py-2 bg-[#100F0E] border border-[#2E2A25] rounded-xl text-xs font-mono text-[#FBF9F5] focus:outline-hidden focus:border-[#EDE1D3]/70"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-[#A8A096] mb-1">Attributed Revenue (EGP)</label>
              <input
                type="number"
                min="0"
                value={formData.revenue}
                onChange={(e) => setFormData({ ...formData, revenue: Math.max(0, Number(e.target.value)) })}
                className="w-full px-3 py-2 bg-[#100F0E] border border-[#2E2A25] rounded-xl text-xs font-mono font-semibold text-[#FBF9F5] focus:outline-hidden focus:border-[#EDE1D3]/70"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-[#26231F]">
            <button
              type="button"
              onClick={() => {
                setIsAddModalOpen(false);
                setIsEditModalOpen(false);
              }}
              className="px-5 py-2 text-xs font-semibold text-[#A8A096] bg-[#181614] hover:bg-[#201D1A] border border-[#2E2A25] rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-bold text-[#121110] bg-[#EDE1D3] hover:bg-[#F7EFE6] rounded-xl transition-all shadow-[0_4px_15px_rgba(237,225,211,0.18)] cursor-pointer"
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
