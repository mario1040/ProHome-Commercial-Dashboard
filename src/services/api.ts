import {
  Product,
  Order,
  MarketingRecord,
  Target,
  User,
  DashboardMetrics,
  ProductMixItem,
  MonthlyPerformanceRecord,
  ApiResponse,
} from '../types';

const TOKEN_KEY = 'prohome_auth_token';

export function getAuthToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setAuthToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function removeAuthToken() {
  localStorage.removeItem(TOKEN_KEY);
}

async function request<T>(
  url: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const res = await fetch(url, {
      ...options,
      headers,
    });

    const contentType = res.headers.get('content-type') || '';
    const rawText = await res.text();

    let data: any = null;
    const isJson = contentType.includes('application/json') || (rawText.trim().startsWith('{') || rawText.trim().startsWith('['));

    if (isJson) {
      try {
        data = JSON.parse(rawText);
      } catch (parseErr: any) {
        return {
          success: false,
          error: {
            code: 'JSON_PARSE_ERROR',
            message: `Failed to parse response JSON from ${url}: ${parseErr.message}`,
          },
        };
      }
    }

    if (!res.ok) {
      if (res.status === 401 && !url.includes('/auth/login')) {
        // Clear token if invalid or expired session
        removeAuthToken();
      }

      if (data && typeof data === 'object') {
        return {
          success: false,
          error: data.error || {
            code: `HTTP_${res.status}`,
            message: data.message || `Request failed with status ${res.status}`,
          },
        };
      }

      // If non-JSON HTML or plaintext error
      const isHtml = rawText.includes('<!DOCTYPE') || rawText.includes('<html');
      const cleanMessage = isHtml
        ? `Server returned HTML page (HTTP ${res.status}) instead of JSON for ${url}`
        : (rawText.slice(0, 300) || `Request failed with status ${res.status}`);

      return {
        success: false,
        error: {
          code: `HTTP_${res.status}`,
          message: cleanMessage,
        },
      };
    }

    if (!isJson) {
      return {
        success: true,
        data: rawText as unknown as T,
      };
    }

    return data;
  } catch (err: any) {
    return {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message: err.message || 'Network request failed. Please check connection.',
      },
    };
  }
}

export const api = {
  auth: {
    login: async (username: string, password: string) => {
      const res = await request<{ token: string; user: User }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });
      if (res.success && res.data?.token) {
        setAuthToken(res.data.token);
      }
      return res;
    },
    logout: async () => {
      await request('/api/auth/logout', { method: 'POST' });
      removeAuthToken();
    },
    getMe: async () => {
      return request<User>('/api/auth/me');
    },
    changePassword: async (currentPassword: string, newPassword: string) => {
      return request('/api/auth/change-password', {
        method: 'PUT',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
    },
  },

  products: {
    list: async () => request<Product[]>('/api/products'),
    create: async (data: Partial<Product>) =>
      request<Product>('/api/products', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: async (id: string, data: Partial<Product>) =>
      request<Product>(`/api/products/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    delete: async (id: string) =>
      request<{ id: string; deactivated?: boolean; message?: string }>(`/api/products/${id}`, {
        method: 'DELETE',
      }),
  },

  orders: {
    list: async () => request<Order[]>('/api/orders'),
    get: async (id: string) => request<Order>(`/api/orders/${id}`),
    create: async (data: any) =>
      request<Order>('/api/orders', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: async (id: string, data: any) =>
      request<Order>(`/api/orders/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    delete: async (id: string) =>
      request<{ id: string; deleted: boolean }>(`/api/orders/${id}`, {
        method: 'DELETE',
      }),
  },

  marketing: {
    list: async () => request<MarketingRecord[]>('/api/marketing'),
    create: async (data: Partial<MarketingRecord>) =>
      request<MarketingRecord>('/api/marketing', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: async (id: string, data: Partial<MarketingRecord>) =>
      request<MarketingRecord>(`/api/marketing/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    delete: async (id: string) =>
      request<{ id: string; deleted: boolean }>(`/api/marketing/${id}`, {
        method: 'DELETE',
      }),
  },

  targets: {
    list: async () => request<Target[]>('/api/targets'),
    create: async (data: Partial<Target>) =>
      request<Target>('/api/targets', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: async (id: string, data: Partial<Target>) =>
      request<Target>(`/api/targets/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    delete: async (id: string) =>
      request<{ id: string; deleted: boolean }>(`/api/targets/${id}`, {
        method: 'DELETE',
      }),
  },

  dashboard: {
    get: async (month?: string) =>
      request<{ metrics: DashboardMetrics; productMix: ProductMixItem[] }>(
        `/api/dashboard${month ? `?month=${month}` : ''}`
      ),
  },

  performance: {
    get: async (year?: string) =>
      request<MonthlyPerformanceRecord[]>(
        `/api/performance${year ? `?year=${year}` : ''}`
      ),
  },

  settings: {
    get: async () =>
      request<{
        settings: { key: string; value: string }[];
        googleSheetsIntegration: { isConfigured: boolean; hasSecret: boolean };
      }>('/api/settings'),
  },

  sync: {
    testConnection: async () => request('/api/sync/test-connection', { method: 'POST' }),
    pushToSheets: async () => request('/api/sync/push-to-sheets', { method: 'POST' }),
    pullFromSheets: async () => request('/api/sync/pull-from-sheets', { method: 'POST' }),
    resetSeed: async () => request('/api/seed/reset', { method: 'POST' }),
  },
};
