import crypto from 'crypto';
import { logStructured, logCrudOperation } from './logger';

export interface DatabaseState {
  Users: any[];
  Products: any[];
  Orders: any[];
  Order_Items: any[];
  Marketing: any[];
  Targets: any[];
  Settings: any[];
}

// In-memory state cache (short TTL) to optimize fast concurrent requests while keeping Google Sheets as the ONLY source of truth
let liveCache: DatabaseState | null = null;
let cacheExpiry: number = 0;
const CACHE_TTL_MS = 3000; // 3-second cache TTL for responsive UI without stale business data

let lastSyncTime: string | null = null;
let lastSyncStatus: { success: boolean; message: string; timestamp: string } | null = null;

const DEFAULT_GAS_URL = 'https://script.google.com/macros/s/AKfycbywe5GzyLoyW7VppCwe3bkfxhAQq37hSzjgbXYY9tN4LSJFd1giQkHkWrEbEsO_OnLugA/exec';
const DEFAULT_GAS_SECRET = 'AKfycbywe5GzyLoyW7VppCwe3bkfxhAQq37hSzjgbXYY9tN4LSJFd1giQkHkWrEbEsO_OnLugA';

export function getGasUrl(): string {
  const envUrl = process.env.GOOGLE_APPS_SCRIPT_URL;
  if (envUrl && !envUrl.includes('LZFyTBOA') && !envUrl.includes('AKfycbxTG8')) {
    return envUrl.trim();
  }
  return DEFAULT_GAS_URL;
}

export function getGasSecret(): string {
  const envSecret = process.env.GOOGLE_APPS_SCRIPT_SECRET;
  if (envSecret && !envSecret.includes('LZFyTBOA') && !envSecret.includes('AKfycbxTG8')) {
    return envSecret.trim();
  }
  return DEFAULT_GAS_SECRET;
}

export function isGoogleSheetsActive(): boolean {
  return Boolean(getGasUrl() && getGasSecret());
}

export const TABLE_SCHEMAS: Record<string, string[]> = {
  Users: ['id', 'username', 'email', 'password_hash', 'role', 'is_active', 'created_at', 'updated_at'],
  Products: [
    'id', 'name', 'sku', 'category', 'selling_price', 'material_cost',
    'manufacturing_cost', 'packaging_cost', 'delivery_cost', 'marketing_cost',
    'is_active', 'created_at', 'updated_at'
  ],
  Orders: ['id', 'order_number', 'order_date', 'status', 'customer_name', 'customer_phone', 'notes', 'created_at', 'updated_at'],
  Order_Items: ['id', 'order_id', 'product_id', 'quantity', 'unit_price', 'unit_cogs', 'unit_delivery_cost', 'created_at'],
  Marketing: ['id', 'month', 'spend', 'orders_generated', 'revenue', 'created_at', 'updated_at'],
  Targets: ['id', 'month', 'sales_target', 'profit_margin_min', 'profit_margin_max', 'created_at', 'updated_at'],
  Settings: ['key', 'value', 'updated_at']
};

/**
 * Cleanly normalizes Month to canonical YYYY-MM format
 */
export function normalizeMonth(val: any): string {
  if (!val) return '';
  const str = String(val).trim();
  if (/^\d{4}-\d{2}$/.test(str)) return str;
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.substring(0, 7);
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  }
  return str.substring(0, 7);
}

/**
 * Cleanly normalizes Date to canonical YYYY-MM-DD format
 */
export function normalizeDate(val: any): string {
  if (!val) return '';
  const str = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  if (str.length >= 10 && /^\d{4}-\d{2}-\d{2}/.test(str)) return str.substring(0, 10);
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  return str.substring(0, 10);
}

