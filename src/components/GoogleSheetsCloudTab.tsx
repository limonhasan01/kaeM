import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  AlertTriangle,
  CloudUpload,
  Download,
  ExternalLink,
  FileSpreadsheet,
  FolderSearch,
  LogOut,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from 'lucide-react';
import type { MessState } from '../types/mess';
import {
  MESS_SHEET_TABS,
  buildMessWorkbookMatrices,
  extractSpreadsheetId,
  matrixToCsv,
  type MessSheetTabName,
  type ParsedWorkbookImport,
} from '../utils/sheetsFormatter';
import {
  createMessSpreadsheet,
  fetchWorkbookTabsForImport,
  getSpreadsheetMetadata,
  listUserSpreadsheets,
  readSheetTabValues,
  syncMessToExistingSpreadsheet,
  trashDriveSpreadsheet,
  type DriveSpreadsheetItem,
  type SpreadsheetDetails,
} from '../services/googleSheetsService';
import type { CloudWorkspaceSummary } from '../services/firebaseService';

interface GoogleSheetsCloudTabProps {
  messState: MessState;
  selectedDate: string;
  googleUser: User | null;
  accessToken: string | null;
  isSigningIn: boolean;
  autoCloudSync: boolean;
  onToggleAutoCloudSync: (enabled: boolean) => void;
  cloudMeta: CloudWorkspaceSummary | null;
  isCloudBusy: boolean;
  onGoogleLogin: () => Promise<void>;
  onGoogleLogout: () => Promise<void>;
  onSaveToFirestore: () => Promise<void>;
  onLoadFromFirestore: () => Promise<void>;
  onLinkSpreadsheetInCloud: (sheetId: string, sheetTitle: string) => Promise<void>;
  onApplyImportedSheetData: (imported: ParsedWorkbookImport) => void;
  onShowToast: (message: string, type?: 'success' | 'error') => void;
}

type PendingConfirmation =
  | {
      kind: 'OVERWRITE_SHEET';
      spreadsheetId: string;
      spreadsheetTitle: string;
    }
  | {
      kind: 'TRASH_SHEET';
      spreadsheetId: string;
      spreadsheetTitle: string;
    }
  | {
      kind: 'IMPORT_FROM_SHEET';
      spreadsheetTitle: string;
      parsed: ParsedWorkbookImport;
    }
  | {
      kind: 'LOAD_FROM_FIRESTORE';
    };

const GoogleLogoIcon: React.FC = () => (
  <svg
    version="1.1"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 48 48"
    className="w-5 h-5 shrink-0 block"
    aria-hidden="true"
  >
    <path
      fill="#EA4335"
      d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
    />
    <path
      fill="#4285F4"
      d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
    />
    <path
      fill="#FBBC05"
      d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
    />
    <path
      fill="#34A853"
      d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
    />
    <path fill="none" d="M0 0h48v48H0z" />
  </svg>
);

