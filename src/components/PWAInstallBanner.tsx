import React, { useState } from 'react';
import { Download, Smartphone, WifiOff, X } from 'lucide-react';
import { useOnlineStatus, usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallBanner: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if (isInstalled || dismissed) {
    return null;
  }

  return (
    <>
      <div className="bg-white border border-slate-200 rounded-2xl px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center shrink-0">
            <Smartphone className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h3 className="text-xs sm:text-sm font-semibold text-slate-900 truncate">
              অ্যান্ড্রয়েড অ্যাপ হিসেবে ইনস্টল করুন
            </h3>
            <p className="text-xs text-slate-500 hidden sm:block">
              হোম স্ক্রিনে যুক্ত করে অফলাইনে ও ফুল-স্ক্রিন অ্যান্ড্রয়েড অ্যাপের মতো ব্যবহার করুন।
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={async () => {
              if (isInstallable) {
                await install();
              } else {
                setShowGuide(true);
              }
            }}
            className="min-h-[44px] px-3.5 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-xl transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>ইনস্টল</span>
          </button>
          <button
            type="button"
            aria-label="ইনস্টল ব্যানার বন্ধ করুন"
            onClick={() => setDismissed(true)}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-slate-700 rounded-xl cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {showGuide && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="android-install-title"
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4"
        >
          <div className="w-full max-w-md rounded-3xl bg-white border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 id="android-install-title" className="text-base font-bold text-slate-900">
                {isIOS ? 'iPhone / iPad এ ইনস্টল নির্দেশিকা' : 'Android ফোনে ইনস্টল নির্দেশিকা'}
              </h3>
              <button
                type="button"
                aria-label="নির্দেশিকা বন্ধ করুন"
                onClick={() => setShowGuide(false)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-slate-700 rounded-xl cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {isIOS ? (
              <ol className="space-y-2.5 text-sm text-slate-600 list-decimal list-inside">
                <li>Safari ব্রাউজারের নিচের Share বাটনে ট্যাপ করুন।</li>
                <li>নিচে স্ক্রল করে Add to Home Screen নির্বাচন করুন।</li>
                <li>উপরে ডানপাশে Add বাটনে ট্যাপ করুন।</li>
              </ol>
            ) : (
              <ol className="space-y-2.5 text-sm text-slate-600 list-decimal list-inside">
                <li>আপনার ফোনের Chrome ব্রাউজারে অ্যাপ লিংকটি ওপেন করুন।</li>
                <li>উপরে ডানপাশের তিন-ডট (⋮) মেনুতে ট্যাপ করুন।</li>
                <li>Install app অথবা Add to Home screen নির্বাচন করুন।</li>
              </ol>
            )}

            <button
              type="button"
              onClick={() => setShowGuide(false)}
              className="w-full min-h-[44px] rounded-xl bg-slate-100 hover:bg-slate-200 text-sm font-semibold text-slate-800 transition-colors cursor-pointer"
            >
              বুঝেছি
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      role="status"
      className="fixed top-16 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-xl bg-amber-100 border border-amber-200 px-4 py-2 text-xs font-semibold text-amber-900"
    >
      <WifiOff className="w-4 h-4 text-amber-700" />
      <span>অফলাইন মোড · লোকাল ক্যাশ ডেটা ব্যবহৃত হচ্ছে</span>
    </div>
  );
};
