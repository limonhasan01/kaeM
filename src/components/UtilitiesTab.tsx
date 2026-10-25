import React, { useMemo, useState } from 'react';
import { Dices, Plus } from 'lucide-react';
import type { FineEntry, Member, UtilityConfig } from '../types/mess';
import { calculateUtilityShare } from '../utils/messCalculations';

interface UtilitiesTabProps {
  members: Member[];
  currentUser: Member;
  fines: FineEntry[];
  utilities: UtilityConfig;
  onUpdateUtilities: (next: UtilityConfig) => void;
  onOpenFineModal: () => void;
}

export const UtilitiesTab: React.FC<UtilitiesTabProps> = ({
  members,
  currentUser,
  fines,
  utilities,
  onUpdateUtilities,
  onOpenFineModal,
}) => {
  const isAdmin = currentUser.isAdmin;
  const [selectedDutyMember, setSelectedDutyMember] = useState<string | null>(null);
  const { total: totalUtility, perMember } = calculateUtilityShare(utilities, members.length);

  const visibleFines = useMemo(
    () => (isAdmin ? fines : fines.filter((f) => f.memberId === currentUser.id)),
    [isAdmin, fines, currentUser.id]
  );

  const handleSpinDuty = () => {
    if (members.length === 0) return;
    const idx = Math.floor(Math.random() * members.length);
    setSelectedDutyMember(members[idx].name);
  };

  return (
    <div className="space-y-6">
      {/* Equal Utility & Rent Splitter (Read-only for Member, Editable for Admin) */}
      <div className="bg-white border border-slate-200 rounded-3xl p-5 space-y-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            {isAdmin ? 'ইউটিলিটি ও বাসা ভাড়া সমান বণ্টন (এডমিন কনফিগারেশন)' : 'ইউটিলিটি বিল ও বাসা ভাড়ায় আপনার প্রদেয় অংশ'}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            মোট ইউটিলিটি খরচ ({members.length} জন মেম্বারের মধ্যে সমান ভাগে বণ্টিত)
          </p>
        </div>

        {isAdmin ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 text-xs">
            <div>
              <label htmlFor="util-rent" className="block text-slate-600 font-medium mb-1.5">
                বাসা ভাড়া (৳)
              </label>
              <input
                id="util-rent"
                type="number"
                min="0"
                value={utilities.rent}
                onChange={(e) =>
                  onUpdateUtilities({ ...utilities, rent: Math.max(0, Number(e.target.value) || 0) })
                }
                className="w-full min-h-[44px] bg-slate-50 border border-slate-200 text-slate-900 rounded-xl px-3 py-2 tabular-nums focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
            </div>

            <div>
              <label htmlFor="util-electric" className="block text-slate-600 font-medium mb-1.5">
                বিদ্যুৎ বিল (৳)
              </label>
              <input
                id="util-electric"
                type="number"
                min="0"
                value={utilities.electric}
                onChange={(e) =>
                  onUpdateUtilities({
                    ...utilities,
                    electric: Math.max(0, Number(e.target.value) || 0),
                  })
                }
                className="w-full min-h-[44px] bg-slate-50 border border-slate-200 text-slate-900 rounded-xl px-3 py-2 tabular-nums focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
            </div>

            <div>
              <label htmlFor="util-gas" className="block text-slate-600 font-medium mb-1.5">
                গ্যাস সিলিন্ডার (৳)
              </label>
              <input
                id="util-gas"
                type="number"
                min="0"
                value={utilities.gas}
                onChange={(e) =>
                  onUpdateUtilities({ ...utilities, gas: Math.max(0, Number(e.target.value) || 0) })
                }
                className="w-full min-h-[44px] bg-slate-50 border border-slate-200 text-slate-900 rounded-xl px-3 py-2 tabular-nums focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
            </div>

            <div>
              <label htmlFor="util-other" className="block text-slate-600 font-medium mb-1.5">
                ওয়াইফাই ও বুয়া (৳)
              </label>
              <input
                id="util-other"
                type="number"
                min="0"
                value={utilities.other}
                onChange={(e) =>
                  onUpdateUtilities({
                    ...utilities,
                    other: Math.max(0, Number(e.target.value) || 0),
                  })
                }
                className="w-full min-h-[44px] bg-slate-50 border border-slate-200 text-slate-900 rounded-xl px-3 py-2 tabular-nums focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div className="bg-slate-50 rounded-2xl p-3.5">
              <div className="text-xs text-slate-500">বাসা ভাড়া</div>
              <div className="text-base font-bold text-slate-900 tabular-nums mt-1">
                ৳ {utilities.rent.toLocaleString('en-US')}
              </div>
            </div>
            <div className="bg-slate-50 rounded-2xl p-3.5">
              <div className="text-xs text-slate-500">বিদ্যুৎ বিল</div>
              <div className="text-base font-bold text-slate-900 tabular-nums mt-1">
                ৳ {utilities.electric.toLocaleString('en-US')}
              </div>
            </div>
            <div className="bg-slate-50 rounded-2xl p-3.5">
              <div className="text-xs text-slate-500">গ্যাস সিলিন্ডার</div>
              <div className="text-base font-bold text-slate-900 tabular-nums mt-1">
                ৳ {utilities.gas.toLocaleString('en-US')}
              </div>
            </div>
            <div className="bg-slate-50 rounded-2xl p-3.5">
              <div className="text-xs text-slate-500">ওয়াইফাই ও বুয়া</div>
              <div className="text-base font-bold text-slate-900 tabular-nums mt-1">
                ৳ {utilities.other.toLocaleString('en-US')}
              </div>
            </div>
          </div>
        )}

        <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-sm">
          <span className="text-slate-600 tabular-nums">
            মোট ইউটিলিটি: ৳ {totalUtility.toLocaleString('en-US')}
          </span>
          <div className="flex items-center gap-2">
            <span className="text-slate-700 font-medium">
              {isAdmin ? 'প্রতিজনের শেয়ার:' : 'আপনার প্রদেয় অংশ:'}
            </span>
            <span
              data-testid="util-per-member"
              className="text-lg font-bold text-teal-700 tabular-nums"
            >
              ৳ {perMember.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* Admin-Only Duty Selector */}
      {isAdmin && (
        <div className="bg-white border border-slate-200 rounded-3xl p-6 text-center space-y-4">
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-900">আজকের রাঁধুনী ও বাজার নির্বাচন</h3>
            <p className="text-xs text-slate-500">
              লটারির মাধ্যমে আজ কে রান্না বা বাজারের দায়িত্ব পালন করবে তা নির্বাচন করুন
            </p>
          </div>

          <div
            data-testid="duty-result"
            className="py-4 px-5 bg-teal-50/70 rounded-2xl max-w-sm mx-auto text-base font-bold text-teal-800"
          >
            {selectedDutyMember ? `আজকে নির্বাচিত: ${selectedDutyMember}` : 'নিচের বাটন চাপুন'}
          </div>

          <button
            type="button"
            onClick={handleSpinDuty}
            disabled={members.length === 0}
            className="min-h-[44px] px-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-xl transition-colors inline-flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Dices className="w-4 h-4" />
            <span>রাঁধুনী বেছে নিন</span>
          </button>
        </div>
      )}

      {/* Fine & Penalty Ledger (Admin sees all + Add Fine button; Member sees only own fines) */}
      {(isAdmin || visibleFines.length > 0) && (
        <div className="bg-white border border-slate-200 rounded-3xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {isAdmin ? 'জরিমানা খাতা (Fine Ledger)' : 'আপনার জরিমানা বিবরণী'}
              </h3>
              <p className="text-xs text-slate-500">
                মেসের নিয়ম ভঙ্গের জরিমানা সরাসরি ব্যালেন্স থেকে সমন্বয় হয়
              </p>
            </div>

            {isAdmin && (
              <button
                type="button"
                onClick={onOpenFineModal}
                className="min-h-[44px] px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-xl transition-colors inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>জরিমানা যুক্ত করুন</span>
              </button>
            )}
          </div>

          {visibleFines.length === 0 ? (
            <div className="py-6 text-center text-xs text-slate-500">
              কোনো মেম্বারের নামে জরিমানা নেই।
            </div>
          ) : (
            <div className="overflow-x-auto border-t border-slate-100 pt-2">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="text-slate-500 border-b border-slate-200 font-semibold">
                  <tr>
                    <th className="py-3 px-3">তারিখ</th>
                    {isAdmin && <th className="py-3 px-3">মেম্বার</th>}
                    <th className="py-3 px-3">কারণ</th>
                    <th className="py-3 px-3 text-right">জরিমানা (৳)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visibleFines.map((fine) => {
                    const mem = members.find((m) => m.id === fine.memberId);
                    return (
                      <tr key={fine.id}>
                        <td className="py-3 px-3 font-mono tabular-nums text-slate-500">
                          {fine.date}
                        </td>
                        {isAdmin && (
                          <td className="py-3 px-3 font-semibold text-slate-900">
                            {mem ? mem.name : 'অজানা'}
                          </td>
                        )}
                        <td className="py-3 px-3 text-slate-600">{fine.reason}</td>
                        <td className="py-3 px-3 text-right font-bold text-rose-700 tabular-nums">
                          ৳ {fine.amount.toLocaleString('en-US')}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

