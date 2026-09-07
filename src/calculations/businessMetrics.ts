import {
  Order,
  OrderItem,
  Product,
  MarketingRecord,
  Target,
  ProductMixItem,
  DashboardMetrics,
  MonthlyPerformanceRecord,
} from '../types';

/**
 * CENTRALIZED SALES RULE
 * Only completed valid sales are included in actual commercial performance.
 * Delivered orders count as completed sales.
 * Cancelled, Refunded, Pending, Confirmed, and Processing are excluded.
 */
export function isCompletedSale(status: string): boolean {
  return status === 'Delivered';
}

/**
 * Direct Cost of Goods Sold (COGS) per Unit:
 * Material Cost + Manufacturing Cost + Packaging Cost
 */
export function calculateProductUnitCOGS(product: {
  material_cost?: number;
  manufacturing_cost?: number;
  packaging_cost?: number;
}): number {
  const material = Math.max(0, Number(product.material_cost) || 0);
  const manufacturing = Math.max(0, Number(product.manufacturing_cost) || 0);
  const packaging = Math.max(0, Number(product.packaging_cost) || 0);
  return material + manufacturing + packaging;
}

/**
 * Gross Profit per Unit:
 * Selling Price - Unit COGS
 */
export function calculateProductUnitGrossProfit(
  sellingPrice: number,
  unitCOGS: number
): number {
  return (Number(sellingPrice) || 0) - (Number(unitCOGS) || 0);
}

/**
 * Gross Margin (%) per Unit:
 * (Gross Profit / Selling Price) * 100
 */
export function calculateProductUnitGrossMargin(
  sellingPrice: number,
  grossProfit: number
): number {
  const price = Number(sellingPrice) || 0;
  if (price <= 0) return 0;
  const margin = (grossProfit / price) * 100;
  return Number.isFinite(margin) ? margin : 0;
}

/**
 * Total Unit Cost (All-in):
 * Unit COGS + Delivery Cost + Direct Marketing Cost
 */
export function calculateProductCost(product: {
  material_cost?: number;
  manufacturing_cost?: number;
  packaging_cost?: number;
  delivery_cost?: number;
  marketing_cost?: number;
}): number {
  const cogs = calculateProductUnitCOGS(product);
  const delivery = Math.max(0, Number(product.delivery_cost) || 0);
  const marketing = Math.max(0, Number(product.marketing_cost) || 0);
  return cogs + delivery + marketing;
}

export const calculateProductUnitTotalCost = calculateProductCost;

/**
 * Net Profit per Unit:
 * Selling Price - Total Unit Cost
 */
export function calculateProductProfit(
  sellingPrice: number,
  totalCost: number
): number {
  return (Number(sellingPrice) || 0) - (Number(totalCost) || 0);
}

export const calculateProductUnitNetProfit = calculateProductProfit;

/**
 * Net Margin (%) per Unit:
 * (Net Profit / Selling Price) * 100
 */
export function calculateProductMargin(
  sellingPrice: number,
  profit: number
): number {
  const price = Number(sellingPrice) || 0;
  if (price <= 0) return 0;
  const margin = (profit / price) * 100;
  return Number.isFinite(margin) ? margin : 0;
}

export const calculateProductUnitNetMargin = calculateProductMargin;

/**
 * Test case verification as required:
 * Selling Price = 5000, Material = 1500, Manufacturing = 1000, Packaging = 200, Delivery = 300, Marketing = 400
 * Unit COGS = 2700, Gross Profit = 2300, Gross Margin = 46%
 * Total Cost = 3400, Net Profit = 1600, Net Margin = 32%
 */
export function runCostingSanityCheck(): {
  sellingPrice: number;
  unitCOGS: number;
  grossProfit: number;
  grossMargin: number;
  totalCost: number;
  profit: number;
  margin: number;
  passed: boolean;
} {
  const sample = {
    selling_price: 5000,
    material_cost: 1500,
    manufacturing_cost: 1000,
    packaging_cost: 200,
    delivery_cost: 300,
    marketing_cost: 400,
  };
  const unitCOGS = calculateProductUnitCOGS(sample);
  const grossProfit = calculateProductUnitGrossProfit(sample.selling_price, unitCOGS);
  const grossMargin = calculateProductUnitGrossMargin(sample.selling_price, grossProfit);

  const totalCost = calculateProductCost(sample);
  const profit = calculateProductProfit(sample.selling_price, totalCost);
  const margin = calculateProductMargin(sample.selling_price, profit);

  const passed =
    unitCOGS === 2700 &&
    grossProfit === 2300 &&
    Math.round(grossMargin) === 46 &&
    totalCost === 3400 &&
    profit === 1600 &&
    Math.round(margin) === 32;

  return {
    sellingPrice: sample.selling_price,
    unitCOGS,
    grossProfit,
    grossMargin,
    totalCost,
    profit,
    margin,
    passed,
  };
}