export function normalizeRecord(tableName: string, raw: any): any {
  if (!raw || typeof raw !== 'object') return raw;
  const copy: any = { ...raw };
  const schema = TABLE_SCHEMAS[tableName] || [];

  // Robust mapping for sheets where headers might be "Column 1", "Column 2" or numbered
  for (let i = 0; i < schema.length; i++) {
    const colName = schema[i];
    const colNum = i + 1;
    const variations = [
      `Column ${colNum}`,
      `column ${colNum}`,
      `Column_${colNum}`,
      `column_${colNum}`,
      `Col ${colNum}`,
      `col ${colNum}`,
      `Column${colNum}`,
      `column${colNum}`,
    ];

    if (copy[colName] === undefined || copy[colName] === null) {
      for (const v of variations) {
        if (copy[v] !== undefined && copy[v] !== null) {
          copy[colName] = copy[v];
          break;
        }
      }
    }
  }

  if (tableName === 'Products') {
    copy.id = String(copy.id || '');
    copy.name = String(copy.name || '');
    copy.sku = String(copy.sku || '');
    copy.category = String(copy.category || 'General');
    copy.selling_price = Math.max(0, Number(copy.selling_price) || 0);
    copy.material_cost = Math.max(0, Number(copy.material_cost) || 0);
    copy.manufacturing_cost = Math.max(0, Number(copy.manufacturing_cost) || 0);
    copy.packaging_cost = Math.max(0, Number(copy.packaging_cost) || 0);
    copy.delivery_cost = Math.max(0, Number(copy.delivery_cost) || 0);
    copy.marketing_cost = Math.max(0, Number(copy.marketing_cost) || 0);
    copy.is_active = copy.is_active === true || copy.is_active === 'TRUE' || copy.is_active === 'true' || copy.is_active === 1 || copy.is_active === '1';
  } else if (tableName === 'Orders') {
    copy.id = String(copy.id || '');
    copy.order_number = String(copy.order_number || '');
    copy.order_date = normalizeDate(copy.order_date);
    copy.status = String(copy.status || 'Pending');
    copy.customer_name = String(copy.customer_name || '');
    copy.customer_phone = String(copy.customer_phone || '');
    copy.notes = String(copy.notes || '');
  } else if (tableName === 'Order_Items') {
    copy.id = String(copy.id || '');
    copy.order_id = String(copy.order_id || '');
    copy.product_id = String(copy.product_id || '');
    copy.quantity = Math.max(1, Number(copy.quantity) || 1);
    copy.unit_price = Math.max(0, Number(copy.unit_price) || 0);
    copy.unit_cogs =
      copy.unit_cogs !== undefined && copy.unit_cogs !== null && !isNaN(Number(copy.unit_cogs))
        ? Math.max(0, Number(copy.unit_cogs))
        : undefined;
    copy.unit_delivery_cost =
      copy.unit_delivery_cost !== undefined && copy.unit_delivery_cost !== null && !isNaN(Number(copy.unit_delivery_cost))
        ? Math.max(0, Number(copy.unit_delivery_cost))
        : undefined;
  } else if (tableName === 'Marketing') {
    copy.id = String(copy.id || '');
    copy.month = normalizeMonth(copy.month);
    copy.spend = Math.max(0, Number(copy.spend) || 0);
    copy.orders_generated = Math.max(0, Number(copy.orders_generated) || 0);
    copy.revenue = Math.max(0, Number(copy.revenue) || 0);
  } else if (tableName === 'Targets') {
    copy.id = String(copy.id || '');
    copy.month = normalizeMonth(copy.month);
    copy.sales_target = Math.max(0, Number(copy.sales_target) || 0);
    copy.profit_margin_min = Number(copy.profit_margin_min) || 25;
    copy.profit_margin_max = Number(copy.profit_margin_max) || 30;
  } else if (tableName === 'Users') {
    copy.id = String(copy.id || '');
    copy.username = String(copy.username || '');
    copy.email = String(copy.email || '');
    copy.password_hash = String(copy.password_hash || '');
    copy.role = String(copy.role || 'viewer');
    copy.is_active = copy.is_active === true || copy.is_active === 'TRUE' || copy.is_active === 'true' || copy.is_active === 1 || copy.is_active === '1';
  } else if (tableName === 'Settings') {
    copy.key = String(copy.key || '');
    copy.value = copy.value !== undefined && copy.value !== null ? copy.value : '';
  }

  return copy;
}

export function generateId(prefix: string): string {
  return `${prefix}_${crypto.randomBytes(6).toString('hex')}`;
}

export function invalidateCache() {
  liveCache = null;
  cacheExpiry = 0;
}

export function getSyncMetadata() {
  const url = getGasUrl();
  const secret = getGasSecret();
  const isUrlConfigured = Boolean(url);
  const isSecretConfigured = Boolean(secret);
  const isConnected = isUrlConfigured && isSecretConfigured;

  return {
    isConfigured: isUrlConfigured,
    hasSecret: isSecretConfigured,
    persistenceMode: isConnected ? 'GOOGLE_SHEETS' : 'ONLINE_GOOGLE_SHEETS_REQUIRED',
    lastSync: lastSyncTime,
    lastSyncStatus,
  };
}

