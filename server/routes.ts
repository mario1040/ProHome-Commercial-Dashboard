import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import {
  db,
  isGoogleSheetsActive,
  getSyncMetadata,
  callGoogleAppsScript,
} from './db';
import {
  calculateDashboardMetrics,
  calculateProductMix,
  calculateMonthlyPerformance,
} from '../src/calculations/businessMetrics';
import {
  verifyPassword,
  hashPassword,
  generateToken,
  verifyToken,
  JWTPayload,
} from './auth';
import { logStructured, logAuditTrail } from './logger';

const router = Router();

export interface AuthenticatedRequest extends Request {
  user?: JWTPayload;
  correlationId?: string;
}

// Authentication middleware
export const requireAuth = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Authentication required. Please log in.' },
    });
  }

  const token = authHeader.split(' ')[1];
  const payload = verifyToken(token);

  if (!payload) {
    return res.status(401).json({
      success: false,
      error: { code: 'INVALID_TOKEN', message: 'Session expired or invalid. Please sign in again.' },
    });
  }

  req.user = payload;
  next();
};

// Global correlation ID and request audit middleware
router.use((req: Request, res: Response, next: NextFunction) => {
  const incomingId = req.headers['x-correlation-id'] as string;
  const correlationId = incomingId || `req_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`;
  (req as any).correlationId = correlationId;
  res.setHeader('X-Correlation-ID', correlationId);

  const startTime = Date.now();
  res.on('finish', () => {
    const durationMs = Date.now() - startTime;
    logAuditTrail({
      correlationId,
      endpoint: `${req.method} ${req.path}`,
      user: (req as any).user ? (req as any).user.username : 'anonymous',
      ip: req.ip || (req.headers['x-forwarded-for'] as string) || '127.0.0.1',
      statusCode: res.statusCode,
      durationMs,
    });
  });

  next();
});

// Health check
router.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    mode: 'ONLINE_ONLY_GOOGLE_SHEETS',
    time: new Date().toISOString(),
  });
});

// ================= AUTHENTICATION =================

router.post('/auth/login', async (req: Request, res: Response) => {
  const correlationId = (req as any).correlationId;
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_CREDENTIALS', message: 'Username and password are required' },
      });
    }

    let user;
    try {
      user = await db.getUserByUsername(username, correlationId);
    } catch (dbErr: any) {
      return res.status(503).json({
        success: false,
        error: {
          code: dbErr.code || 'DATABASE_UNAVAILABLE',
          message: dbErr.message || 'Google Sheets database is currently unavailable. Please verify connectivity in Settings.',
          isAuthError: Boolean(dbErr.isAuthError),
        },
      });
    }

    if (!user || !user.is_active) {
      return res.status(401).json({
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid username or password' },
      });
    }

    const isValid = verifyPassword(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid username or password' },
      });
    }

    const token = generateToken({
      id: user.id,
      username: user.username,
      role: user.role,
    });

    return res.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
        },
      },
      message: 'Login successful',
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: err.message || 'Login failed' },
    });
  }
});

router.post('/auth/logout', (req: Request, res: Response) => {
  return res.json({ success: true, message: 'Logged out successfully' });
});

router.get('/auth/me', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const correlationId = (req as any).correlationId;
  try {
    const user = await db.getUserById(req.user!.userId, correlationId);
    if (!user) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });
    }

    return res.json({
      success: true,
      data: {
        id: user.id,
        username: user.username,
        role: user.role,
      },
    });
  } catch (err: any) {
    return res.status(503).json({ success: false, error: { code: 'DATABASE_ERROR', message: err.message } });
  }
});

router.put('/auth/change-password', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const correlationId = (req as any).correlationId;
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_FIELDS', message: 'Current and new password are required' },
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        error: { code: 'WEAK_PASSWORD', message: 'New password must be at least 6 characters' },
      });
    }

    const user = await db.getUserById(req.user!.userId, correlationId);
    if (!user) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });
    }

    if (!verifyPassword(currentPassword, user.password_hash)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INCORRECT_PASSWORD', message: 'Current password is incorrect' },
      });
    }

    const newHash = hashPassword(newPassword);
    await db.updateUser(user.id, { password_hash: newHash }, correlationId);

    return res.json({ success: true, message: 'Password updated successfully in Google Sheets' });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: err.message },
    });
  }
});

