import { getRecordById, deleteRecordById } from '../../src/server/storage.js';

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

  // Extract ID from query param (Vercel automatic parameter) or URL
  let id = req.query?.id as string;
  if (!id && req.url) {
    const parts = req.url.split('?')[0].split('/');
    id = parts[parts.length - 1];
  }

  if (!id) {
    return sendJson(res, 400, { error: 'Missing record identifier' });
  }

  if (req.method === 'GET') {
    const record = getRecordById(id);
    if (!record) {
      return sendJson(res, 404, { error: 'Text record not found' });
    }
    return sendJson(res, 200, record);
  }

  if (req.method === 'DELETE') {
    const deleted = deleteRecordById(id);
    if (!deleted) {
      return sendJson(res, 404, { error: 'Record not found' });
    }
    return sendJson(res, 200, { success: true, message: 'Record deleted' });
  }

  return sendJson(res, 405, { error: 'Method not allowed' });
}
