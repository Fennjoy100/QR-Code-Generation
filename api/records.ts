import type { IncomingMessage, ServerResponse } from 'http';
import {
  getAllRecords,
  saveRecord,
  clearAllRecords,
  resolvePublicOrigin,
} from '../src/server/storage.js';

// Helper to parse JSON body from incoming request
async function parseJsonBody(req: IncomingMessage): Promise<any> {
  if ((req as any).body) {
    return (req as any).body;
  }
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        resolve({});
      }
    });
  });
}

function sendJson(res: any, status: number, data: any) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  if (typeof res.json === 'function') {
    res.json(data);
  } else {
    res.end(JSON.stringify(data));
  }
}

export default async function handler(req: any, res: any) {
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'GET') {
    const records = getAllRecords();
    return sendJson(res, 200, { records });
  }

  if (req.method === 'POST') {
    const body = await parseJsonBody(req);
    const { text, id: customId } = body || {};

    if (!text || typeof text !== 'string' || !text.trim()) {
      return sendJson(res, 400, { error: 'Text content is required' });
    }

    const record = saveRecord(text, customId);
    const hostHeader = (req.headers['x-forwarded-host'] as string) || req.headers.host;
    const protoHeader = (req.headers['x-forwarded-proto'] as string);
    const publicOrigin = resolvePublicOrigin(hostHeader, protoHeader);
    const publicUrl = publicOrigin ? `${publicOrigin}/view/${record.id}` : '';

    return sendJson(res, 201, { ...record, publicUrl });
  }

  if (req.method === 'DELETE') {
    clearAllRecords();
    return sendJson(res, 200, { success: true, message: 'All records cleared' });
  }

  return sendJson(res, 405, { error: 'Method not allowed' });
}