// ================= PRODUCTS CRUD =================

router.get('/products', requireAuth, async (req: Request, res: Response) => {
  const correlationId = (req as any).correlationId;
  try {
    const fresh = req.query.fresh === 'true';
    const products = await db.getProducts(fresh, correlationId);
    return res.json({ success: true, data: products });
  } catch (err: any) {
    return res.status(503).json({
      success: false,
      error: { code: 'DATABASE_ERROR', message: err.message },
    });
  }
});

router.post('/products', requireAuth, async (req: Request, res: Response) => {
  const correlationId = (req as any).correlationId;
  try {
    const { name, sku } = req.body;
    if (!name || !sku) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Product Name and SKU are required' },
      });
    }

    const product = await db.createProduct(req.body, correlationId);
    return res.status(201).json({
      success: true,
      data: product,
      message: 'Product created and persisted to Google Sheets',
    });
  } catch (err: any) {
    return res.status(400).json({
      success: false,
      error: { code: 'CREATE_FAILED', message: err.message },
    });
  }
});

router.put('/products/:id', requireAuth, async (req: Request, res: Response) => {
  const correlationId = (req as any).correlationId;
  try {
    const updated = await db.updateProduct(req.params.id, req.body, correlationId);
    if (!updated) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Product not found' },
      });
    }
    return res.json({
      success: true,
      data: updated,
      message: 'Product updated and persisted to Google Sheets',
    });
  } catch (err: any) {
    return res.status(400).json({
      success: false,
      error: { code: 'UPDATE_FAILED', message: err.message },
    });
  }
});

router.delete('/products/:id', requireAuth, async (req: Request, res: Response) => {
  const correlationId = (req as any).correlationId;
  try {
    const result = await db.deleteProduct(req.params.id, correlationId);
    if (!result) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Product not found' },
      });
    }
    return res.json({ success: true, data: result, message: result.message || 'Product deleted' });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: { code: 'DELETE_FAILED', message: err.message },
    });
  }
});

// ================= ORDERS CRUD =================

router.get('/orders', requireAuth, async (req: Request, res: Response) => {
  const correlationId = (req as any).correlationId;
  try {
    const fresh = req.query.fresh === 'true';
    const orders = await db.getOrders(fresh, correlationId);
    return res.json({ success: true, data: orders });
  } catch (err: any) {
    return res.status(503).json({ success: false, error: { code: 'DATABASE_ERROR', message: err.message } });
  }
});

router.get('/orders/:id', requireAuth, async (req: Request, res: Response) => {
  const correlationId = (req as any).correlationId;
  try {
    const order = await db.getOrderById(req.params.id, correlationId);
    if (!order) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Order not found' } });
    }
    return res.json({ success: true, data: order });
  } catch (err: any) {
    return res.status(503).json({ success: false, error: { code: 'DATABASE_ERROR', message: err.message } });
  }
});

router.post('/orders', requireAuth, async (req: Request, res: Response) => {
  const correlationId = (req as any).correlationId;
  try {
    const { customer_name, items } = req.body;
    if (!customer_name) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Customer name is required' },
      });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Order must contain at least one product item' },
      });
    }

    const order = await db.createOrder(req.body, correlationId);
    return res.status(201).json({
      success: true,
      data: order,
      message: 'Order created and persisted to Google Sheets',
    });
  } catch (err: any) {
    return res.status(400).json({
      success: false,
      error: { code: 'CREATE_FAILED', message: err.message },
    });
  }
});

router.put('/orders/:id', requireAuth, async (req: Request, res: Response) => {
  const correlationId = (req as any).correlationId;
  try {
    const updated = await db.updateOrder(req.params.id, req.body, correlationId);
    if (!updated) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Order not found' },
      });
    }
    return res.json({
      success: true,
      data: updated,
      message: 'Order updated and persisted to Google Sheets',
    });
  } catch (err: any) {
    return res.status(400).json({
      success: false,
      error: { code: 'UPDATE_FAILED', message: err.message },
    });
  }
});

