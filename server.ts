import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' }));

// Persistent records storage
const DATA_DIR = path.resolve(__dirname, 'data');
const RECORDS_FILE = path.join(DATA_DIR, 'records.json');

interface QrRecord {
  id: string;
  text: string;
  createdAt: string;
  views: number;
}

function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(RECORDS_FILE)) {
    fs.writeFileSync(RECORDS_FILE, JSON.stringify([]), 'utf-8');
  }
}

function readRecords(): QrRecord[] {
  try {
    ensureDataFile();
    const data = fs.readFileSync(RECORDS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error reading records file:', err);
    return [];
  }
}

function writeRecords(records: QrRecord[]) {
  try {
    ensureDataFile();
    fs.writeFileSync(RECORDS_FILE, JSON.stringify(records, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing records file:', err);
  }
}

// Generate URL-friendly unique ID
function generateUniqueId(): string {
  // 8 random alphanumeric characters (e.g., 'k8m2p9w4')
  return crypto.randomBytes(4).toString('hex');
}

// API Routes
app.get('/api/records', (req: Request, res: Response) => {
  const records = readRecords();
  res.json({ records });
});

app.post('/api/records', (req: Request, res: Response) => {
  const { text, id: customId } = req.body;
  if (!text || typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ error: 'Text content is required' });
  }

  const records = readRecords();
  const id = (customId && typeof customId === 'string' && customId.trim()) 
    ? customId.trim() 
    : generateUniqueId();

  // If record already exists with this ID, update it
  const existingIndex = records.findIndex((r) => r.id === id);
  const now = new Date().toISOString();

  let record: QrRecord;
  if (existingIndex >= 0) {
    record = {
      ...records[existingIndex],
      text: text,
      createdAt: records[existingIndex].createdAt || now,
    };
    records[existingIndex] = record;
  } else {
    record = {
      id,
      text,
      createdAt: now,
      views: 0,
    };
    records.unshift(record);
  }

  writeRecords(records);
  res.status(201).json(record);
});

app.get('/api/records/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const records = readRecords();
  const recordIndex = records.findIndex((r) => r.id === id);

  if (recordIndex === -1) {
    return res.status(404).json({ error: 'Text record not found' });
  }

  // Increment view counter
  records[recordIndex].views = (records[recordIndex].views || 0) + 1;
  writeRecords(records);

  res.json(records[recordIndex]);
});

app.delete('/api/records/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  let records = readRecords();
  const initialLength = records.length;
  records = records.filter((r) => r.id !== id);

  if (records.length === initialLength) {
    return res.status(404).json({ error: 'Record not found' });
  }

  writeRecords(records);
  res.json({ success: true, message: 'Record deleted' });
});

app.delete('/api/records', (req: Request, res: Response) => {
  writeRecords([]);
  res.json({ success: true, message: 'All records cleared' });
});

// Start Vite middleware in dev or static files in prod
async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, () => {
    console.log(`QuickQR server running on port ${PORT}`);
  });
}

startServer();
