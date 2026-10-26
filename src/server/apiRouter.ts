import { Router, Request, Response } from 'express';
import {
  getAllRecords,
  getRecordById,
  saveRecord,
  deleteRecordById,
  clearAllRecords,
  resolvePublicOrigin,
} from './storage.js';

export const apiRouter = Router();

// Ensure all responses are JSON
apiRouter.use((req, res, next) => {
  res.setHeader('Content-Type', 'application/json');
  next();
});

// GET /api/config - Returns configuration and resolved public origin
apiRouter.get('/config', (req: Request, res: Response) => {
  const hostHeader = (req.headers['x-forwarded-host'] as string) || req.headers.host;
  const protoHeader = (req.headers['x-forwarded-proto'] as string);
  const publicOrigin = resolvePublicOrigin(hostHeader, protoHeader);

  res.json({
    publicOrigin,
    isProduction: process.env.NODE_ENV === 'production',
  });
});

// GET /api/records - List all records
apiRouter.get('/records', (req: Request, res: Response) => {
  const records = getAllRecords();
  res.json({ records });
});

// POST /api/records - Create a new record
apiRouter.post('/records', (req: Request, res: Response) => {
  const { text, id: customId } = req.body || {};

  if (!text || typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ error: 'Text content is required' });
  }

  const record = saveRecord(text, customId);

  const hostHeader = (req.headers['x-forwarded-host'] as string) || req.headers.host;
  const protoHeader = (req.headers['x-forwarded-proto'] as string);
  const publicOrigin = resolvePublicOrigin(hostHeader, protoHeader);

  const publicUrl = publicOrigin ? `${publicOrigin}/view/${record.id}` : '';

  res.status(201).json({
    ...record,
    publicUrl,
  });
});

// GET /api/records/:id - Fetch single record and increment scan count
apiRouter.get('/records/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  if (!id) {
    return res.status(400).json({ error: 'Missing record identifier' });
  }

  const record = getRecordById(id);
  if (!record) {
    return res.status(404).json({ error: 'Text record not found' });
  }

  res.json(record);
});

// DELETE /api/records/:id - Delete single record
apiRouter.delete('/records/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const deleted = deleteRecordById(id);

  if (!deleted) {
    return res.status(404).json({ error: 'Record not found' });
  }

  res.json({ success: true, message: 'Record deleted' });
});

// DELETE /api/records - Clear all records
apiRouter.delete('/records', (req: Request, res: Response) => {
  clearAllRecords();
  res.json({ success: true, message: 'All records cleared' });
});

// Catch-all inside /api so no unmatched API call ever falls through to HTML index.html
apiRouter.all('*', (req: Request, res: Response) => {
  res.status(404).json({ error: 'API endpoint not found' });
});