router.delete('/orders/:id', requireAuth, async (req: Request, res: Response) => {
  const correlationId = (req as any).correlationId;
  try {
    const result = await db.deleteOrder(req.params.id, correlationId);
    if (!result) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Order not found' },
      });
    }
    return res.json({ success: true, data: result, message: 'Order deleted successfully from Google Sheets' });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: { code: 'DELETE_FAILED', message: err.message },
    });
  }
});

// ================= MARKETING CRUD =================

router.get('/marketing', requireAuth, async (req: Request, res: Response) => {
  const correlationId = (req as any).correlationId;
  try {
    const fresh = req.query.fresh === 'true';
    const marketing = await db.getMarketing(fresh, correlationId);
    return res.json({ success: true, data: marketing });
  } catch (err: any) {
    return res.status(503).json({ success: false, error: { code: 'DATABASE_ERROR', message: err.message } });
  }
});

router.post('/marketing', requireAuth, async (req: Request, res: Response) => {
  const correlationId = (req as any).correlationId;
  try {
    const { month } = req.body;
    if (!month) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Month is required' },
      });
    }

    const record = await db.createMarketing(req.body, correlationId);
    return res.status(201).json({
      success: true,
      data: record,
      message: 'Marketing record persisted to Google Sheets',
    });
  } catch (err: any) {
    return res.status(400).json({
      success: false,
      error: { code: 'CREATE_FAILED', message: err.message },
    });
  }
});

router.put('/marketing/:id', requireAuth, async (req: Request, res: Response) => {
  const correlationId = (req as any).correlationId;
  try {
    const updated = await db.updateMarketing(req.params.id, req.body, correlationId);
    if (!updated) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Marketing record not found' },
      });
    }
    return res.json({ success: true, data: updated, message: 'Marketing record updated in Google Sheets' });
  } catch (err: any) {
    return res.status(400).json({
      success: false,
      error: { code: 'UPDATE_FAILED', message: err.message },
    });
  }
});

router.delete('/marketing/:id', requireAuth, async (req: Request, res: Response) => {
  const correlationId = (req as any).correlationId;
  try {
    const result = await db.deleteMarketing(req.params.id, correlationId);
    if (!result) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Marketing record not found' },
      });
    }
    return res.json({ success: true, data: result, message: 'Marketing record deleted from Google Sheets' });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: { code: 'DELETE_FAILED', message: err.message },
    });
  }
});

// ================= TARGETS CRUD =================

router.get('/targets', requireAuth, async (req: Request, res: Response) => {
  const correlationId = (req as any).correlationId;
  try {
    const fresh = req.query.fresh === 'true';
    const targets = await db.getTargets(fresh, correlationId);
    return res.json({ success: true, data: targets });
  } catch (err: any) {
    return res.status(503).json({ success: false, error: { code: 'DATABASE_ERROR', message: err.message } });
  }
});

router.post('/targets', requireAuth, async (req: Request, res: Response) => {
  const correlationId = (req as any).correlationId;
  try {
    const { month, sales_target } = req.body;
    if (!month || sales_target === undefined) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Month and sales target are required' },
      });
    }

    const target = await db.createTarget(req.body, correlationId);
    return res.status(201).json({
      success: true,
      data: target,
      message: 'Target persisted to Google Sheets',
    });
  } catch (err: any) {
    return res.status(400).json({
      success: false,
      error: { code: 'CREATE_FAILED', message: err.message },
    });
  }
});

router.put('/targets/:id', requireAuth, async (req: Request, res: Response) => {
  const correlationId = (req as any).correlationId;
  try {
    const updated = await db.updateTarget(req.params.id, req.body, correlationId);
    if (!updated) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Target not found' },
      });
    }
    return res.json({ success: true, data: updated, message: 'Target updated in Google Sheets' });
  } catch (err: any) {
    return res.status(400).json({
      success: false,
      error: { code: 'UPDATE_FAILED', message: err.message },
    });
  }
});

