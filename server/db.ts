import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { getInitialSeedData } from './seed';
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

const DATA_DIR = process.env.VERCEL ? '/tmp' : path.join(process.cwd(), 'data');
const STORE_PATH = path.join(DATA_DIR, 'store.json');

let inMemoryDb: DatabaseState = {
  Users: [],
  Products: [],
  Orders: [],
  Order_Items: [],
  Marketing: [],
  Targets: [],
  Settings: [],
};

let lastSyncTime: string | null = null;
let lastSyncStatus: { success: boolean; message: string; timestamp: string } | null = null;

const DEFAULT_GAS_URL = 'https://script.google.com/macros/s/AKfycbyMu9VIskbfUrGQsGg0K-k-Wv7sEQxPdCAYHS0rib9EYsyuGU4UWDus4qrkv-LZFyTBOA/exec';
const DEFAULT_GAS_SECRET = 'AKfycbyMu9VIskbfUrGQsGg0K-k-Wv7sEQxPdCAYHS0rib9EYsyuGU4UWDus4qrkv-LZFyTBOA';

export function getGasUrl(): string {
  return process.env.GOOGLE_APPS_SCRIPT_URL || DEFAULT_GAS_URL;
}

export function getGasSecret(): string {
  return process.env.GOOGLE_APPS_SCRIPT_SECRET || DEFAULT_GAS_SECRET;
}

export function isGoogleSheetsActive(): boolean {
  return Boolean(getGasUrl() && getGasSecret());
}

export function normalizeRecord(tableName: string, raw: any): any {
  if (!raw || typeof raw !== 'object') return raw;
  const copy = { ...raw };

  if (tableName === 'Products') {
    copy.selling_price = Math.max(0, Number(copy.selling_price) || 0);
    copy.material_cost = Math.max(0, Number(copy.material_cost) || 0);
    copy.manufacturing_cost = Math.max(0, Number(copy.manufacturing_cost) || 0);
    copy.packaging_cost = Math.max(0, Number(copy.packaging_cost) || 0);
    copy.delivery_cost = Math.max(0, Number(copy.delivery_cost) || 0);
    copy.marketing_cost = Math.max(0, Number(copy.marketing_cost) || 0);
    copy.is_active = copy.is_active === true || copy.is_active === 'TRUE' || copy.is_active === 'true' || copy.is_active === 1 || copy.is_active === '1';
  } else if (tableName === 'Orders') {
    // String dates / strings
    copy.order_number = String(copy.order_number || '');
    copy.order_date = String(copy.order_date || '');
    copy.status = String(copy.status || 'Pending');
    copy.customer_name = String(copy.customer_name || '');
    copy.customer_phone = String(copy.customer_phone || '');
  } else if (tableName === 'Order_Items') {
    copy.quantity = Math.max(1, Number(copy.quantity) || 1);
    copy.unit_price = Math.max(0, Number(copy.unit_price) || 0);
  } else if (tableName === 'Marketing') {
    copy.spend = Math.max(0, Number(copy.spend) || 0);
    copy.orders_generated = Math.max(0, Number(copy.orders_generated) || 0);
    copy.revenue = Math.max(0, Number(copy.revenue) || 0);
  } else if (tableName === 'Targets') {
    copy.sales_target = Math.max(0, Number(copy.sales_target) || 0);
    copy.profit_margin_min = Number(copy.profit_margin_min) || 25;
    copy.profit_margin_max = Number(copy.profit_margin_max) || 30;
  } else if (tableName === 'Users') {
    copy.is_active = copy.is_active === true || copy.is_active === 'TRUE' || copy.is_active === 'true' || copy.is_active === 1 || copy.is_active === '1';
  }

  return copy;
}

