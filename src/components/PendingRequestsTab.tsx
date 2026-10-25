import React from 'react';
import {
  Check,
  CheckCircle2,
  Clock,
  ExternalLink,
  MessageCircle,
  Receipt,
  Trash2,
  X,
} from 'lucide-react';
import type { BazarRequisition, Member, PendingRequest, RequestType } from '../types/mess';
import type { BazarReceiptModalSeed } from './Modals';
import { buildBazarDutyWhatsAppMessage, buildWhatsAppShareUrl } from '../utils/messCalculations';

interface PendingRequestsTabProps {
  currentUser: Member;
  members: Member[];
  bazarRequests: BazarRequisition[];
  pendingRequests: PendingRequest[];
  onApprove: (reqId: string) => void;
  onReject: (reqId: string) => void;
  onOpenUserSwitch: () => void;
  onOpenBazarRequestModal: () => void;
  onOpenBazarReceiptModal: (seed: BazarReceiptModalSeed) => void;
  onDeleteBazarRequest: (reqId: string) => void;
}

const REQUEST_TYPE_LABELS: Record<RequestType, string> = {
  MEAL_CHANGE: 'মিল পরিবর্তন',
  GUEST_MEAL: 'গেস্ট মিল',
  BAZAR_ENTRY: 'যৌথ বাজার',
  DEPOSIT_ENTRY: 'টাকা জমা',
  PROFILE_EDIT: 'প্রোফাইল আপডেট',
  TIME_EXTENSION: 'সময় বৃদ্ধির আবেদন',
  MESS_LEAVE: 'মেস ছুটির আবেদন',
  FEEDBACK: 'মতামত ও অভিযোগ',
};

export const PendingRequestsTab: React.FC<PendingRequestsTabProps> = ({
  currentUser,
  members,
  bazarRequests,
  pendingRequests,
  onApprove,
  onReject,
  onOpenUserSwitch,
  onOpenBazarRequestModal,
  onOpenBazarReceiptModal,
  onDeleteBazarRequest,
}) => {
  const isAdmin = currentUser.isAdmin;
  const scheduledDuties = bazarRequests.filter((r) => r.status === 'scheduled');

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-3xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">অ্যাডমিন প্যানেল ও অ্যাপ্রুভাল হাব</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            আবেদন অনুমোদন এবং সরাসরি WhatsApp-এ বাজারের রিকোয়েস্ট ও ডিজিটাল বাজার রশিদ প্রেরণ
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-amber-700 tabular-nums">
            মোট পেন্ডিং: {pendingRequests.length} টি
          </span>
          {!isAdmin && (
            <button
              type="button"
              onClick={onOpenUserSwitch}
              className="min-h-[44px] px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
            >
              এডমিন হিসেবে প্রবেশ করুন
            </button>
          )}
        </div>
      </div>

      {/* Admin Direct WhatsApp Bazar Request & Digital Receipt Hub */}
      <div className="bg-white border border-slate-200 rounded-3xl p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              বাজারের দায়িত্ব ও ডিজিটাল রশিদ (ওয়ান-ক্লিক WhatsApp)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              ২ জন বা একাধিক মেম্বারের বাজারের তারিখ ও কি কি কিনতে হবে তা নির্ধারণ করে ১ ক্লিকে যার যার WhatsApp-এ ফর্দ ও রশিদ পাঠান
            </p>
          </div>

          {isAdmin ? (
            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={onOpenBazarRequestModal}
                className="min-h-[44px] px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl transition-colors inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
              >
                <MessageCircle className="w-4 h-4" />
                <span>বাজারের রিকোয়েস্ট পাঠান</span>
              </button>
              <button
                type="button"
                onClick={() => onOpenBazarReceiptModal({ mode: 'new' })}
                className="min-h-[44px] px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-xl transition-colors inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
              >
                <Receipt className="w-4 h-4" />
                <span>ডিজিটাল বাজার রশিদ বানান</span>
              </button>
            </div>
          ) : (
            <span className="text-xs text-slate-500">
              নতুন বাজার রিকোয়েস্ট ও রশিদ তৈরি করতে এডমিন লগইন করুন
            </span>
          )}
        </div>

        {scheduledDuties.length > 0 && (
          <div className="divide-y divide-slate-100 border-t border-slate-100 pt-1">
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
                  className="py-3.5 flex flex-col lg:flex-row lg:items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span className="font-mono font-semibold text-teal-700 tabular-nums">
                        {duty.date}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-semibold text-slate-900">
                        বাজারকারী: {assignedMembers.map((m) => m.name).join(', ') || 'নির্ধারিত নয়'}
                      </span>
                      {duty.estimatedAmount > 0 && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="tabular-nums text-amber-700 font-medium">
                            বাজেট: ৳ {duty.estimatedAmount.toLocaleString('en-US')}
                          </span>
                        </>
                      )}
                    </div>
                    <p className="text-xs sm:text-sm text-slate-800">
                      <span className="font-semibold">তালিকা:</span> {duty.items}
                    </p>
                  </div>

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
                          <span>{shopper.name} WhatsApp</span>
                          <ExternalLink className="w-3 h-3 opacity-80 shrink-0" />
                        </a>
                      );
                    })}

                    {isAdmin && (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            onOpenBazarReceiptModal({ mode: 'from-request', request: duty })
                          }
                          className="min-h-[44px] px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
                        >
                          <Receipt className="w-3.5 h-3.5" />
                          <span>রশিদ তৈরি</span>
                        </button>
                        <button
                          type="button"
                          aria-label="বাজারের রিকোয়েস্ট মুছুন"
                          onClick={() => onDeleteBazarRequest(duty.id)}
                          className="min-h-[44px] min-w-[44px] bg-slate-100 hover:bg-rose-50 text-rose-600 rounded-xl inline-flex items-center justify-center transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Member Approval Queue */}
      {pendingRequests.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-3xl p-10 text-center space-y-2">
          <CheckCircle2 className="w-8 h-8 text-teal-600/70 mx-auto" />
          <p className="text-sm font-semibold text-slate-800">কোনো পেন্ডিং রিকোয়েস্ট নেই</p>
          <p className="text-xs text-slate-500">সব আবেদন অনুমোদিত বা নিষ্পত্তি হয়েছে।</p>
        </div>
      ) : (
        <div className="space-y-3.5">
          {pendingRequests.map((req) => (
            <div
              key={req.id}
              className="bg-white border border-slate-200 rounded-3xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span className="font-semibold text-teal-700">
                    {REQUEST_TYPE_LABELS[req.type]}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums">{req.date}</span>
                  <span aria-hidden="true">·</span>
                  <span>আবেদনকারী: {req.requestedBy}</span>
                </div>
                <p className="text-sm font-semibold text-slate-900">{req.details}</p>
              </div>

              {isAdmin ? (
                <div className="flex items-center gap-2.5 shrink-0">
                  <button
                    type="button"
                    aria-label={`${req.details} অনুমোদন করুন`}
                    onClick={() => onApprove(req.id)}
                    className="min-h-[44px] px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <Check className="w-4 h-4" />
                    <span>অ্যাপ্রুভ</span>
                  </button>
                  <button
                    type="button"
                    aria-label={`${req.details} বাতিল করুন`}
                    onClick={() => onReject(req.id)}
                    className="min-h-[44px] px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                    <span>বাতিল</span>
                  </button>
                </div>
              ) : (
                <div className="inline-flex items-center gap-1.5 text-xs text-amber-700 font-medium shrink-0">
                  <Clock className="w-4 h-4" />
                  <span>এডমিন অনুমোদনের অপেক্ষায়</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

