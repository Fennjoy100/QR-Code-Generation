export interface QrRecord {
  id: string;
  text: string;
  createdAt: string;
  views?: number;
}

export interface QrHistoryItem {
  id: string;
  text: string;
  createdAt: string;
  url: string;
  qrPngUrl?: string;
  qrSvgString?: string;
}