// Google Apps Script Connection Helper with safe Content-Type and HTTP status inspection
export async function callGoogleAppsScript(
  action: string,
  payload?: any,
  resource?: string,
  id?: string,
  reqCorrelationId?: string
) {
  const correlationId = reqCorrelationId || `gas_${Date.now().toString(36)}_${crypto.randomBytes(3).toString('hex')}`;
  const startTime = Date.now();
  const url = getGasUrl();
  const secret = getGasSecret();

  if (!url) {
    logStructured({
      type: 'DOWNSTREAM_APPS_SCRIPT',
      correlationId,
      message: 'GOOGLE_APPS_SCRIPT_URL is not configured',
      validationResult: 'INVALID',
    });
    return {
      connected: false,
      configured: false,
      error: 'CONFIG_MISSING',
      message: 'GOOGLE_APPS_SCRIPT_URL is not configured in the server environment.',
    };
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action,
        resource,
        secret,
        payload,
        id,
      }),
      redirect: 'follow',
    });

    const durationMs = Date.now() - startTime;
    const contentType = res.headers.get('content-type') || '';
    const rawText = await res.text();

    const isHtml = rawText.includes('<!DOCTYPE') || rawText.includes('<html') || rawText.includes('accounts.google.com');

    if (isHtml || res.status === 401 || res.status === 403) {
      logStructured({
        type: 'DOWNSTREAM_APPS_SCRIPT',
        correlationId,
        downstreamStatus: res.status,
        sanitizedResponse: {
          contentType,
          isHtml: true,
          preview: rawText.substring(0, 200),
        },
        durationMs,
        message: `Downstream Google Apps Script returned HTML auth/sign-in page (HTTP ${res.status})`,
      });

      lastSyncStatus = {
        success: false,
        message: `Apps Script deployment returned HTTP ${res.status} (Authentication required). In Google Apps Script, click Deploy > Manage Deployments and ensure 'Who has access' is set to 'Anyone'.`,
        timestamp: new Date().toISOString(),
      };

      return {
        connected: false,
        configured: true,
        httpStatus: res.status,
        isAuthError: true,
        error: 'APPS_SCRIPT_AUTH_ERROR',
        message: `Google Apps Script returned an HTML sign-in page (HTTP ${res.status}). In Google Apps Script, please click Deploy > Manage Deployments and change 'Who has access' from 'Only myself' to 'Anyone' so the backend can authenticate using the shared secret.`,
      };
    }

    let parsedData: any = null;
    try {
      parsedData = JSON.parse(rawText);
    } catch (parseErr: any) {
      logStructured({
        type: 'DOWNSTREAM_APPS_SCRIPT',
        correlationId,
        downstreamStatus: res.status,
        sanitizedResponse: { rawText: rawText.substring(0, 300) },
        durationMs,
        message: `Failed to parse downstream JSON: ${parseErr.message}`,
      });

      return {
        connected: false,
        configured: true,
        httpStatus: res.status,
        error: 'MALFORMED_JSON',
        message: `Google Apps Script returned non-JSON data: ${rawText.substring(0, 150)}`,
      };
    }

    logStructured({
      type: 'DOWNSTREAM_APPS_SCRIPT',
      correlationId,
      downstreamStatus: res.status,
      sanitizedResponse: parsedData,
      durationMs,
      message: 'Downstream Google Apps Script call completed',
    });

    if (parsedData && parsedData.success === false) {
      return {
        connected: false,
        configured: true,
        httpStatus: res.status,
        error: parsedData.error?.code || 'APPS_SCRIPT_ERROR',
        message: parsedData.error?.message || 'Apps Script returned an error',
        result: parsedData,
      };
    }

    lastSyncTime = new Date().toISOString();
    lastSyncStatus = {
      success: true,
      message: 'Synchronized with Google Sheets successfully',
      timestamp: lastSyncTime,
    };

    return {
      connected: true,
      configured: true,
      httpStatus: res.status,
      result: parsedData.data !== undefined ? parsedData.data : parsedData,
      message: parsedData.message || 'Operation completed successfully',
    };
  } catch (error: any) {
    const durationMs = Date.now() - startTime;
    logStructured({
      type: 'DOWNSTREAM_APPS_SCRIPT',
      correlationId,
      durationMs,
      message: `Network failure connecting to Apps Script: ${error.message}`,
    });

    return {
      connected: false,
      configured: true,
      error: 'NETWORK_ERROR',
      message: error.message || 'Error connecting to Apps Script',
    };
  }
}

