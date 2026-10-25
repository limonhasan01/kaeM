import React, { useMemo, useState } from 'react';
import { Award, Search, ShoppingBasket } from 'lucide-react';
import type { BazarEntry, Member } from '../types/mess';
import { buildMonthlyBazarReport, getTodayDateString } from '../utils/messCalculations';

interface MonthlyBazarReportProps {
  members: Member[];
  bazar: BazarEntry[];
}

const BENGALI_MONTH_NAMES: Record<string, string> = {
  '01': 'জানুয়ারি',
  '02': 'ফেব্রুয়ারি',
  '03': 'মার্চ',
  '04': 'এপ্রিল',
  '05': 'মে',
  '06': 'জুন',
  '07': 'জুলাই',
  '08': 'আগস্ট',
  '09': 'সেপ্টেম্বর',
  '10': 'অক্টোবর',
  '11': 'নভেম্বর',
  '12': 'ডিসেম্বর',
};

function formatMonthDisplay(ym: string): string {
  if (ym === 'ALL') return 'সব মাস (সর্বমোট)';
  const [y, m] = ym.split('-');
  const mName = BENGALI_MONTH_NAMES[m] || m;
  return `${mName} ${y} (${ym})`;
}

export const MonthlyBazarReport: React.FC<MonthlyBazarReportProps> = ({ members, bazar }) => {
  const defaultMonth = useMemo(() => {
    const firstApproved = bazar.find((b) => b.status === 'approved' && b.date.length >= 7);
    if (firstApproved) return firstApproved.date.slice(0, 7);
    return getTodayDateString().slice(0, 7);
  }, [bazar]);

  const [selectedMonth, setSelectedMonth] = useState<string>(defaultMonth);
  const [itemQuery, setItemQuery] = useState<string>('');

  const report = useMemo(
    () => buildMonthlyBazarReport(members, bazar, selectedMonth, defaultMonth),
    [members, bazar, selectedMonth, defaultMonth]
  );

  const filteredItems = useMemo(() => {
    const q = itemQuery.trim().toLowerCase();
    if (!q) return report.itemBreakdown;
    return report.itemBreakdown.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        item.examples.some((ex) => ex.toLowerCase().includes(q)) ||
        item.shopperNames.some((s) => s.toLowerCase().includes(q))
    );
  }, [report.itemBreakdown, itemQuery]);

  const maxShopperSpend = Math.max(
    1,
    ...report.topShoppers.map((s) => s.attributedSpend)
  );

  return (
    <section
      data-testid="monthly-bazar-report"
      aria-labelledby="monthly-bazar-report-heading"
      className="bg-white border border-slate-200 rounded-3xl p-5 space-y-6"
    >
      {/* Header & Month Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3
            id="monthly-bazar-report-heading"
            className="text-lg font-bold text-slate-900 flex items-center gap-2"
          >
            <ShoppingBasket className="w-5 h-5 text-teal-700 shrink-0" />
            <span>মাসিক বাজার রিপোর্ট (Monthly Bazar Report)</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            মাসিক মোট বাজার ব্যয়, সর্বোচ্চ বাজারকারী (Top Shoppers) এবং ক্রয়কৃত পণ্যের বিস্তারিত বিশ্লেষণ
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <label
            htmlFor="monthly-bazar-month-select"
            className="text-xs font-medium text-slate-600 whitespace-nowrap"
          >
            মাস নির্বাচন:
          </label>
          <select
            id="monthly-bazar-month-select"
            aria-label="বাজার রিপোর্টের মাস নির্বাচন করুন"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="min-h-[44px] bg-slate-50 border border-slate-200 text-slate-900 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-teal-600 cursor-pointer"
          >
            {report.availableMonths.map((ym) => (
              <option key={ym} value={ym}>
                {formatMonthDisplay(ym)}
              </option>
            ))}
            <option value="ALL">সব মাস (সর্বমোট)</option>
          </select>
        </div>
      </div>

      {/* 1. Monthly Market Expenditure Summary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-slate-50 rounded-2xl p-4 space-y-1">
          <div className="text-xs text-slate-500">মোট মাসিক বাজার খরচ</div>
          <div
            data-testid="monthly-bazar-total"
            className="text-xl font-bold text-teal-700 tabular-nums"
          >
            ৳ {report.totalExpenditure.toLocaleString('en-US')}
          </div>
          <div className="text-[11px] text-slate-500 tabular-nums">
            {report.pendingExpenditure > 0
              ? `অনুমোদিত · পেন্ডিং: ৳ ${report.pendingExpenditure.toLocaleString('en-US')}`
              : `${formatMonthDisplay(selectedMonth)}`}
          </div>
        </div>

        <div className="bg-slate-50 rounded-2xl p-4 space-y-1">
          <div className="text-xs text-slate-500">সম্পন্ন বাজার ট্রিপ</div>
          <div
            data-testid="monthly-bazar-trips"
            className="text-xl font-bold text-slate-900 tabular-nums"
          >
            {report.tripCount} বার
          </div>
          <div className="text-[11px] text-slate-500 tabular-nums">
            গড় প্রতি ট্রিপ: ৳ {Math.round(report.averagePerTrip).toLocaleString('en-US')}
          </div>
        </div>

        <div className="bg-slate-50 rounded-2xl p-4 space-y-1">
          <div className="text-xs text-slate-500">টপ বাজারকারী (Top Shopper)</div>
          <div
            data-testid="monthly-bazar-top-shopper"
            className="text-lg font-bold text-slate-900 truncate"
          >
            {report.leadShopper ? report.leadShopper.member.name : 'এখনো কেউ নয়'}
          </div>
          <div className="text-[11px] text-slate-500 tabular-nums">
            {report.leadShopper
              ? `${report.leadShopper.trips} বার · বাজার মূল্য ৳ ${Math.round(
                  report.leadShopper.totalMarketValue
                ).toLocaleString('en-US')}`
              : 'অনুমোদিত বাজার নেই'}
          </div>
        </div>

        <div className="bg-slate-50 rounded-2xl p-4 space-y-1">
          <div className="text-xs text-slate-500">সর্বোচ্চ একক বাজার</div>
          <div className="text-xl font-bold text-amber-700 tabular-nums">
            {report.highestSingleTrip
              ? `৳ ${report.highestSingleTrip.amount.toLocaleString('en-US')}`
              : '৳ 0'}
          </div>
          <div className="text-[11px] text-slate-500 font-mono tabular-nums truncate">
            {report.highestSingleTrip
              ? `${report.highestSingleTrip.date} · ${report.highestSingleTrip.shopperNames}`
              : 'কোনো রেকর্ড নেই'}
          </div>
        </div>
      </div>

      {/* 2. Top Shoppers Leaderboard */}
      <div className="space-y-3 pt-2 border-t border-slate-100">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
          <h4 className="text-sm font-bold text-slate-900">
            টপ বাজারকারী মেম্বার তালিকা (Top Shoppers Ranking)
          </h4>
          <span className="text-xs text-slate-500">
            সম্পন্ন বাজার ট্রিপ সংখ্যা ও যৌথ বাজারের সমবণ্টিত ব্যয়ের ভিত্তিতে ক্রমানুসারে
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          {report.topShoppers.map((rankItem, idx) => {
            const isTop = idx === 0 && rankItem.trips > 0;
            const barWidthPct =
              rankItem.attributedSpend > 0
                ? Math.min(100, Math.max(8, (rankItem.attributedSpend / maxShopperSpend) * 100))
                : 0;

            return (
              <div
                key={rankItem.member.id}
                className="bg-slate-50 rounded-2xl p-4 space-y-3 flex flex-col justify-between"
              >
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-mono text-xs font-bold text-slate-400 tabular-nums">
                        {String(idx + 1).padStart(2, '0')}.
                      </span>
                      <span className="font-bold text-slate-900 text-sm truncate">
                        {rankItem.member.name}
                      </span>
                    </div>
                    {isTop && (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 shrink-0">
                        <Award className="w-3.5 h-3.5" />
                        <span>শীর্ষ বাজারকারী</span>
                      </span>
                    )}
                  </div>

                  <div className="text-xs text-slate-500 tabular-nums">
                    সম্পন্ন ট্রিপ: <strong className="text-slate-800">{rankItem.trips} বার</strong>
                    <span aria-hidden="true"> · </span>
                    অংশগ্রহণকৃত বাজার: ৳ {rankItem.totalMarketValue.toLocaleString('en-US')}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="w-full h-2 bg-slate-200/80 rounded-full overflow-hidden">
                    <div
                      style={{ width: `${barWidthPct}%` }}
                      className={`h-full rounded-full ${
                        isTop ? 'bg-teal-600' : 'bg-slate-600'
                      }`}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500 tabular-nums">
                    <span>একক অংশীদারিত্ব: ৳ {Math.round(rankItem.attributedSpend).toLocaleString('en-US')}</span>
                    <span className="font-semibold text-slate-700">
                      {rankItem.sharePercent.toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Breakdown of Items Purchased */}
      <div className="space-y-3.5 pt-2 border-t border-slate-100">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h4 className="text-sm font-bold text-slate-900">
              ক্রয়কৃত বাজার আইটেমের বিস্তারিত বিবরণ ({filteredItems.length} টি আইটেম)
            </h4>
            <p className="text-xs text-slate-500">
              কোন আইটেম কতবার কেনা হয়েছে, কোন তারিখে এবং আনুমানিক ব্যয় বণ্টন
            </p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              aria-label="ক্রয়কৃত বাজার আইটেম খুঁজুন"
              placeholder="আইটেম বা মেম্বার খুঁজুন..."
              value={itemQuery}
              onChange={(e) => setItemQuery(e.target.value)}
              className="w-full min-h-[42px] bg-slate-50 border border-slate-200 text-slate-900 rounded-xl pl-9 pr-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-teal-600"
            />
          </div>
        </div>

        {filteredItems.length === 0 ? (
          <div className="bg-slate-50 rounded-2xl p-8 text-center text-xs text-slate-500">
            {report.tripCount === 0
              ? 'নির্বাচিত মাসে কোনো অনুমোদিত বাজার খরচ পাওয়া যায়নি।'
              : 'অনুসন্ধানকৃত নামের সাথে কোনো ক্রয়কৃত আইটেম মেলেনি।'}
          </div>
        ) : (
          <div className="overflow-x-auto border border-slate-200/80 rounded-2xl">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 font-semibold">
                <tr>
                  <th className="py-3 px-4">আইটেমের নাম</th>
                  <th className="py-3 px-4">পরিমাণ / বিবরণ</th>
                  <th className="py-3 px-4 text-right">ক্রয় সংখ্যা</th>
                  <th className="py-3 px-4">বাজারকারী</th>
                  <th className="py-3 px-4">তারিখসমূহ</th>
                  <th className="py-3 px-4 text-right">আনুমানিক ব্যয় অংশ (৳)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredItems.map((item) => (
                  <tr key={item.key} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-900 whitespace-nowrap">
                      {item.name}
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {item.examples.join(' · ')}
                    </td>
                    <td className="py-3 px-4 text-right font-semibold text-teal-700 tabular-nums whitespace-nowrap">
                      {item.frequency} বার
                    </td>
                    <td className="py-3 px-4 text-slate-700">
                      {item.shopperNames.join(', ') || '—'}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-500 tabular-nums">
                      {item.dates.join(', ')}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-amber-700 tabular-nums whitespace-nowrap">
                      ৳ {Math.round(item.allocatedSpend).toLocaleString('en-US')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
};