router.delete('/targets/:id', requireAuth, async (req: Request, res: Response) => {
  const correlationId = (req as any).correlationId;
  try {
    const result = await db.deleteTarget(req.params.id, correlationId);
    if (!result) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Target not found' },
      });
    }
    return res.json({ success: true, data: result, message: 'Target deleted from Google Sheets' });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: { code: 'DELETE_FAILED', message: err.message },
    });
  }
});

// ================= ANALYTICS & DASHBOARD =================

router.get('/dashboard', requireAuth, async (req: Request, res: Response) => {
  const correlationId = (req as any).correlationId;
  try {
    const month = (req.query.month as string) || new Date().toISOString().substring(0, 7);
    const all = await db.getAllAsync(false, correlationId);

    const metrics = calculateDashboardMetrics(
      month,
      all.Orders,
      all.Order_Items,
      all.Products,
      all.Marketing,
      all.Targets
    );

    const productMix = calculateProductMix(all.Orders, all.Order_Items, all.Products, month);

    return res.json({
      success: true,
      data: {
        metrics,
        productMix,
      },
    });
  } catch (err: any) {
    return res.status(503).json({
      success: false,
      error: {
        code: err.code || 'DATABASE_UNAVAILABLE',
        message: err.message || 'Google Sheets database unavailable',
        isAuthError: Boolean(err.isAuthError),
      },
    });
  }
});

router.get('/performance', requireAuth, async (req: Request, res: Response) => {
  const correlationId = (req as any).correlationId;
  try {
    const year = (req.query.year as string) || '';
    const all = await db.getAllAsync(false, correlationId);

    const performance = calculateMonthlyPerformance(
      all.Orders,
      all.Order_Items,
      all.Products,
      all.Marketing,
      all.Targets,
      year
    );

    return res.json({ success: true, data: performance });
  } catch (err: any) {
    return res.status(503).json({
      success: false,
      error: {
        code: err.code || 'DATABASE_UNAVAILABLE',
        message: err.message || 'Google Sheets database unavailable',
        isAuthError: Boolean(err.isAuthError),
      },
    });
  }
});

// ================= SETTINGS & GOOGLE SHEETS =================

router.get('/settings', requireAuth, async (req: Request, res: Response) => {
  const correlationId = (req as any).correlationId;
  try {
    const settings = await db.getSettings(correlationId);
    const syncMeta = getSyncMetadata();

    return res.json({
      success: true,
      data: {
        settings,
        googleSheetsIntegration: syncMeta,
      },
    });
  } catch (err: any) {
    const syncMeta = getSyncMetadata();
    return res.json({
      success: true,
      data: {
        settings: [],
        googleSheetsIntegration: syncMeta,
      },
    });
  }
});

router.get('/sync/status', requireAuth, (req: Request, res: Response) => {
  const syncMeta = getSyncMetadata();
  return res.json({
    success: true,
    data: syncMeta,
  });
});

router.post('/sync/test-connection', requireAuth, async (req: Request, res: Response) => {
  const correlationId = (req as any).correlationId;
  try {
    const result = await callGoogleAppsScript('ping', undefined, undefined, undefined, correlationId);
    if (!result.connected) {
      return res.status(result.httpStatus === 401 ? 401 : 400).json({
        success: false,
        error: {
          code: result.error || 'CONNECTION_TEST_FAILED',
          message: result.message || 'Connection test failed',
          isAuthError: Boolean(result.isAuthError),
        },
      });
    }

    return res.json({
      success: true,
      data: result.result,
      message: result.message || 'Google Apps Script connection verified successfully!',
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: { code: 'CONNECTION_ERROR', message: err.message },
    });
  }
});

router.post('/sync/pull-from-sheets', requireAuth, async (req: Request, res: Response) => {
  const correlationId = (req as any).correlationId;
  try {
    const result = await db.pullAllFromSheets(correlationId);
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'PULL_FAILED',
          message: result.message || 'Failed to pull from Google Sheets',
        },
      });
    }

    const all = await db.getAllAsync(false, correlationId);
    return res.json({
      success: true,
      data: all,
      message: 'Successfully pulled latest records from Google Sheets',
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: { code: 'PULL_ERROR', message: err.message },
    });
  }
});

export default router;
