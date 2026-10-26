import { resolvePublicOrigin } from '../src/server/storage.js';

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
    const hostHeader = (req.headers['x-forwarded-host'] as string) || req.headers.host;
    const protoHeader = (req.headers['x-forwarded-proto'] as string);
    const publicOrigin = resolvePublicOrigin(hostHeader, protoHeader);

    return sendJson(res, 200, {
      publicOrigin,
      isProduction: process.env.NODE_ENV === 'production',
    });
  }

  return sendJson(res, 405, { error: 'Method not allowed' });
}
