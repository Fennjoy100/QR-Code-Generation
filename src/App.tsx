import React, { useState, useEffect, useCallback } from 'react';
import QRCode from 'qrcode';
import {
  QrCode,
  Download,
  Sparkles,
  AlertCircle,
  ExternalLink,
  Copy,
  Check,
  Trash2,
  Clock,
  History,
  Eye,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { QrHistoryItem, QrRecord } from './types';

export default function App() {
  const [text, setText] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);

  // Active generated QR code details
  const [currentRecord, setCurrentRecord] = useState<QrRecord | null>(null);
  const [currentViewUrl, setCurrentViewUrl] = useState<string>('');
  const [qrPngUrl, setQrPngUrl] = useState<string>('');
  const [qrSvgString, setQrSvgString] = useState<string>('');
  const [linkCopied, setLinkCopied] = useState<boolean>(false);

  // Server-detected public origin (from Cloud Run APP_URL or Vercel environment)
  const [serverPublicOrigin, setServerPublicOrigin] = useState<string>('');

  // History state
  const [history, setHistory] = useState<QrHistoryItem[]>(() => {
    try {
      const saved = localStorage.getItem('quickqr_history');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Determine base public origin: Prioritize genuine public domain over localhost
  const getPublicOrigin = useCallback((): string => {
    // 1. If currently accessed on a real public domain in the browser (e.g. Vercel, Cloud Run, custom domain)
    const hostname = window.location.hostname;
    const isLocalhost =
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '0.0.0.0' ||
      hostname.endsWith('.local');

    if (!isLocalhost && window.location.origin.startsWith('http')) {
      return window.location.origin.replace(/\/+$/, '');
    }

    // 2. If server provided a genuine public origin (e.g. from APP_URL or Vercel)
    if (serverPublicOrigin && serverPublicOrigin.startsWith('http')) {
      return serverPublicOrigin.replace(/\/+$/, '');
    }

    // 3. If VITE_PUBLIC_URL environment variable is provided
    const envUrl = import.meta.env.VITE_PUBLIC_URL;
    if (envUrl && typeof envUrl === 'string' && envUrl.startsWith('http')) {
      return envUrl.replace(/\/+$/, '');
    }

    // 4. Fallback to current window.location.origin
    return window.location.origin;
  }, [serverPublicOrigin]);

  // Fetch server config and sync history from server on mount
  useEffect(() => {
    async function initServerData() {
      // 1. Fetch server config to obtain genuine public URL
      try {
        const configRes = await fetch('/api/config');
        if (configRes.ok) {
          const configContentType = configRes.headers.get('content-type') || '';
          if (configContentType.includes('application/json')) {
            const configData = await configRes.json();
            if (configData.publicOrigin && typeof configData.publicOrigin === 'string') {
              setServerPublicOrigin(configData.publicOrigin);
            }
          }
        }
      } catch (err) {
        console.warn('Could not fetch server config:', err);
      }

      // 2. Sync records from server
      try {
        const res = await fetch('/api/records');
        if (res.ok) {
          const contentType = res.headers.get('content-type') || '';
          if (contentType.includes('application/json')) {
            const data = await res.json();
            if (Array.isArray(data.records) && data.records.length > 0) {
              setHistory((prev) => {
                const existingIds = new Set(prev.map((item) => item.id));
                const newItems: QrHistoryItem[] = [];

                for (const r of data.records) {
                  if (!existingIds.has(r.id)) {
                    newItems.push({
                      id: r.id,
                      text: r.text,
                      createdAt: r.createdAt,
                      url: `${getPublicOrigin()}/view/${r.id}`,
                    });
                  }
                }

                if (newItems.length > 0) {
                  const merged = [...newItems, ...prev];
                  localStorage.setItem('quickqr_history', JSON.stringify(merged));
                  return merged;
                }
                return prev;
              });
            }
          }
        }
      } catch (err) {
        console.warn('Failed to sync history from server:', err);
      }
    }

    initServerData();
  }, [getPublicOrigin]);

  // Save history to localStorage
  const updateHistory = (newHistory: QrHistoryItem[]) => {
    setHistory(newHistory);
    try {
      localStorage.setItem('quickqr_history', JSON.stringify(newHistory));
    } catch (e) {
      console.error('Failed to save to localStorage:', e);
    }
  };

  const handleGenerate = async () => {
    if (!text.trim()) {
      setError('Please enter some text before generating a QR code.');
      return;
    }

    try {
      setIsGenerating(true);
      setError(null);

      // 1. Save text record to backend
      let recordId = '';
      let createdAt = new Date().toISOString();
      let trackingUrl = '';

      try {
        const response = await fetch('/api/records', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text }),
        });

        const contentType = response.headers.get('content-type') || '';
        if (response.ok && contentType.includes('application/json')) {
          const data = await response.json();
          recordId = data.id;
          createdAt = data.createdAt || createdAt;
          if (data.publicUrl && typeof data.publicUrl === 'string' && data.publicUrl.startsWith('http')) {
            // If the server provided a public URL, verify it's not localhost
            if (!data.publicUrl.includes('localhost') && !data.publicUrl.includes('127.0.0.1')) {
              trackingUrl = data.publicUrl;
            }
          }
        } else {
          throw new Error('Server returned invalid response');
        }
      } catch (backendErr) {
        console.warn('Backend save fallback to local generation:', backendErr);
        // Fallback: generate local ID
        recordId = Math.random().toString(36).substring(2, 10);
      }

      // 2. Generate the dedicated scanning target URL (Guaranteed non-localhost in production)
      if (!trackingUrl) {
        const baseOrigin = getPublicOrigin();
        trackingUrl = `${baseOrigin}/view/${recordId}`;
      }

      // 3. Generate crisp high-resolution PNG (1024x1024) of the dedicated URL
      const pngUrl = await QRCode.toDataURL(trackingUrl, {
        width: 1024,
        margin: 2,
        errorCorrectionLevel: 'M',
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
      });

      // 4. Generate scalable vector SVG string of the dedicated URL
      const svgString = await QRCode.toString(trackingUrl, {
        type: 'svg',
        margin: 2,
        errorCorrectionLevel: 'M',
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
      });

      const newRecord: QrRecord = {
        id: recordId,
        text,
        createdAt,
        views: 0,
      };

      setCurrentRecord(newRecord);
      setCurrentViewUrl(trackingUrl);
      setQrPngUrl(pngUrl);
      setQrSvgString(svgString);

      // 5. Update history
      const newHistoryItem: QrHistoryItem = {
        id: recordId,
        text,
        createdAt,
        url: trackingUrl,
        qrPngUrl: pngUrl,
        qrSvgString: svgString,
      };

      const updated = [newHistoryItem, ...history.filter((h) => h.id !== recordId)];
      updateHistory(updated);
    } catch (err) {
      console.error('Failed to generate QR code:', err);
      setError('An error occurred while generating the QR code. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadPNG = (customPngUrl?: string, customId?: string) => {
    const url = customPngUrl || qrPngUrl;
    if (!url) return;
    const link = document.createElement('a');
    link.href = url;
    link.download = `quickqr-${customId || currentRecord?.id || 'code'}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadSVG = (customSvg?: string, customId?: string) => {
    const svg = customSvg || qrSvgString;
    if (!svg) return;
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `quickqr-${customId || currentRecord?.id || 'code'}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleCopyViewLink = async (urlToCopy?: string) => {
    const target = urlToCopy || currentViewUrl;
    if (!target) return;
    try {
      await navigator.clipboard.writeText(target);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2200);
    } catch {
      setLinkCopied(false);
    }
  };

  const handleDeleteItem = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      await fetch(`/api/records/${encodeURIComponent(id)}`, { method: 'DELETE' });
    } catch (err) {
      console.warn('Backend delete error:', err);
    }

    const updated = history.filter((item) => item.id !== id);
    updateHistory(updated);

    if (currentRecord?.id === id) {
      setCurrentRecord(null);
      setCurrentViewUrl('');
      setQrPngUrl('');
      setQrSvgString('');
    }
  };

  const handleClearAllHistory = async () => {
    if (history.length === 0) return;
    if (!window.confirm('Are you sure you want to delete all QR code history?')) {
      return;
    }

    try {
      await fetch('/api/records', { method: 'DELETE' });
    } catch (err) {
      console.warn('Backend clear error:', err);
    }

    updateHistory([]);
    setCurrentRecord(null);
    setCurrentViewUrl('');
    setQrPngUrl('');
    setQrSvgString('');
  };

  const handleSelectHistoryItem = async (item: QrHistoryItem) => {
    setText(item.text);
    setCurrentRecord({
      id: item.id,
      text: item.text,
      createdAt: item.createdAt,
    });
    setCurrentViewUrl(item.url);

    // If cached png exists use it, otherwise re-render
    if (item.qrPngUrl && item.qrSvgString) {
      setQrPngUrl(item.qrPngUrl);
      setQrSvgString(item.qrSvgString);
    } else {
      try {
        const png = await QRCode.toDataURL(item.url, {
          width: 1024,
          margin: 2,
          errorCorrectionLevel: 'M',
          color: { dark: '#0f172a', light: '#ffffff' },
        });
        const svg = await QRCode.toString(item.url, {
          type: 'svg',
          margin: 2,
          errorCorrectionLevel: 'M',
          color: { dark: '#0f172a', light: '#ffffff' },
        });
        setQrPngUrl(png);
        setQrSvgString(svg);
      } catch (e) {
        console.error(e);
      }
    }

    // Scroll smoothly to preview
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(d);
    } catch {
      return isoString;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/70 text-slate-900 flex flex-col font-sans selection:bg-indigo-100 selection:text-indigo-900">
      {/* Top Header / Brand Bar */}
      <header className="w-full border-b border-slate-200/80 bg-white sticky top-0 z-20 shadow-xs">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-sm shadow-indigo-500/20">
              <QrCode className="w-5 h-5" />
            </div>
            <span className="font-extrabold text-xl tracking-tight text-slate-900">
              QuickQR
            </span>
          </div>

          {history.length > 0 && (
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 bg-slate-100 px-3 py-1.5 rounded-full">
              <History className="w-3.5 h-3.5 text-indigo-600" />
              <span>{history.length} Saved</span>
            </div>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 py-10 sm:py-14 flex flex-col items-center">
        {/* Heading & Subtitle */}
        <div className="text-center max-w-xl mx-auto mb-8 sm:mb-10">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight">
            Turn Any Text into a{' '}
            <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
              QR Code
            </span>
          </h1>
          <p className="mt-3 text-base sm:text-lg text-slate-600 leading-relaxed">
            Convert your text into a scannable QR code in seconds.
          </p>
        </div>

        {/* Input Card */}
        <div className="w-full bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 sm:p-8">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label
                htmlFor="user-text-input"
                className="block text-sm font-semibold text-slate-800"
              >
                Your Text
              </label>
              {text.length > 0 && (
                <span className="text-xs text-slate-500 font-medium">
                  {text.length} characters
                </span>
              )}
            </div>

            <textarea
              id="user-text-input"
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                if (error) setError(null);
              }}
              placeholder="Enter anything here..."
              rows={5}
              className={`w-full px-4 py-3.5 text-base text-slate-900 bg-slate-50/60 border rounded-xl placeholder:text-slate-400 focus:outline-none focus:bg-white transition-all duration-200 resize-y min-h-[140px] font-sans ${
                error
                  ? 'border-red-400 focus:ring-2 focus:ring-red-200 focus:border-red-500'
                  : 'border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600'
              }`}
            />

            {error && (
              <div className="mt-2.5 flex items-center gap-2 text-sm text-red-600 font-medium">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </div>

          <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
            <span className="text-xs text-slate-400">
              Scanned QR codes open a dedicated, beautifully formatted webpage.
            </span>
            <button
              type="button"
              onClick={handleGenerate}
              disabled={isGenerating}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 text-base font-semibold text-white bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:via-indigo-700 hover:to-purple-700 rounded-xl shadow-md shadow-indigo-500/20 hover:shadow-lg hover:shadow-indigo-500/30 active:scale-[0.99] transition-all duration-150 cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed shrink-0"
            >
              <Sparkles className="w-5 h-5" />
              <span>{isGenerating ? 'Generating...' : 'Generate QR Code'}</span>
            </button>
          </div>
        </div>

        {/* Generated QR Code Preview Card */}
        {currentRecord && qrPngUrl && (
          <div className="mt-8 w-full bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 sm:p-8 flex flex-col items-center">
            {/* Header info */}
            <div className="w-full flex items-center justify-between border-b border-slate-100 pb-4 mb-6">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs sm:text-sm font-semibold text-slate-700">
                  QR Code Ready
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  #{currentRecord.id}
                </span>
              </div>

              <span className="text-xs text-slate-500">
                Created {formatDate(currentRecord.createdAt)}
              </span>
            </div>

            {/* Centered QR code with white space */}
            <div className="p-4 sm:p-5 bg-white rounded-2xl border-2 border-slate-100 shadow-sm flex items-center justify-center group relative">
              <img
                src={qrPngUrl}
                alt="Generated QR Code"
                className="w-56 h-56 sm:w-64 sm:h-64 object-contain rounded-lg"
              />
            </div>

            {/* Live Scan Target Webpage Bar */}
            <div className="mt-6 w-full max-w-lg bg-slate-50 border border-slate-200 rounded-xl p-3 sm:p-3.5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 truncate w-full sm:w-auto">
                <span className="text-slate-500 font-medium shrink-0">Scans open:</span>
                <span className="font-mono text-indigo-700 font-semibold truncate select-all">
                  {currentViewUrl}
                </span>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => handleCopyViewLink()}
                  className="px-2.5 py-1.5 rounded-md bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 font-medium transition-colors flex items-center gap-1 cursor-pointer"
                  title="Copy link"
                >
                  {linkCopied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-700 font-semibold">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Link</span>
                    </>
                  )}
                </button>

                <Link
                  to={`/view/${currentRecord.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-1.5 rounded-md bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 font-semibold transition-colors flex items-center gap-1"
                  title="Test scan page"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Preview Page</span>
                  <ExternalLink className="w-3 h-3 opacity-60" />
                </Link>
              </div>
            </div>

            {/* Download Buttons */}
            <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3 w-full max-w-md">
              <button
                type="button"
                onClick={() => handleDownloadPNG()}
                className="w-full sm:w-1/2 inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] rounded-xl shadow-sm hover:shadow transition-all duration-150 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Download QR Code (PNG)</span>
              </button>

              <button
                type="button"
                onClick={() => handleDownloadSVG()}
                className="w-full sm:w-1/2 inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 active:scale-[0.99] border border-indigo-200 rounded-xl transition-all duration-150 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Download QR Code (SVG)</span>
              </button>
            </div>
          </div>
        )}

        {/* QR Code History Section */}
        {history.length > 0 && (
          <div className="mt-12 w-full">
            <div className="flex items-center justify-between mb-4 px-1">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-indigo-600" />
                <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                  QR Code History
                </h2>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-200/80 text-slate-700">
                  {history.length}
                </span>
              </div>

              <button
                type="button"
                onClick={handleClearAllHistory}
                className="text-xs font-medium text-red-600 hover:text-red-700 hover:underline flex items-center gap-1 cursor-pointer transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear All</span>
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3.5">
              {history.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleSelectHistoryItem(item)}
                  className={`bg-white rounded-xl border p-4 sm:p-5 shadow-xs hover:shadow-sm transition-all cursor-pointer flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                    currentRecord?.id === item.id
                      ? 'border-indigo-400 ring-1 ring-indigo-400 bg-indigo-50/20'
                      : 'border-slate-200/80 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start gap-3.5 min-w-0 flex-1">
                    <div className="w-10 h-10 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                      <QrCode className="w-5 h-5" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
                        <span className="font-mono font-semibold text-slate-700">
                          #{item.id}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-400" />
                          <span>{formatDate(item.createdAt)}</span>
                        </span>
                      </div>

                      <p className="text-sm font-medium text-slate-900 line-clamp-2 break-words">
                        {item.text}
                      </p>
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div
                    className="flex items-center gap-2 w-full sm:w-auto justify-end border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-100"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Link
                      to={`/view/${item.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
                      title="Open scan webpage in new tab"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>View Page</span>
                    </Link>

                    <button
                      type="button"
                      onClick={() => handleDownloadPNG(item.qrPngUrl, item.id)}
                      className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                      title="Download PNG"
                    >
                      <Download className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleCopyViewLink(item.url)}
                      className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                      title="Copy URL"
                    >
                      <Copy className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={(e) => handleDeleteItem(item.id, e)}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                      title="Delete QR code"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
