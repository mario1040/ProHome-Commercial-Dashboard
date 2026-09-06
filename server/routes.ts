import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import {
  db,
  getSyncMetadata,
  callGoogleAppsScript,
  isGoogleSheetsActive,
} from './db';
import {
  hashPassword,
  verifyPassword,
  generateToken,
  requireAuth,
  AuthenticatedRequest,
} from './auth';
import {
  calculateDashboardMetrics,
  calculateMonthlyPerformance,
  calculateProductMix,
} from '../src/calculations/businessMetrics';
import { logStructured } from './logger';

const router = Router();

// Middleware to assign correlation ID and log all requests & responses
router.use((req: Request, res: Response, next: NextFunction) => {
  const correlationId = `req_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`;
  (req as any).correlationId = correlationId;
  const startTime = Date.now();

  logStructured({
    type: 'REQUEST',
    correlationId,
    method: req.method,
    path: req.originalUrl || req.path,
    sanitizedResponse: req.body,
    message: `Incoming ${req.method} ${req.originalUrl || req.path}`,
  });

  res.on('finish', () => {
    const durationMs = Date.now() - startTime;
    logStructured({
      type: 'RESPONSE',
      correlationId,
      method: req.method,
      path: req.originalUrl || req.path,
      statusCode: res.statusCode,
      durationMs,
    });
  });

  next();
});

// Health check
router.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// ================= AUTHENTICATION =================

router.post('/auth/login', (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_CREDENTIALS', message: 'Username and password are required' },
      });
    }

    const user = db.getUserByUsername(username);
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

router.get('/auth/me', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const user = db.getUserById(req.user!.userId);
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

    const user = db.getUserById(req.user!.userId);
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

    return res.json({ success: true, message: 'Password updated successfully' });
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
    return res.status(500).json({ success: false, error: { code: 'ERROR', message: err.message } });
  }
});

router.post('/products', requireAuth, async (req: Request, res: Response) => {
  const correlationId = (req as any).correlationId;
  try {
    const { name, sku, category, selling_price } = req.body;
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
      message: isGoogleSheetsActive() ? 'Product created and persisted to Google Sheets' : 'Product created in local store',
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
      message: isGoogleSheetsActive() ? 'Product updated and persisted to Google Sheets' : 'Product updated in local store',
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
    return res.status(500).json({ success: false, error: { code: 'ERROR', message: err.message } });
  }
});

router.get('/orders/:id', requireAuth, (req: Request, res: Response) => {
  try {
    const order = db.getOrderById(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Order not found' } });
    }
    return res.json({ success: true, data: order });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: { code: 'ERROR', message: err.message } });
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
      message: isGoogleSheetsActive() ? 'Order created and persisted to Google Sheets' : 'Order created in local store',
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
      message: isGoogleSheetsActive() ? 'Order updated and persisted to Google Sheets' : 'Order updated in local store',
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
    return res.json({ success: true, data: result, message: 'Order deleted successfully' });
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
    return res.status(500).json({ success: false, error: { code: 'ERROR', message: err.message } });
  }
});

router.post('/marketing', requireAuth, async (req: Request, res: Response) => {
  const correlationId = (req as any).correlationId;
  try {
    const { month } = req.body;
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Valid month (YYYY-MM) is required' },
      });
    }

    const record = await db.createMarketing(req.body, correlationId);
    return res.status(201).json({
      success: true,
      data: record,
      message: isGoogleSheetsActive() ? 'Marketing record persisted to Google Sheets' : 'Marketing record saved in local store',
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
    return res.json({ success: true, data: updated, message: 'Marketing record updated' });
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
    return res.json({ success: true, data: result, message: 'Marketing record deleted' });
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
    return res.status(500).json({ success: false, error: { code: 'ERROR', message: err.message } });
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
      message: isGoogleSheetsActive() ? 'Target persisted to Google Sheets' : 'Target saved in local store',
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
    return res.json({ success: true, data: updated, message: 'Target updated' });
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
    return res.json({ success: true, data: result, message: 'Target deleted' });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: { code: 'DELETE_FAILED', message: err.message },
    });
  }
});

// ================= ANALYTICS & DASHBOARD =================

router.get('/dashboard', requireAuth, (req: Request, res: Response) => {
  try {
    const month = (req.query.month as string) || new Date().toISOString().substring(0, 7);
    const all = db.getAll();

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
    return res.status(500).json({ success: false, error: { code: 'ERROR', message: err.message } });
  }
});

router.get('/performance', requireAuth, (req: Request, res: Response) => {
  try {
    const year = (req.query.year as string) || '';
    const all = db.getAll();

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
    return res.status(500).json({ success: false, error: { code: 'ERROR', message: err.message } });
  }
});

// ================= SETTINGS & GOOGLE SHEETS =================

router.get('/settings', requireAuth, (req: Request, res: Response) => {
  const settings = db.getSettings();
  const syncMeta = getSyncMetadata();

  return res.json({
    success: true,
    data: {
      settings,
      googleSheetsIntegration: syncMeta,
    },
  });
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

router.post('/sync/push-to-sheets', requireAuth, async (req: Request, res: Response) => {
  const correlationId = (req as any).correlationId;
  try {
    const all = db.getAll();
    const result = await callGoogleAppsScript('batch_sync', all, undefined, undefined, correlationId);
    
    if (!result.connected) {
      return res.status(result.httpStatus === 401 ? 401 : 400).json({
        success: false,
        error: {
          code: result.error || 'SYNC_FAILED',
          message: result.message || 'Failed to reach Apps Script',
          isAuthError: Boolean(result.isAuthError),
        },
      });
    }

    return res.json({
      success: true,
      data: result.result,
      message: 'Successfully synchronized all 7 tables to Google Sheets & Drive!',
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: { code: 'SYNC_ERROR', message: err.message },
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

    return res.json({
      success: true,
      data: db.getAll(),
      message: 'Successfully pulled latest records from Google Sheets',
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: { code: 'PULL_ERROR', message: err.message },
    });
  }
});

router.post('/seed/reset', requireAuth, (req: Request, res: Response) => {
  try {
    db.resetSeed();
    return res.json({ success: true, message: 'Sample dataset reset successfully' });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: { code: 'RESET_FAILED', message: err.message } });
  }
});

export default router;
