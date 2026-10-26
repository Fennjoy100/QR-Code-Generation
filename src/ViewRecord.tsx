import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  QrCode,
  Copy,
  Check,
  ExternalLink,
  Calendar,
  Eye,
  FileText,
  AlertTriangle,
  ArrowLeft,
  Share2,
  Sparkles,
} from 'lucide-react';
import { QrRecord } from './types';

export default function ViewRecord() {
  const { id } = useParams<{ id: string }>();
  const [record, setRecord] = useState<QrRecord | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [linkCopied, setLinkCopied] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;

    async function fetchRecord() {
      if (!id || typeof id !== 'string' || !id.trim()) {
        if (isMounted) {
          setError('No QR record identifier provided.');
          setLoading(false);
        }
        return;
      }

      const cleanId = id.trim();
      setLoading(true);
      setError(null);

      // Helper to check localStorage backup
      const checkLocalBackup = (): QrRecord | null => {
        try {
          const localHistory = localStorage.getItem('quickqr_history');
          if (localHistory) {
            const parsed = JSON.parse(localHistory);
            if (Array.isArray(parsed)) {
              const found = parsed.find((item: { id: string }) => item.id === cleanId);
              if (found && found.text) {
                return {
                  id: found.id,
                  text: found.text,
                  createdAt: found.createdAt || new Date().toISOString(),
                  views: 1,
                };
              }
            }
          }
        } catch {
          // Ignore localStorage parsing issues
        }
        return null;
      };

      try {
        const response = await fetch(`/api/records/${encodeURIComponent(cleanId)}`);
        const contentType = response.headers.get('content-type') || '';

        // Safe JSON parsing: Never call .json() directly if content-type is HTML
        let data: any = null;
        if (contentType.includes('application/json')) {
          try {
            data = await response.json();
          } catch {
            data = null;
          }
        }

        // If response is successful and valid record object returned
        if (response.ok && data && typeof data.text === 'string') {
          if (isMounted) {
            setRecord(data);
            setLoading(false);
          }
          return;
        }

        // If record not found on server, check local history before showing error
        const localRecord = checkLocalBackup();
        if (localRecord && isMounted) {
          setRecord(localRecord);
          setLoading(false);
          return;
        }

        // Server returned an error or non-JSON response
        if (isMounted) {
          const friendlyMessage =
            data && typeof data.error === 'string'
              ? data.error
              : 'This QR code record does not exist or may have been deleted.';
          setError(friendlyMessage);
          setLoading(false);
        }
      } catch {
        // Network or connection failure: check local backup
        const localRecord = checkLocalBackup();
        if (localRecord && isMounted) {
          setRecord(localRecord);
        } else if (isMounted) {
          setError('This QR code record does not exist or may have been deleted.');
        }
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    fetchRecord();

    return () => {
      isMounted = false;
    };
  }, [id]);

  const handleCopyText = async () => {
    if (!record?.text) return;
    try {
      await navigator.clipboard.writeText(record.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
      const textArea = document.createElement('textarea');
      textArea.value = record.text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2500);
    } catch {
      setLinkCopied(false);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Recently';
    try {
      const d = new Date(dateString);
      return new Intl.DateTimeFormat('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(d);
    } catch {
      return dateString;
    }
  };

  const isUrl = (val: string): boolean => {
    const trimmed = val.trim();
    return /^https?:\/\/[^\s$.?#].[^\s]*$/i.test(trimmed);
  };

  const getStats = (content: string) => {
    const charCount = content.length;
    const words = content.trim() ? content.trim().split(/\s+/).length : 0;
    const lines = content.split('\n').length;
    return { charCount, words, lines };
  };

  return (
    <div className="min-h-screen bg-slate-50/80 text-slate-900 flex flex-col font-sans selection:bg-indigo-100 selection:text-indigo-900">
      {/* Top Header */}
      <header className="w-full border-b border-slate-200/80 bg-white sticky top-0 z-20 shadow-xs backdrop-blur-md bg-white/95">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link
            to="/"
            className="flex items-center gap-2.5 group hover:opacity-90 transition-opacity"
            title="Go to QuickQR Homepage"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-sm shadow-indigo-500/20 group-hover:scale-105 transition-transform">
              <QrCode className="w-5 h-5" />
            </div>
            <div className="flex flex-col">
              <span className="font-extrabold text-xl tracking-tight text-slate-900 leading-tight">
                QuickQR
              </span>
              <span className="text-[11px] text-slate-500 font-medium -mt-0.5">
                Scan Result
              </span>
            </div>
          </Link>

          <Link
            to="/"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs sm:text-sm font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 active:bg-indigo-200 rounded-lg transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Create QR Code</span>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-12 flex flex-col justify-center">
        {loading ? (
          <div className="w-full bg-white rounded-2xl border border-slate-200/80 shadow-sm p-10 sm:p-14 text-center flex flex-col items-center">
            <div className="w-12 h-12 rounded-full border-4 border-indigo-200 border-t-indigo-600 animate-spin mb-4" />
            <h2 className="text-xl font-bold text-slate-800">Loading Scanned Content...</h2>
            <p className="text-sm text-slate-500 mt-1">Retrieving verified QR record</p>
          </div>
        ) : error || !record ? (
          <div className="w-full bg-white rounded-2xl border border-slate-200/80 shadow-sm p-8 sm:p-12 text-center flex flex-col items-center">
            <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200/60 flex items-center justify-center text-amber-600 mb-5 shadow-xs">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
              Text Record Not Found
            </h2>
            <p className="mt-2 text-base text-slate-600 max-w-md">
              {error || 'This QR code record does not exist or may have been deleted.'}
            </p>

            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <Link
                to="/"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-xl shadow-sm transition-all"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Go to QuickQR Generator</span>
              </Link>
            </div>
          </div>
        ) : (
          <div className="w-full flex flex-col gap-5">
            {/* Scanned Badge & Metadata Banner */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-white/80 border border-slate-200/70 rounded-xl px-4 py-3 shadow-2xs backdrop-blur-xs">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>Verified Record</span>
                </span>
                <span className="text-xs text-slate-500 font-mono hidden sm:inline">
                  ID: #{record.id}
                </span>
              </div>

              <div className="flex items-center gap-3 text-xs text-slate-500">
                <span className="inline-flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>{formatDate(record.createdAt)}</span>
                </span>
                {typeof record.views === 'number' && (
                  <span className="inline-flex items-center gap-1">
                    <Eye className="w-3.5 h-3.5 text-slate-400" />
                    <span>{record.views} {record.views === 1 ? 'scan' : 'scans'}</span>
                  </span>
                )}
              </div>
            </div>

            {/* Main Text Content Card */}
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
              {/* Card Header with Stats and Quick Actions */}
              <div className="px-5 sm:px-7 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50">
                <div className="flex items-center gap-3 text-xs font-medium text-slate-500">
                  <span className="flex items-center gap-1">
                    <FileText className="w-3.5 h-3.5 text-indigo-500" />
                    <span className="font-semibold text-slate-700">
                      {getStats(record.text).charCount}
                    </span>{' '}
                    characters
                  </span>
                  <span>•</span>
                  <span>
                    <span className="font-semibold text-slate-700">
                      {getStats(record.text).words}
                    </span>{' '}
                    words
                  </span>
                  {getStats(record.text).lines > 1 && (
                    <>
                      <span>•</span>
                      <span>
                        <span className="font-semibold text-slate-700">
                          {getStats(record.text).lines}
                        </span>{' '}
                        lines
                      </span>
                    </>
                  )}
                </div>

                {/* Header Action Buttons */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    title="Copy webpage share link"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors cursor-pointer"
                  >
                    {linkCopied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-emerald-700 font-bold">Link Copied!</span>
                      </>
                    ) : (
                      <>
                        <Share2 className="w-3.5 h-3.5 text-slate-500" />
                        <span>Share Link</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleCopyText}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer shadow-2xs ${
                      copied
                        ? 'bg-emerald-600 text-white'
                        : 'bg-indigo-600 text-white hover:bg-indigo-700 active:scale-[0.98]'
                    }`}
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                        <span>Copied Text!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy Text</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Text Body - Exact Whitespace & Break Preservation */}
              <div className="p-6 sm:p-8">
                <div className="p-5 sm:p-6 bg-slate-50/70 border border-slate-200/80 rounded-xl">
                  <div className="font-sans text-base sm:text-lg text-slate-800 leading-relaxed whitespace-pre-wrap break-words select-text">
                    {record.text}
                  </div>
                </div>

                {/* If the content is a web link, provide direct action */}
                {isUrl(record.text) && (
                  <div className="mt-5 p-4 rounded-xl bg-blue-50/70 border border-blue-200/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="text-xs sm:text-sm text-blue-900 font-medium">
                      This content appears to be a web URL.
                    </div>
                    <a
                      href={record.text.trim()}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-2xs transition-colors shrink-0"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Open Website</span>
                    </a>
                  </div>
                )}

                {/* Bottom Card Footer Actions */}
                <div className="mt-6 pt-5 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <button
                    type="button"
                    onClick={handleCopyText}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 rounded-xl transition-colors cursor-pointer"
                  >
                    {copied ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-600" />
                        <span className="text-emerald-700">Copied to Clipboard!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 text-slate-500" />
                        <span>Copy All Text</span>
                      </>
                    )}
                  </button>

                  <Link
                    to="/"
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:via-indigo-700 hover:to-purple-700 rounded-xl shadow-xs transition-all"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>Create Your Own QR Code</span>
                  </Link>
                </div>
              </div>
            </div>

            {/* Attribution Footnote */}
            <div className="text-center text-xs text-slate-400 py-3">
              Scanned via QuickQR • Secure standalone text tracking page
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
