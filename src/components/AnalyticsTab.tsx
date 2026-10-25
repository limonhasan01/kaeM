import React from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { BazarEntry, Member } from '../types/mess';
import type { MemberFinancialSummary } from '../utils/messCalculations';
import { MonthlyBazarReport } from './MonthlyBazarReport';

interface AnalyticsTabProps {
  currentUser: Member;
  financials: MemberFinancialSummary[];
  members: Member[];
  bazar: BazarEntry[];
}

export const AnalyticsTab: React.FC<AnalyticsTabProps> = ({
  currentUser,
  financials,
  members,
  bazar,
}) => {
  const isAdmin = currentUser.isAdmin;
  const maxVal = Math.max(
    1000,
    ...financials.flatMap((f) => [f.deposited, f.totalExpense])
  );
  const niceMax = Math.ceil(maxVal / 500) * 500;

  return (
    <div className="space-y-6">
      {/* Monthly Bazar Report (Shared Market Transparency: Expenditures, Top Shoppers, Purchased Items Breakdown) */}
      <MonthlyBazarReport members={members} bazar={bazar} />

      {/* Admin-Only All-Member Financial Comparison & Balance Shortage Health */}
      {isAdmin && (
        <>
          <div className="bg-white border border-slate-200 rounded-3xl p-5 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900">মেসের গ্রাফিক্যাল অ্যানালিটিক্স</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  মেম্বারদের মোট জমা টাকা বনাম মিল খরচ ও জরিমানার তুলনামূলক চিত্র
                </p>
              </div>

              <div className="flex items-center gap-4 text-xs font-medium text-slate-600">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm bg-teal-600 inline-block" />
                  <span>মোট জমা (৳)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm bg-rose-400 inline-block" />
                  <span>আনুমানিক খরচ (৳)</span>
                </div>
              </div>
            </div>

            {/* Responsive Grouped Bar Chart */}
            {financials.length === 0 ? (
              <div className="py-12 text-center text-sm text-slate-500">
                অ্যানালিটিক্স দেখানোর জন্য কোনো মেম্বার নেই।
              </div>
            ) : (
              <div className="pt-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 items-end min-h-[240px] border-b border-slate-200 pb-4 px-2">
                  {financials.map((item) => {
                    const depPct = Math.min(100, Math.max(4, (item.deposited / niceMax) * 100));
                    const costPct = Math.min(
                      100,
                      Math.max(item.totalExpense > 0 ? 4 : 1, (item.totalExpense / niceMax) * 100)
                    );

                    return (
                      <div key={item.member.id} className="flex flex-col items-center gap-3">
                        <div className="w-full h-48 flex items-end justify-center gap-4 px-4">
                          {/* Deposit Bar */}
                          <div className="flex flex-col items-center justify-end h-full w-16">
                            <span className="text-xs tabular-nums text-teal-700 mb-1.5 font-semibold whitespace-nowrap">
                              ৳ {Math.round(item.deposited)}
                            </span>
                            <div
                              style={{ height: `${depPct}%` }}
                              className="w-full bg-teal-600 rounded-t-xl transition-opacity"
                              title={`${item.member.name} মোট জমা: ৳ ${item.deposited}`}
                            />
                          </div>

                          {/* Expense Bar */}
                          <div className="flex flex-col items-center justify-end h-full w-16">
                            <span className="text-xs tabular-nums text-rose-600 mb-1.5 font-semibold whitespace-nowrap">
                              ৳ {Math.round(item.totalExpense)}
                            </span>
                            <div
                              style={{ height: `${costPct}%` }}
                              className="w-full bg-rose-400 rounded-t-xl transition-opacity"
                              title={`${item.member.name} মোট খরচ: ৳ ${item.totalExpense.toFixed(1)}`}
                            />
                          </div>
                        </div>

                        <div className="text-center">
                          <div className="text-sm font-bold text-slate-900">{item.member.name}</div>
                          <div className="text-xs text-slate-500 tabular-nums">
                            {item.totalMeals.toFixed(1)} মিল
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Balance Health Status */}
          <div className="bg-white border border-slate-200 rounded-3xl p-5 space-y-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                মেম্বারদের ব্যালেন্স স্বাস্থ্য অবস্থা (Balance Health)
              </h3>
              <p className="text-xs text-slate-500">
                কার ব্যালেন্সে পর্যাপ্ত উদ্বৃত্ত আছে এবং কাকে অতিরিক্ত টাকা জমা দিতে হবে
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {financials.map((item) => {
                const { member, totalExpense, netBalance, isShort } = item;
                return (
                  <div
                    key={member.id}
                    className="bg-slate-50 rounded-2xl p-4 flex flex-col justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="font-bold text-slate-900 text-sm">{member.name}</h4>
                        {isShort ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-700">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span>টাকা দেওয়া লাগবে</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>পর্যাপ্ত ব্যালেন্স</span>
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 tabular-nums">
                        মিল খরচ ও জরিমানা: ৳ {totalExpense.toFixed(0)}
                      </p>
                    </div>

                    <div
                      className={`text-sm font-bold tabular-nums pt-2 border-t border-slate-200/80 ${
                        isShort ? 'text-rose-700' : 'text-emerald-700'
                      }`}
                    >
                      {isShort
                        ? `ঘাটতি: ৳ ${Math.abs(netBalance).toFixed(0)}`
                        : `উদ্বৃত্ত: ৳ ${netBalance.toFixed(0)}`}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