export const db = {
  /**
   * Fetch all tables live from Google Sheets (with short TTL caching for rapid consecutive reads)
   */
  async getAllAsync(forceFresh: boolean = false, correlationId?: string): Promise<DatabaseState> {
    const now = Date.now();
    if (!forceFresh && liveCache && now < cacheExpiry) {
      return liveCache;
    }

    if (!isGoogleSheetsActive()) {
      throw new Error('Google Sheets database connection is not configured. Google Sheets is required as the source of truth.');
    }

    const res = await callGoogleAppsScript('get_all', undefined, undefined, undefined, correlationId);
    if (!res.connected || !res.result || typeof res.result !== 'object') {
      const errMsg = res.message || 'Failed to fetch database from Google Sheets';
      const isAuth = Boolean(res.isAuthError);
      const err: any = new Error(errMsg);
      err.isAuthError = isAuth;
      err.code = res.error || 'DATABASE_UNAVAILABLE';
      throw err;
    }

    const sheetsData = res.result;
    const newState: DatabaseState = {
      Users: Array.isArray(sheetsData.Users) ? sheetsData.Users.map((u: any) => normalizeRecord('Users', u)) : [],
      Products: Array.isArray(sheetsData.Products) ? sheetsData.Products.map((p: any) => normalizeRecord('Products', p)) : [],
      Orders: Array.isArray(sheetsData.Orders) ? sheetsData.Orders.map((o: any) => normalizeRecord('Orders', o)) : [],
      Order_Items: Array.isArray(sheetsData.Order_Items) ? sheetsData.Order_Items.map((oi: any) => normalizeRecord('Order_Items', oi)) : [],
      Marketing: Array.isArray(sheetsData.Marketing) ? sheetsData.Marketing.map((m: any) => normalizeRecord('Marketing', m)) : [],
      Targets: Array.isArray(sheetsData.Targets) ? sheetsData.Targets.map((t: any) => normalizeRecord('Targets', t)) : [],
      Settings: Array.isArray(sheetsData.Settings) ? sheetsData.Settings.map((s: any) => normalizeRecord('Settings', s)) : [],
    };

    liveCache = newState;
    cacheExpiry = Date.now() + CACHE_TTL_MS;
    return newState;
  },

  async pullAllFromSheets(correlationId?: string): Promise<{ success: boolean; message: string }> {
    try {
      await this.getAllAsync(true, correlationId);
      return { success: true, message: 'Successfully loaded database from Google Sheets' };
    } catch (err: any) {
      return { success: false, message: err.message || 'Failed to pull from Google Sheets' };
    }
  },

  // Users
  async getUsers(fresh: boolean = false, correlationId?: string) {
    const all = await this.getAllAsync(fresh, correlationId);
    return all.Users;
  },

  async getUserByUsername(username: string, correlationId?: string) {
    if (!username) return undefined;
    const clean = username.trim().toLowerCase();
    const all = await this.getAllAsync(false, correlationId);
    return all.Users.find(
      (u) =>
        (u.username && u.username.toLowerCase() === clean) ||
        (u.email && u.email.toLowerCase() === clean)
    );
  },

  async getUserById(id: string, correlationId?: string) {
    const all = await this.getAllAsync(false, correlationId);
    return all.Users.find((u) => u.id === id);
  },

  async updateUser(id: string, updates: any, correlationId?: string) {
    const all = await this.getAllAsync(true, correlationId);
    const user = all.Users.find((u) => u.id === id);
    if (!user) return null;

    const updated = {
      ...user,
      ...updates,
      updated_at: new Date().toISOString(),
    };

    const startTime = Date.now();
    logCrudOperation({
      correlationId,
      operation: 'UPDATE',
      table: 'Users',
      recordId: id,
      target: 'GOOGLE_SHEETS',
      status: 'PENDING',
    });

    const res = await callGoogleAppsScript('update_record', updated, 'Users', id, correlationId);
    const durationMs = Date.now() - startTime;

    if (!res.connected || res.httpStatus !== 200) {
      logCrudOperation({
        correlationId,
        operation: 'UPDATE',
        table: 'Users',
        recordId: id,
        target: 'GOOGLE_SHEETS',
        status: 'FAILED',
        durationMs,
      });
      throw new Error(res.message || 'Failed to persist user update to Google Sheets');
    }

    logCrudOperation({
      correlationId,
      operation: 'UPDATE',
      table: 'Users',
      recordId: id,
      target: 'GOOGLE_SHEETS',
      status: 'SUCCESS',
      durationMs,
    });

    invalidateCache();
    return updated;
  },

  // Products
  async getProducts(freshFromSheets: boolean = false, correlationId?: string) {
    const all = await this.getAllAsync(freshFromSheets, correlationId);
    return all.Products;
  },

  async getProductById(id: string, correlationId?: string) {
    const all = await this.getAllAsync(false, correlationId);
    return all.Products.find((p) => p.id === id);
  },

  async getProductBySku(sku: string, correlationId?: string) {
    if (!sku) return undefined;
    const all = await this.getAllAsync(false, correlationId);
    return all.Products.find((p) => (p.sku || '').trim().toLowerCase() === sku.trim().toLowerCase());
  },

  async createProduct(data: any, correlationId?: string) {
    const all = await this.getAllAsync(true, correlationId);
    const existingSku = all.Products.find(
      (p) => (p.sku || '').trim().toLowerCase() === String(data.sku || '').trim().toLowerCase()
    );
    if (existingSku) {
      throw new Error(`A product with SKU "${data.sku}" already exists`);
    }

    const now = new Date().toISOString();
    const newProduct = {
      id: generateId('prod'),
      name: String(data.name || '').trim(),
      sku: String(data.sku || '').trim().toUpperCase(),
      category: String(data.category || 'General').trim(),
      selling_price: Math.max(0, Number(data.selling_price) || 0),
      material_cost: Math.max(0, Number(data.material_cost) || 0),
      manufacturing_cost: Math.max(0, Number(data.manufacturing_cost) || 0),
      packaging_cost: Math.max(0, Number(data.packaging_cost) || 0),
      delivery_cost: Math.max(0, Number(data.delivery_cost) || 0),
      marketing_cost: Math.max(0, Number(data.marketing_cost) || 0),
      is_active: data.is_active !== undefined ? Boolean(data.is_active) : true,
      created_at: now,
      updated_at: now,
    };

    const startTime = Date.now();
    logCrudOperation({
      correlationId,
      operation: 'CREATE',
      table: 'Products',
      recordId: newProduct.id,
      target: 'GOOGLE_SHEETS',
      status: 'PENDING',
      message: `Writing new product "${newProduct.name}" (${newProduct.sku}) to Google Sheets`,
    });

    const res = await callGoogleAppsScript('create_record', newProduct, 'Products', newProduct.id, correlationId);
    const durationMs = Date.now() - startTime;

    if (!res.connected || res.httpStatus !== 200) {
      logCrudOperation({
        correlationId,
        operation: 'CREATE',
        table: 'Products',
        recordId: newProduct.id,
        target: 'GOOGLE_SHEETS',
        status: 'FAILED',
        durationMs,
        message: res.message,
      });
      throw new Error(res.message || 'Failed to persist product to Google Sheets');
    }

    logCrudOperation({
      correlationId,
      operation: 'CREATE',
      table: 'Products',
      recordId: newProduct.id,
      target: 'GOOGLE_SHEETS',
      status: 'SUCCESS',
      durationMs,
    });

    invalidateCache();
    return newProduct;
  },

  async updateProduct(id: string, data: any, correlationId?: string) {
    const all = await this.getAllAsync(true, correlationId);
    const current = all.Products.find((p) => p.id === id);
    if (!current) return null;

    if (data.sku) {
      const existingSku = all.Products.find(
        (p) => p.id !== id && (p.sku || '').trim().toLowerCase() === String(data.sku).trim().toLowerCase()
      );
      if (existingSku) {
        throw new Error(`A product with SKU "${data.sku}" already exists`);
      }
    }

    const updatedProduct = {
      ...current,
      name: data.name !== undefined ? String(data.name).trim() : current.name,
      sku: data.sku !== undefined ? String(data.sku).trim().toUpperCase() : current.sku,
      category: data.category !== undefined ? String(data.category).trim() : current.category,
      selling_price: data.selling_price !== undefined ? Math.max(0, Number(data.selling_price) || 0) : current.selling_price,
      material_cost: data.material_cost !== undefined ? Math.max(0, Number(data.material_cost) || 0) : current.material_cost,
      manufacturing_cost: data.manufacturing_cost !== undefined ? Math.max(0, Number(data.manufacturing_cost) || 0) : current.manufacturing_cost,
      packaging_cost: data.packaging_cost !== undefined ? Math.max(0, Number(data.packaging_cost) || 0) : current.packaging_cost,
      delivery_cost: data.delivery_cost !== undefined ? Math.max(0, Number(data.delivery_cost) || 0) : current.delivery_cost,
      marketing_cost: data.marketing_cost !== undefined ? Math.max(0, Number(data.marketing_cost) || 0) : current.marketing_cost,
      is_active: data.is_active !== undefined ? Boolean(data.is_active) : current.is_active,
      updated_at: new Date().toISOString(),
    };

    const startTime = Date.now();
    logCrudOperation({
      correlationId,
      operation: 'UPDATE',
      table: 'Products',
      recordId: id,
      target: 'GOOGLE_SHEETS',
      status: 'PENDING',
      message: `Updating product "${updatedProduct.name}" in Google Sheets`,
    });

    const res = await callGoogleAppsScript('update_record', updatedProduct, 'Products', id, correlationId);
    const durationMs = Date.now() - startTime;

    if (!res.connected || res.httpStatus !== 200) {
      logCrudOperation({
        correlationId,
        operation: 'UPDATE',
        table: 'Products',
        recordId: id,
        target: 'GOOGLE_SHEETS',
        status: 'FAILED',
        durationMs,
        message: res.message,
      });
      throw new Error(res.message || 'Failed to persist product update to Google Sheets');
    }

    logCrudOperation({
      correlationId,
      operation: 'UPDATE',
      table: 'Products',
      recordId: id,
      target: 'GOOGLE_SHEETS',
      status: 'SUCCESS',
      durationMs,
    });

    invalidateCache();
    return updatedProduct;
  },

  async deleteProduct(id: string, correlationId?: string) {
    const all = await this.getAllAsync(true, correlationId);
    const product = all.Products.find((p) => p.id === id);
    if (!product) return null;

    // Check if product is referenced in historical order items
    const isUsedInOrders = all.Order_Items.some((item) => item.product_id === id);

    if (isUsedInOrders) {
      // RULE: For products used in historical orders, deactivate in Google Sheets
      const updated = {
        ...product,
        is_active: false,
        updated_at: new Date().toISOString(),
      };

      const startTime = Date.now();
      logCrudOperation({
        correlationId,
        operation: 'DEACTIVATE',
        table: 'Products',
        recordId: id,
        target: 'GOOGLE_SHEETS',
        status: 'PENDING',
        message: 'Product referenced by orders; deactivating in Google Sheets',
      });

      const res = await callGoogleAppsScript('update_record', { is_active: false }, 'Products', id, correlationId);
      const durationMs = Date.now() - startTime;

      if (!res.connected || res.httpStatus !== 200) {
        logCrudOperation({
          correlationId,
          operation: 'DEACTIVATE',
          table: 'Products',
          recordId: id,
          target: 'GOOGLE_SHEETS',
          status: 'FAILED',
          durationMs,
          message: res.message,
        });
        throw new Error(res.message || 'Failed to deactivate product in Google Sheets');
      }

      logCrudOperation({
        correlationId,
        operation: 'DEACTIVATE',
        table: 'Products',
        recordId: id,
        target: 'GOOGLE_SHEETS',
        status: 'SUCCESS',
        durationMs,
      });

      invalidateCache();
      return { id, deactivated: true, message: 'Product is used in existing orders and has been deactivated in Google Sheets.' };
    } else {
      const startTime = Date.now();
      logCrudOperation({
        correlationId,
        operation: 'DELETE',
        table: 'Products',
        recordId: id,
        target: 'GOOGLE_SHEETS',
        status: 'PENDING',
      });

      const res = await callGoogleAppsScript('delete_record', undefined, 'Products', id, correlationId);
      const durationMs = Date.now() - startTime;

      if (!res.connected || res.httpStatus !== 200) {
        logCrudOperation({
          correlationId,
          operation: 'DELETE',
          table: 'Products',
          recordId: id,
          target: 'GOOGLE_SHEETS',
          status: 'FAILED',
          durationMs,
          message: res.message,
        });
        throw new Error(res.message || 'Failed to delete product from Google Sheets');
      }

      logCrudOperation({
        correlationId,
        operation: 'DELETE',
        table: 'Products',
        recordId: id,
        target: 'GOOGLE_SHEETS',
        status: 'SUCCESS',
        durationMs,
      });

      invalidateCache();
      return { id, deleted: true };
    }
  },

  // Orders
  async getOrders(freshFromSheets: boolean = false, correlationId?: string) {
    const all = await this.getAllAsync(freshFromSheets, correlationId);
    const productMap = new Map<string, any>(all.Products.map((p) => [p.id, p]));

    return all.Orders.map((order) => {
      const items = all.Order_Items.filter((it) => it.order_id === order.id).map((it) => {
        const prod = productMap.get(it.product_id);
        return {
          ...it,
          product_name: prod ? prod.name : 'Unknown Product',
          product_sku: prod ? prod.sku : '',
        };
      });

      const total_amount = items.reduce((sum, it) => sum + (Number(it.quantity) || 0) * (Number(it.unit_price) || 0), 0);

      return {
        ...order,
        items,
        items_count: items.length,
        total_amount,
      };
    });
  },

  async getOrderById(id: string, correlationId?: string) {
    const all = await this.getAllAsync(false, correlationId);
    const order = all.Orders.find((o) => o.id === id);
    if (!order) return null;

    const productMap = new Map<string, any>(all.Products.map((p) => [p.id, p]));
    const items = all.Order_Items.filter((it) => it.order_id === order.id).map((it) => {
      const prod = productMap.get(it.product_id);
      return {
        ...it,
        product_name: prod ? prod.name : 'Unknown Product',
        product_sku: prod ? prod.sku : '',
      };
    });

    const total_amount = items.reduce((sum, it) => sum + (Number(it.quantity) || 0) * (Number(it.unit_price) || 0), 0);

    return {
      ...order,
      items,
      items_count: items.length,
      total_amount,
    };
  },

  async createOrder(data: any, correlationId?: string) {
    const all = await this.getAllAsync(true, correlationId);
    const now = new Date().toISOString();
    const orderId = generateId('ord');

    if (!data.order_number) {
      const datePart = (data.order_date || now.substring(0, 10)).replace(/-/g, '').substring(0, 6);
      const count = all.Orders.length + 1;
      data.order_number = `PH-${datePart}-${String(count).padStart(3, '0')}`;
    }

    const newOrder = {
      id: orderId,
      order_number: String(data.order_number).trim(),
      order_date: normalizeDate(data.order_date || now.substring(0, 10)),
      status: data.status || 'Pending',
      customer_name: String(data.customer_name || '').trim(),
      customer_phone: String(data.customer_phone || '').trim(),
      notes: String(data.notes || '').trim(),
      created_at: now,
      updated_at: now,
    };

    // Prepare order items with historical costing snapshot
    const newItems: any[] = [];
    const createdItemsWithMeta: any[] = [];

    if (Array.isArray(data.items) && data.items.length > 0) {
      for (const item of data.items) {
        const prod = all.Products.find((p) => p.id === item.product_id);
        if (!prod) {
          throw new Error(`Product not found for ID: ${item.product_id}`);
        }

        const unitPrice = item.unit_price !== undefined && !isNaN(Number(item.unit_price))
          ? Number(item.unit_price)
          : Number(prod.selling_price);

        // Historical unit COGS = material + manufacturing + packaging
        const unitCOGS = (Number(prod.material_cost) || 0) + (Number(prod.manufacturing_cost) || 0) + (Number(prod.packaging_cost) || 0);
        const unitDelivery = Number(prod.delivery_cost) || 0;

        const newItem = {
          id: generateId('item'),
          order_id: orderId,
          product_id: item.product_id,
          quantity: Math.max(1, Number(item.quantity) || 1),
          unit_price: Math.max(0, unitPrice),
          unit_cogs: unitCOGS,
          unit_delivery_cost: unitDelivery,
          created_at: now,
        };

        newItems.push(newItem);
        createdItemsWithMeta.push({
          ...newItem,
          product_name: prod.name,
          product_sku: prod.sku,
        });
      }
    }

    const startTime = Date.now();
    logCrudOperation({
      correlationId,
      operation: 'CREATE',
      table: 'Orders',
      recordId: newOrder.id,
      target: 'GOOGLE_SHEETS',
      status: 'PENDING',
    });

    // Write Order header to Google Sheets
    const resOrder = await callGoogleAppsScript('create_record', newOrder, 'Orders', newOrder.id, correlationId);
    if (!resOrder.connected || resOrder.httpStatus !== 200) {
      throw new Error(resOrder.message || 'Failed to write Order to Google Sheets');
    }

    // Write each Order Item to Google Sheets
    for (const item of newItems) {
      const resItem = await callGoogleAppsScript('create_record', item, 'Order_Items', item.id, correlationId);
      if (!resItem.connected || resItem.httpStatus !== 200) {
        throw new Error(resItem.message || 'Failed to write Order_Item to Google Sheets');
      }
    }

    const durationMs = Date.now() - startTime;
    logCrudOperation({
      correlationId,
      operation: 'CREATE',
      table: 'Orders',
      recordId: newOrder.id,
      target: 'GOOGLE_SHEETS',
      status: 'SUCCESS',
      durationMs,
    });

    invalidateCache();

    return {
      ...newOrder,
      items: createdItemsWithMeta,
      total_amount: createdItemsWithMeta.reduce((s, it) => s + it.quantity * it.unit_price, 0),
    };
  },

  async updateOrder(id: string, data: any, correlationId?: string) {
    const all = await this.getAllAsync(true, correlationId);
    const current = all.Orders.find((o) => o.id === id);
    if (!current) return null;

    const updatedOrder = {
      ...current,
      order_number: data.order_number !== undefined ? String(data.order_number).trim() : current.order_number,
      order_date: data.order_date !== undefined ? normalizeDate(data.order_date) : current.order_date,
      status: data.status !== undefined ? data.status : current.status,
      customer_name: data.customer_name !== undefined ? String(data.customer_name).trim() : current.customer_name,
      customer_phone: data.customer_phone !== undefined ? String(data.customer_phone).trim() : current.customer_phone,
      notes: data.notes !== undefined ? String(data.notes).trim() : current.notes,
      updated_at: new Date().toISOString(),
    };

    const startTime = Date.now();
    logCrudOperation({
      correlationId,
      operation: 'UPDATE',
      table: 'Orders',
      recordId: id,
      target: 'GOOGLE_SHEETS',
      status: 'PENDING',
    });

    // 1. Update Order Header
    const res = await callGoogleAppsScript('update_record', updatedOrder, 'Orders', id, correlationId);
    if (!res.connected || res.httpStatus !== 200) {
      throw new Error(res.message || 'Failed to update order in Google Sheets');
    }

    // 2. Reconcile Order Items if provided in payload
    if (Array.isArray(data.items)) {
      const existingItems = all.Order_Items.filter((it) => it.order_id === id);
      const incomingItems = data.items;

      // Map incoming items
      for (const item of incomingItems) {
        const prod = all.Products.find((p) => p.id === item.product_id);
        const unitPrice = item.unit_price !== undefined ? Number(item.unit_price) : (prod ? Number(prod.selling_price) : 0);
        const unitCOGS = prod ? (Number(prod.material_cost) || 0) + (Number(prod.manufacturing_cost) || 0) + (Number(prod.packaging_cost) || 0) : 0;
        const unitDelivery = prod ? Number(prod.delivery_cost) || 0 : 0;

        if (item.id && existingItems.some((ex) => ex.id === item.id)) {
          // Update existing item
          const updatedItem = {
            id: item.id,
            order_id: id,
            product_id: item.product_id,
            quantity: Math.max(1, Number(item.quantity) || 1),
            unit_price: Math.max(0, unitPrice),
            unit_cogs: unitCOGS,
            unit_delivery_cost: unitDelivery,
          };
          await callGoogleAppsScript('update_record', updatedItem, 'Order_Items', item.id, correlationId);
        } else {
          // Create new line item
          const newItem = {
            id: generateId('item'),
            order_id: id,
            product_id: item.product_id,
            quantity: Math.max(1, Number(item.quantity) || 1),
            unit_price: Math.max(0, unitPrice),
            unit_cogs: unitCOGS,
            unit_delivery_cost: unitDelivery,
            created_at: new Date().toISOString(),
          };
          await callGoogleAppsScript('create_record', newItem, 'Order_Items', newItem.id, correlationId);
        }
      }

      // Delete removed items
      const incomingItemIds = new Set(incomingItems.filter((it: any) => it.id).map((it: any) => it.id));
      for (const ex of existingItems) {
        if (!incomingItemIds.has(ex.id)) {
          await callGoogleAppsScript('delete_record', undefined, 'Order_Items', ex.id, correlationId);
        }
      }
    }

    const durationMs = Date.now() - startTime;
    logCrudOperation({
      correlationId,
      operation: 'UPDATE',
      table: 'Orders',
      recordId: id,
      target: 'GOOGLE_SHEETS',
      status: 'SUCCESS',
      durationMs,
    });

    invalidateCache();
    return this.getOrderById(id, correlationId);
  },

  async deleteOrder(id: string, correlationId?: string) {
    const all = await this.getAllAsync(true, correlationId);
    const order = all.Orders.find((o) => o.id === id);
    if (!order) return null;

    const startTime = Date.now();
    logCrudOperation({
      correlationId,
      operation: 'DELETE',
      table: 'Orders',
      recordId: id,
      target: 'GOOGLE_SHEETS',
      status: 'PENDING',
    });

    // 1. Delete Order header
    const res = await callGoogleAppsScript('delete_record', undefined, 'Orders', id, correlationId);
    if (!res.connected || res.httpStatus !== 200) {
      throw new Error(res.message || 'Failed to delete order from Google Sheets');
    }

    // 2. Delete all associated Order_Items
    const orderItems = all.Order_Items.filter((it) => it.order_id === id);
    for (const item of orderItems) {
      await callGoogleAppsScript('delete_record', undefined, 'Order_Items', item.id, correlationId).catch(() => {});
    }

    const durationMs = Date.now() - startTime;
    logCrudOperation({
      correlationId,
      operation: 'DELETE',
      table: 'Orders',
      recordId: id,
      target: 'GOOGLE_SHEETS',
      status: 'SUCCESS',
      durationMs,
    });

    invalidateCache();
    return { id, deleted: true };
  },

  // Marketing
  async getMarketing(freshFromSheets: boolean = false, correlationId?: string) {
    const all = await this.getAllAsync(freshFromSheets, correlationId);
    return all.Marketing;
  },

  async createMarketing(data: any, correlationId?: string) {
    const now = new Date().toISOString();
    const newRecord = {
      id: generateId('mkt'),
      month: normalizeMonth(data.month),
      spend: Math.max(0, Number(data.spend) || 0),
      orders_generated: Math.max(0, Number(data.orders_generated) || 0),
      revenue: Math.max(0, Number(data.revenue) || 0),
      created_at: now,
      updated_at: now,
    };

    const startTime = Date.now();
    logCrudOperation({
      correlationId,
      operation: 'CREATE',
      table: 'Marketing',
      recordId: newRecord.id,
      target: 'GOOGLE_SHEETS',
      status: 'PENDING',
    });

    const res = await callGoogleAppsScript('create_record', newRecord, 'Marketing', newRecord.id, correlationId);
    const durationMs = Date.now() - startTime;

    if (!res.connected || res.httpStatus !== 200) {
      logCrudOperation({
        correlationId,
        operation: 'CREATE',
        table: 'Marketing',
        recordId: newRecord.id,
        target: 'GOOGLE_SHEETS',
        status: 'FAILED',
        durationMs,
      });
      throw new Error(res.message || 'Failed to write marketing record to Google Sheets');
    }

    logCrudOperation({
      correlationId,
      operation: 'CREATE',
      table: 'Marketing',
      recordId: newRecord.id,
      target: 'GOOGLE_SHEETS',
      status: 'SUCCESS',
      durationMs,
    });

    invalidateCache();
    return newRecord;
  },

  async updateMarketing(id: string, data: any, correlationId?: string) {
    const all = await this.getAllAsync(true, correlationId);
    const current = all.Marketing.find((m) => m.id === id);
    if (!current) return null;

    const updated = {
      ...current,
      month: data.month !== undefined ? normalizeMonth(data.month) : current.month,
      spend: data.spend !== undefined ? Math.max(0, Number(data.spend) || 0) : current.spend,
      orders_generated: data.orders_generated !== undefined ? Math.max(0, Number(data.orders_generated) || 0) : current.orders_generated,
      revenue: data.revenue !== undefined ? Math.max(0, Number(data.revenue) || 0) : current.revenue,
      updated_at: new Date().toISOString(),
    };

    const res = await callGoogleAppsScript('update_record', updated, 'Marketing', id, correlationId);
    if (!res.connected || res.httpStatus !== 200) {
      throw new Error(res.message || 'Failed to update marketing record in Google Sheets');
    }

    invalidateCache();
    return updated;
  },

  async deleteMarketing(id: string, correlationId?: string) {
    const all = await this.getAllAsync(true, correlationId);
    const item = all.Marketing.find((m) => m.id === id);
    if (!item) return null;

    const res = await callGoogleAppsScript('delete_record', undefined, 'Marketing', id, correlationId);
    if (!res.connected || res.httpStatus !== 200) {
      throw new Error(res.message || 'Failed to delete marketing record from Google Sheets');
    }

    invalidateCache();
    return { id, deleted: true };
  },

  // Targets
  async getTargets(freshFromSheets: boolean = false, correlationId?: string) {
    const all = await this.getAllAsync(freshFromSheets, correlationId);
    return all.Targets;
  },

  async createTarget(data: any, correlationId?: string) {
    const now = new Date().toISOString();
    const newTarget = {
      id: generateId('tgt'),
      month: normalizeMonth(data.month),
      sales_target: Math.max(0, Number(data.sales_target) || 0),
      profit_margin_min: Number(data.profit_margin_min) || 25,
      profit_margin_max: Number(data.profit_margin_max) || 30,
      created_at: now,
      updated_at: now,
    };

    const startTime = Date.now();
    logCrudOperation({
      correlationId,
      operation: 'CREATE',
      table: 'Targets',
      recordId: newTarget.id,
      target: 'GOOGLE_SHEETS',
      status: 'PENDING',
    });

    const res = await callGoogleAppsScript('create_record', newTarget, 'Targets', newTarget.id, correlationId);
    const durationMs = Date.now() - startTime;

    if (!res.connected || res.httpStatus !== 200) {
      logCrudOperation({
        correlationId,
        operation: 'CREATE',
        table: 'Targets',
        recordId: newTarget.id,
        target: 'GOOGLE_SHEETS',
        status: 'FAILED',
        durationMs,
      });
      throw new Error(res.message || 'Failed to write target to Google Sheets');
    }

    logCrudOperation({
      correlationId,
      operation: 'CREATE',
      table: 'Targets',
      recordId: newTarget.id,
      target: 'GOOGLE_SHEETS',
      status: 'SUCCESS',
      durationMs,
    });

    invalidateCache();
    return newTarget;
  },

  async updateTarget(id: string, data: any, correlationId?: string) {
    const all = await this.getAllAsync(true, correlationId);
    const current = all.Targets.find((t) => t.id === id);
    if (!current) return null;

    const updated = {
      ...current,
      month: data.month !== undefined ? normalizeMonth(data.month) : current.month,
      sales_target: data.sales_target !== undefined ? Math.max(0, Number(data.sales_target) || 0) : current.sales_target,
      profit_margin_min: data.profit_margin_min !== undefined ? Number(data.profit_margin_min) : current.profit_margin_min,
      profit_margin_max: data.profit_margin_max !== undefined ? Number(data.profit_margin_max) : current.profit_margin_max,
      updated_at: new Date().toISOString(),
    };

    const res = await callGoogleAppsScript('update_record', updated, 'Targets', id, correlationId);
    if (!res.connected || res.httpStatus !== 200) {
      throw new Error(res.message || 'Failed to update target in Google Sheets');
    }

    invalidateCache();
    return updated;
  },

  async deleteTarget(id: string, correlationId?: string) {
    const all = await this.getAllAsync(true, correlationId);
    const item = all.Targets.find((t) => t.id === id);
    if (!item) return null;

    const res = await callGoogleAppsScript('delete_record', undefined, 'Targets', id, correlationId);
    if (!res.connected || res.httpStatus !== 200) {
      throw new Error(res.message || 'Failed to delete target from Google Sheets');
    }

    invalidateCache();
    return { id, deleted: true };
  },

  // Settings
  async getSettings(correlationId?: string) {
    const all = await this.getAllAsync(false, correlationId);
    return all.Settings;
  },

  async setSetting(key: string, value: string, correlationId?: string) {
    const all = await this.getAllAsync(true, correlationId);
    const idx = all.Settings.findIndex((s) => s.key === key);
    const now = new Date().toISOString();
    const settingObj = { key, value, updated_at: now };

    if (idx >= 0) {
      await callGoogleAppsScript('update_record', settingObj, 'Settings', key, correlationId);
    } else {
      await callGoogleAppsScript('create_record', settingObj, 'Settings', key, correlationId);
    }

    invalidateCache();
    return { key, value };
  },
};
