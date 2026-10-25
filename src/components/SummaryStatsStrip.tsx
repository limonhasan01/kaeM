import React from 'react';
import type { MemberFinancialSummary } from '../utils/messCalculations';

interface SummaryStatsStripProps {
  isAdmin: boolean;
  totalMeals: number;
  totalDeposit: number;
  totalBazar: number;
  cashBalance: number;
  mealRate: number;
  memberFinancial?: MemberFinancialSummary;
}

export const SummaryStatsStrip: React.FC<SummaryStatsStripProps> = ({
  isAdmin,
  totalMeals,
  totalDeposit,
  totalBazar,
  cashBalance,
  mealRate,
  memberFinancial,
}) => {
  if (!isAdmin && memberFinancial) {
    const isSurplus = memberFinancial.netBalance >= -0.005;
    return (
      <section aria-label="আপনার ব্যক্তিগত সারসংক্ষেপ" className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-white border border-slate-200 p-4 rounded-2xl">
          <div className="text-xs font-medium text-slate-500 mb-1">আপনার মোট মিল</div>
          <div
            data-testid="stat-total-meals"
            className="text-2xl font-bold text-slate-900 tabular-nums"
          >
            {memberFinancial.totalMeals.toFixed(1)}
          </div>
          <div className="text-xs text-slate-500 mt-1">চলমান মাসে আপনার গৃহীত মিল</div>
        </div>

        <div className="bg-white border border-slate-200 p-4 rounded-2xl">
          <div className="text-xs font-medium text-slate-500 mb-1">আপনার মোট জমা</div>
          <div
            data-testid="stat-total-deposit"
            className="text-2xl font-bold text-emerald-700 tabular-nums"
          >
            ৳ {memberFinancial.deposited.toLocaleString('en-US')}
          </div>
          <div className="text-xs text-slate-500 mt-1">আপনার অনুমোদিত ডিপোজিট</div>
        </div>

        <div className="bg-white border border-slate-200 p-4 rounded-2xl">
          <div className="text-xs font-medium text-slate-500 mb-1">আপনার বর্তমান ব্যালেন্স</div>
          <div
            data-testid="stat-total-bazar"
            className={`text-2xl font-bold tabular-nums ${
              isSurplus ? 'text-emerald-700' : 'text-rose-700'
            }`}
          >
            {isSurplus ? '৳ ' : '-৳ '}
            {Math.abs(memberFinancial.netBalance).toFixed(0)}
          </div>
          <div className="text-xs text-slate-500 mt-1 tabular-nums">
            মিল ও জরিমানা খরচ: ৳ {memberFinancial.totalExpense.toFixed(0)}
          </div>
        </div>

        <div className="bg-white border border-slate-200 p-4 rounded-2xl">
          <div className="text-xs font-medium text-slate-500 mb-1">বর্তমান মিল রেট</div>
          <div
            data-testid="stat-meal-rate"
            className="text-2xl font-bold text-teal-700 tabular-nums"
          >
            ৳ {mealRate.toFixed(2)}
          </div>
          <div className="text-xs text-slate-500 mt-1">প্রতি ১.০ মিলের গড় ব্যয়</div>
        </div>
      </section>
    );
  }

  return (
    <section aria-label="মেসের সারসংক্ষেপ" className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
      <div className="bg-white border border-slate-200 p-4 rounded-2xl">
        <div className="text-xs font-medium text-slate-500 mb-1">মোট মিল · গেস্ট সহ</div>
        <div
          data-testid="stat-total-meals"
          className="text-2xl font-bold text-slate-900 tabular-nums"
        >
          {totalMeals.toFixed(1)}
        </div>
        <div className="text-xs text-slate-500 mt-1">চলমান মাসের সর্বমোট মিল</div>
      </div>

      <div className="bg-white border border-slate-200 p-4 rounded-2xl">
        <div className="text-xs font-medium text-slate-500 mb-1">মোট জমা · সব মেম্বার</div>
        <div
          data-testid="stat-total-deposit"
          className="text-2xl font-bold text-emerald-700 tabular-nums"
        >
          ৳ {totalDeposit.toLocaleString('en-US')}
        </div>
        <div className="text-xs text-slate-500 mt-1">ক্যাশ ও মোবাইল ব্যাংকিং জমা</div>
      </div>

      <div className="bg-white border border-slate-200 p-4 rounded-2xl">
        <div className="text-xs font-medium text-slate-500 mb-1">বাজার খরচ · অনুমোদিত</div>
        <div
          data-testid="stat-total-bazar"
          className="text-2xl font-bold text-amber-700 tabular-nums"
        >
          ৳ {totalBazar.toLocaleString('en-US')}
        </div>
        <div className="text-xs text-slate-500 mt-1 tabular-nums">
          অবশিষ্ট ক্যাশ: ৳ {cashBalance.toLocaleString('en-US')}
        </div>
      </div>

      <div className="bg-white border border-slate-200 p-4 rounded-2xl">
        <div className="text-xs font-medium text-slate-500 mb-1">বর্তমান মিল রেট</div>
        <div
          data-testid="stat-meal-rate"
          className="text-2xl font-bold text-teal-700 tabular-nums"
        >
          ৳ {mealRate.toFixed(2)}
        </div>
        <div className="text-xs text-slate-500 mt-1">প্রতি ১.০ মিলের গড় ব্যয়</div>
      </div>
    </section>
  );
};

