import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Clock, Lock, Minus, Pencil, Plus, Users } from 'lucide-react';
import type { MealType, MealsRecord, Member, PendingRequest } from '../types/mess';
import {
  buildMemberPeriodMealSummary,
  calculateMemberTotalMeals,
  getDayMemberTotalMeals,
} from '../utils/messCalculations';

interface MealsTabProps {
  selectedDate: string;
  onChangeDate: (date: string) => void;
  members: Member[];
  currentUser: Member;
  meals: MealsRecord;
  pendingRequests: PendingRequest[];
  focusedMemberId?: string | null;
  onSelectFocusedMember?: (memberId: string) => void;
  onToggleMeal: (date: string, memberId: string, mealType: MealType, isChecked: boolean) => void;
  onUpdateGuestMeal: (date: string, memberId: string, count: number) => void;
  onOpenEditOwnProfile: () => void;
  onOpenMemberSwitch: () => void;
  onOpenAdminLogin: () => void;
}

export const MealsTab: React.FC<MealsTabProps> = ({
  selectedDate,
  onChangeDate,
  members,
  currentUser,
  meals,
  pendingRequests,
  focusedMemberId,
  onSelectFocusedMember,
  onToggleMeal,
  onUpdateGuestMeal,
  onOpenEditOwnProfile,
  onOpenMemberSwitch,
  onOpenAdminLogin,
}) => {
  const dayRecord = meals[selectedDate] || {};
  const isAdmin = currentUser.isAdmin;
  const visibleSwitcherMembers = useMemo(
    () => (isAdmin ? members : members.filter((m) => m.id === currentUser.id)),
    [isAdmin, members, currentUser.id]
  );
  const myPendingRequests = useMemo(
    () =>
      isAdmin ? [] : pendingRequests.filter((req) => req.requestedBy === currentUser.name),
    [isAdmin, pendingRequests, currentUser.name]
  );

  // Automatically focus the logged-in member's 30-day meal ledger whenever a member logs in
  const defaultLedgerMemberId = !currentUser.isAdmin
    ? currentUser.id
    : members[0]?.id || '';

  const [ledgerMemberId, setLedgerMemberId] = useState<string>(
    focusedMemberId || defaultLedgerMemberId
  );
  const [periodMode, setPeriodMode] = useState<'30days' | 'month'>('30days');
  const [selectedMonth, setSelectedMonth] = useState<string>(() => selectedDate.slice(0, 7));
  const [showOnlyActiveDays, setShowOnlyActiveDays] = useState<boolean>(false);

  // Sync ledgerMemberId whenever logged-in user switches to a specific Member ID
  useEffect(() => {
    if (!currentUser.isAdmin && members.some((m) => m.id === currentUser.id)) {
      setLedgerMemberId(currentUser.id);
    } else if (!members.some((m) => m.id === ledgerMemberId) && members[0]) {
      setLedgerMemberId(members[0].id);
    }
  }, [currentUser.id, currentUser.isAdmin, members, ledgerMemberId]);

  // Sync when navigated from MembersTab with an explicit focusedMemberId
  useEffect(() => {
    if (focusedMemberId && members.some((m) => m.id === focusedMemberId)) {
      setLedgerMemberId(focusedMemberId);
    }
  }, [focusedMemberId, members]);

  // Generate 7 quick-tap dates centered around selectedDate for thumb ergonomics
  const quickDates = useMemo(() => {
    const base = new Date(`${selectedDate}T00:00:00`);
    if (Number.isNaN(base.getTime())) return [selectedDate];
    const list: string[] = [];
    for (let offset = -3; offset <= 3; offset++) {
      const d = new Date(base);
      d.setDate(base.getDate() + offset);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      list.push(`${y}-${m}-${day}`);
    }
    return list;
  }, [selectedDate]);

  const activeLedgerMember =
    members.find((m) => m.id === ledgerMemberId) || members[0] || currentUser;

  const periodSummary = useMemo(() => {
    if (!activeLedgerMember) {
      return {
        rows: [],
        totalBreakfast: 0,
        totalLunch: 0,
        totalDinner: 0,
        totalGuest: 0,
        grandTotal: 0,
        activeDays: 0,
      };
    }
    if (periodMode === '30days') {
      return buildMemberPeriodMealSummary(meals, activeLedgerMember.id, {
        mode: '30days',
        anchorDate: selectedDate,
      });
    }
    return buildMemberPeriodMealSummary(meals, activeLedgerMember.id, {
      mode: 'month',
      yearMonth: selectedMonth,
    });
  }, [meals, activeLedgerMember, periodMode, selectedDate, selectedMonth]);

  // Order newest date first so recent/today meals appear immediately at the top
  const displayedRows = useMemo(() => {
    const reversed = [...periodSummary.rows].reverse();
    return showOnlyActiveDays ? reversed.filter((r) => r.total > 0) : reversed;
  }, [periodSummary.rows, showOnlyActiveDays]);

  const handleChooseMember = (id: string) => {
    setLedgerMemberId(id);
    if (onSelectFocusedMember) {
      onSelectFocusedMember(id);
    }
  };

  return (
    <div className="space-y-6">
      {/* Member Dashboard Header Card (Hidden in Admin Panel) */}
      {!isAdmin && (
        <div
          data-testid="member-dashboard-banner"
          className="bg-white border border-slate-200 rounded-3xl p-5 space-y-4"
        >
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-800 font-bold text-lg flex items-center justify-center shrink-0">
                {currentUser.name.charAt(0).toUpperCase()}
              </div>
              <div className="space-y-0.5">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-base sm:text-lg font-bold text-slate-900">
                    {currentUser.name}-এর মেম্বার ড্যাশবোর্ড
                  </h1>
                  <span className="text-xs font-mono text-slate-500">@{currentUser.username}</span>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 tabular-nums">
                  <span>ফোন: {currentUser.phone}</span>
                  <span aria-hidden="true">·</span>
                  <span>WhatsApp: {currentUser.whatsapp || currentUser.phone}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={onOpenEditOwnProfile}
                className="min-h-[42px] px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-xl transition-colors inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
              >
                <Pencil className="w-3.5 h-3.5" />
                <span>প্রোফাইল ও WhatsApp এডিট</span>
              </button>

              <button
                type="button"
                onClick={onOpenMemberSwitch}
                className="min-h-[42px] px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-xl transition-colors inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
              >
                <Users className="w-3.5 h-3.5" />
                <span>অন্য মেম্বার</span>
              </button>

              <button
                type="button"
                data-testid="enter-admin-btn"
                onClick={onOpenAdminLogin}
                className="min-h-[42px] px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl transition-colors inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>এডমিন প্যানেলে প্রবেশ</span>
              </button>
            </div>
          </div>

          {myPendingRequests.length > 0 && (
            <div className="pt-3.5 border-t border-slate-100 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-800">
                <Clock className="w-3.5 h-3.5 shrink-0" />
                <span>
                  আপনার প্রেরিত পেন্ডিং আবেদন ({myPendingRequests.length} টি) · এডমিন অনুমোদনের অপেক্ষায়
                </span>
              </div>
              <div className="divide-y divide-slate-100">
                {myPendingRequests.slice(0, 4).map((req) => (
                  <div
                    key={req.id}
                    className="py-1.5 flex items-center justify-between gap-3 text-xs text-slate-600"
                  >
                    <span>{req.details}</span>
                    <span className="font-mono text-[11px] text-slate-400 shrink-0 tabular-nums">
                      {req.date}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-3xl p-5 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              {isAdmin ? 'দৈনিক ৩ বেলা মিল ও গেস্ট সুইচার (সব মেম্বার)' : 'আপনার দৈনিক ৩ বেলা মিল ও গেস্ট সুইচার'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {isAdmin
                ? 'সকাল ০.৫ মিল · দুপুর ১.০ মিল · রাত ১.০ মিল — এডমিন হিসেবে যেকোনো মেম্বারের মিল সরাসরি আপডেট করুন'
                : 'সকাল ০.৫ মিল · দুপুর ১.০ মিল · রাত ১.০ মিল — আপনার পরিবর্তন এডমিন অনুমোদনের পর খাতায় যুক্ত হবে'}
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <label
              htmlFor="meal-date-input"
              className="text-xs font-medium text-slate-600 whitespace-nowrap"
            >
              তারিখ নির্বাচন:
            </label>
            <input
              id="meal-date-input"
              type="date"
              value={selectedDate}
              onChange={(e) => onChangeDate(e.target.value)}
              className="min-h-[44px] bg-slate-50 border border-slate-200 text-slate-900 rounded-xl px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-teal-600"
            />
          </div>
        </div>

        {/* Android Horizontal Date Scroller */}
        <div className="flex overflow-x-auto hide-scrollbar gap-2 pb-1">
          {quickDates.map((dStr) => {
            const isSelected = dStr === selectedDate;
            const dayNum = dStr.slice(8, 10);
            const monthNum = dStr.slice(5, 7);
            return (
              <button
                key={dStr}
                type="button"
                onClick={() => onChangeDate(dStr)}
                className={`min-h-[44px] min-w-[64px] px-3 py-2 rounded-xl text-xs font-mono transition-colors shrink-0 cursor-pointer ${
                  isSelected
                    ? 'bg-teal-600 text-white font-semibold'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                }`}
              >
                {dayNum}/{monthNum}
              </button>
            );
          })}
        </div>

        {/* Member Meal Rows separated cleanly by hairline dividers */}
        <div className="divide-y divide-slate-100 border-t border-slate-100">
          {visibleSwitcherMembers.map((member) => {
            const userMeal = dayRecord[member.id] || {
              breakfast: 0,
              lunch: 0,
              dinner: 0,
              guest: 0,
            };
            const dayTotal = getDayMemberTotalMeals(userMeal);
            const canEdit = currentUser.isAdmin || currentUser.id === member.id;

            const mealButtons: { type: MealType; label: string; unit: string; active: boolean }[] = [
              {
                type: 'breakfast',
                label: 'সকাল',
                unit: '0.5',
                active: Boolean(userMeal.breakfast && userMeal.breakfast > 0),
              },
              {
                type: 'lunch',
                label: 'দুপুর',
                unit: '1.0',
                active: Boolean(userMeal.lunch && userMeal.lunch > 0),
              },
              {
                type: 'dinner',
                label: 'রাত',
                unit: '1.0',
                active: Boolean(userMeal.dinner && userMeal.dinner > 0),
              },
            ];

            return (
              <div
                key={member.id}
                className="py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-11 h-11 rounded-2xl bg-teal-50 text-teal-700 font-bold text-base flex items-center justify-center shrink-0">
                    {member.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-slate-900 text-sm">{member.name}</h3>
                      {currentUser.id === member.id && (
                        <span className="text-xs font-medium text-teal-700">· আপনি</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 tabular-nums mt-0.5">
                      আজকের মোট:{' '}
                      <span className="text-slate-900 font-semibold">{dayTotal.toFixed(1)}</span> মিল
                      {!canEdit && (
                        <span className="text-slate-400"> · শুধুমাত্র নিজের মিল পরিবর্তনযোগ্য</span>
                      )}
                    </p>
                  </div>
                </div>

                {/* 3 Meal Touch Buttons + Guest Stepper */}
                <div className="flex flex-wrap items-center gap-2.5">
                  {mealButtons.map((mb) => (
                    <button
                      key={mb.type}
                      type="button"
                      disabled={!canEdit}
                      aria-pressed={mb.active}
                      aria-label={`${member.name} ${mb.label} মিল ${mb.active ? 'অফ করুন' : 'অন করুন'}`}
                      onClick={() => onToggleMeal(selectedDate, member.id, mb.type, !mb.active)}
                      className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed ${
                        mb.active
                          ? 'bg-teal-600 text-white'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      <span>{mb.label}</span>
                      <span className="font-mono text-[11px] opacity-85">({mb.unit})</span>
                    </button>
                  ))}

                  {/* Guest Meal Stepper */}
                  <div className="flex items-center gap-1.5 bg-slate-100 rounded-xl px-2.5 py-1 min-h-[44px]">
                    <span className="text-xs text-slate-700 font-medium pr-1">গেস্ট:</span>
                    <button
                      type="button"
                      disabled={!canEdit || (userMeal.guest || 0) <= 0}
                      aria-label={`${member.name} গেস্ট মিল কমান`}
                      onClick={() =>
                        onUpdateGuestMeal(
                          selectedDate,
                          member.id,
                          Math.max(0, (Number(userMeal.guest) || 0) - 0.5)
                        )
                      }
                      className="min-h-[36px] min-w-[36px] rounded-lg bg-white text-slate-700 hover:bg-slate-50 flex items-center justify-center disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      disabled={!canEdit}
                      aria-label={`${member.name} গেস্ট মিল সংখ্যা`}
                      value={userMeal.guest || 0}
                      onChange={(e) =>
                        onUpdateGuestMeal(
                          selectedDate,
                          member.id,
                          Math.max(0, Number(e.target.value) || 0)
                        )
                      }
                      className="w-12 text-center bg-transparent text-slate-900 text-xs font-mono font-semibold focus:outline-none tabular-nums"
                    />
                    <button
                      type="button"
                      disabled={!canEdit}
                      aria-label={`${member.name} গেস্ট মিল বাড়ান`}
                      onClick={() =>
                        onUpdateGuestMeal(
                          selectedDate,
                          member.id,
                          (Number(userMeal.guest) || 0) + 0.5
                        )
                      }
                      className="min-h-[36px] min-w-[36px] rounded-lg bg-white text-slate-700 hover:bg-slate-50 flex items-center justify-center disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Member-Specific 1-Month / 30-Day Detailed Meal Ledger Dashboard */}
      <div
        data-testid="member-30day-meal-dashboard"
        className="bg-white border border-slate-200 rounded-3xl p-5 space-y-5"
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-teal-700 shrink-0" />
              <h3 className="text-base sm:text-lg font-bold text-slate-900">
                {activeLedgerMember
                  ? `${activeLedgerMember.name}-এর ১ মাসের (৩০ দিনের) মিল ড্যাশবোর্ড`
                  : 'মেম্বারের ৩০ দিনের মিল ড্যাশবোর্ড'}
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {isAdmin
                ? 'যেকোনো মেম্বার নির্বাচন করে বিগত ৩০ দিনের কোন তারিখে কয়টি মিল হয়েছে তা যাচাই করুন'
                : 'আপনার বিগত ৩০ দিনের কোন তারিখে কয়টি মিল হয়েছে তার বিস্তারিত হিসাব'}
            </p>
          </div>

          {/* Segmented Mode Controls: 30-Day Rolling vs Calendar Month */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl">
              <button
                type="button"
                onClick={() => setPeriodMode('30days')}
                className={`min-h-[38px] px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                  periodMode === '30days'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                শেষ ৩০ দিন
              </button>
              <button
                type="button"
                onClick={() => setPeriodMode('month')}
                className={`min-h-[38px] px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                  periodMode === 'month'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                মাসভিত্তিক
              </button>
            </div>

            {periodMode === 'month' && (
              <input
                type="month"
                aria-label="মাস নির্বাচন করুন"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="min-h-[42px] bg-slate-50 border border-slate-200 text-slate-900 rounded-xl px-3 py-1.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
            )}

            <button
              type="button"
              onClick={() => setShowOnlyActiveDays((prev) => !prev)}
              className={`min-h-[42px] px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                showOnlyActiveDays
                  ? 'bg-teal-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {showOnlyActiveDays ? 'সব ৩০ দিন দেখান' : 'শুধু মিল খাওয়া দিন'}
            </button>
          </div>
        </div>

        {/* Admin-Only Member Selector Strip (Hidden in Member Dashboard) */}
        {isAdmin && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {members.map((member) => {
              const totalMemberMeals = calculateMemberTotalMeals(meals, member.id);
              const isSelected = activeLedgerMember?.id === member.id;
              return (
                <button
                  key={member.id}
                  type="button"
                  onClick={() => handleChooseMember(member.id)}
                  className={`min-h-[56px] flex items-center justify-between py-3 px-4 rounded-2xl text-left transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-teal-600 text-white'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-900'
                  }`}
                >
                  <div>
                    <div className="font-semibold text-sm flex items-center gap-1.5">
                      <span>{member.name}</span>
                      <span
                        className={`text-[11px] font-mono ${
                          isSelected ? 'text-teal-100' : 'text-slate-500'
                        }`}
                      >
                        @{member.username}
                      </span>
                    </div>
                    <div className={`text-xs ${isSelected ? 'text-teal-100' : 'text-slate-500'}`}>
                      ৩০ দিনের খাতা দেখুন
                    </div>
                  </div>
                  <div className="text-lg font-bold tabular-nums">
                    {totalMemberMeals.toFixed(1)}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Selected Member 30-Day Breakdown KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-1">
          <div className="bg-slate-50 rounded-2xl p-3.5">
            <div className="text-[11px] text-slate-500">মোট মিল ({periodSummary.rows.length} দিন)</div>
            <div
              data-testid="ledger-grand-total"
              className="text-lg font-bold text-teal-700 tabular-nums mt-0.5"
            >
              {periodSummary.grandTotal.toFixed(1)}
            </div>
          </div>
          <div className="bg-slate-50 rounded-2xl p-3.5">
            <div className="text-[11px] text-slate-500">মিল চালু ছিল</div>
            <div className="text-lg font-bold text-slate-900 tabular-nums mt-0.5">
              {periodSummary.activeDays} দিন
            </div>
          </div>
          <div className="bg-slate-50 rounded-2xl p-3.5">
            <div className="text-[11px] text-slate-500">সকালের মিল</div>
            <div className="text-base font-bold text-slate-800 tabular-nums mt-0.5">
              {periodSummary.totalBreakfast.toFixed(1)}
            </div>
          </div>
          <div className="bg-slate-50 rounded-2xl p-3.5">
            <div className="text-[11px] text-slate-500">দুপুরের মিল</div>
            <div className="text-base font-bold text-slate-800 tabular-nums mt-0.5">
              {periodSummary.totalLunch.toFixed(1)}
            </div>
          </div>
          <div className="bg-slate-50 rounded-2xl p-3.5">
            <div className="text-[11px] text-slate-500">রাতের মিল</div>
            <div className="text-base font-bold text-slate-800 tabular-nums mt-0.5">
              {periodSummary.totalDinner.toFixed(1)}
            </div>
          </div>
          <div className="bg-slate-50 rounded-2xl p-3.5">
            <div className="text-[11px] text-slate-500">গেস্ট মিল</div>
            <div className="text-base font-bold text-amber-700 tabular-nums mt-0.5">
              {periodSummary.totalGuest.toFixed(1)}
            </div>
          </div>
        </div>

        {/* 30-Day Date-by-Date Table */}
        <div className="border-t border-slate-100 pt-3">
          {displayedRows.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500">
              নির্বাচিত সময়ে এই মেম্বারের কোনো সক্রিয় মিল রেকর্ড পাওয়া যায়নি।
            </div>
          ) : (
            <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 font-semibold sticky top-0 z-10">
                  <tr>
                    <th className="py-3 px-3.5">তারিখ</th>
                    <th className="py-3 px-3 text-center">সকাল (0.5)</th>
                    <th className="py-3 px-3 text-center">দুপুর (1.0)</th>
                    <th className="py-3 px-3 text-center">রাত (1.0)</th>
                    <th className="py-3 px-3 text-center">গেস্ট</th>
                    <th className="py-3 px-3.5 text-right">মোট মিল</th>
                    <th className="py-3 px-3.5 text-right">অ্যাকশন</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {displayedRows.map((row) => {
                    const hasMeals = row.total > 0;
                    const isCurrentSelectedDate = row.date === selectedDate;
                    return (
                      <tr
                        key={row.date}
                        className={`transition-colors ${
                          isCurrentSelectedDate
                            ? 'bg-teal-50/60'
                            : hasMeals
                              ? 'hover:bg-slate-50'
                              : 'text-slate-400 hover:bg-slate-50/60'
                        }`}
                      >
                        <td className="py-2.5 px-3.5 font-mono tabular-nums whitespace-nowrap font-medium text-slate-800">
                          {row.date}
                          {isCurrentSelectedDate && (
                            <span className="text-teal-700 font-sans font-semibold"> · নির্বাচিত</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono tabular-nums">
                          {row.breakfast > 0 ? row.breakfast.toFixed(1) : '—'}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono tabular-nums">
                          {row.lunch > 0 ? row.lunch.toFixed(1) : '—'}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono tabular-nums">
                          {row.dinner > 0 ? row.dinner.toFixed(1) : '—'}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono tabular-nums">
                          {row.guest > 0 ? row.guest.toFixed(1) : '—'}
                        </td>
                        <td
                          className={`py-2.5 px-3.5 text-right font-mono tabular-nums font-bold ${
                            hasMeals ? 'text-teal-700' : 'text-slate-400'
                          }`}
                        >
                          {row.total.toFixed(1)}
                        </td>
                        <td className="py-2 px-3.5 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => onChangeDate(row.date)}
                            className="min-h-[34px] px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-medium transition-colors cursor-pointer"
                          >
                            সুইচারে দেখুন
                          </button>
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
    </div>
  );
};

