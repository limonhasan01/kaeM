import React, { useMemo } from 'react';
import { CheckCircle2, Clock, Plus } from 'lucide-react';
import type { DepositEntry, Member } from '../types/mess';
import type { MemberFinancialSummary } from '../utils/messCalculations';

interface DepositsTabProps {
  currentUser: Member;
  members: Member[];
  deposits: DepositEntry[];
  financials: MemberFinancialSummary[];
  onOpenAddDeposit: () => void;
}

export const DepositsTab: React.FC<DepositsTabProps> = ({
  currentUser,
  members,
  deposits,
  financials,
  onOpenAddDeposit,
}) => {
  const isAdmin = currentUser.isAdmin;

  const visibleFinancials = useMemo(
    () => (isAdmin ? financials : financials.filter((f) => f.member.id === currentUser.id)),
    [isAdmin, financials, currentUser.id]
  );

  const visibleDeposits = useMemo(
    () => (isAdmin ? deposits : deposits.filter((d) => d.memberId === currentUser.id)),
    [isAdmin, deposits, currentUser.id]
  );

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-3xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            {isAdmin ? 'মেস ডিপোজিট খাতা ও ব্যালেন্স (সব মেম্বার)' : 'আপনার জমা খাতা ও ব্যালেন্স বিবরণী'}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {isAdmin
              ? 'প্রত্যেক মেম্বারের জমা, আনুমানিক মিল খরচ, জরিমানা এবং অবশিষ্ট ব্যালেন্স'
              : 'আপনার ব্যক্তিগত জমা টাকা, আনুমানিক মিল খরচ, জরিমানা এবং বর্তমান ব্যালেন্স'}
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenAddDeposit}
          className="min-h-[44px] px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>{isAdmin ? 'টাকা জমা এন্ট্রি' : 'নিজের টাকা জমার আবেদন'}</span>
        </button>
      </div>

      {/* Member Balance Cards */}
      <div className={`grid grid-cols-1 ${isAdmin ? 'md:grid-cols-3' : ''} gap-4`}>
        {visibleFinancials.map((item) => {
          const { member, deposited, mealCost, finesTotal, netBalance } = item;
          return (
            <div
              key={member.id}
              className="bg-white border border-slate-200 rounded-3xl p-5 space-y-3"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-900 text-base">
                  {isAdmin ? member.name : `${member.name} · আপনার হিসাব`}
                </h3>
                <span className="text-xs text-slate-500 font-mono">@{member.username}</span>
              </div>

              <div
                className={`grid ${
                  isAdmin ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-4'
                } gap-3 text-xs pt-3 border-t border-slate-100`}
              >
                <div>
                  <span className="text-slate-500">মোট জমা</span>
                  <div className="font-semibold text-emerald-700 tabular-nums text-sm mt-0.5">
                    ৳ {deposited.toLocaleString('en-US')}
                  </div>
                </div>
                <div>
                  <span className="text-slate-500">মিল খরচ</span>
                  <div className="font-semibold text-rose-700 tabular-nums text-sm mt-0.5">
                    ৳ {mealCost.toFixed(1)}
                  </div>
                </div>
                <div>
                  <span className="text-slate-500">জরিমানা</span>
                  <div className="font-semibold text-amber-700 tabular-nums text-sm mt-0.5">
                    ৳ {finesTotal.toLocaleString('en-US')}
                  </div>
                </div>
                <div>
                  <span className="text-slate-500">অবশিষ্ট ব্যালেন্স</span>
                  <div
                    className={`font-bold tabular-nums text-sm mt-0.5 ${
                      netBalance >= -0.005 ? 'text-emerald-700' : 'text-rose-700'
                    }`}
                  >
                    ৳ {netBalance.toFixed(1)}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Deposits History Table */}
      <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-900">
            {isAdmin ? 'জমা দেওয়ার সাম্প্রতিক ইতিহাস (সব মেম্বার)' : 'আপনার জমা দেওয়ার ইতিহাস'}
          </h3>
        </div>

        {visibleDeposits.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            এখনো কোনো জমা এন্ট্রি নেই।
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 font-semibold">
                <tr>
                  <th className="py-3.5 px-4">তারিখ</th>
                  {isAdmin && <th className="py-3.5 px-4">মেম্বার</th>}
                  <th className="py-3.5 px-4">মেথড · নোট</th>
                  <th className="py-3.5 px-4 text-right">পরিমাণ (৳)</th>
                  <th className="py-3.5 px-4 text-right">অবস্থা</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibleDeposits.map((dep) => {
                  const mem = members.find((m) => m.id === dep.memberId);
                  const isPending = dep.status === 'pending';
                  return (
                    <tr key={dep.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-mono tabular-nums text-slate-500 whitespace-nowrap">
                        {dep.date}
                      </td>
                      {isAdmin && (
                        <td className="py-3.5 px-4 font-semibold text-slate-900">
                          {mem ? mem.name : 'অজানা'}
                        </td>
                      )}
                      <td className="py-3.5 px-4 text-slate-600">{dep.note}</td>
                      <td className="py-3.5 px-4 text-right font-bold text-emerald-700 tabular-nums whitespace-nowrap">
                        ৳ {dep.amount.toLocaleString('en-US')}
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        {isPending ? (
                          <span className="inline-flex items-center gap-1 text-amber-700 font-medium">
                            <Clock className="w-3.5 h-3.5" />
                            <span>পেন্ডিং</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>অনুমোদিত</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

