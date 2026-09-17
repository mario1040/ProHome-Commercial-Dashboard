import React, { useState, useEffect } from 'react';
import {
  Search,
  Plus,
  Trash2,
  Edit2,
  Package,
  Layers,
  DollarSign,
  Percent,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Tag,
} from 'lucide-react';
import { api } from '../services/api';
import { Product } from '../types';
import {
  calculateProductCost,
  calculateProductProfit,
  calculateProductMargin,
} from '../calculations/businessMetrics';
import { formatEgp, formatPercent } from '../utils/format';
import { Modal } from '../components/common/Modal';
import { ConfirmModal } from '../components/common/ConfirmModal';
import { useToast } from '../components/common/Toast';

export const ProductsPage: React.FC = () => {
  const { success, error } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Filters & Sorting
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<'name' | 'price' | 'margin' | 'profit'>('name');

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [activeProduct, setActiveProduct] = useState<Product | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    category: 'Living',
    selling_price: 0,
    material_cost: 0,
    manufacturing_cost: 0,
    packaging_cost: 0,
    delivery_cost: 0,
    marketing_cost: 0,
    is_active: true,
  });

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

  // Categories list
  const categories = Array.from(new Set(products.map((p) => p.category))).filter(Boolean);

  // Filter & Sort Products
  const filteredProducts = products
    .filter((p) => {
      const term = searchTerm.toLowerCase();
      const matchesSearch =
        !term || p.name.toLowerCase().includes(term) || p.sku.toLowerCase().includes(term);
      const matchesCat = selectedCategory === 'ALL' || p.category === selectedCategory;
      const matchesStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'ACTIVE' && p.is_active) ||
        (statusFilter === 'INACTIVE' && !p.is_active);
      return matchesSearch && matchesCat && matchesStatus;
    })
    .sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'price') return b.selling_price - a.selling_price;
      if (sortBy === 'profit') {
        const pA = calculateProductProfit(a.selling_price, calculateProductCost(a));
        const pB = calculateProductProfit(b.selling_price, calculateProductCost(b));
        return pB - pA;
      }
      if (sortBy === 'margin') {
        const mA = calculateProductMargin(
          a.selling_price,
          calculateProductProfit(a.selling_price, calculateProductCost(a))
        );
        const mB = calculateProductMargin(
          b.selling_price,
          calculateProductProfit(b.selling_price, calculateProductCost(b))
        );
        return mB - mA;
      }
      return 0;
    });

  const handleOpenAdd = () => {
    setFormData({
      name: '',
      sku: '',
      category: categories[0] || 'Smart Furniture',
      selling_price: 5000,
      material_cost: 1500,
      manufacturing_cost: 1000,
      packaging_cost: 200,
      delivery_cost: 300,
      marketing_cost: 400,
      is_active: true,
    });
    setIsAddModalOpen(true);
  };

  const handleOpenEdit = (p: Product) => {
    setActiveProduct(p);
    setFormData({
      name: p.name,
      sku: p.sku,
      category: p.category,
      selling_price: p.selling_price,
      material_cost: p.material_cost,
      manufacturing_cost: p.manufacturing_cost,
      packaging_cost: p.packaging_cost,
      delivery_cost: p.delivery_cost,
      marketing_cost: p.marketing_cost,
      is_active: p.is_active,
    });
    setIsEditModalOpen(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.sku.trim()) {
      error('Product Name and SKU are required');
      return;
    }

    try {
      if (isEditModalOpen && activeProduct) {
        const res = await api.products.update(activeProduct.id, formData);
        if (res.success) {
          success(`Product "${formData.name}" updated successfully`);
          setIsEditModalOpen(false);
          fetchProducts();
        } else {
          error(res.error?.message || 'Failed to update product');
        }
      } else {
        const res = await api.products.create(formData);
        if (res.success) {
          success(`Product "${formData.name}" created successfully`);
          setIsAddModalOpen(false);
          fetchProducts();
        } else {
          error(res.error?.message || 'Failed to create product');
        }
      }
    } catch (err: any) {
      error(err.message || 'Error saving product');
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      const res = await api.products.delete(deleteTarget.id);
      if (res.success) {
        if (res.data?.deactivated) {
          success(`Product "${deleteTarget.name}" deactivated (preserved for historical orders)`);
        } else {
          success(`Product "${deleteTarget.name}" deleted successfully`);
        }
        setDeleteTarget(null);
        fetchProducts();
      } else {
        error(res.error?.message || 'Failed to delete product');
      }
    } catch (err: any) {
      error(err.message || 'Error deleting product');
    }
  };

  // Preview calculations for modal form
  const formTotalCost = calculateProductCost(formData);
  const formProfit = calculateProductProfit(formData.selling_price, formTotalCost);
  const formMargin = calculateProductMargin(formData.selling_price, formProfit);

  return (
    <div className="space-y-6">
      {/* Top Filter Bar */}
      <div className="bg-[#161412]/85 border border-[#26231F] rounded-3xl p-5 flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center backdrop-blur-md">
        <div className="flex flex-1 flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#787066] absolute left-3.5 top-3" />
            <input
              id="products-search-input"
              type="text"
              placeholder="Search by product name or SKU..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-[#100F0E] border border-[#2E2A25] rounded-xl text-xs text-[#FBF9F5] placeholder-[#5C554D] focus:outline-hidden focus:border-[#EDE1D3]/70 focus:ring-1 focus:ring-[#EDE1D3]/70 transition-all font-mono"
            />
          </div>

          {/* Category Filter */}
          <select
            id="products-category-filter"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3.5 py-2.5 bg-[#100F0E] border border-[#2E2A25] rounded-xl text-xs text-[#FBF9F5] focus:outline-hidden focus:border-[#EDE1D3]/70 cursor-pointer"
          >
            <option value="ALL">All Categories</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3.5 py-2.5 bg-[#100F0E] border border-[#2E2A25] rounded-xl text-xs text-[#FBF9F5] focus:outline-hidden focus:border-[#EDE1D3]/70 cursor-pointer"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active Only</option>
            <option value="INACTIVE">Inactive Only</option>
          </select>

          {/* Sort By */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-3.5 py-2.5 bg-[#100F0E] border border-[#2E2A25] rounded-xl text-xs text-[#FBF9F5] focus:outline-hidden focus:border-[#EDE1D3]/70 cursor-pointer"
          >
            <option value="name">Sort by Name</option>
            <option value="price">Sort by Price (High to Low)</option>
            <option value="profit">Sort by Profit</option>
            <option value="margin">Sort by Margin %</option>
          </select>
        </div>

        <button
          id="add-product-btn"
          onClick={handleOpenAdd}
          className="px-5 py-2.5 bg-[#EDE1D3] hover:bg-[#F7EFE6] text-[#121110] font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-[0_4px_20px_rgba(237,225,211,0.18)] shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Add Product
        </button>
      </div>

      {/* Products Table */}
      <div className="bg-[#161412]/85 border border-[#26231F] rounded-3xl overflow-hidden backdrop-blur-md">
        <div className="px-6 py-4 border-b border-[#26231F] flex justify-between items-center text-xs text-[#A8A096]">
          <div>
            Showing <strong className="text-[#FBF9F5] font-mono">{filteredProducts.length}</strong> of{' '}
            <strong className="text-[#FBF9F5] font-mono">{products.length}</strong> products
          </div>
          <div className="text-[11px] text-[#787066] font-medium">
            * Historical orders preserve unit prices independently from catalog edits
          </div>
        </div>

        {filteredProducts.length === 0 ? (
          <div className="p-12 text-center text-[#787066] text-xs">
            No products match your criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#26231F] text-[10px] uppercase tracking-widest text-[#8C8275] font-bold bg-[#100F0E]/60">
                  <th className="py-3.5 px-4 font-bold">Product Name</th>
                  <th className="py-3.5 px-4 font-bold">SKU</th>
                  <th className="py-3.5 px-4 font-bold">Category</th>
                  <th className="py-3.5 px-4 font-bold text-right">Selling Price</th>
                  <th className="py-3.5 px-4 font-bold text-right">Total Cost</th>
                  <th className="py-3.5 px-4 font-bold text-right">Profit</th>
                  <th className="py-3.5 px-4 font-bold text-right">Margin</th>
                  <th className="py-3.5 px-4 font-bold text-center">Status</th>
                  <th className="py-3.5 px-4 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#26231F]/50">
                {filteredProducts.map((p) => {
                  const totalCost = calculateProductCost(p);
                  const profit = calculateProductProfit(p.selling_price, totalCost);
                  const margin = calculateProductMargin(p.selling_price, profit);

                  return (
                    <tr key={p.id} className="hover:bg-[#201D1A]/30 transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-[#FBF9F5]">{p.name}</td>
                      <td className="py-3.5 px-4 font-mono text-[#A8A096] text-[11px]">{p.sku}</td>
                      <td className="py-3.5 px-4 text-[#A8A096]">{p.category}</td>
                      <td className="py-3.5 px-4 text-right font-mono font-semibold text-[#FBF9F5]">
                        {formatEgp(p.selling_price)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-[#A8A096]">{formatEgp(totalCost)}</td>
                      <td className="py-3.5 px-4 text-right font-mono font-semibold text-[#52C48D]">
                        {formatEgp(profit)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-medium">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                            margin >= 30
                              ? 'bg-[#52C48D]/10 text-[#52C48D] border border-[#52C48D]/25'
                              : margin >= 25
                              ? 'bg-[#181614] text-[#EDE1D3] border border-[#332F2A]'
                              : 'bg-[#E6AF55]/10 text-[#E6AF55] border border-[#E6AF55]/25'
                          }`}
                        >
                          {formatPercent(margin)}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {p.is_active ? (
                          <span className="inline-flex items-center gap-1.5 text-[11px] text-[#52C48D] font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#52C48D] animate-pulse shadow-[0_0_6px_rgba(82,196,141,0.8)]" /> Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-[11px] text-[#787066] font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#787066]" /> Inactive
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenEdit(p)}
                            className="p-2 text-[#8C8275] hover:text-[#EDE1D3] hover:bg-[#201D1A] rounded-xl transition-colors cursor-pointer"
                            title="Edit product"
                            aria-label="Edit product"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(p)}
                            className="p-2 text-[#8C8275] hover:text-[#E06A6A] hover:bg-[#201D1A] rounded-xl transition-colors cursor-pointer"
                            title="Delete or deactivate product"
                            aria-label="Delete or deactivate product"
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
        )}
      </div>

      {/* Add / Edit Product Modal */}
      <Modal
        isOpen={isAddModalOpen || isEditModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setIsEditModalOpen(false);
        }}
        title={isEditModalOpen ? 'Edit Product' : 'Add New Product'}
        subtitle="Specify product catalog details and cost breakdown"
        maxWidth="2xl"
      >
        <form onSubmit={handleSaveProduct} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-[#A8A096] mb-1">Product Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Smart Desk Pro"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 bg-[#100F0E] border border-[#2E2A25] rounded-xl text-xs text-[#FBF9F5] focus:outline-hidden focus:border-[#EDE1D3]/70"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-[#A8A096] mb-1">SKU *</label>
              <input
                type="text"
                required
                placeholder="e.g. PH-DSK-001"
                value={formData.sku}
                onChange={(e) => setFormData({ ...formData, sku: e.target.value.toUpperCase() })}
                className="w-full px-3 py-2 bg-[#100F0E] border border-[#2E2A25] rounded-xl text-xs font-mono text-[#FBF9F5] focus:outline-hidden focus:border-[#EDE1D3]/70"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-[#A8A096] mb-1">Category</label>
              <input
                type="text"
                placeholder="e.g. Smart Desks, Transforming Tables"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-3 py-2 bg-[#100F0E] border border-[#2E2A25] rounded-xl text-xs text-[#FBF9F5] focus:outline-hidden focus:border-[#EDE1D3]/70"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-[#A8A096] mb-1">Selling Price (EGP) *</label>
              <input
                type="number"
                required
                min="0"
                value={formData.selling_price}
                onChange={(e) => setFormData({ ...formData, selling_price: Math.max(0, Number(e.target.value)) })}
                className="w-full px-3 py-2 bg-[#100F0E] border border-[#2E2A25] rounded-xl text-xs font-semibold text-[#FBF9F5] focus:outline-hidden focus:border-[#EDE1D3]/70"
              />
            </div>
          </div>

          {/* Cost Components Breakdown */}
          <div className="pt-3 border-t border-[#26231F]">
            <span className="text-xs font-semibold text-[#FBF9F5] block mb-2">Cost Breakdown Components (EGP)</span>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              <div>
                <label className="block text-[10px] text-[#A8A096] mb-1">Material Cost</label>
                <input
                  type="number"
                  min="0"
                  value={formData.material_cost}
                  onChange={(e) => setFormData({ ...formData, material_cost: Math.max(0, Number(e.target.value)) })}
                  className="w-full px-2.5 py-1.5 bg-[#100F0E] border border-[#2E2A25] rounded-xl text-xs text-[#FBF9F5] focus:outline-hidden focus:border-[#EDE1D3]/70"
                />
              </div>
              <div>
                <label className="block text-[10px] text-[#A8A096] mb-1">Manufacturing Cost</label>
                <input
                  type="number"
                  min="0"
                  value={formData.manufacturing_cost}
                  onChange={(e) => setFormData({ ...formData, manufacturing_cost: Math.max(0, Number(e.target.value)) })}
                  className="w-full px-2.5 py-1.5 bg-[#100F0E] border border-[#2E2A25] rounded-xl text-xs text-[#FBF9F5] focus:outline-hidden focus:border-[#EDE1D3]/70"
                />
              </div>
              <div>
                <label className="block text-[10px] text-[#A8A096] mb-1">Packaging Cost</label>
                <input
                  type="number"
                  min="0"
                  value={formData.packaging_cost}
                  onChange={(e) => setFormData({ ...formData, packaging_cost: Math.max(0, Number(e.target.value)) })}
                  className="w-full px-2.5 py-1.5 bg-[#100F0E] border border-[#2E2A25] rounded-xl text-xs text-[#FBF9F5] focus:outline-hidden focus:border-[#EDE1D3]/70"
                />
              </div>
              <div>
                <label className="block text-[10px] text-[#A8A096] mb-1">Delivery Cost</label>
                <input
                  type="number"
                  min="0"
                  value={formData.delivery_cost}
                  onChange={(e) => setFormData({ ...formData, delivery_cost: Math.max(0, Number(e.target.value)) })}
                  className="w-full px-2.5 py-1.5 bg-[#100F0E] border border-[#2E2A25] rounded-xl text-xs text-[#FBF9F5] focus:outline-hidden focus:border-[#EDE1D3]/70"
                />
              </div>
              <div>
                <label className="block text-[10px] text-[#A8A096] mb-1">Marketing Cost</label>
                <input
                  type="number"
                  min="0"
                  value={formData.marketing_cost}
                  onChange={(e) => setFormData({ ...formData, marketing_cost: Math.max(0, Number(e.target.value)) })}
                  className="w-full px-2.5 py-1.5 bg-[#100F0E] border border-[#2E2A25] rounded-xl text-xs text-[#FBF9F5] focus:outline-hidden focus:border-[#EDE1D3]/70"
                />
              </div>
              <div className="flex items-center pt-4">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-[#A8A096]">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="w-4 h-4 rounded text-[#EDE1D3] bg-[#100F0E] border-[#2E2A25] accent-[#EDE1D3]"
                  />
                  <span>Active Catalog Item</span>
                </label>
              </div>
            </div>
          </div>

          {/* Live Calculated Cost Summary */}
          <div className="p-4 bg-[#100F0E] rounded-2xl border border-[#26231F] grid grid-cols-3 gap-3 text-center text-xs">
            <div>
              <span className="text-[#8C8275] block text-[10px] uppercase font-bold tracking-wider mb-0.5">Total Cost</span>
              <span className="font-mono font-semibold text-[#FBF9F5]">{formatEgp(formTotalCost)}</span>
            </div>
            <div>
              <span className="text-[#8C8275] block text-[10px] uppercase font-bold tracking-wider mb-0.5">Unit Profit</span>
              <span className="font-mono font-semibold text-[#52C48D]">{formatEgp(formProfit)}</span>
            </div>
            <div>
              <span className="text-[#8C8275] block text-[10px] uppercase font-bold tracking-wider mb-0.5">Profit Margin</span>
              <span className="font-mono font-semibold text-[#EDE1D3]">{formatPercent(formMargin)}</span>
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
              {isEditModalOpen ? 'Save Changes' : 'Create Product'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete / Deactivate Confirmation */}
      <ConfirmModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete / Deactivate Product"
        message={`Are you sure you want to remove product "${deleteTarget?.name}"? If this product has been ordered historically, it will be safely deactivated to preserve past financial reporting.`}
        confirmLabel="Confirm Action"
        isDestructive={true}
      />
    </div>
  );
};