/**
 * Calculate Order Total from Order Items using historical unit price
 */
export function calculateOrderTotal(items: OrderItem[]): number {
  if (!items || items.length === 0) return 0;
  return items.reduce((sum, item) => {
    const qty = Number(item.quantity) || 0;
    const price = Number(item.unit_price) || 0;
    return sum + qty * price;
  }, 0);
}

/**
 * Calculate Product Mix from Orders, Order Items, and Products
 */
export function calculateProductMix(
  orders: Order[],
  orderItems: OrderItem[],
  products: Product[],
  filterMonth?: string
): ProductMixItem[] {
  const productMap = new Map<string, Product>();
  products.forEach((p) => productMap.set(p.id, p));

  // Filter completed orders (and optionally by month YYYY-MM)
  const completedOrders = orders.filter((o) => {
    if (!isCompletedSale(o.status)) return false;
    if (filterMonth && !o.order_date.startsWith(filterMonth)) return false;
    return true;
  });

  const completedOrderIds = new Set(completedOrders.map((o) => o.id));
  const relevantItems = orderItems.filter((item) =>
    completedOrderIds.has(item.order_id)
  );

  // Group by product_id
  const statsByProduct = new Map<
    string,
    { units: number; revenue: number; cost: number }
  >();

  relevantItems.forEach((item) => {
    const prod = productMap.get(item.product_id);
    const existing = statsByProduct.get(item.product_id) || {
      units: 0,
      revenue: 0,
      cost: 0,
    };
    const qty = Number(item.quantity) || 0;
    const unitPrice = Number(item.unit_price) || 0;
    // Historical unit cost or live product cost fallback
    const unitCost =
      item.unit_cogs !== undefined && item.unit_cogs !== null
        ? Number(item.unit_cogs)
        : (prod ? calculateProductUnitCOGS(prod) : 0);

    existing.units += qty;
    existing.revenue += qty * unitPrice;
    existing.cost += qty * unitCost;

    statsByProduct.set(item.product_id, existing);
  });

  const result: ProductMixItem[] = [];

  productMap.forEach((prod, prodId) => {
    const stats = statsByProduct.get(prodId) || { units: 0, revenue: 0, cost: 0 };
    const profit = stats.revenue - stats.cost;
    const margin = stats.revenue > 0 ? (profit / stats.revenue) * 100 : 0;

    result.push({
      product_id: prod.id,
      product_name: prod.name,
      sku: prod.sku,
      category: prod.category,
      units_sold: stats.units,
      revenue: stats.revenue,
      product_cost: stats.cost,
      profit,
      margin: Number.isFinite(margin) ? margin : 0,
    });
  });

  return result.sort((a, b) => b.revenue - a.revenue);
}

/**
 * Calculate Monthly Dashboard Metrics with Strict No-Double-Counting Formula:
 * - Sales = sum of (qty * unit_price) for completed (Delivered) orders
 * - COGS = sum of (qty * unit_cogs) for completed orders (Material + Mfg + Pkg)
 * - Gross Profit = Sales - COGS
 * - Gross Margin = (Gross Profit / Sales) * 100
 * - Delivery Cost = sum of (qty * unit_delivery_cost)
 * - Marketing Cost = monthly spend from Marketing table
 * - Net Profit = Gross Profit - Delivery Cost - Marketing Cost = Sales - COGS - Delivery Cost - Marketing Cost
 * - Net Margin = (Net Profit / Sales) * 100
 */
