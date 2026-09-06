/**
 * Structured Server-Side Logger
 * 
 * Complies with strict security rules:
 * Never logs passwords, secrets, tokens, hashes, or credentials.
 */

export function sanitizeData(data: any): any {
  if (!data) return data;
  if (typeof data !== 'object') {
    if (typeof data === 'string' && (data.includes('<!DOCTYPE') || data.includes('<html'))) {
      return `[HTML Content - length: ${data.length}]`;
    }
    return data;
  }

  if (Array.isArray(data)) {
    return data.slice(0, 5).map(sanitizeData);
  }

  const sanitized: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase();
    if (
      lowerKey.includes('password') ||
      lowerKey.includes('secret') ||
      lowerKey.includes('token') ||
      lowerKey.includes('hash') ||
      lowerKey.includes('auth') ||
      lowerKey.includes('credential') ||
      lowerKey.includes('cookie') ||
      lowerKey.includes('key')
    ) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeData(value);
    } else if (typeof value === 'string' && (value.includes('<!DOCTYPE') || value.includes('<html'))) {
      sanitized[key] = `[HTML Document - length: ${value.length}]`;
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

export interface LogEntry {
  type: 'REQUEST' | 'RESPONSE' | 'DOWNSTREAM_APPS_SCRIPT' | 'VALIDATION' | 'INFO' | 'ERROR' | 'CRUD_OPERATION';
  correlationId?: string;
  method?: string;
  path?: string;
  operation?: 'CREATE' | 'READ' | 'UPDATE' | 'DELETE' | 'DEACTIVATE' | 'BATCH_SYNC';
  table?: string;
  recordId?: string;
  target?: 'GOOGLE_SHEETS' | 'LOCAL_STORE';
  statusCode?: number;
  validationResult?: 'VALID' | 'INVALID';
  downstreamStatus?: number | string;
  sanitizedResponse?: any;
  message?: string;
  durationMs?: number;
}

export function logCrudOperation(params: {
  correlationId?: string;
  operation: 'CREATE' | 'READ' | 'UPDATE' | 'DELETE' | 'DEACTIVATE' | 'BATCH_SYNC';
  table: string;
  recordId?: string;
  target: 'GOOGLE_SHEETS' | 'LOCAL_STORE';
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
  durationMs?: number;
  message?: string;
}) {
  const prefix = `[PERSISTENCE TARGET: ${params.target}]`;
  console.log(`${prefix} Operation: ${params.operation} | Table: ${params.table} | Record ID: ${params.recordId || 'N/A'} | Status: ${params.status}${params.durationMs !== undefined ? ` | Duration: ${params.durationMs}ms` : ''}`);
  
  logStructured({
    type: 'CRUD_OPERATION',
    correlationId: params.correlationId,
    operation: params.operation,
    table: params.table,
    recordId: params.recordId,
    target: params.target,
    message: params.message || `${params.operation} on ${params.table} (${params.status})`,
    durationMs: params.durationMs,
  });
}

export function logStructured(entry: LogEntry) {
  const timestamp = new Date().toISOString();
  const logObj = {
    timestamp,
    ...entry,
    sanitizedResponse: entry.sanitizedResponse !== undefined ? sanitizeData(entry.sanitizedResponse) : undefined,
  };
  console.log(`[PROHOME_LOG] ${JSON.stringify(logObj)}`);
}