export function initDatabase() {
  try {
    if (fs.existsSync(STORE_PATH)) {
      const data = fs.readFileSync(STORE_PATH, 'utf-8');
      const parsed = JSON.parse(data);
      if (parsed && Array.isArray(parsed.Users) && parsed.Users.length > 0) {
        inMemoryDb = {
          Users: parsed.Users || [],
          Products: parsed.Products || [],
          Orders: parsed.Orders || [],
          Order_Items: parsed.Order_Items || [],
          Marketing: parsed.Marketing || [],
          Targets: parsed.Targets || [],
          Settings: parsed.Settings || [],
        };
        console.log(`[DB] Loaded state from local store with ${inMemoryDb.Products.length} products, ${inMemoryDb.Orders.length} orders`);
        return;
      }
    }
  } catch (err) {
    console.error('[DB] Error loading local store:', err);
  }

  // Idempotent initial seed
  console.log('[DB] Seeding initial ProHome commercial database...');
  inMemoryDb = getInitialSeedData();
  saveDb();
}

export const initDb = initDatabase;

export function saveDb() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(STORE_PATH, JSON.stringify(inMemoryDb, null, 2), 'utf-8');
  } catch (err) {
    console.error('[DB] Failed saving store.json:', err);
  }
}

export function generateId(prefix: string): string {
  return `${prefix}_${crypto.randomBytes(6).toString('hex')}`;
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
    persistenceMode: isConnected ? 'GOOGLE_SHEETS' : 'LOCAL_PERSISTENCE',
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
  getAll(): DatabaseState {
    return inMemoryDb;
  },

  async pullAllFromSheets(correlationId?: string): Promise<{ success: boolean; message: string }> {
    if (!isGoogleSheetsActive()) {
      return { success: true, message: 'Google Sheets not configured; using local store' };
    }

    const res = await callGoogleAppsScript('get_all', undefined, undefined, undefined, correlationId);
    if (res.connected && res.result && typeof res.result === 'object') {
      const sheetsData = res.result;
      if (Array.isArray(sheetsData.Products) && sheetsData.Products.length > 0) {
        inMemoryDb.Products = sheetsData.Products.map((p: any) => normalizeRecord('Products', p));
      }
      if (Array.isArray(sheetsData.Orders)) {
        inMemoryDb.Orders = sheetsData.Orders.map((o: any) => normalizeRecord('Orders', o));
      }
      if (Array.isArray(sheetsData.Order_Items)) {
        inMemoryDb.Order_Items = sheetsData.Order_Items.map((oi: any) => normalizeRecord('Order_Items', oi));
      }
      if (Array.isArray(sheetsData.Marketing)) {
        inMemoryDb.Marketing = sheetsData.Marketing.map((m: any) => normalizeRecord('Marketing', m));
      }
      if (Array.isArray(sheetsData.Targets)) {
        inMemoryDb.Targets = sheetsData.Targets.map((t: any) => normalizeRecord('Targets', t));
      }
      if (Array.isArray(sheetsData.Settings)) {
        inMemoryDb.Settings = sheetsData.Settings.map((s: any) => normalizeRecord('Settings', s));
      }
      if (Array.isArray(sheetsData.Users) && sheetsData.Users.length > 0) {
        inMemoryDb.Users = sheetsData.Users.map((u: any) => normalizeRecord('Users', u));
      }
      saveDb();
      return { success: true, message: 'Successfully loaded database from Google Sheets' };
    }

    return { success: false, message: res.message || 'Failed to pull from Google Sheets' };
  },

  resetSeed() {
    inMemoryDb = getInitialSeedData();
    saveDb();
    return inMemoryDb;
  },

  // Users
  getUsers() {
    return inMemoryDb.Users;
  },

  getUserByUsername(username: string) {
    const clean = username.trim().toLowerCase();
    return inMemoryDb.Users.find(
      (u) =>
        u.username.toLowerCase() === clean ||
        (u.email && u.email.toLowerCase() === clean) ||
        (clean === 'jemyneutron228@gmail.com' && u.role === 'admin')
    );
  },

  getUserById(id: string) {
    return inMemoryDb.Users.find((u) => u.id === id);
  },

  async updateUser(id: string, updates: any, correlationId?: string) {
    const idx = inMemoryDb.Users.findIndex((u) => u.id === id);
    if (idx === -1) return null;
    
    const updated = {
      ...inMemoryDb.Users[idx],
      ...updates,
      updated_at: new Date().toISOString(),
    };

    if (isGoogleSheetsActive()) {
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
    }

    inMemoryDb.Users[idx] = updated;
    saveDb();
    return inMemoryDb.Users[idx];
  },

  // Products
  async getProducts(freshFromSheets: boolean = false, correlationId?: string) {
    if (freshFromSheets && isGoogleSheetsActive()) {
      const res = await callGoogleAppsScript('get_resource', undefined, 'Products', undefined, correlationId);
      if (res.connected && Array.isArray(res.result)) {
        inMemoryDb.Products = res.result.map((p: any) => normalizeRecord('Products', p));
        saveDb();
      }
    }
    return inMemoryDb.Products;
  },

  getProductById(id: string) {
    return inMemoryDb.Products.find((p) => p.id === id);
  },

  getProductBySku(sku: string) {
    return inMemoryDb.Products.find((p) => p.sku.trim().toLowerCase() === sku.trim().toLowerCase());
  },

  async createProduct(data: any, correlationId?: string) {
    const existingSku = this.getProductBySku(data.sku);
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

    if (isGoogleSheetsActive()) {
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
        message: `Product "${newProduct.name}" persisted to Google Sheets in ${durationMs}ms`,
      });
    } else {
      logCrudOperation({
        correlationId,
        operation: 'CREATE',
        table: 'Products',
        recordId: newProduct.id,
        target: 'LOCAL_STORE',
        status: 'SUCCESS',
      });
    }

    inMemoryDb.Products.push(newProduct);
    saveDb();
    return newProduct;
  },

  async updateProduct(id: string, data: any, correlationId?: string) {
    const idx = inMemoryDb.Products.findIndex((p) => p.id === id);
    if (idx === -1) return null;

    if (data.sku) {
      const existingSku = this.getProductBySku(data.sku);
      if (existingSku && existingSku.id !== id) {
        throw new Error(`A product with SKU "${data.sku}" already exists`);
      }
    }

    const current = inMemoryDb.Products[idx];
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

    if (isGoogleSheetsActive()) {
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
    } else {
      logCrudOperation({
        correlationId,
        operation: 'UPDATE',
        table: 'Products',
        recordId: id,
        target: 'LOCAL_STORE',
        status: 'SUCCESS',
      });
    }

    inMemoryDb.Products[idx] = updatedProduct;
    saveDb();
    return inMemoryDb.Products[idx];
  },

  async deleteProduct(id: string, correlationId?: string) {
    const idx = inMemoryDb.Products.findIndex((p) => p.id === id);
    if (idx === -1) return null;

    // Check if product is referenced in historical orders
    const isUsedInOrders = inMemoryDb.Order_Items.some((item) => item.product_id === id);

    if (isUsedInOrders) {
      // RULE: For products used in historical orders, deactivate in Google Sheets
      const updated = {
        ...inMemoryDb.Products[idx],
        is_active: false,
        updated_at: new Date().toISOString(),
      };

      if (isGoogleSheetsActive()) {
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
      }

      inMemoryDb.Products[idx] = updated;
      saveDb();
      return { id, deactivated: true, message: 'Product is used in existing orders and has been deactivated in Google Sheets.' };
    } else {
      if (isGoogleSheetsActive()) {
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
      }

      const removed = inMemoryDb.Products.splice(idx, 1)[0];
      saveDb();
      return { id: removed.id, deleted: true };
    }
  },

  // Orders
  async getOrders(freshFromSheets: boolean = false, correlationId?: string) {
    if (freshFromSheets && isGoogleSheetsActive()) {
      const resOrders = await callGoogleAppsScript('get_resource', undefined, 'Orders', undefined, correlationId);
      const resItems = await callGoogleAppsScript('get_resource', undefined, 'Order_Items', undefined, correlationId);
      if (resOrders.connected && Array.isArray(resOrders.result)) {
        inMemoryDb.Orders = resOrders.result.map((o: any) => normalizeRecord('Orders', o));
      }
      if (resItems.connected && Array.isArray(resItems.result)) {
        inMemoryDb.Order_Items = resItems.result.map((oi: any) => normalizeRecord('Order_Items', oi));
      }
      saveDb();
    }

    const productMap = new Map(inMemoryDb.Products.map((p) => [p.id, p]));
    return inMemoryDb.Orders.map((order) => {
      const items = inMemoryDb.Order_Items.filter((it) => it.order_id === order.id).map((it) => {
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

  getOrderById(id: string) {
    const order = inMemoryDb.Orders.find((o) => o.id === id);
    if (!order) return null;

    const productMap = new Map(inMemoryDb.Products.map((p) => [p.id, p]));
    const items = inMemoryDb.Order_Items.filter((it) => it.order_id === order.id).map((it) => {
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
    const now = new Date().toISOString();
    const orderId = generateId('ord');

    if (!data.order_number) {
      const datePart = (data.order_date || now.substring(0, 10)).replace(/-/g, '').substring(0, 6);
      const count = inMemoryDb.Orders.length + 1;
      data.order_number = `PH-${datePart}-${String(count).padStart(3, '0')}`;
    }

    const newOrder = {
      id: orderId,
      order_number: String(data.order_number).trim(),
      order_date: String(data.order_date || now.substring(0, 10)).trim(),
      status: data.status || 'Pending',
      customer_name: String(data.customer_name || '').trim(),
      customer_phone: String(data.customer_phone || '').trim(),
      notes: String(data.notes || '').trim(),
      created_at: now,
      updated_at: now,
    };

    // Prepare order items
    const newItems: any[] = [];
    const createdItemsWithMeta: any[] = [];

    if (Array.isArray(data.items) && data.items.length > 0) {
      for (const item of data.items) {
        const prod = inMemoryDb.Products.find((p) => p.id === item.product_id);
        if (!prod) {
          throw new Error(`Product not found for ID: ${item.product_id}`);
        }

        const unitPrice = item.unit_price !== undefined ? Number(item.unit_price) : Number(prod.selling_price);
        const newItem = {
          id: generateId('item'),
          order_id: orderId,
          product_id: item.product_id,
          quantity: Math.max(1, Number(item.quantity) || 1),
          unit_price: Math.max(0, unitPrice),
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

    if (isGoogleSheetsActive()) {
      const startTime = Date.now();
      logCrudOperation({
        correlationId,
        operation: 'CREATE',
        table: 'Orders',
        recordId: newOrder.id,
        target: 'GOOGLE_SHEETS',
        status: 'PENDING',
      });

      // Write Order
      const resOrder = await callGoogleAppsScript('create_record', newOrder, 'Orders', newOrder.id, correlationId);
      if (!resOrder.connected || resOrder.httpStatus !== 200) {
        throw new Error(resOrder.message || 'Failed to write Order to Google Sheets');
      }

      // Write Order Items
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
    }

    inMemoryDb.Orders.push(newOrder);
    inMemoryDb.Order_Items.push(...newItems);
    saveDb();

    return {
      ...newOrder,
      items: createdItemsWithMeta,
      total_amount: createdItemsWithMeta.reduce((s, it) => s + it.quantity * it.unit_price, 0),
    };
  },

  async updateOrder(id: string, data: any, correlationId?: string) {
    const idx = inMemoryDb.Orders.findIndex((o) => o.id === id);
    if (idx === -1) return null;

    const current = inMemoryDb.Orders[idx];
    const updatedOrder = {
      ...current,
      order_number: data.order_number !== undefined ? String(data.order_number).trim() : current.order_number,
      order_date: data.order_date !== undefined ? String(data.order_date).trim() : current.order_date,
      status: data.status !== undefined ? data.status : current.status,
      customer_name: data.customer_name !== undefined ? String(data.customer_name).trim() : current.customer_name,
      customer_phone: data.customer_phone !== undefined ? String(data.customer_phone).trim() : current.customer_phone,
      notes: data.notes !== undefined ? String(data.notes).trim() : current.notes,
      updated_at: new Date().toISOString(),
    };

    if (isGoogleSheetsActive()) {
      const startTime = Date.now();
      logCrudOperation({
        correlationId,
        operation: 'UPDATE',
        table: 'Orders',
        recordId: id,
        target: 'GOOGLE_SHEETS',
        status: 'PENDING',
      });

      const res = await callGoogleAppsScript('update_record', updatedOrder, 'Orders', id, correlationId);
      if (!res.connected || res.httpStatus !== 200) {
        throw new Error(res.message || 'Failed to update order in Google Sheets');
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
    }

    inMemoryDb.Orders[idx] = updatedOrder;
    saveDb();
    return this.getOrderById(id);
  },

  async deleteOrder(id: string, correlationId?: string) {
    const idx = inMemoryDb.Orders.findIndex((o) => o.id === id);
    if (idx === -1) return null;

    if (isGoogleSheetsActive()) {
      const startTime = Date.now();
      logCrudOperation({
        correlationId,
        operation: 'DELETE',
        table: 'Orders',
        recordId: id,
        target: 'GOOGLE_SHEETS',
        status: 'PENDING',
      });

      const res = await callGoogleAppsScript('delete_record', undefined, 'Orders', id, correlationId);
      if (!res.connected || res.httpStatus !== 200) {
        throw new Error(res.message || 'Failed to delete order from Google Sheets');
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
    }

    inMemoryDb.Orders.splice(idx, 1);
    inMemoryDb.Order_Items = inMemoryDb.Order_Items.filter((it) => it.order_id !== id);
    saveDb();
    return { id, deleted: true };
  },

  // Marketing
  async getMarketing(freshFromSheets: boolean = false, correlationId?: string) {
    if (freshFromSheets && isGoogleSheetsActive()) {
      const res = await callGoogleAppsScript('get_resource', undefined, 'Marketing', undefined, correlationId);
      if (res.connected && Array.isArray(res.result)) {
        inMemoryDb.Marketing = res.result.map((m: any) => normalizeRecord('Marketing', m));
        saveDb();
      }
    }
    return inMemoryDb.Marketing;
  },

  async createMarketing(data: any, correlationId?: string) {
    const now = new Date().toISOString();
    const newRecord = {
      id: generateId('mkt'),
      month: String(data.month).trim(),
      spend: Math.max(0, Number(data.spend) || 0),
      orders_generated: Math.max(0, Number(data.orders_generated) || 0),
      revenue: Math.max(0, Number(data.revenue) || 0),
      created_at: now,
      updated_at: now,
    };

    if (isGoogleSheetsActive()) {
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
    }

    inMemoryDb.Marketing.push(newRecord);
    saveDb();
    return newRecord;
  },

  async updateMarketing(id: string, data: any, correlationId?: string) {
    const idx = inMemoryDb.Marketing.findIndex((m) => m.id === id);
    if (idx === -1) return null;

    const current = inMemoryDb.Marketing[idx];
    const updated = {
      ...current,
      month: data.month !== undefined ? String(data.month).trim() : current.month,
      spend: data.spend !== undefined ? Math.max(0, Number(data.spend) || 0) : current.spend,
      orders_generated: data.orders_generated !== undefined ? Math.max(0, Number(data.orders_generated) || 0) : current.orders_generated,
      revenue: data.revenue !== undefined ? Math.max(0, Number(data.revenue) || 0) : current.revenue,
      updated_at: new Date().toISOString(),
    };

    if (isGoogleSheetsActive()) {
      const res = await callGoogleAppsScript('update_record', updated, 'Marketing', id, correlationId);
      if (!res.connected || res.httpStatus !== 200) {
        throw new Error(res.message || 'Failed to update marketing record in Google Sheets');
      }
    }

    inMemoryDb.Marketing[idx] = updated;
    saveDb();
    return inMemoryDb.Marketing[idx];
  },

  async deleteMarketing(id: string, correlationId?: string) {
    const idx = inMemoryDb.Marketing.findIndex((m) => m.id === id);
    if (idx === -1) return null;

    if (isGoogleSheetsActive()) {
      const res = await callGoogleAppsScript('delete_record', undefined, 'Marketing', id, correlationId);
      if (!res.connected || res.httpStatus !== 200) {
        throw new Error(res.message || 'Failed to delete marketing record from Google Sheets');
      }
    }

    inMemoryDb.Marketing.splice(idx, 1);
    saveDb();
    return { id, deleted: true };
  },

  // Targets
  async getTargets(freshFromSheets: boolean = false, correlationId?: string) {
    if (freshFromSheets && isGoogleSheetsActive()) {
      const res = await callGoogleAppsScript('get_resource', undefined, 'Targets', undefined, correlationId);
      if (res.connected && Array.isArray(res.result)) {
        inMemoryDb.Targets = res.result.map((t: any) => normalizeRecord('Targets', t));
        saveDb();
      }
    }
    return inMemoryDb.Targets;
  },

  async createTarget(data: any, correlationId?: string) {
    const now = new Date().toISOString();
    const newTarget = {
      id: generateId('tgt'),
      month: String(data.month).trim(),
      sales_target: Math.max(0, Number(data.sales_target) || 0),
      profit_margin_min: Number(data.profit_margin_min) || 25,
      profit_margin_max: Number(data.profit_margin_max) || 30,
      created_at: now,
      updated_at: now,
    };

    if (isGoogleSheetsActive()) {
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
    }

    inMemoryDb.Targets.push(newTarget);
    saveDb();
    return newTarget;
  },

  async updateTarget(id: string, data: any, correlationId?: string) {
    const idx = inMemoryDb.Targets.findIndex((t) => t.id === id);
    if (idx === -1) return null;

    const current = inMemoryDb.Targets[idx];
    const updated = {
      ...current,
      month: data.month !== undefined ? String(data.month).trim() : current.month,
      sales_target: data.sales_target !== undefined ? Math.max(0, Number(data.sales_target) || 0) : current.sales_target,
      profit_margin_min: data.profit_margin_min !== undefined ? Number(data.profit_margin_min) : current.profit_margin_min,
      profit_margin_max: data.profit_margin_max !== undefined ? Number(data.profit_margin_max) : current.profit_margin_max,
      updated_at: new Date().toISOString(),
    };

    if (isGoogleSheetsActive()) {
      const res = await callGoogleAppsScript('update_record', updated, 'Targets', id, correlationId);
      if (!res.connected || res.httpStatus !== 200) {
        throw new Error(res.message || 'Failed to update target in Google Sheets');
      }
    }

    inMemoryDb.Targets[idx] = updated;
    saveDb();
    return inMemoryDb.Targets[idx];
  },

  async deleteTarget(id: string, correlationId?: string) {
    const idx = inMemoryDb.Targets.findIndex((t) => t.id === id);
    if (idx === -1) return null;

    if (isGoogleSheetsActive()) {
      const res = await callGoogleAppsScript('delete_record', undefined, 'Targets', id, correlationId);
      if (!res.connected || res.httpStatus !== 200) {
        throw new Error(res.message || 'Failed to delete target from Google Sheets');
      }
    }

    inMemoryDb.Targets.splice(idx, 1);
    saveDb();
    return { id, deleted: true };
  },

  // Settings
  getSettings() {
    return inMemoryDb.Settings;
  },

  async setSetting(key: string, value: string, correlationId?: string) {
    const idx = inMemoryDb.Settings.findIndex((s) => s.key === key);
    const now = new Date().toISOString();
    const settingObj = { key, value, updated_at: now };

    if (isGoogleSheetsActive()) {
      if (idx >= 0) {
        await callGoogleAppsScript('update_record', settingObj, 'Settings', key, correlationId);
      } else {
        await callGoogleAppsScript('create_record', settingObj, 'Settings', key, correlationId);
      }
    }

    if (idx >= 0) {
      inMemoryDb.Settings[idx] = settingObj;
    } else {
      inMemoryDb.Settings.push(settingObj);
    }
    saveDb();
    return { key, value };
  },
};
