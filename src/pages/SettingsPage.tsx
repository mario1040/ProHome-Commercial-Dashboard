import React, { useState, useEffect } from 'react';
import {
  Settings as SettingsIcon,
  Target,
  Database,
  RefreshCw,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  HardDrive,
  Shield,
  Layers,
} from 'lucide-react';
import { api } from '../services/api';
import { TargetRecord } from '../types';
import { formatEgp, formatPercent } from '../utils/format';
import { Modal } from '../components/common/Modal';
import { ConfirmModal } from '../components/common/ConfirmModal';
import { useToast } from '../components/common/Toast';

export const SettingsPage: React.FC = () => {
  const { success, error } = useToast();
  const [targets, setTargets] = useState<TargetRecord[]>([]);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [syncStatus, setSyncStatus] = useState<any>(null);
  const [authErrorNotice, setAuthErrorNotice] = useState<string | null>(null);

  // Targets modal state
  const [isAddTargetOpen, setIsAddTargetOpen] = useState<boolean>(false);
  const [isEditTargetOpen, setIsEditTargetOpen] = useState<boolean>(false);
  const [activeTarget, setActiveTarget] = useState<TargetRecord | null>(null);
  const [deleteTargetItem, setDeleteTargetItem] = useState<TargetRecord | null>(null);

  const [targetForm, setTargetForm] = useState({
    month: new Date().toISOString().substring(0, 7),
    sales_target: 300000,
    profit_margin_min: 25,
    profit_margin_max: 35,
  });

  const fetchSettingsAndTargets = async () => {
    try {
      const [targetsRes, settingsRes] = await Promise.all([
        api.targets.list(),
        api.settings.get(),
      ]);

      if (targetsRes.success && targetsRes.data) {
        setTargets(targetsRes.data.sort((a, b) => b.month.localeCompare(a.month)));
      }
      if (settingsRes.success && settingsRes.data) {
        setSyncStatus(settingsRes.data.googleSheetsIntegration);
      }
    } catch (err: any) {
      error('Failed to load settings');
    }
  };

  useEffect(() => {
    fetchSettingsAndTargets();
  }, []);

  const handleTestConnection = async () => {
    setIsTesting(true);
    setAuthErrorNotice(null);
    try {
      const res = await api.sync.testConnection();
      if (res.success) {
        success(res.message || 'Google Apps Script connection verified successfully');
        setAuthErrorNotice(null);
        fetchSettingsAndTargets();
      } else {
        const errorMsg = res.error?.message || 'Connection test failed';
        error(errorMsg);
        if (res.error?.isAuthError || res.error?.code === 'APPS_SCRIPT_AUTH_ERROR' || res.error?.code === 'HTTP_401') {
          setAuthErrorNotice(errorMsg);
        }
      }
    } catch (err: any) {
      error(err.message || 'Error testing connection');
    } finally {
      setIsTesting(false);
    }
  };

  const handleSyncToSheets = async () => {
    setIsSyncing(true);
    setAuthErrorNotice(null);
    try {
      const res = await api.sync.pullFromSheets();
      if (res.success) {
        success(res.message || 'Database refreshed directly from Google Sheets');
        setAuthErrorNotice(null);
        fetchSettingsAndTargets();
      } else {
        const errorMsg = res.error?.message || 'Sync failed';
        error(errorMsg);
        if (res.error?.isAuthError || res.error?.code === 'APPS_SCRIPT_AUTH_ERROR' || res.error?.code === 'HTTP_401') {
          setAuthErrorNotice(errorMsg);
        }
      }
    } catch (err: any) {
      error(err.message || 'Error during synchronization');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSaveTarget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetForm.month) {
      error('Month is required');
      return;
    }
    if (targetForm.profit_margin_min > targetForm.profit_margin_max) {
      error('Minimum margin target cannot exceed maximum margin target');
      return;
    }

    try {
      if (isEditTargetOpen && activeTarget) {
        const res = await api.targets.update(activeTarget.id, targetForm);
        if (res.success) {
          success(`Target for ${targetForm.month} updated`);
          setIsEditTargetOpen(false);
          fetchSettingsAndTargets();
        } else {
          error(res.error?.message || 'Failed to update target');
        }
      } else {
        const res = await api.targets.create(targetForm);
        if (res.success) {
          success(`Target for ${targetForm.month} configured`);
          setIsAddTargetOpen(false);
          fetchSettingsAndTargets();
        } else {
          error(res.error?.message || 'Failed to create target');
        }
      }
    } catch (err: any) {
      error(err.message || 'Error saving target');
    }
  };

  const handleDeleteTargetConfirm = async () => {
    if (!deleteTargetItem) return;
    try {
      const res = await api.targets.delete(deleteTargetItem.id);
      if (res.success) {
        success(`Target for ${deleteTargetItem.month} deleted`);
        setDeleteTargetItem(null);
        fetchSettingsAndTargets();
      } else {
        error(res.error?.message || 'Failed to delete target');
      }
    } catch (err: any) {
      error(err.message || 'Error deleting target');
    }
  };

  return (
    <div className="space-y-6">
      {/* Google Sheets Private Database Sync Card */}
      <div className="bg-[#161412]/85 border border-[#26231F] rounded-3xl p-6 shadow-sm backdrop-blur-md">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-[#26231F]">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 rounded-2xl bg-[#EDE1D3]/10 text-[#EDE1D3] border border-[#EDE1D3]/20 shrink-0">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm font-semibold text-[#FBF9F5]">
                  Google Workspace (Sheets & Drive) Database Architecture
                </h2>
                <span
                  className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase bg-[#52C48D]/10 text-[#52C48D] border border-[#52C48D]/20"
                >
                  GOOGLE SHEETS MODE (ONLINE-ONLY SOURCE OF TRUTH)
                </span>
              </div>
              <p className="text-xs text-[#A8A096] mt-1 max-w-2xl leading-relaxed">
                The ProHome Commercial Dashboard reads and persists all business operations directly to your Google Spreadsheet in real time across 7 structured tables:
                Products, Orders, Order_Items, Marketing, Targets, Settings, and Users. Google Sheets is the sole source of truth.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0 flex-wrap">
            <button
              id="test-connection-btn"
              onClick={handleTestConnection}
              disabled={isTesting || isSyncing}
              className="px-4 py-2.5 bg-[#181614] hover:bg-[#201D1A] text-[#EDE1D3] border border-[#2E2A25] font-semibold rounded-xl text-xs flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-40"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
              {isTesting ? 'Testing...' : 'Test Connection'}
            </button>

            <button
              id="sync-sheets-btn"
              onClick={handleSyncToSheets}
              disabled={isSyncing || isTesting}
              className="px-5 py-2.5 bg-[#EDE1D3] hover:bg-[#F7EFE6] text-[#121110] font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-[0_4px_20px_rgba(237,225,211,0.18)] disabled:opacity-40 cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'Refreshing...' : 'Pull Latest from Google Sheets'}
            </button>
          </div>
        </div>

        {/* Auth Error Banner & Deployment Instructions */}
        {authErrorNotice && (
          <div className="mt-5 p-4 rounded-2xl bg-[#E6AF55]/10 border border-[#E6AF55]/30 text-[#E6AF55]">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-[#E6AF55] shrink-0 mt-0.5" />
              <div className="text-xs space-y-2">
                <div className="font-semibold text-[#FBF9F5]">
                  Google Apps Script Access Notice (HTTP 401 Sign-In Page)
                </div>
                <p className="text-[#B5ACA2] leading-relaxed">
                  Google is currently returning a Google Account login redirect page because the Web App deployment is configured with restricted Google Account authentication instead of Web App API access.
                </p>
                <div className="bg-[#100F0E] p-3 rounded-xl border border-[#E6AF55]/20 font-mono text-[11px] text-[#E6AF55] space-y-1">
                  <div className="font-bold text-[#FBF9F5] mb-1">To enable automated backend API access:</div>
                  <div>1. Open your Google Apps Script project at script.google.com</div>
                  <div>2. Click <span className="text-[#52C48D] font-bold">Deploy</span> &gt; <span className="text-[#52C48D] font-bold">Manage deployments</span> (or New deployment)</div>
                  <div>3. Set <span className="text-[#52C48D] font-bold">Execute as</span> to <span className="text-[#52C48D] font-bold">Me (your account)</span></div>
                  <div>4. Set <span className="text-[#52C48D] font-bold">Who has access</span> to <span className="text-[#52C48D] font-bold">Anyone</span></div>
                  <div>5. Click <span className="text-[#52C48D] font-bold">Deploy</span> and copy the new Web App URL</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Database Sync Status Details */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-5">
          <div className="p-4 bg-[#100F0E] rounded-2xl border border-[#26231F]">
            <div className="flex items-center gap-2 text-[#8C8275] text-xs mb-1">
              <HardDrive className="w-3.5 h-3.5 text-[#8C8275]" />
              <span>Storage Architecture</span>
            </div>
            <div className="text-xs font-semibold text-[#FBF9F5]">
              Google Sheets (Sole Source of Truth)
            </div>
            <div className="text-[11px] text-[#787066] mt-0.5">
              Online-only real-time synchronization
            </div>
          </div>

          <div className="p-4 bg-[#100F0E] rounded-2xl border border-[#26231F]">
            <div className="flex items-center gap-2 text-[#8C8275] text-xs mb-1">
              <FileSpreadsheet className="w-3.5 h-3.5 text-[#8C8275]" />
              <span>Target Spreadsheet Tabs</span>
            </div>
            <div className="text-xs font-semibold font-mono text-[#EDE1D3]">7 Synchronized Tables</div>
            <div className="text-[11px] text-[#787066] mt-0.5">
              Products, Orders, Order_Items, Marketing, Targets, Settings, Users
            </div>
          </div>

          <div className="p-4 bg-[#100F0E] rounded-2xl border border-[#26231F]">
            <div className="flex items-center gap-2 text-[#8C8275] text-xs mb-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#52C48D]" />
              <span>Last Synchronized</span>
            </div>
            <div className="text-xs font-semibold font-mono text-[#52C48D]">
              {syncStatus?.lastSync ? new Date(syncStatus.lastSync).toLocaleString() : 'Ready to Sync'}
            </div>
            <div className="text-[11px] text-[#787066] mt-0.5">
              Manual triggers and automatic record sync supported
            </div>
          </div>
        </div>
      </div>

      {/* Monthly Commercial Financial Targets */}
      <div className="bg-[#161412]/85 border border-[#26231F] rounded-3xl overflow-hidden backdrop-blur-md">
        <div className="px-6 py-5 border-b border-[#26231F] flex justify-between items-center">
          <div>
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-[#EDE1D3]" />
              <h3 className="text-sm font-semibold text-[#FBF9F5]">Monthly Commercial Targets</h3>
            </div>
            <p className="text-xs text-[#A8A096] mt-0.5">
              Set monthly sales benchmarks and profit margin bounds to compute dashboard achievement rates
            </p>
          </div>

          <button
            id="add-target-btn"
            onClick={() => {
              setTargetForm({
                month: new Date().toISOString().substring(0, 7),
                sales_target: 300000,
                profit_margin_min: 25,
                profit_margin_max: 35,
              });
              setIsAddTargetOpen(true);
            }}
            className="px-4 py-2 bg-[#EDE1D3] hover:bg-[#F7EFE6] text-[#121110] font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-[0_4px_15px_rgba(237,225,211,0.18)] cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Set Target
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#26231F] text-[10px] uppercase tracking-widest text-[#8C8275] font-bold bg-[#100F0E]/60">
                <th className="py-3.5 px-4 font-bold">Target Month</th>
                <th className="py-3.5 px-4 font-bold text-right">Sales Target (EGP)</th>
                <th className="py-3.5 px-4 font-bold text-right">Target Margin Range</th>
                <th className="py-3.5 px-4 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#26231F]/50">
              {targets.map((t) => (
                <tr key={t.id} className="hover:bg-[#201D1A]/30 transition-colors">
                  <td className="py-3.5 px-4 font-semibold text-[#FBF9F5] font-mono">{t.month}</td>
                  <td className="py-3.5 px-4 text-right font-mono font-medium text-[#52C48D]">
                    {formatEgp(t.sales_target)}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono text-[#EDE1D3]">
                    {t.profit_margin_min}% – {t.profit_margin_max}%
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => {
                          setActiveTarget(t);
                          setTargetForm({
                            month: t.month,
                            sales_target: t.sales_target,
                            profit_margin_min: t.profit_margin_min,
                            profit_margin_max: t.profit_margin_max,
                          });
                          setIsEditTargetOpen(true);
                        }}
                        className="p-2 text-[#8C8275] hover:text-[#EDE1D3] hover:bg-[#201D1A] rounded-xl transition-colors cursor-pointer"
                        title="Edit target"
                        aria-label="Edit target"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setDeleteTargetItem(t)}
                        className="p-2 text-[#8C8275] hover:text-[#E06A6A] hover:bg-[#201D1A] rounded-xl transition-colors cursor-pointer"
                        title="Delete target"
                        aria-label="Delete target"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Target Modal */}
      <Modal
        isOpen={isAddTargetOpen || isEditTargetOpen}
        onClose={() => {
          setIsAddTargetOpen(false);
          setIsEditTargetOpen(false);
        }}
        title={isEditTargetOpen ? 'Edit Commercial Target' : 'Configure Commercial Target'}
        subtitle="Set monthly revenue and net profit expectations"
        maxWidth="md"
      >
        <form onSubmit={handleSaveTarget} className="space-y-4">
          <div>
            <label className="block text-[11px] font-medium text-[#A8A096] mb-1">Month (YYYY-MM) *</label>
            <input
              type="month"
              required
              value={targetForm.month}
              onChange={(e) => setTargetForm({ ...targetForm, month: e.target.value })}
              className="w-full px-3 py-2 bg-[#100F0E] border border-[#2E2A25] rounded-xl text-xs text-[#FBF9F5] focus:outline-hidden focus:border-[#EDE1D3]/70 font-mono"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-[#A8A096] mb-1">
              Sales Revenue Target (EGP) *
            </label>
            <input
              type="number"
              min="0"
              required
              value={targetForm.sales_target}
              onChange={(e) =>
                setTargetForm({ ...targetForm, sales_target: Math.max(0, Number(e.target.value)) })
              }
              className="w-full px-3 py-2 bg-[#100F0E] border border-[#2E2A25] rounded-xl text-xs font-mono font-semibold text-[#FBF9F5] focus:outline-hidden focus:border-[#EDE1D3]/70"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-[#A8A096] mb-1">Min Profit Margin (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                value={targetForm.profit_margin_min}
                onChange={(e) =>
                  setTargetForm({
                    ...targetForm,
                    profit_margin_min: Math.max(0, Math.min(100, Number(e.target.value))),
                  })
                }
                className="w-full px-3 py-2 bg-[#100F0E] border border-[#2E2A25] rounded-xl text-xs font-mono text-[#FBF9F5] focus:outline-hidden focus:border-[#EDE1D3]/70"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-[#A8A096] mb-1">Max Profit Margin (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                value={targetForm.profit_margin_max}
                onChange={(e) =>
                  setTargetForm({
                    ...targetForm,
                    profit_margin_max: Math.max(0, Math.min(100, Number(e.target.value))),
                  })
                }
                className="w-full px-3 py-2 bg-[#100F0E] border border-[#2E2A25] rounded-xl text-xs font-mono text-[#FBF9F5] focus:outline-hidden focus:border-[#EDE1D3]/70"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-[#26231F]">
            <button
              type="button"
              onClick={() => {
                setIsAddTargetOpen(false);
                setIsEditTargetOpen(false);
              }}
              className="px-5 py-2 text-xs font-semibold text-[#A8A096] bg-[#181614] hover:bg-[#201D1A] border border-[#2E2A25] rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-bold text-[#121110] bg-[#EDE1D3] hover:bg-[#F7EFE6] rounded-xl transition-all shadow-[0_4px_15px_rgba(237,225,211,0.18)] cursor-pointer"
            >
              {isEditTargetOpen ? 'Update Target' : 'Save Target'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmModal
        isOpen={Boolean(deleteTargetItem)}
        onClose={() => setDeleteTargetItem(null)}
        onConfirm={handleDeleteTargetConfirm}
        title="Delete Commercial Target"
        message={`Are you sure you want to delete the target for ${deleteTargetItem?.month}? The dashboard will indicate "No target configured" for this month.`}
        confirmLabel="Delete Target"
        isDestructive={true}
      />
    </div>
  );
};
