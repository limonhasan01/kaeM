import React, { useState } from 'react';
import { CalendarDays, ExternalLink, MessageCircle, Pencil, Trash2, UserPlus } from 'lucide-react';
import type { Member } from '../types/mess';
import { buildWhatsAppShareUrl } from '../utils/messCalculations';

interface MembersTabProps {
  members: Member[];
  currentUser: Member;
  onOpenAddMember: () => void;
  onOpenEditProfile: (member: Member) => void;
  onDeleteMember: (memberId: string) => void;
  onViewMemberMealHistory: (memberId: string) => void;
}

export const MembersTab: React.FC<MembersTabProps> = ({
  members,
  currentUser,
  onOpenAddMember,
  onOpenEditProfile,
  onDeleteMember,
  onViewMemberMealHistory,
}) => {
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const isAdmin = currentUser.isAdmin;

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-3xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">মেম্বারদের ডিরেক্টরি ও WhatsApp নম্বর</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            সক্রিয় মেস সদস্য ({members.length} জন) — প্রোফাইলে WhatsApp নম্বর সংরক্ষণ এবং ১ মাসের মিল খাতা দেখুন
          </p>
        </div>

        {isAdmin && (
          <button
            type="button"
            onClick={onOpenAddMember}
            className="min-h-[44px] px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>নতুন মেম্বার যোগ করুন</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {members.map((member) => {
          const isSelf = currentUser.id === member.id;
          const canEdit = isSelf || isAdmin;
          const isConfirmingDelete = confirmDeleteId === member.id;
          const wpNumber = member.whatsapp || member.phone;
          const directWpHref = buildWhatsAppShareUrl(
            wpNumber,
            `হ্যালো ${member.name}, মেস ম্যানেজার থেকে যোগাযোগ করছি।`
          );

          return (
            <div
              key={member.id}
              className="bg-white border border-slate-200 rounded-3xl p-5 flex flex-col justify-between gap-4"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-700 font-bold text-lg flex items-center justify-center shrink-0">
                      {member.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-bold text-slate-900 text-base truncate">{member.name}</h3>
                      <p className="text-xs text-slate-500 font-mono truncate">
                        আইডি: @{member.username}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 space-y-2 text-xs text-slate-600">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-500">ফোন নম্বর</span>
                    <span className="font-mono tabular-nums text-slate-800">{member.phone}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-500">WhatsApp নম্বর</span>
                    <a
                      href={directWpHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono tabular-nums text-emerald-700 hover:text-emerald-800 font-semibold inline-flex items-center gap-1"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>{wpNumber}</span>
                      <ExternalLink className="w-3 h-3 opacity-75" />
                    </a>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 space-y-2">
                <button
                  type="button"
                  onClick={() => onViewMemberMealHistory(member.id)}
                  className="w-full min-h-[44px] px-3 py-2 bg-teal-50 hover:bg-teal-100 text-teal-800 text-xs font-semibold rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <CalendarDays className="w-4 h-4 shrink-0" />
                  <span>৩০ দিনের মিল হিসাব দেখুন</span>
                </button>

                <div className="flex items-center justify-between gap-2">
                  {canEdit ? (
                    <button
                      type="button"
                      onClick={() => onOpenEditProfile(member)}
                      className="flex-1 min-h-[44px] px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      <span>প্রোফাইল ও WhatsApp এডিট</span>
                    </button>
                  ) : (
                    <span className="text-xs text-slate-400 py-2">নিজস্ব প্রোফাইল এডিটযোগ্য</span>
                  )}

                  {isAdmin && !isConfirmingDelete && (
                    <button
                      type="button"
                      aria-label={`${member.name} মেম্বার ডিলিট করুন`}
                      onClick={() => setConfirmDeleteId(member.id)}
                      className="min-h-[44px] min-w-[44px] bg-slate-100 hover:bg-rose-50 text-rose-600 rounded-xl flex items-center justify-center transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}

                  {isAdmin && isConfirmingDelete && (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          onDeleteMember(member.id);
                          setConfirmDeleteId(null);
                        }}
                        className="min-h-[44px] px-3 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-xl cursor-pointer"
                      >
                        নিশ্চিত ডিলিট
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(null)}
                        className="min-h-[44px] px-2.5 bg-slate-100 text-slate-700 text-xs rounded-xl cursor-pointer"
                      >
                        না
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

