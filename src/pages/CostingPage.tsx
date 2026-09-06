import React, { useState, useEffect } from 'react';
import {
  Calculator,
  Save,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Percent,
  DollarSign,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { api } from '../services/api';
import { Product } from '../types';
import {
  calculateProductCost,
  calculateProductProfit,
  calculateProductMargin,
  runCostingSanityCheck,
} from '../calculations/businessMetrics';
import { formatEgp, formatPercent } from '../utils/format';
import { useToast } from '../components/common/Toast';

export const CostingPage: React.FC = () => {
  const { success, error } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  // Standalone Interactive Simulator
  const [calcValues, setCalcValues] = useState({
    selling_price: 5000,
    material_cost: 1500,
    manufacturing_cost: 1000,
    packaging_cost: 200,
    delivery_cost: 300,
    marketing_cost: 400,
  });

  // Edited values map for products table: { [productId]: Partial<Product> }
  const [productEdits, setProductEdits] = useState<Record<string, Partial<Product>>>({});

  const fetchProducts = async () => {
    setIsLoading(true);
    try {
      const res = await api.products.list();
      if (res.success && res.data) {
        setProducts(res.data);
      }
    } catch (err: any) {
      error('Failed to load products');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const handleSimulatorChange = (key: string, val: number) => {
    setCalcValues((prev) => ({
      ...prev,
      [key]: Math.max(0, val),
    }));
  };

  const handleLoadSanityTestCase = () => {
    setCalcValues({
      selling_price: 5000,
      material_cost: 1500,
      manufacturing_cost: 1000,
      packaging_cost: 200,
      delivery_cost: 300,
      marketing_cost: 400,
    });
    success('Loaded official specification test case: 5000 selling price -> 3400 total cost, 1600 profit, 32% margin.');
  };

  // Simulator computed values
  const simTotalCost = calculateProductCost(calcValues);
  const simProfit = calculateProductProfit(calcValues.selling_price, simTotalCost);
  const simMargin = calculateProductMargin(calcValues.selling_price, simProfit);

  // Sanity check audit
  const sanity = runCostingSanityCheck();

  // Table edit handler
  const handleProductCostChange = (productId: string, field: keyof Product, value: number) => {
    setProductEdits((prev) => ({
      ...prev,
      [productId]: {
        ...prev[productId],
        [field]: Math.max(0, value),
      },
    }));
  };

  const handleSaveProductCost = async (p: Product) => {
    const edits = productEdits[p.id];
    if (!edits || Object.keys(edits).length === 0) return;

    setSavingId(p.id);
    try {
      const res = await api.products.update(p.id, edits);
      if (res.success) {
        success(`Costings updated for "${p.name}"`);
        setProductEdits((prev) => {
          const copy = { ...prev };
          delete copy[p.id];
          return copy;
        });
        fetchProducts();
      } else {
        error(res.error?.message || 'Failed to save product costs');
      }
    } catch (err: any) {
      error(err.message || 'Error updating costs');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Interactive Costing & Sanity Check Simulator */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-6 backdrop-blur-md shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <Calculator className="w-5 h-5 text-indigo-400" />
              <h2 className="text-sm font-semibold text-white">Live Product Costing Simulator</h2>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Simulate unit pricing, manufacturing, delivery, and marketing to assess profitability margins
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="load-test-case-btn"
              onClick={handleLoadSanityTestCase}
              className="px-4 py-2 bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl flex items-center gap-2 transition-colors cursor-pointer border border-slate-700"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              Verify Official Test Case
            </button>
          </div>
        </div>

        {/* Inputs */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5 mt-5">
          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">Selling Price</label>
            <div className="relative">
              <input
                id="sim-selling-price"
                type="number"
                min="0"
                value={calcValues.selling_price}
                onChange={(e) => handleSimulatorChange('selling_price', Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold font-mono text-white focus:outline-hidden focus:border-indigo-500/60"
              />
              <span className="absolute right-2.5 top-2 text-[10px] text-slate-500 font-mono">EGP</span>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">Material</label>
            <div className="relative">
              <input
                id="sim-material-cost"
                type="number"
                min="0"
                value={calcValues.material_cost}
                onChange={(e) => handleSimulatorChange('material_cost', Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-white focus:outline-hidden focus:border-indigo-500/60"
              />
              <span className="absolute right-2.5 top-2 text-[10px] text-slate-500 font-mono">EGP</span>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">Manufacturing</label>
            <div className="relative">
              <input
                id="sim-manufacturing-cost"
                type="number"
                min="0"
                value={calcValues.manufacturing_cost}
                onChange={(e) => handleSimulatorChange('manufacturing_cost', Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-white focus:outline-hidden focus:border-indigo-500/60"
              />
              <span className="absolute right-2.5 top-2 text-[10px] text-slate-500 font-mono">EGP</span>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">Packaging</label>
            <div className="relative">
              <input
                id="sim-packaging-cost"
                type="number"
                min="0"
                value={calcValues.packaging_cost}
                onChange={(e) => handleSimulatorChange('packaging_cost', Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-white focus:outline-hidden focus:border-indigo-500/60"
              />
              <span className="absolute right-2.5 top-2 text-[10px] text-slate-500 font-mono">EGP</span>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">Delivery</label>
            <div className="relative">
              <input
                id="sim-delivery-cost"
                type="number"
                min="0"
                value={calcValues.delivery_cost}
                onChange={(e) => handleSimulatorChange('delivery_cost', Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-white focus:outline-hidden focus:border-indigo-500/60"
              />
              <span className="absolute right-2.5 top-2 text-[10px] text-slate-500 font-mono">EGP</span>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">Marketing</label>
            <div className="relative">
              <input
                id="sim-marketing-cost"
                type="number"
                min="0"
                value={calcValues.marketing_cost}
                onChange={(e) => handleSimulatorChange('marketing_cost', Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-white focus:outline-hidden focus:border-indigo-500/60"
              />
              <span className="absolute right-2.5 top-2 text-[10px] text-slate-500 font-mono">EGP</span>
            </div>
          </div>
        </div>

        {/* Live Calculation Outcomes Banner */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6 p-5 rounded-2xl bg-slate-950 border border-slate-800">
          <div className="text-center sm:text-left">
            <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block mb-1">Calculated Total Cost</span>
            <div id="sim-total-cost-display" className="text-2xl font-bold font-mono text-white">
              {formatEgp(simTotalCost)}
            </div>
            <span className="text-[10px] text-slate-500 font-medium">Material + Mfg + Pkg + Del + Mkt</span>
          </div>

          <div className="text-center sm:text-left">
            <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block mb-1">Calculated Unit Profit</span>
            <div id="sim-profit-display" className="text-2xl font-bold font-mono text-emerald-400">
              {formatEgp(simProfit)}
            </div>
            <span className="text-[10px] text-slate-500 font-medium">Selling Price - Total Cost</span>
          </div>

          <div className="text-center sm:text-left">
            <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block mb-1">Calculated Margin</span>
            <div id="sim-margin-display" className="text-2xl font-bold font-mono text-indigo-400">
              {formatPercent(simMargin)}
            </div>
            <span className="text-[10px] text-slate-500 font-medium">Profit / Selling Price × 100</span>
          </div>
        </div>
      </div>

      {/* Catalog Product Costing Editor */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-3xl overflow-hidden backdrop-blur-md">
        <div className="px-6 py-5 border-b border-slate-800 flex justify-between items-center">
          <div>
            <h3 className="text-sm font-semibold text-white">Active Product Cost Component Matrix</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Edit individual cost elements live. Changes immediately compute revised total costs, profit, and margins.
            </p>
          </div>
          <div className="text-xs font-mono text-slate-400">
            {products.length} Products configured
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-[10px] uppercase tracking-widest text-slate-500 font-bold bg-slate-950/40">
                <th className="py-3.5 px-4 font-bold">Product / SKU</th>
                <th className="py-3.5 px-2 font-bold w-28 text-right">Selling Price</th>
                <th className="py-3.5 px-2 font-bold w-24 text-right">Material</th>
                <th className="py-3.5 px-2 font-bold w-24 text-right">Mfg</th>
                <th className="py-3.5 px-2 font-bold w-24 text-right">Pkg</th>
                <th className="py-3.5 px-2 font-bold w-24 text-right">Delivery</th>
                <th className="py-3.5 px-2 font-bold w-24 text-right">Mkt</th>
                <th className="py-3.5 px-3 font-bold text-right">Total Cost</th>
                <th className="py-3.5 px-3 font-bold text-right">Profit</th>
                <th className="py-3.5 px-3 font-bold text-right">Margin</th>
                <th className="py-3.5 px-4 font-bold text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {products.map((p) => {
                const edits = productEdits[p.id] || {};
                const current = { ...p, ...edits };

                const totalCost = calculateProductCost(current);
                const profit = calculateProductProfit(current.selling_price, totalCost);
                const margin = calculateProductMargin(current.selling_price, profit);
                const hasChanges = Object.keys(edits).length > 0;

                return (
                  <tr key={p.id} className="hover:bg-slate-800/20 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-white">{p.name}</div>
                      <div className="text-[11px] font-mono text-slate-400">{p.sku}</div>
                    </td>

                    <td className="py-3.5 px-2">
                      <input
                        type="number"
                        min="0"
                        value={current.selling_price}
                        onChange={(e) => handleProductCostChange(p.id, 'selling_price', Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono font-semibold text-white text-right focus:outline-hidden focus:border-indigo-500/60"
                      />
                    </td>

                    <td className="py-3.5 px-2">
                      <input
                        type="number"
                        min="0"
                        value={current.material_cost}
                        onChange={(e) => handleProductCostChange(p.id, 'material_cost', Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-slate-200 text-right focus:outline-hidden focus:border-indigo-500/60"
                      />
                    </td>

                    <td className="py-3.5 px-2">
                      <input
                        type="number"
                        min="0"
                        value={current.manufacturing_cost}
                        onChange={(e) => handleProductCostChange(p.id, 'manufacturing_cost', Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-slate-200 text-right focus:outline-hidden focus:border-indigo-500/60"
                      />
                    </td>

                    <td className="py-3.5 px-2">
                      <input
                        type="number"
                        min="0"
                        value={current.packaging_cost}
                        onChange={(e) => handleProductCostChange(p.id, 'packaging_cost', Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-slate-200 text-right focus:outline-hidden focus:border-indigo-500/60"
                      />
                    </td>

                    <td className="py-3.5 px-2">
                      <input
                        type="number"
                        min="0"
                        value={current.delivery_cost}
                        onChange={(e) => handleProductCostChange(p.id, 'delivery_cost', Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-slate-200 text-right focus:outline-hidden focus:border-indigo-500/60"
                      />
                    </td>

                    <td className="py-3.5 px-2">
                      <input
                        type="number"
                        min="0"
                        value={current.marketing_cost}
                        onChange={(e) => handleProductCostChange(p.id, 'marketing_cost', Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-slate-200 text-right focus:outline-hidden focus:border-indigo-500/60"
                      />
                    </td>

                    <td className="py-3.5 px-3 text-right font-mono font-medium text-slate-300">
                      {formatEgp(totalCost)}
                    </td>

                    <td className="py-3.5 px-3 text-right font-mono font-semibold text-emerald-400">
                      {formatEgp(profit)}
                    </td>

                    <td className="py-3.5 px-3 text-right font-semibold">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                          margin >= 30
                            ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20'
                            : margin >= 25
                            ? 'text-slate-300 bg-slate-800 border border-slate-700'
                            : 'text-amber-400 bg-amber-500/10 border border-amber-500/20'
                        }`}
                      >
                        {formatPercent(margin)}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      <button
                        onClick={() => handleSaveProductCost(p)}
                        disabled={!hasChanges || savingId === p.id}
                        className="px-3 py-1.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 mx-auto disabled:opacity-20 disabled:cursor-not-allowed bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 cursor-pointer shadow-[0_0_10px_rgba(16,185,129,0.1)]"
                      >
                        <Save className="w-3.5 h-3.5" />
                        {savingId === p.id ? 'Saving...' : 'Save'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