export function calculateDashboardMetrics(
  month: string, // YYYY-MM
  orders: Order[],
  orderItems: OrderItem[],
  products: Product[],
  marketingRecords: MarketingRecord[],
  targets: Target[]
): DashboardMetrics {
  const productMap = new Map<string, Product>();
  products.forEach((p) => productMap.set(p.id, p));

  // 1. Completed orders in selected month
  const monthlyOrders = orders.filter(
    (o) => o.order_date.startsWith(month) && isCompletedSale(o.status)
  );

  const completedOrderIds = new Set(monthlyOrders.map((o) => o.id));
  const monthlyItems = orderItems.filter((item) =>
    completedOrderIds.has(item.order_id)
  );

  // 2. Sales, COGS, and Delivery Costs
  let sales = 0;
  let cogs = 0;
  let deliveryCost = 0;

  monthlyItems.forEach((item) => {
    const qty = Math.max(0, Number(item.quantity) || 0);
    const unitPrice = Math.max(0, Number(item.unit_price) || 0);
    sales += qty * unitPrice;

    const prod = productMap.get(item.product_id);
    
    // Line COGS: use captured historical unit_cogs if present, otherwise calculate from product
    const itemUnitCOGS =
      item.unit_cogs !== undefined && item.unit_cogs !== null && !isNaN(Number(item.unit_cogs))
        ? Number(item.unit_cogs)
        : (prod ? calculateProductUnitCOGS(prod) : 0);
    cogs += qty * itemUnitCOGS;

    // Delivery cost: use captured historical delivery cost or product delivery cost
    const itemUnitDelivery =
      item.unit_delivery_cost !== undefined && item.unit_delivery_cost !== null && !isNaN(Number(item.unit_delivery_cost))
        ? Number(item.unit_delivery_cost)
        : (prod ? Number(prod.delivery_cost) || 0 : 0);
    deliveryCost += qty * itemUnitDelivery;
  });

  const ordersCount = monthlyOrders.length;
  const aov = ordersCount > 0 ? sales / ordersCount : 0;

  // 3. Marketing cost for selected month
  const marketing = marketingRecords.find((m) => m.month === month);
  const marketingSpend = marketing ? Math.max(0, Number(marketing.spend) || 0) : 0;
  const marketingOrdersGenerated = marketing
    ? Math.max(0, Number(marketing.orders_generated) || 0)
    : 0;
  const marketingRevenue = marketing ? Math.max(0, Number(marketing.revenue) || 0) : 0;

  const costPerOrder =
    marketingOrdersGenerated > 0
      ? marketingSpend / marketingOrdersGenerated
      : (ordersCount > 0 ? marketingSpend / ordersCount : 0);

  const roas = marketingSpend > 0 ? (marketingRevenue || sales) / marketingSpend : 0;

  // 4. Net Profit & Margins
  // Formula: Net Profit = Gross Profit - Delivery Cost - Marketing Cost = Sales - COGS - Delivery Cost - Marketing Cost
  const grossProfit = sales - cogs;
  const netProfit = grossProfit - deliveryCost - marketingSpend;
  const netMargin = sales > 0 ? (netProfit / sales) * 100 : 0;

  // 5. Target comparison
  const target = targets.find((t) => t.month === month) || null;
  let salesAchievementRate: number | null = null;
  let marginStatus: 'below' | 'in_range' | 'above' | 'no_target' = 'no_target';

  if (target && target.sales_target > 0) {
    salesAchievementRate = (sales / target.sales_target) * 100;
  }

  if (target) {
    if (netMargin < target.profit_margin_min) {
      marginStatus = 'below';
    } else if (netMargin > target.profit_margin_max) {
      marginStatus = 'above';
    } else {
      marginStatus = 'in_range';
    }
  }

  return {
    month,
    sales,
    orders_count: ordersCount,
    aov,
    cogs,
    marketing_cost: marketingSpend,
    delivery_cost: deliveryCost,
    net_profit: netProfit,
    net_margin: Number.isFinite(netMargin) ? netMargin : 0,
    website_conversion_rate: 'Not available', // Explicit requirement
    cost_per_order: Number.isFinite(costPerOrder) ? costPerOrder : 0,
    roas: Number.isFinite(roas) ? roas : 0,
    target,
    sales_achievement_rate: salesAchievementRate,
    margin_status: marginStatus,
  };
}

/**
 * Calculate Monthly Performance Overview across all available months
 */
export function calculateMonthlyPerformance(
  orders: Order[],
  orderItems: OrderItem[],
  products: Product[],
  marketingRecords: MarketingRecord[],
  targets: Target[],
  year?: string
): MonthlyPerformanceRecord[] {
  const monthSet = new Set<string>();

  orders.forEach((o) => {
    if (o.order_date && o.order_date.length >= 7) {
      monthSet.add(o.order_date.substring(0, 7));
    }
  });

  marketingRecords.forEach((m) => {
    if (m.month && m.month.length >= 7) monthSet.add(m.month.substring(0, 7));
  });

  targets.forEach((t) => {
    if (t.month && t.month.length >= 7) monthSet.add(t.month.substring(0, 7));
  });

  const sortedMonths = Array.from(monthSet).sort();

  return sortedMonths
    .filter((m) => (!year ? true : m.startsWith(year)))
    .map((m) => {
      const metrics = calculateDashboardMetrics(
        m,
        orders,
        orderItems,
        products,
        marketingRecords,
        targets
      );

      const targetSales = metrics.target ? metrics.target.sales_target : null;
      const variance = targetSales !== null ? metrics.sales - targetSales : null;
      const achievement =
        targetSales !== null && targetSales > 0
          ? (metrics.sales / targetSales) * 100
          : null;

      return {
        month: m,
        sales: metrics.sales,
        orders_count: metrics.orders_count,
        cogs: metrics.cogs,
        delivery_cost: metrics.delivery_cost,
        marketing_cost: metrics.marketing_cost,
        net_profit: metrics.net_profit,
        net_margin: metrics.net_margin,
        sales_target: targetSales,
        variance,
        achievement_pct: achievement,
      };
    });
}

