import React from 'react';
import {
  CheckCircle2,
  Clock,
  ExternalLink,
  MessageCircle,
  Pencil,
  Plus,
  Receipt,
  Trash2,
} from 'lucide-react';
import type { BazarEntry, BazarRequisition, Member } from '../types/mess';
import type { BazarReceiptModalSeed } from './Modals';
import {
  buildBazarDutyWhatsAppMessage,
  buildWhatsAppShareUrl,
  calculateBazarTripCounts,
} from '../utils/messCalculations';

interface BazarTabProps {
  currentUser: Member;
  members: Member[];
  bazar: BazarEntry[];
  bazarRequests: BazarRequisition[];
  onOpenAddBazar: () => void;
  onOpenBazarRequestModal: () => void;
  onOpenBazarReceiptModal: (seed: BazarReceiptModalSeed) => void;
  onOpenEditBazar: (entry: BazarEntry) => void;
  onDeleteBazarRequest: (reqId: string) => void;
}

export const BazarTab: React.FC<BazarTabProps> = ({
  currentUser,
  members,
  bazar,
  bazarRequests,
  onOpenAddBazar,
  onOpenBazarRequestModal,
  onOpenBazarReceiptModal,
  onOpenEditBazar,
  onDeleteBazarRequest,
}) => {
  const tripCounts = calculateBazarTripCounts(members, bazar);
  const isAdmin = currentUser.isAdmin;
  const scheduledDuties = bazarRequests.filter((r) => r.status === 'scheduled');

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-3xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            {isAdmin ? 'যৌথ বাজার খাতা, ফর্দ ও ডিজিটাল রশিদ' : 'যৌথ বাজার খাতা ও বাজারের সূচি'}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {isAdmin
              ? 'একাধিক মেম্বারের বাজারের দায়িত্ব বণ্টন, ওয়ান-ক্লিক WhatsApp ফর্দ এবং ডিজিটাল বাজার রশিদ প্রেরণ'
              : 'যৌথ বাজারের খরচ জমা দিন এবং মেসের অনুমোদিত স্থায়ী বাজার খাতা দেখুন'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {isAdmin && (
            <>
              <button
                type="button"
                onClick={onOpenBazarRequestModal}
                className="min-h-[44px] px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
              >
                <MessageCircle className="w-4 h-4" />
                <span>বাজারের রিকোয়েস্ট (WhatsApp)</span>
              </button>
              <button
                type="button"
                onClick={() => onOpenBazarReceiptModal({ mode: 'new' })}
                className="min-h-[44px] px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
              >
                <Receipt className="w-4 h-4" />
                <span>রশিদ তৈরি করুন</span>
              </button>
            </>
          )}

          <button
            type="button"
            onClick={onOpenAddBazar}
            className="min-h-[44px] px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>যৌথ বাজার যুক্ত করুন</span>
          </button>
        </div>
      </div>

      {/* Scheduled Bazar Duty & 1-Click Direct WhatsApp Dispatch */}
      {scheduledDuties.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-3xl p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                নির্ধারিত বাজারের ফর্দ ও দায়িত্ব ({scheduledDuties.length} টি)
              </h3>
              <p className="text-xs text-slate-500">
                {isAdmin
                  ? 'যাদের বাজারের তারিখ নির্ধারিত হয়েছে তাদের WhatsApp নম্বরে ১ ক্লিকে ফর্দ বা রশিদ পাঠান'
                  : 'আগামী নির্ধারিত বাজারের তারিখ, দায়িত্বপ্রাপ্ত মেম্বার ও বাজারের ফর্দ'}
              </p>
            </div>
          </div>

          <div className="divide-y divide-slate-100 border-t border-slate-100">
            {scheduledDuties.map((duty) => {
              const assignedMembers = duty.shopperIds
                .map((id) => members.find((m) => m.id === id))
                .filter((m): m is Member => Boolean(m));
              const dutyMsg = buildBazarDutyWhatsAppMessage(
                duty,
                assignedMembers.map((m) => m.name)
              );

              return (
                <div
                  key={duty.id}
                  className="py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span className="font-mono font-semibold text-teal-700 tabular-nums">
                        {duty.date}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-semibold text-slate-900">
                        বাজারকারী ({assignedMembers.length} জন):{' '}
                        {assignedMembers.map((m) => m.name).join(', ') || 'নির্ধারিত নয়'}
                      </span>
                      {duty.estimatedAmount > 0 && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="tabular-nums font-medium text-amber-700">
                            সম্ভাব্য বাজেট: ৳ {duty.estimatedAmount.toLocaleString('en-US')}
                          </span>
                        </>
                      )}
                    </div>
                    <p className="text-sm font-medium text-slate-900">
                      কি কি কিনতে হবে: <span className="font-normal text-slate-700">{duty.items}</span>
                    </p>
                    {duty.note && <p className="text-xs text-slate-500">নোট: {duty.note}</p>}
                  </div>

                  {isAdmin && (
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      {assignedMembers.map((shopper) => {
                        const wpNum = shopper.whatsapp || shopper.phone;
                        const href = buildWhatsAppShareUrl(wpNum, dutyMsg);
                        return (
                          <a
                            key={shopper.id}
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="min-h-[44px] px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
                          >
                            <MessageCircle className="w-3.5 h-3.5 shrink-0" />
                            <span>{shopper.name}-কে WhatsApp</span>
                            <ExternalLink className="w-3 h-3 opacity-80 shrink-0" />
                          </a>
                        );
                      })}

                      <button
                        type="button"
                        onClick={() =>
                          onOpenBazarReceiptModal({ mode: 'from-request', request: duty })
                        }
                        className="min-h-[44px] px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
                      >
                        <Receipt className="w-3.5 h-3.5" />
                        <span>রশিদ ও সম্পন্ন</span>
                      </button>
                      <button
                        type="button"
                        aria-label="বাজারের রিকোয়েস্ট মুছুন"
                        onClick={() => onDeleteBazarRequest(duty.id)}
                        className="min-h-[44px] min-w-[44px] bg-slate-100 hover:bg-rose-50 text-rose-600 rounded-xl inline-flex items-center justify-center transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Trip Counter Strip */}
      <div className="bg-white border border-slate-200 rounded-3xl p-5 space-y-4">
        <div>
          <h3 className="text-sm font-bold text-slate-900">মেম্বারদের বাজার দেওয়ার সংখ্যা</h3>
          <p className="text-xs text-slate-500">অনুমোদিত যৌথ ও একক বাজারের ট্রিপ সংখ্যা</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3.5">
          {members.map((m) => (
            <div
              key={m.id}
              className="bg-slate-50 rounded-2xl p-3.5 flex items-center justify-between"
            >
              <div>
                <div className="font-semibold text-slate-900 text-sm">{m.name}</div>
                <div className="text-xs text-slate-500">সম্পন্ন ট্রিপ</div>
              </div>
              <div
                data-testid={`trip-count-${m.id}`}
                className="text-base font-bold text-teal-700 tabular-nums"
              >
                {tripCounts[m.id] || 0} বার
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bazar History Table (Permanent Non-Deletable Ledger, Editable by Admin) */}
      <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 space-y-0.5">
          <h3 className="text-sm font-bold text-slate-900">বাজার খরচের স্থায়ী খাতা ও রশিদ</h3>
          <p className="text-xs text-slate-500">
            স্বচ্ছতা ও কারচুপি রোধে একবার বাজারের টাকা তোলা হলে তা কখনো মুছা যাবে না — শুধুমাত্র এডমিন প্রয়োজনে টাকা এডিট করতে পারবেন এবং পূর্বের হিসাব দৃশ্যমান থাকবে
          </p>
        </div>

        {bazar.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            এখনো কোনো বাজার এন্ট্রি যুক্ত করা হয়নি।
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 font-semibold">
                <tr>
                  <th className="py-3.5 px-4">তারিখ</th>
                  <th className="py-3.5 px-4">বাজারকারী মেম্বারবৃন্দ</th>
                  <th className="py-3.5 px-4">আইটেম বিবরণ</th>
                  <th className="py-3.5 px-4 text-right">মোট খরচ (৳)</th>
                  <th className="py-3.5 px-4 text-right">স্ট্যাটাস</th>
                  {isAdmin && <th className="py-3.5 px-4 text-right">রশিদ ও অ্যাকশন</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {bazar.map((entry) => {
                  const shopperNames = entry.shopperIds
                    .map((id) => members.find((m) => m.id === id)?.name)
                    .filter(Boolean)
                    .join(', ');
                  const isPending = entry.status === 'pending';
                  const wasEdited = (entry.editCount || 0) > 0;

                  return (
                    <tr key={entry.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-mono tabular-nums text-slate-500 whitespace-nowrap">
                        {entry.date}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-slate-900">
                        {shopperNames || 'অজানা'}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">
                        <div>{entry.items}</div>
                        {entry.note && (
                          <div className="text-[11px] text-slate-500 mt-0.5">নোট: {entry.note}</div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="font-bold text-amber-700 tabular-nums">
                          ৳ {entry.amount.toLocaleString('en-US')}
                        </div>
                        {wasEdited && (
                          <div className="text-[11px] text-slate-500 tabular-nums mt-0.5">
                            {entry.previousAmount !== undefined
                              ? `পূর্বে: ৳ ${entry.previousAmount.toLocaleString('en-US')} · এডিটেড`
                              : `এডিটেড (${entry.editedAt || ''})`}
                          </div>
                        )}
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
                            <span>অনুমোদিত · স্থায়ী</span>
                          </span>
                        )}
                      </td>
                      {isAdmin && (
                        <td className="py-2.5 px-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center justify-end gap-2">
                            <button
                              type="button"
                              data-testid={`edit-bazar-${entry.id}`}
                              aria-label={`${shopperNames || entry.date} বাজার হিসাব এডিট করুন`}
                              onClick={() => onOpenEditBazar(entry)}
                              className="min-h-[38px] px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold rounded-xl inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                              <span>এডিট</span>
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                onOpenBazarReceiptModal({ mode: 'existing-bazar', entry })
                              }
                              className="min-h-[38px] px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-semibold rounded-xl inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                            >
                              <Receipt className="w-3.5 h-3.5" />
                              <span>রশিদ ও WhatsApp</span>
                            </button>
                          </div>
                        </td>
                      )}
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

