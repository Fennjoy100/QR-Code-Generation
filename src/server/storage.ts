import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

export interface QrRecord {
  id: string;
  text: string;
  createdAt: string;
  views: number;
}

// In-memory cache for ultra-fast, zero-failure access across serverless cold starts / reads
let inMemoryRecords: QrRecord[] | null = null;

// Determine writable data directory
function getDataPaths() {
  let primaryDir: string;
  let primaryFile: string;

  try {
    primaryDir = path.resolve(process.cwd(), 'data');
    primaryFile = path.join(primaryDir, 'records.json');
  } catch {
    primaryDir = path.join('/tmp', 'quickqr_data');
    primaryFile = path.join(primaryDir, 'records.json');
  }

  const fallbackDir = path.join('/tmp', 'quickqr_data');
  const fallbackFile = path.join(fallbackDir, 'records.json');

  return { primaryDir, primaryFile, fallbackDir, fallbackFile };
}

function ensureDirectoryExists(dirPath: string) {
  try {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
    return true;
  } catch (err) {
    return false;
  }
}

export function readRecords(): QrRecord[] {
  if (inMemoryRecords !== null) {
    return inMemoryRecords;
  }

  const { primaryDir, primaryFile, fallbackDir, fallbackFile } = getDataPaths();

  // Try reading from primary location
  try {
    ensureDirectoryExists(primaryDir);
    if (fs.existsSync(primaryFile)) {
      const data = fs.readFileSync(primaryFile, 'utf-8');
      inMemoryRecords = JSON.parse(data);
      if (Array.isArray(inMemoryRecords)) {
        return inMemoryRecords;
      }
    }
  } catch (err) {
    console.warn('Could not read from primary records file, trying fallback:', err);
  }

  // Try reading from fallback (/tmp)
  try {
    ensureDirectoryExists(fallbackDir);
    if (fs.existsSync(fallbackFile)) {
      const data = fs.readFileSync(fallbackFile, 'utf-8');
      inMemoryRecords = JSON.parse(data);
      if (Array.isArray(inMemoryRecords)) {
        return inMemoryRecords;
      }
    }
  } catch (fallbackErr) {
    console.warn('Could not read from fallback records file:', fallbackErr);
  }

  inMemoryRecords = [];
  return inMemoryRecords;
}

export function writeRecords(records: QrRecord[]) {
  inMemoryRecords = records;
  const { primaryDir, primaryFile, fallbackDir, fallbackFile } = getDataPaths();
  const serialized = JSON.stringify(records, null, 2);

  let saved = false;

  // Attempt to write to primary file
  try {
    if (ensureDirectoryExists(primaryDir)) {
      fs.writeFileSync(primaryFile, serialized, 'utf-8');
      saved = true;
    }
  } catch (err) {
    console.warn('Failed to write to primary data path, falling back to /tmp:', err);
  }

  // Always attempt to save to /tmp as redundant backup for serverless environments
  try {
    if (ensureDirectoryExists(fallbackDir)) {
      fs.writeFileSync(fallbackFile, serialized, 'utf-8');
      saved = true;
    }
  } catch (err) {
    if (!saved) {
      console.error('Failed to write records to /tmp backup:', err);
    }
  }
}

export function generateUniqueId(): string {
  // 8 random alphanumeric characters (e.g., 'k8m2p9w4')
  return crypto.randomBytes(4).toString('hex');
}

export function getAllRecords(): QrRecord[] {
  return readRecords();
}

export function getRecordById(id: string): QrRecord | null {
  const records = readRecords();
  const index = records.findIndex((r) => r.id === id);
  if (index === -1) {
    return null;
  }

  // Increment scan / view count
  records[index].views = (records[index].views || 0) + 1;
  writeRecords(records);
  return records[index];
}

export function saveRecord(text: string, customId?: string): QrRecord {
  const records = readRecords();
  const id = (customId && typeof customId === 'string' && customId.trim())
    ? customId.trim()
    : generateUniqueId();

  const now = new Date().toISOString();
  const existingIndex = records.findIndex((r) => r.id === id);

  let record: QrRecord;
  if (existingIndex >= 0) {
    record = {
      ...records[existingIndex],
      text,
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
  return record;
}

export function deleteRecordById(id: string): boolean {
  let records = readRecords();
  const initialLength = records.length;
  records = records.filter((r) => r.id !== id);

  if (records.length === initialLength) {
    return false;
  }

  writeRecords(records);
  return true;
}

export function clearAllRecords(): void {
  writeRecords([]);
}

// Detect and determine public production URL from environment or request
export function resolvePublicOrigin(hostHeader?: string, protoHeader?: string): string {
  // 1. Explicit APP_URL from Cloud Run or production deployment
  if (process.env.APP_URL && process.env.APP_URL.startsWith('http')) {
    return process.env.APP_URL.replace(/\/+$/, '');
  }

  // 2. Vercel production domain
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL.replace(/\/+$/, '')}`;
  }

  // 3. Vercel deployment URL
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL.replace(/\/+$/, '')}`;
  }

  // 4. Custom Public URL
  if (process.env.PUBLIC_URL && process.env.PUBLIC_URL.startsWith('http')) {
    return process.env.PUBLIC_URL.replace(/\/+$/, '');
  }

  // 5. Host headers (excluding localhost/127.0.0.1)
  if (hostHeader && !hostHeader.includes('localhost') && !hostHeader.includes('127.0.0.1')) {
    const proto = protoHeader || (hostHeader.includes('.run.app') || hostHeader.includes('.vercel.app') ? 'https' : 'http');
    return `${proto}://${hostHeader.replace(/\/+$/, '')}`;
  }

  // Fallback to APP_URL if exists or empty string to allow frontend to use its current window.location.origin
  return process.env.APP_URL || '';
}