export const GoogleSheetsCloudTab: React.FC<GoogleSheetsCloudTabProps> = ({
  messState,
  selectedDate,
  googleUser,
  accessToken,
  isSigningIn,
  autoCloudSync,
  onToggleAutoCloudSync,
  cloudMeta,
  isCloudBusy,
  onGoogleLogin,
  onGoogleLogout,
  onSaveToFirestore,
  onLoadFromFirestore,
  onLinkSpreadsheetInCloud,
  onApplyImportedSheetData,
  onShowToast,
}) => {
  const defaultSheetTitle = useMemo(() => {
    const ym = selectedDate.slice(0, 7);
    return `মেস ম্যানেজার হিসাব — ${ym}`;
  }, [selectedDate]);

  const [newSheetTitle, setNewSheetTitle] = useState(defaultSheetTitle);
  const [driveSearch, setDriveSearch] = useState('');
  const [manualSheetInput, setManualSheetInput] = useState('');
  const [driveFiles, setDriveFiles] = useState<DriveSpreadsheetItem[]>([]);
  const [isLoadingDrive, setIsLoadingDrive] = useState(false);

  const [connectedSheet, setConnectedSheet] = useState<SpreadsheetDetails | null>(null);
  const [activeRemoteTab, setActiveRemoteTab] = useState<string>('');
  const [remoteTabRows, setRemoteTabRows] = useState<string[][]>([]);
  const [isLoadingRemoteRows, setIsLoadingRemoteRows] = useState(false);
  const [isMutatingSheet, setIsMutatingSheet] = useState(false);
  const [needsTokenRefresh, setNeedsTokenRefresh] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  // Local workbook preview state (always usable even offline / logged out)
  const [previewTab, setPreviewTab] = useState<MessSheetTabName>('Summary');
  const [confirmation, setConfirmation] = useState<PendingConfirmation | null>(null);

  const localWorkbook = useMemo(() => buildMessWorkbookMatrices(messState), [messState]);

  const localMaxCols = useMemo(() => {
    const matrix = localWorkbook[previewTab] || [];
    return Math.max(1, ...matrix.map((r) => r.length));
  }, [localWorkbook, previewTab]);

  const remoteMaxCols = useMemo(() => {
    return Math.max(1, ...remoteTabRows.map((r) => r.length));
  }, [remoteTabRows]);

  const handleApiError = useCallback(
    (err: unknown, fallbackMessage: string) => {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.startsWith('AUTH_REQUIRED:')) {
        setNeedsTokenRefresh(true);
        setApiError(
          'Google Sheets অ্যাক্সেস টোকেনের মেয়াদ শেষ হয়েছে বা অনুমতি প্রয়োজন। আবার Sign in with Google বাটনে ক্লিক করুন।'
        );
        onShowToast('পুনরায় Google সাইন-ইন প্রয়োজন', 'error');
        return;
      }
      setApiError(msg || fallbackMessage);
      onShowToast(fallbackMessage, 'error');
    },
    [onShowToast]
  );

  const loadDriveSpreadsheets = useCallback(
    async (queryText = '') => {
      if (!accessToken) return;
      setIsLoadingDrive(true);
      setApiError(null);
      try {
        const files = await listUserSpreadsheets(accessToken, queryText);
        setDriveFiles(files);
        setNeedsTokenRefresh(false);
      } catch (err) {
        handleApiError(err, 'Google Drive থেকে স্প্রেডশিট তালিকা লোড করা যায়নি');
      } finally {
        setIsLoadingDrive(false);
      }
    },
    [accessToken, handleApiError]
  );

  const loadRemoteTabPreview = useCallback(
    async (spreadsheetId: string, tabTitle: string) => {
      if (!accessToken || !spreadsheetId || !tabTitle) return;
      setIsLoadingRemoteRows(true);
      setApiError(null);
      try {
        const rows = await readSheetTabValues(accessToken, spreadsheetId, tabTitle, 'A1:Z50');
        setRemoteTabRows(rows);
      } catch (err) {
        handleApiError(err, `"${tabTitle}" ট্যাবের তথ্য পড়া যায়নি`);
      } finally {
        setIsLoadingRemoteRows(false);
      }
    },
    [accessToken, handleApiError]
  );

  const connectToSpreadsheetId = useCallback(
    async (spreadsheetId: string, persistLink = true) => {
      if (!accessToken) {
        setNeedsTokenRefresh(true);
        return;
      }
      setIsMutatingSheet(true);
      setApiError(null);
      try {
        const details = await getSpreadsheetMetadata(accessToken, spreadsheetId);
        setConnectedSheet(details);
        const firstTab = details.sheets[0]?.title || '';
        setActiveRemoteTab(firstTab);
        if (firstTab) {
          const rows = await readSheetTabValues(accessToken, details.spreadsheetId, firstTab, 'A1:Z50');
          setRemoteTabRows(rows);
        } else {
          setRemoteTabRows([]);
        }
        if (persistLink && googleUser) {
          await onLinkSpreadsheetInCloud(details.spreadsheetId, details.title);
        }
      } catch (err) {
        handleApiError(err, 'স্প্রেডশিট সংযুক্ত করা যায়নি');
      } finally {
        setIsMutatingSheet(false);
      }
    },
    [accessToken, googleUser, handleApiError, onLinkSpreadsheetInCloud]
  );

  // When accessToken arrives, load Drive sheets and auto-connect cloud-linked sheet if present
  useEffect(() => {
    if (accessToken) {
      setNeedsTokenRefresh(false);
      void loadDriveSpreadsheets('');
    }
  }, [accessToken, loadDriveSpreadsheets]);

  useEffect(() => {
    if (
      accessToken &&
      cloudMeta?.linkedSpreadsheetId &&
      !connectedSheet &&
      !isMutatingSheet
    ) {
      void connectToSpreadsheetId(cloudMeta.linkedSpreadsheetId, false);
    }
  }, [accessToken, cloudMeta?.linkedSpreadsheetId, connectedSheet, connectToSpreadsheetId, isMutatingSheet]);

  const handleCreateNewSpreadsheet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken) {
      setNeedsTokenRefresh(true);
      return;
    }
    setIsMutatingSheet(true);
    setApiError(null);
    try {
      const created = await createMessSpreadsheet(accessToken, newSheetTitle, messState);
      setConnectedSheet(created);
      const initialTab = created.sheets[0]?.title || '';
      setActiveRemoteTab(initialTab);
      if (initialTab) {
        const rows = await readSheetTabValues(accessToken, created.spreadsheetId, initialTab, 'A1:Z50');
        setRemoteTabRows(rows);
      }
      if (googleUser) {
        await onLinkSpreadsheetInCloud(created.spreadsheetId, created.title);
      }
      await loadDriveSpreadsheets(driveSearch);
      onShowToast(`নতুন Google Sheet "${created.title}" তৈরি ও সিঙ্ক হয়েছে!`);
    } catch (err) {
      handleApiError(err, 'নতুন Google Sheet তৈরি করা যায়নি');
    } finally {
      setIsMutatingSheet(false);
    }
  };

  const handleConnectByUrlOrId = async (e: React.FormEvent) => {
    e.preventDefault();
    const extracted = extractSpreadsheetId(manualSheetInput);
    if (!extracted) {
      setApiError('সঠিক Google Sheets লিংক অথবা Spreadsheet ID প্রদান করুন।');
      return;
    }
    await connectToSpreadsheetId(extracted, true);
    setManualSheetInput('');
    onShowToast('Google Sheet সংযুক্ত হয়েছে');
  };

  const handlePrepareImportFromSheet = async () => {
    if (!accessToken || !connectedSheet) return;
    setIsMutatingSheet(true);
    setApiError(null);
    try {
      const { meta, parsed } = await fetchWorkbookTabsForImport(
        accessToken,
        connectedSheet.spreadsheetId,
        selectedDate
      );
      setConfirmation({
        kind: 'IMPORT_FROM_SHEET',
        spreadsheetTitle: meta.title,
        parsed,
      });
    } catch (err) {
      handleApiError(err, 'স্প্রেডশিট থেকে ইমপোর্ট ডেটা পড়া যায়নি');
    } finally {
      setIsMutatingSheet(false);
    }
  };

  const handleConfirmPendingAction = async () => {
    if (!confirmation) return;
    const currentConfirm = confirmation;
    setConfirmation(null);

    if (currentConfirm.kind === 'LOAD_FROM_FIRESTORE') {
      await onLoadFromFirestore();
      return;
    }

    if (currentConfirm.kind === 'IMPORT_FROM_SHEET') {
      onApplyImportedSheetData(currentConfirm.parsed);
      onShowToast(`"${currentConfirm.spreadsheetTitle}" থেকে মেসের তথ্য ইমপোর্ট হয়েছে`);
      return;
    }

    if (!accessToken) {
      setNeedsTokenRefresh(true);
      return;
    }

    if (currentConfirm.kind === 'OVERWRITE_SHEET') {
      setIsMutatingSheet(true);
      setApiError(null);
      try {
        const updated = await syncMessToExistingSpreadsheet(
          accessToken,
          currentConfirm.spreadsheetId,
          messState
        );
        setConnectedSheet(updated);
        const tabToReload =
          updated.sheets.find((s) => s.title === activeRemoteTab)?.title ||
          updated.sheets[0]?.title ||
          '';
        setActiveRemoteTab(tabToReload);
        if (tabToReload) {
          const rows = await readSheetTabValues(
            accessToken,
            updated.spreadsheetId,
            tabToReload,
            'A1:Z50'
          );
          setRemoteTabRows(rows);
        }
        onShowToast(`"${updated.title}" স্প্রেডশিটে সর্বশেষ হিসাব আপডেট হয়েছে!`);
      } catch (err) {
        handleApiError(err, 'স্প্রেডশিট আপডেট করা যায়নি');
      } finally {
        setIsMutatingSheet(false);
      }
      return;
    }

    if (currentConfirm.kind === 'TRASH_SHEET') {
      setIsMutatingSheet(true);
      setApiError(null);
      try {
        await trashDriveSpreadsheet(accessToken, currentConfirm.spreadsheetId);
        if (connectedSheet?.spreadsheetId === currentConfirm.spreadsheetId) {
          setConnectedSheet(null);
          setRemoteTabRows([]);
          setActiveRemoteTab('');
          if (googleUser) {
            await onLinkSpreadsheetInCloud('', '');
          }
        }
        await loadDriveSpreadsheets(driveSearch);
        onShowToast(`"${currentConfirm.spreadsheetTitle}" ট্র্যাশে পাঠানো হয়েছে`);
      } catch (err) {
        handleApiError(err, 'স্প্রেডশিট ডিলিট করা যায়নি');
      } finally {
        setIsMutatingSheet(false);
      }
    }
  };

  const handleDownloadLocalCsv = () => {
    const csv = matrixToCsv(localWorkbook[previewTab]);
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `mess_${previewTab.toLowerCase()}_${selectedDate}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    onShowToast(`${previewTab} ট্যাবের CSV ডাউনলোড হয়েছে`);
  };

  const requiresGoogleOAuth = !googleUser || !accessToken || needsTokenRefresh;

  return (
    <div className="space-y-6">
      {/* Section 1: Google Auth + Firebase Cloud Workspace */}
      <section
        aria-label="Google ও Firebase ক্লাউড সংযোগ"
        className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 space-y-5"
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-slate-900">
              Google Sheets ও Firebase ক্লাউড সিঙ্ক
            </h2>
            <p className="text-xs text-slate-600 max-w-2xl">
              আপনার Google অ্যাকাউন্ট দিয়ে সাইন-ইন করে মেসের সম্পূর্ণ হিসাব Firebase Firestore ক্লাউডে সংরক্ষণ করুন এবং সরাসরি Google Sheets-এ এক্সপোর্ট বা ইমপোর্ট করুন।
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            {requiresGoogleOAuth ? (
              <button
                type="button"
                onClick={onGoogleLogin}
                disabled={isSigningIn}
                className="gsi-material-button min-h-[44px] px-4 py-2 bg-white hover:bg-slate-50 border border-[#747775] text-[#1f1f1f] rounded-full text-sm font-medium transition-colors flex items-center gap-3 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
              >
                <div className="gsi-material-button-icon">
                  <GoogleLogoIcon />
                </div>
                <span className="gsi-material-button-contents">
                  {isSigningIn
                    ? 'সংযুক্ত হচ্ছে...'
                    : googleUser && !accessToken
                      ? 'Reconnect Google Sheets'
                      : 'Sign in with Google'}
                </span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onGoogleLogout}
                className="min-h-[44px] px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-semibold transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>সাইন আউট ({googleUser.email})</span>
              </button>
            )}
          </div>
        </div>

        {/* Signed-in Firebase Firestore Controls */}
        {googleUser ? (
          <div className="pt-4 border-t border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="text-xs text-slate-600 space-y-1">
              <div className="font-semibold text-slate-900">
                ক্লাউড অ্যাকাউন্ট: {googleUser.displayName || googleUser.email} ·{' '}
                {cloudMeta?.exists ? 'Firestore ব্যাকআপ সক্রিয়' : 'প্রথম ক্লাউড ব্যাকআপের জন্য প্রস্তুত'}
              </div>
              <div className="text-slate-500 tabular-nums">
                {cloudMeta?.updatedAtIso
                  ? `সর্বশেষ ক্লাউড আপডেট: ${new Date(cloudMeta.updatedAtIso).toLocaleString('bn-BD')}`
                  : 'এখনো ক্লাউডে সেভ করা হয়নি · ক্লাউডে সেভ করলে যেকোনো ডিভাইস থেকে পাওয়া যাবে'}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <label className="min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-medium text-slate-700 flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0">
                <input
                  type="checkbox"
                  checked={autoCloudSync}
                  onChange={(e) => onToggleAutoCloudSync(e.target.checked)}
                  className="w-4 h-4 accent-teal-600"
                />
                <span>অটো ক্লাউড সিঙ্ক</span>
              </label>

              <button
                type="button"
                onClick={onSaveToFirestore}
                disabled={isCloudBusy}
                className="min-h-[44px] px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-xl transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
              >
                <CloudUpload className="w-4 h-4" />
                <span>{isCloudBusy ? 'সিঙ্ক হচ্ছে...' : 'ক্লাউডে সেভ করুন'}</span>
              </button>

              <button
                type="button"
                onClick={() => setConfirmation({ kind: 'LOAD_FROM_FIRESTORE' })}
                disabled={isCloudBusy || !cloudMeta?.exists}
                className="min-h-[44px] px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 text-xs font-semibold rounded-xl transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className="w-4 h-4" />
                <span>ক্লাউড থেকে লোড</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="pt-4 border-t border-slate-100 text-xs text-slate-500">
            লগইন ছাড়াই অ্যাপের সকল হিসাব লোকাল ডিভাইসে সংরক্ষিত থাকে। মাল্টি-ডিভাইস ক্লাউড ডেটাবেস (Firestore) ও সরাসরি Google Sheets সিঙ্ক চালু করতে উপরের Sign in with Google বাটন ব্যবহার করুন।
          </div>
        )}

        {apiError && (
          <div
            role="alert"
            className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start justify-between gap-3"
          >
            <span>{apiError}</span>
            <button
              type="button"
              onClick={() => setApiError(null)}
              aria-label="ত্রুটি বার্তা বন্ধ করুন"
              className="text-rose-600 hover:text-rose-900 shrink-0 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </section>

      {/* Section 2: Live Google Sheets Workspace (Visible & Active with OAuth Token) */}
      {accessToken && !needsTokenRefresh && (
        <section
          aria-label="Google Sheets স্প্রেডশিট ব্যবস্থাপনা"
          className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 space-y-6"
        >
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Create a Brand-New Multi-Tab Mess Sheet */}
            <form onSubmit={handleCreateNewSpreadsheet} className="space-y-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  ১. নতুন মেস স্প্রেডশিট তৈরি করুন
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  এক ক্লিকে ৫টি ট্যাবসহ (Summary, Daily_Meals, Bazar_Ledger, Deposits, Utilities_Fines) নতুন Google Sheet তৈরি হবে।
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2.5">
                <label htmlFor="new-sheet-title" className="sr-only">
                  নতুন Google Sheet-এর নাম
                </label>
                <input
                  id="new-sheet-title"
                  type="text"
                  value={newSheetTitle}
                  onChange={(e) => setNewSheetTitle(e.target.value)}
                  placeholder="স্প্রেডশিটের নাম লিখুন"
                  className="flex-1 min-h-[44px] bg-slate-50 border border-slate-200 text-slate-900 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
                <button
                  type="submit"
                  disabled={isMutatingSheet}
                  className="min-h-[44px] px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
                >
                  <Plus className="w-4 h-4" />
                  <span>নতুন Sheet তৈরি করুন</span>
                </button>
              </div>
            </form>

            {/* Connect Existing Sheet via URL or ID */}
            <form onSubmit={handleConnectByUrlOrId} className="space-y-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  ২. বিদ্যমান স্প্রেডশিট লিংক বা ID দিয়ে যুক্ত করুন
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  আপনার পূর্বের যেকোনো Google Sheets লিংক বা আইডি পেস্ট করে সরাসরি সংযুক্ত করুন।
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2.5">
                <label htmlFor="existing-sheet-link" className="sr-only">
                  Google Sheets URL অথবা ID
                </label>
                <input
                  id="existing-sheet-link"
                  type="text"
                  value={manualSheetInput}
                  onChange={(e) => setManualSheetInput(e.target.value)}
                  placeholder="https://docs.google.com/spreadsheets/d/..."
                  className="flex-1 min-h-[44px] bg-slate-50 border border-slate-200 text-slate-900 rounded-xl px-3.5 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
                <button
                  type="submit"
                  disabled={isMutatingSheet}
                  className="min-h-[44px] px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>সংযুক্ত করুন</span>
                </button>
              </div>
            </form>
          </div>

          {/* Connected Spreadsheet Operations + Live Tab Reader */}
          {connectedSheet && (
            <div className="pt-5 border-t border-slate-100 space-y-4">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                  <div className="text-xs text-teal-700 font-semibold">সংযুক্ত স্প্রেডশিট</div>
                  <div className="flex flex-wrap items-center gap-2 mt-0.5">
                    <h4 className="text-base font-bold text-slate-900">{connectedSheet.title}</h4>
                    <span className="text-slate-300" aria-hidden="true">
                      ·
                    </span>
                    <a
                      href={connectedSheet.spreadsheetUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 hover:text-teal-900 underline underline-offset-2"
                    >
                      <span>Google Sheets-এ খুলুন</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    disabled={isMutatingSheet}
                    onClick={() =>
                      setConfirmation({
                        kind: 'OVERWRITE_SHEET',
                        spreadsheetId: connectedSheet.spreadsheetId,
                        spreadsheetTitle: connectedSheet.title,
                      })
                    }
                    className="min-h-[44px] px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-xl transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
                  >
                    <CloudUpload className="w-4 h-4" />
                    <span>এই Sheet-এ হিসাব আপডেট করুন</span>
                  </button>

                  <button
                    type="button"
                    disabled={isMutatingSheet}
                    onClick={handlePrepareImportFromSheet}
                    className="min-h-[44px] px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 text-xs font-semibold rounded-xl transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
                  >
                    <Download className="w-4 h-4" />
                    <span>Sheet থেকে ইমপোর্ট</span>
                  </button>

                  <button
                    type="button"
                    disabled={isMutatingSheet}
                    onClick={() =>
                      setConfirmation({
                        kind: 'TRASH_SHEET',
                        spreadsheetId: connectedSheet.spreadsheetId,
                        spreadsheetTitle: connectedSheet.title,
                      })
                    }
                    className="min-h-[44px] px-3.5 py-2 bg-white hover:bg-rose-50 border border-slate-200 text-rose-700 text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>ট্র্যাশ</span>
                  </button>
                </div>
              </div>

              {/* Dynamic Sheet Tab Selector discovered from Spreadsheet Metadata */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex overflow-x-auto hide-scrollbar gap-1.5 bg-slate-100 p-1 rounded-xl">
                  {connectedSheet.sheets.map((sheet) => {
                    const active = activeRemoteTab === sheet.title;
                    return (
                      <button
                        key={sheet.sheetId}
                        type="button"
                        onClick={() => {
                          setActiveRemoteTab(sheet.title);
                          void loadRemoteTabPreview(connectedSheet.spreadsheetId, sheet.title);
                        }}
                        className={`min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          active
                            ? 'bg-white text-teal-800 border border-slate-200/80'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {sheet.title}
                      </button>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={() =>
                    loadRemoteTabPreview(connectedSheet.spreadsheetId, activeRemoteTab)
                  }
                  disabled={isLoadingRemoteRows || !activeRemoteTab}
                  className="min-h-[40px] px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingRemoteRows ? 'animate-spin' : ''}`} />
                  <span>রিফ্রেশ ডেটা</span>
                </button>
              </div>

              {/* Remote Sheet Live Rows Table */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden">
                {isLoadingRemoteRows ? (
                  <div className="p-8 text-center text-xs text-slate-500">
                    Google Sheets থেকে "{activeRemoteTab}" ট্যাবের ডেটা লোড হচ্ছে...
                  </div>
                ) : remoteTabRows.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-500">
                    "{activeRemoteTab}" ট্যাবে কোনো ডেটা নেই। উপরের "এই Sheet-এ হিসাব আপডেট করুন" বাটনে ক্লিক করে মেসের তথ্য পাঠান।
                  </div>
                ) : (
                  <div className="overflow-x-auto max-h-80">
                    <table className="w-full text-left text-xs text-slate-700">
                      <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold sticky top-0">
                        <tr>
                          {Array.from({ length: remoteMaxCols }).map((_, idx) => (
                            <th key={idx} className="py-2.5 px-3.5 whitespace-nowrap">
                              {remoteTabRows[0]?.[idx] ?? ''}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {remoteTabRows.slice(1).map((row, rIdx) => (
                          <tr key={rIdx} className="hover:bg-slate-50/70">
                            {Array.from({ length: remoteMaxCols }).map((_, cIdx) => (
                              <td
                                key={cIdx}
                                className="py-2 px-3.5 tabular-nums whitespace-nowrap text-slate-700"
                              >
                                {row[cIdx] ?? ''}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Google Drive Spreadsheets Browser */}
          <div className="pt-5 border-t border-slate-100 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  আপনার Google Drive স্প্রেডশিট তালিকা
                </h3>
                <p className="text-xs text-slate-500">
                  যেকোনো স্প্রেডশিট নির্বাচন করে প্রিভিউ ও সিঙ্ক করুন
                </p>
              </div>

              <div className="flex items-center gap-2">
                <label htmlFor="drive-sheet-search" className="sr-only">
                  ড্রাইভে স্প্রেডশিট খুঁজুন
                </label>
                <input
                  id="drive-sheet-search"
                  type="search"
                  value={driveSearch}
                  onChange={(e) => setDriveSearch(e.target.value)}
                  placeholder="নাম দিয়ে খুঁজুন..."
                  className="min-h-[40px] bg-slate-50 border border-slate-200 text-slate-900 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
                <button
                  type="button"
                  onClick={() => loadDriveSpreadsheets(driveSearch)}
                  disabled={isLoadingDrive}
                  className="min-h-[40px] px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <FolderSearch className="w-3.5 h-3.5" />
                  <span>খুঁজুন</span>
                </button>
              </div>
            </div>

            {isLoadingDrive ? (
              <div className="py-6 text-center text-xs text-slate-500">
                Google Drive থেকে ফাইল তালিকা লোড হচ্ছে...
              </div>
            ) : driveFiles.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-500">
                কোনো Google Sheet পাওয়া যায়নি। উপরে নতুন একটি মেস স্প্রেডশিট তৈরি করুন।
              </div>
            ) : (
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden">
                {driveFiles.slice(0, 8).map((file) => {
                  const isSelected = connectedSheet?.spreadsheetId === file.id;
                  return (
                    <div
                      key={file.id}
                      className="px-4 py-3 flex items-center justify-between gap-3 hover:bg-slate-50 transition-colors"
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-slate-900 truncate">
                          {file.name}
                        </div>
                        <div className="text-[11px] text-slate-500 tabular-nums mt-0.5">
                          সর্বশেষ পরিবর্তন: {new Date(file.modifiedTime).toLocaleDateString('bn-BD')}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => connectToSpreadsheetId(file.id, true)}
                        disabled={isMutatingSheet}
                        className={`min-h-[40px] px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-teal-50 text-teal-800 border border-teal-200'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-800'
                        }`}
                      >
                        {isSelected ? 'সংযুক্ত' : 'নির্বাচন করুন'}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      )}

      {/* Section 3: Local Structured Sheet Preview & Instant CSV Export */}
      <section
        aria-label="প্রস্তুতকৃত Google Sheets ডেটা প্রিভিউ"
        className="bg-white border border-slate-200 rounded-3xl overflow-hidden"
      >
        <div className="p-5 sm:p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Google Sheets ফরম্যাট প্রিভিউ ও CSV এক্সপোর্ট
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              চলমান মেসের হিসাব যেভাবে ৫টি ওয়ার্কশিটে সাজানো হয়েছে তার লাইভ টেবিল প্রিভিউ
            </p>
          </div>

          <button
            type="button"
            onClick={handleDownloadLocalCsv}
            className="min-h-[44px] px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>{previewTab}.csv ডাউনলোড</span>
          </button>
        </div>

        <div className="px-5 py-3 bg-slate-50/70 border-b border-slate-100 flex overflow-x-auto hide-scrollbar gap-1.5">
          {MESS_SHEET_TABS.map((tab) => {
            const active = previewTab === tab;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setPreviewTab(tab)}
                className={`min-h-[40px] px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'bg-white text-teal-800 border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab} ({Math.max(0, localWorkbook[tab].length - 1)} রো)
              </button>
            );
          })}
        </div>

        <div className="overflow-x-auto max-h-96">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold">
              <tr>
                {Array.from({ length: localMaxCols }).map((_, idx) => (
                  <th key={idx} className="py-3 px-4 whitespace-nowrap">
                    {localWorkbook[previewTab][0]?.[idx] ?? ''}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {localWorkbook[previewTab].slice(1).map((row, rIdx) => {
                if (row.length === 0) {
                  return (
                    <tr key={rIdx} className="bg-slate-50/60">
                      <td colSpan={localMaxCols} className="py-1.5 px-4" />
                    </tr>
                  );
                }
                const firstCell = String(row[0] ?? '');
                const isSubHeader = firstCell === 'Member ID' || firstCell === 'Fine ID';
                return (
                  <tr
                    key={rIdx}
                    className={
                      isSubHeader
                        ? 'bg-slate-50 font-semibold text-slate-900'
                        : 'hover:bg-slate-50/80'
                    }
                  >
                    {Array.from({ length: localMaxCols }).map((_, cIdx) => (
                      <td
                        key={cIdx}
                        className={`py-2.5 px-4 tabular-nums whitespace-nowrap ${
                          isSubHeader ? 'text-slate-800 font-semibold' : 'text-slate-700'
                        }`}
                      >
                        {String(row[cIdx] ?? '')}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Mandatory User Confirmation Modal for Mutating / Destructive Operations */}
      {confirmation && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="পরিবর্তন নিশ্চিতকরণ"
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/40 backdrop-blur-sm p-0 sm:p-4"
        >
          <div className="w-full sm:max-w-md bg-white border-t sm:border border-slate-200 rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 space-y-4">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                <h3 className="font-bold text-slate-900 text-base">
                  {confirmation.kind === 'OVERWRITE_SHEET' && 'Google Sheet আপডেট নিশ্চিত করুন'}
                  {confirmation.kind === 'TRASH_SHEET' && 'স্প্রেডশিট ট্র্যাশে পাঠানো নিশ্চিত করুন'}
                  {confirmation.kind === 'IMPORT_FROM_SHEET' && 'Google Sheet থেকে ইমপোর্ট নিশ্চিত করুন'}
                  {confirmation.kind === 'LOAD_FROM_FIRESTORE' && 'ক্লাউড ব্যাকআপ লোড নিশ্চিত করুন'}
                </h3>
              </div>
              <button
                type="button"
                aria-label="নিশ্চিতকরণ ডায়ালগ বন্ধ করুন"
                onClick={() => setConfirmation(null)}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center text-slate-400 hover:text-slate-700 rounded-xl cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-xs text-slate-600 leading-relaxed space-y-2">
              {confirmation.kind === 'OVERWRITE_SHEET' && (
                <p>
                  আপনি কি নিশ্চিতভাবে{' '}
                  <strong className="text-slate-900">"{confirmation.spreadsheetTitle}"</strong>{' '}
                  স্প্রেডশিটের ৫টি ট্যাব (Summary, Daily_Meals, Bazar_Ledger, Deposits, Utilities_Fines) বর্তমান মেসের সর্বশেষ তথ্য দিয়ে আপডেট ও প্রতিস্থাপন করতে চান?
                </p>
              )}

              {confirmation.kind === 'TRASH_SHEET' && (
                <p>
                  আপনি কি নিশ্চিতভাবে{' '}
                  <strong className="text-slate-900">"{confirmation.spreadsheetTitle}"</strong>{' '}
                  ফাইলটি আপনার Google Drive-এর ট্র্যাশে পাঠাতে চান?
                </p>
              )}

              {confirmation.kind === 'IMPORT_FROM_SHEET' && (
                <div className="space-y-1.5">
                  <p>
                    <strong className="text-slate-900">"{confirmation.spreadsheetTitle}"</strong>{' '}
                    থেকে নিচের তথ্যগুলো অ্যাপের বর্তমান হিসাবে ইমপোর্ট করা হবে:
                  </p>
                  <p className="font-mono tabular-nums text-slate-800 bg-slate-50 p-3 rounded-xl border border-slate-200">
                    মেম্বার: {confirmation.parsed.importedCounts.members} · মিল এন্ট্রি:{' '}
                    {confirmation.parsed.importedCounts.mealRows} · বাজার:{' '}
                    {confirmation.parsed.importedCounts.bazar} · ডিপোজিট:{' '}
                    {confirmation.parsed.importedCounts.deposits} · জরিমানা:{' '}
                    {confirmation.parsed.importedCounts.fines}
                  </p>
                </div>
              )}

              {confirmation.kind === 'LOAD_FROM_FIRESTORE' && (
                <p>
                  Firebase ক্লাউডে সংরক্ষিত মেসের তথ্য দিয়ে বর্তমান স্ক্রিনের লোকাল ডেটা প্রতিস্থাপন করা হবে। আপনি কি এগিয়ে যেতে চান?
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setConfirmation(null)}
                className="min-h-[44px] px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
              >
                বাতিল করুন
              </button>
              <button
                type="button"
                onClick={handleConfirmPendingAction}
                className={`min-h-[44px] px-4 py-2 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer ${
                  confirmation.kind === 'TRASH_SHEET'
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : 'bg-teal-600 hover:bg-teal-700'
                }`}
              >
                {confirmation.kind === 'TRASH_SHEET' ? 'হ্যাঁ, ট্র্যাশে পাঠান' : 'নিশ্চিত করুন'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
