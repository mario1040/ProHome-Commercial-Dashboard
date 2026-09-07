import React, { useState, useEffect } from 'react';
import {
  Search,
  Plus,
  Filter,
  Trash2,
  Edit2,
  Eye,
  CheckCircle2,
  Clock,
  Package,
  Calendar,
  Phone,
  User,
  AlertCircle,
} from 'lucide-react';
import { api } from '../services/api';
import { Order, Product, OrderStatus, OrderItem } from '../types';
import { formatEgp, formatNumber } from '../utils/format';
import { Modal } from '../components/common/Modal';
import { ConfirmModal } from '../components/common/ConfirmModal';
import { useToast } from '../components/common/Toast';

export const OrdersPage: React.FC = () => {
  const { success, error } = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [dateFilter, setDateFilter] = useState<string>('');

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState<boolean>(false);
  const [deleteTarget, setDeleteTarget] = useState<Order | null>(null);
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    order_number: '',
    order_date: new Date().toISOString().substring(0, 10),
    status: 'Pending' as OrderStatus,
    customer_name: '',
    customer_phone: '',
    notes: '',
    items: [] as { id?: string; product_id: string; quantity: number; unit_price: number }[],
  });

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [ordersRes, prodsRes] = await Promise.all([
        api.orders.list(),
        api.products.list(),
      ]);

      if (ordersRes.success && ordersRes.data) {
        setOrders(ordersRes.data);
      }
      if (prodsRes.success && prodsRes.data) {
        setProducts(prodsRes.data);
      }
    } catch (err: any) {
      error('Failed to load orders');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filter logic
  const filteredOrders = orders.filter((o) => {
    // Search match
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      !term ||
      o.order_number.toLowerCase().includes(term) ||
      o.customer_name.toLowerCase().includes(term) ||
      o.customer_phone.toLowerCase().includes(term) ||
      (o.items && o.items.some((it) => it.product_name?.toLowerCase().includes(term)));

    // Status match
    const matchesStatus = statusFilter === 'ALL' || o.status === statusFilter;

    // Date match
    const matchesDate = !dateFilter || o.order_date.startsWith(dateFilter);

    return matchesSearch && matchesStatus && matchesDate;
  });

  const handleOpenAdd = () => {
    const defaultProd = products.find((p) => p.is_active) || products[0];
    setFormData({
      order_number: '',
      order_date: new Date().toISOString().substring(0, 10),
      status: 'Pending',
      customer_name: '',
      customer_phone: '',
      notes: '',
      items: defaultProd
        ? [{ product_id: defaultProd.id, quantity: 1, unit_price: defaultProd.selling_price }]
        : [],
    });
    setIsAddModalOpen(true);
  };

  const handleOpenEdit = (order: Order) => {
    setActiveOrder(order);
    setFormData({
      order_number: order.order_number,
      order_date: order.order_date,
      status: order.status,
      customer_name: order.customer_name,
      customer_phone: order.customer_phone,
      notes: order.notes,
      items:
        order.items && order.items.length > 0
          ? order.items.map((it) => ({
              id: it.id,
              product_id: it.product_id,
              quantity: it.quantity,
              unit_price: it.unit_price,
            }))
          : [],
    });
    setIsEditModalOpen(true);
  };

  const handleOpenView = (order: Order) => {
    setActiveOrder(order);
    setIsViewModalOpen(true);
  };

  const handleAddItemRow = () => {
    const defaultProd = products.find((p) => p.is_active) || products[0];
    if (!defaultProd) return;
    setFormData((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          product_id: defaultProd.id,
          quantity: 1,
          unit_price: defaultProd.selling_price,
        },
      ],
    }));
  };

  const handleRemoveItemRow = (idx: number) => {
    setFormData((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== idx),
    }));
  };

  const handleItemProductChange = (idx: number, productId: string) => {
    const selectedProd = products.find((p) => p.id === productId);
    setFormData((prev) => {
      const updated = [...prev.items];
      updated[idx] = {
        ...updated[idx],
        product_id: productId,
        unit_price: selectedProd ? selectedProd.selling_price : updated[idx].unit_price,
      };
      return { ...prev, items: updated };
    });
  };

  const handleItemQuantityChange = (idx: number, quantity: number) => {
    setFormData((prev) => {
      const updated = [...prev.items];
      updated[idx] = { ...updated[idx], quantity: Math.max(1, quantity) };
      return { ...prev, items: updated };
    });
  };

  const handleItemPriceChange = (idx: number, price: number) => {
    setFormData((prev) => {
      const updated = [...prev.items];
      updated[idx] = { ...updated[idx], unit_price: Math.max(0, price) };
      return { ...prev, items: updated };
    });
  };

  const handleSaveOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.customer_name.trim()) {
      error('Customer name is required');
      return;
    }
    if (formData.items.length === 0) {
      error('Please add at least one product item to the order');
      return;
    }

    try {
      if (isEditModalOpen && activeOrder) {
        const res = await api.orders.update(activeOrder.id, formData);
        if (res.success) {
          success(`Order ${formData.order_number} updated successfully`);
          setIsEditModalOpen(false);
          fetchData();
        } else {
          error(res.error?.message || 'Failed to update order');
        }
      } else {
        const res = await api.orders.create(formData);
        if (res.success) {
          success('New order created successfully');
          setIsAddModalOpen(false);
          fetchData();
        } else {
          error(res.error?.message || 'Failed to create order');
        }
      }
    } catch (err: any) {
      error(err.message || 'Error saving order');
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      const res = await api.orders.delete(deleteTarget.id);
      if (res.success) {
        success(`Order ${deleteTarget.order_number} deleted`);
        setDeleteTarget(null);
        fetchData();
      } else {
        error(res.error?.message || 'Failed to delete order');
      }
    } catch (err: any) {
      error(err.message || 'Error deleting order');
    }
  };

  const getStatusBadge = (status: OrderStatus) => {
    const map = {
      Delivered: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      Processing: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
      Confirmed: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
      Pending: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
      Cancelled: 'bg-slate-800 text-slate-400 border-slate-700',
      Refunded: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    }[status] || 'bg-slate-800 text-slate-400 border-slate-700';

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold border ${map}`}>
        {status}
      </span>
    );
  };

  const calculatedFormTotal = formData.items.reduce(
    (sum, it) => sum + (it.quantity || 0) * (it.unit_price || 0),
    0
  );

  return (
    <div className="space-y-6">
      {/* Top Controls & Filters */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-5 flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center backdrop-blur-md">
        <div className="flex flex-1 flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
            <input
              id="orders-search-input"
              type="text"
              placeholder="Search by order #, customer name, phone, product..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-hidden focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/60 transition-all"
            />
          </div>

          {/* Status Filter */}
          <select
            id="orders-status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-hidden focus:border-indigo-500/60 cursor-pointer"
          >
            <option value="ALL">All Statuses</option>
            <option value="Delivered">Delivered (Completed Sales)</option>
            <option value="Processing">Processing</option>
            <option value="Confirmed">Confirmed</option>
            <option value="Pending">Pending</option>
            <option value="Cancelled">Cancelled</option>
            <option value="Refunded">Refunded</option>
          </select>

          {/* Date Filter */}
          <input
            type="month"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-hidden focus:border-indigo-500/60"
            title="Filter by month"
          />
        </div>

        <button
          id="add-order-btn"
          onClick={handleOpenAdd}
          className="px-5 py-2.5 bg-slate-50 hover:bg-white text-slate-950 font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_rgba(255,255,255,0.1)] shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Create Order
        </button>
      </div>

      {/* Orders Table */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-3xl overflow-hidden backdrop-blur-md">
        <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center text-xs text-slate-400">
          <div>
            Showing <strong className="text-white font-mono">{filteredOrders.length}</strong> of{' '}
            <strong className="text-white font-mono">{orders.length}</strong> orders
          </div>
          <div className="text-[11px] text-slate-500 font-medium">
            * Delivered status counts toward actual commercial revenue
          </div>
        </div>

        {filteredOrders.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-xs">
            No orders found matching your search or filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-[10px] uppercase tracking-widest text-slate-500 font-bold bg-slate-950/40">
                  <th className="py-3.5 px-4 font-bold">Order Number</th>
                  <th className="py-3.5 px-4 font-bold">Date</th>
                  <th className="py-3.5 px-4 font-bold">Customer</th>
                  <th className="py-3.5 px-4 font-bold">Status</th>
                  <th className="py-3.5 px-4 font-bold text-center">Items</th>
                  <th className="py-3.5 px-4 font-bold text-right">Total Amount</th>
                  <th className="py-3.5 px-4 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {filteredOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-slate-800/20 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-semibold text-white">{order.order_number}</td>
                    <td className="py-3.5 px-4 text-slate-400 font-mono text-[11px] whitespace-nowrap">{order.order_date}</td>
                    <td className="py-3.5 px-4">
                      <div className="font-medium text-slate-200">{order.customer_name}</div>
                      <div className="text-[11px] text-slate-500 font-mono">{order.customer_phone}</div>
                    </td>
                    <td className="py-3.5 px-4">{getStatusBadge(order.status)}</td>
                    <td className="py-3.5 px-4 text-center font-mono font-medium text-slate-300">
                      {order.items_count || (order.items?.length ?? 0)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-semibold text-white">
                      {formatEgp(order.total_amount)}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenView(order)}
                          className="p-2 text-slate-400 hover:text-white hover:bg-slate-800/60 rounded-xl transition-colors"
                          title="View order details"
                          aria-label="View order details"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleOpenEdit(order)}
                          className="p-2 text-slate-400 hover:text-amber-400 hover:bg-slate-800/60 rounded-xl transition-colors"
                          title="Edit order"
                          aria-label="Edit order"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(order)}
                          className="p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-800/60 rounded-xl transition-colors"
                          title="Delete order"
                          aria-label="Delete order"
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
        )}
      </div>

      {/* Add / Edit Order Modal */}
      <Modal
        isOpen={isAddModalOpen || isEditModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setIsEditModalOpen(false);
        }}
        title={isEditModalOpen ? 'Edit Order' : 'Create New Order'}
        subtitle="Manage customer, items, and historical unit prices"
        maxWidth="3xl"
      >
        <form onSubmit={handleSaveOrder} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">Order Date</label>
              <input
                type="date"
                required
                value={formData.order_date}
                onChange={(e) => setFormData({ ...formData, order_date: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-hidden focus:border-indigo-500/60"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">Order Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as OrderStatus })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-hidden focus:border-indigo-500/60"
              >
                <option value="Pending">Pending</option>
                <option value="Confirmed">Confirmed</option>
                <option value="Processing">Processing</option>
                <option value="Delivered">Delivered (Completed Sale)</option>
                <option value="Cancelled">Cancelled</option>
                <option value="Refunded">Refunded</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">
                Order Number (Optional)
              </label>
              <input
                type="text"
                placeholder="Leave blank to auto-generate"
                value={formData.order_number}
                onChange={(e) => setFormData({ ...formData, order_number: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-hidden focus:border-indigo-500/60"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">Customer Name *</label>
              <input
                type="text"
                required
                placeholder="Full name"
                value={formData.customer_name}
                onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-hidden focus:border-indigo-500/60"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">Customer Phone</label>
              <input
                type="text"
                placeholder="+20 100 000 0000"
                value={formData.customer_phone}
                onChange={(e) => setFormData({ ...formData, customer_phone: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-hidden focus:border-indigo-500/60"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">Notes / Address</label>
            <textarea
              rows={2}
              placeholder="Delivery address, custom finish, customer notes..."
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white resize-none focus:outline-hidden focus:border-indigo-500/60"
            />
          </div>

          {/* Line Items Section */}
          <div className="pt-3 border-t border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-200">Order Items</span>
              <button
                type="button"
                onClick={handleAddItemRow}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Add Product Item
              </button>
            </div>

            <div className="space-y-2">
              {formData.items.map((item, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-slate-950 border border-slate-800 rounded-2xl flex flex-col sm:flex-row gap-2.5 items-center"
                >
                  <div className="flex-1 w-full">
                    <select
                      value={item.product_id}
                      onChange={(e) => handleItemProductChange(idx, e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-hidden"
                    >
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.sku}) — {formatEgp(p.selling_price)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <div className="w-20">
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => handleItemQuantityChange(idx, Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white text-center font-mono"
                        title="Quantity"
                      />
                    </div>

                    <div className="w-28">
                      <input
                        type="number"
                        min="0"
                        value={item.unit_price}
                        onChange={(e) => handleItemPriceChange(idx, Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white text-right font-mono"
                        title="Historical Unit Price (EGP)"
                      />
                    </div>

                    <div className="w-24 text-right text-xs font-mono font-semibold text-white">
                      {formatEgp(item.quantity * item.unit_price)}
                    </div>

                    {formData.items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveItemRow(idx)}
                        className="p-1.5 text-slate-400 hover:text-rose-400 transition-colors"
                        title="Remove row"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Total Summary */}
            <div className="flex justify-between items-center mt-3 pt-3 border-t border-slate-800 text-xs">
              <span className="text-slate-400">Order Subtotal:</span>
              <span className="text-base font-bold font-mono text-emerald-400">{formatEgp(calculatedFormTotal)}</span>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
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
              className="px-5 py-2 text-xs font-bold text-slate-950 bg-slate-50 hover:bg-white rounded-xl transition-all shadow-[0_0_15px_rgba(255,255,255,0.1)]"
            >
              {isEditModalOpen ? 'Save Changes' : 'Confirm & Create Order'}
            </button>
          </div>
        </form>
      </Modal>

      {/* View Order Details Modal */}
      {activeOrder && (
        <Modal
          isOpen={isViewModalOpen}
          onClose={() => setIsViewModalOpen(false)}
          title={`Order ${activeOrder.order_number}`}
          subtitle={`Placed on ${activeOrder.order_date}`}
          maxWidth="lg"
        >
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3 p-3 bg-slate-950 rounded-2xl border border-slate-800">
              <div>
                <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider">Customer</span>
                <span className="font-semibold text-white">{activeOrder.customer_name}</span>
                <span className="text-slate-400 block text-[11px] font-mono">{activeOrder.customer_phone || 'N/A'}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider">Status</span>
                <div className="mt-0.5">{getStatusBadge(activeOrder.status)}</div>
              </div>
            </div>

            {activeOrder.notes && (
              <div className="p-3 bg-slate-950/60 rounded-2xl border border-slate-800/80">
                <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider mb-1">Notes / Instructions</span>
                <p className="text-slate-300">{activeOrder.notes}</p>
              </div>
            )}

            <div>
              <h4 className="font-semibold text-slate-200 mb-2">Itemized Products</h4>
              <div className="border border-slate-800 rounded-2xl overflow-hidden divide-y divide-slate-800/60">
                {activeOrder.items?.map((it) => (
                  <div key={it.id} className="p-3 flex justify-between items-center bg-slate-950/40">
                    <div>
                      <div className="font-semibold text-white">{it.product_name}</div>
                      <div className="text-[11px] text-slate-400 font-mono">
                        Qty: {it.quantity} × {formatEgp(it.unit_price)} (Historical Price)
                      </div>
                    </div>
                    <div className="font-mono font-semibold text-white">
                      {formatEgp(it.quantity * it.unit_price)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-between items-center p-4 bg-slate-950 rounded-2xl border border-slate-800">
              <span className="font-medium text-slate-300">Total Order Amount</span>
              <span className="text-base font-bold font-mono text-emerald-400">
                {formatEgp(activeOrder.total_amount)}
              </span>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Confirmation */}
      <ConfirmModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete Order"
        message={`Are you sure you want to delete order "${deleteTarget?.order_number}"? This will permanently remove its record and order items.`}
        confirmLabel="Delete Order"
        isDestructive={true}
      />
    </div>
  );
};
