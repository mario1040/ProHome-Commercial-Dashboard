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
 * Calculate Product Unit Costs and Margins
 */
export function calculateProductCost(product: {
  material_cost?: number;
  manufacturing_cost?: number;
  packaging_cost?: number;
  delivery_cost?: number;
  marketing_cost?: number;
}): number {
  const material = Number(product.material_cost) || 0;
  const manufacturing = Number(product.manufacturing_cost) || 0;
  const packaging = Number(product.packaging_cost) || 0;
  const delivery = Number(product.delivery_cost) || 0;
  const marketing = Number(product.marketing_cost) || 0;

  return material + manufacturing + packaging + delivery + marketing;
}

export function calculateProductProfit(
  sellingPrice: number,
  totalCost: number
): number {
  return (Number(sellingPrice) || 0) - (Number(totalCost) || 0);
}

export function calculateProductMargin(
  sellingPrice: number,
  profit: number
): number {
  const price = Number(sellingPrice) || 0;
  if (price <= 0) return 0;
  const margin = (profit / price) * 100;
  return Number.isFinite(margin) ? margin : 0;
}

/**
 * Test case verification as required:
 * Selling Price = 5000, Material = 1500, Manufacturing = 1000, Packaging = 200, Delivery = 300, Marketing = 400
 * Total Cost = 3400, Profit = 1600, Margin = 32%
 */
export function runCostingSanityCheck(): {
  sellingPrice: number;
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
  const totalCost = calculateProductCost(sample);
  const profit = calculateProductProfit(sample.selling_price, totalCost);
  const margin = calculateProductMargin(sample.selling_price, profit);

  const passed = totalCost === 3400 && profit === 1600 && Math.round(margin) === 32;
  return {
    sellingPrice: sample.selling_price,
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
    const unitCost = prod ? calculateProductCost(prod) : 0;

    existing.units += qty;
    existing.revenue += qty * unitPrice;
    existing.cost += qty * unitCost;

    statsByProduct.set(item.product_id, existing);
  });

  const result: ProductMixItem[] = [];

  // Include products that have sales, plus any active products
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

  // Sort by revenue descending by default
  return result.sort((a, b) => b.revenue - a.revenue);
}

/**
 * Calculate Monthly Dashboard Metrics
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

  // 2. Sales = sum of revenue from completed orders
  let sales = 0;
  let cogs = 0;
  let deliveryCost = 0;

  monthlyItems.forEach((item) => {
    const qty = Number(item.quantity) || 0;
    const unitPrice = Number(item.unit_price) || 0;
    sales += qty * unitPrice;

    const prod = productMap.get(item.product_id);
    if (prod) {
      // COGS is sum of product costs for completed sales
      // Product cost = Material + Manufacturing + Packaging + Delivery + Marketing
      const unitProductCost = calculateProductCost(prod);
      cogs += qty * unitProductCost;

      // Delivery cost associated with completed sales
      deliveryCost += qty * (Number(prod.delivery_cost) || 0);
    }
  });

  const ordersCount = monthlyOrders.length;
  const aov = ordersCount > 0 ? sales / ordersCount : 0;

  // 3. Marketing cost for selected month
  const marketing = marketingRecords.find((m) => m.month === month);
  const marketingSpend = marketing ? Number(marketing.spend) || 0 : 0;
  const marketingOrdersGenerated = marketing
    ? Number(marketing.orders_generated) || 0
    : 0;
  const marketingRevenue = marketing ? Number(marketing.revenue) || 0 : 0;

  const costPerOrder =
    marketingOrdersGenerated > 0
      ? marketingSpend / marketingOrdersGenerated
      : 0;

  const roas = marketingSpend > 0 ? marketingRevenue / marketingSpend : 0;

  // 4. Net Profit & Margin
  // Formula: Net Profit = Sales - COGS - Marketing Cost - Delivery Cost
  const netProfit = sales - cogs - marketingSpend - deliveryCost;
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
    website_conversion_rate: 'Not available', // Explicitly required: "Not available" when website traffic data is absent
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
  // Collect all unique months from orders, marketing, and targets
  const monthSet = new Set<string>();

  orders.forEach((o) => {
    if (o.order_date && o.order_date.length >= 7) {
      monthSet.add(o.order_date.substring(0, 7));
    }
  });

  marketingRecords.forEach((m) => {
    if (m.month) monthSet.add(m.month);
  });

  targets.forEach((t) => {
    if (t.month) monthSet.add(t.month);
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
