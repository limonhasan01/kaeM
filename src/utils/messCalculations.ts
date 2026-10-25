import type {
  ActiveTab,
  BazarEntry,
  BazarRequisition,
  DayMemberMeal,
  DepositEntry,
  FineEntry,
  MealType,
  MealsRecord,
  Member,
  MessState,
  PendingRequest,
  UtilityConfig,
} from '../types/mess';

export const ADMIN_USER: Member = {
  id: 'admin_sys',
  name: 'মেস এডমিন',
  phone: '01700000000',
  username: 'admin',
  isAdmin: true,
};

export const ADMIN_PIN = 'limon1234@@';

export const DEFAULT_MEMBERS: Member[] = [
  {
    id: 'm1',
    name: 'Limon',
    phone: '01711112222',
    whatsapp: '01711112222',
    username: 'limon',
    isAdmin: false,
  },
  {
    id: 'm2',
    name: 'Sujoy',
    phone: '01833334444',
    whatsapp: '01833334444',
    username: 'sujoy',
    isAdmin: false,
  },
  {
    id: 'm3',
    name: 'Zisman',
    phone: '01955556666',
    whatsapp: '01955556666',
    username: 'zisman',
    isAdmin: false,
  },
];

export function getTodayDateString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function createInitialMessState(today = getTodayDateString()): MessState {
  return {
    currentUser: DEFAULT_MEMBERS[0],
    members: DEFAULT_MEMBERS.map((m) => ({ ...m })),
    meals: {
      [today]: {
        m1: { breakfast: 0.5, lunch: 1, dinner: 1, guest: 1 },
        m2: { breakfast: 0, lunch: 1, dinner: 1, guest: 0 },
        m3: { breakfast: 0.5, lunch: 0, dinner: 1, guest: 0 },
      },
    },
    bazar: [
      {
        id: 'b1',
        date: today,
        shopperIds: ['m1', 'm2'],
        items: 'চাল, সয়াবিন তেল, ডিম, মুরগি',
        amount: 1200,
        receiptNo: 'RSH-1001',
        status: 'approved',
      },
    ],
    bazarRequests: [
      {
        id: 'breq_1',
        date: today,
        shopperIds: ['m1', 'm2'],
        items: 'চাল ১০ কেজি, ব্রয়লার মুরগি ২ কেজি, ডিম ২ হালি, পেঁয়াজ ২ কেজি, কাঁচা মরিচ',
        estimatedAmount: 1500,
        note: 'সকাল ১০টার মধ্যে বাজার সম্পন্ন করার অনুরোধ',
        status: 'scheduled',
      },
    ],
    deposits: [
      { id: 'd1', date: today, memberId: 'm1', amount: 3000, note: 'বিকাশ পেমেন্ট', status: 'approved' },
      { id: 'd2', date: today, memberId: 'm2', amount: 2500, note: 'ক্যাশ জমা', status: 'approved' },
      { id: 'd3', date: today, memberId: 'm3', amount: 2000, note: 'ক্যাশ জমা', status: 'approved' },
    ],
    pendingRequests: [],
    fines: [],
    utilities: {
      rent: 12000,
      electric: 1500,
      gas: 1000,
      other: 2500,
    },
  };
}

export function mealUnitValue(mealType: MealType, isChecked: boolean): number {
  if (!isChecked) return 0;
  return mealType === 'breakfast' ? 0.5 : 1.0;
}

export function getDayMemberTotalMeals(meal?: DayMemberMeal): number {
  if (!meal) return 0;
  return (
    (Number(meal.breakfast) || 0) +
    (Number(meal.lunch) || 0) +
    (Number(meal.dinner) || 0) +
    (Number(meal.guest) || 0)
  );
}

export function calculateMemberTotalMeals(meals: MealsRecord, memberId: string): number {
  let sum = 0;
  for (const day of Object.values(meals)) {
    if (day && day[memberId]) {
      sum += getDayMemberTotalMeals(day[memberId]);
    }
  }
  return sum;
}

export function calculateSummaryStats(
  members: Member[],
  meals: MealsRecord,
  bazar: BazarEntry[],
  deposits: DepositEntry[]
) {
  const validIds = new Set(members.map((m) => m.id));
  let totalMeals = 0;
  for (const day of Object.values(meals)) {
    for (const [mId, record] of Object.entries(day)) {
      if (validIds.has(mId)) {
        totalMeals += getDayMemberTotalMeals(record);
      }
    }
  }

  const totalBazar = bazar
    .filter((b) => b.status === 'approved')
    .reduce((acc, b) => acc + (Number(b.amount) || 0), 0);

  const totalDeposit = deposits
    .filter((d) => d.status === 'approved' && validIds.has(d.memberId))
    .reduce((acc, d) => acc + (Number(d.amount) || 0), 0);

  const mealRate = totalMeals > 0 ? totalBazar / totalMeals : 0;
  const cashBalance = totalDeposit - totalBazar;

  return {
    totalMeals,
    totalBazar,
    totalDeposit,
    mealRate,
    cashBalance,
  };
}

export interface MemberFinancialSummary {
  member: Member;
  totalMeals: number;
  deposited: number;
  mealCost: number;
  finesTotal: number;
  totalExpense: number;
  netBalance: number;
  isShort: boolean;
}

export function calculateMemberFinancials(
  members: Member[],
  meals: MealsRecord,
  bazar: BazarEntry[],
  deposits: DepositEntry[],
  fines: FineEntry[]
): MemberFinancialSummary[] {
  const { mealRate } = calculateSummaryStats(members, meals, bazar, deposits);

  return members.map((member) => {
    const totalMeals = calculateMemberTotalMeals(meals, member.id);
    const deposited = deposits
      .filter((d) => d.memberId === member.id && d.status === 'approved')
      .reduce((s, d) => s + (Number(d.amount) || 0), 0);
    const finesTotal = fines
      .filter((f) => f.memberId === member.id)
      .reduce((s, f) => s + (Number(f.amount) || 0), 0);

    const mealCost = totalMeals * mealRate;
    const totalExpense = mealCost + finesTotal;
    const netBalance = deposited - totalExpense;

    return {
      member,
      totalMeals,
      deposited,
      mealCost,
      finesTotal,
      totalExpense,
      netBalance,
      isShort: netBalance < -0.005,
    };
  });
}

export function calculateBazarTripCounts(
  members: Member[],
  bazar: BazarEntry[]
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const m of members) {
    counts[m.id] = 0;
  }

  for (const entry of bazar) {
    if (entry.status !== 'approved') continue;
    for (const sId of entry.shopperIds) {
      if (counts[sId] !== undefined) {
        counts[sId] += 1;
      }
    }
  }
  return counts;
}

export function calculateUtilityShare(utilities: UtilityConfig, memberCount: number) {
  const total =
    (Number(utilities.rent) || 0) +
    (Number(utilities.electric) || 0) +
    (Number(utilities.gas) || 0) +
    (Number(utilities.other) || 0);
  const perMember = memberCount > 0 ? total / memberCount : 0;
  return { total, perMember };
}

export function applyMealChangeToMeals(
  meals: MealsRecord,
  date: string,
  memberId: string,
  mealType: MealType,
  isChecked: boolean
): MealsRecord {
  const prevDay = meals[date] || {};
  const prevMem = prevDay[memberId] || { breakfast: 0, lunch: 0, dinner: 0, guest: 0 };

  return {
    ...meals,
    [date]: {
      ...prevDay,
      [memberId]: {
        ...prevMem,
        [mealType]: mealUnitValue(mealType, isChecked),
      },
    },
  };
}

export function applyGuestMealToMeals(
  meals: MealsRecord,
  date: string,
  memberId: string,
  count: number
): MealsRecord {
  const cleanCount = Math.max(0, Number(count) || 0);
  const prevDay = meals[date] || {};
  const prevMem = prevDay[memberId] || { breakfast: 0, lunch: 0, dinner: 0, guest: 0 };

  return {
    ...meals,
    [date]: {
      ...prevDay,
      [memberId]: {
        ...prevMem,
        guest: cleanCount,
      },
    },
  };
}

export function approvePendingRequestInState(
  state: MessState,
  requestId: string,
  nowIdSuffix = String(Date.now())
): MessState {
  const target = state.pendingRequests.find((r) => r.id === requestId);
  if (!target) return state;

  const remaining = state.pendingRequests.filter((r) => r.id !== requestId);

  switch (target.type) {
    case 'MEAL_CHANGE': {
      const { date, memberId, mealType, isChecked } = target.dataPayload;
      return {
        ...state,
        meals: applyMealChangeToMeals(state.meals, date, memberId, mealType, isChecked),
        pendingRequests: remaining,
      };
    }
    case 'GUEST_MEAL': {
      const { date, memberId, count } = target.dataPayload;
      return {
        ...state,
        meals: applyGuestMealToMeals(state.meals, date, memberId, count),
        pendingRequests: remaining,
      };
    }
    case 'BAZAR_ENTRY': {
      const { date, shopperIds, items, amount } = target.dataPayload;
      const newBazar: BazarEntry = {
        id: `b_${nowIdSuffix}`,
        date,
        shopperIds,
        items,
        amount,
        status: 'approved',
      };
      return {
        ...state,
        bazar: [newBazar, ...state.bazar],
        pendingRequests: remaining,
      };
    }
    case 'DEPOSIT_ENTRY': {
      const { date, memberId, amount, note } = target.dataPayload;
      const newDep: DepositEntry = {
        id: `d_${nowIdSuffix}`,
        date,
        memberId,
        amount,
        note,
        status: 'approved',
      };
      return {
        ...state,
        deposits: [newDep, ...state.deposits],
        pendingRequests: remaining,
      };
    }
    case 'PROFILE_EDIT': {
      const { memberId, newName, newPhone, newWhatsapp, newUsername } = target.dataPayload;
      const cleanWp = newWhatsapp !== undefined ? newWhatsapp : newPhone;
      const updatedMembers = state.members.map((m) =>
        m.id === memberId
          ? { ...m, name: newName, phone: newPhone, whatsapp: cleanWp, username: newUsername }
          : m
      );
      const updatedCurrentUser =
        state.currentUser.id === memberId
          ? {
              ...state.currentUser,
              name: newName,
              phone: newPhone,
              whatsapp: cleanWp,
              username: newUsername,
            }
          : state.currentUser;
      return {
        ...state,
        members: updatedMembers,
        currentUser: updatedCurrentUser,
        pendingRequests: remaining,
      };
    }
    default:
      return state;
  }
}

export function rejectPendingRequestInState(state: MessState, requestId: string): MessState {
  return {
    ...state,
    pendingRequests: state.pendingRequests.filter((r) => r.id !== requestId),
  };
}

export function validateAdminPin(pinInput: string): boolean {
  return pinInput.trim() === ADMIN_PIN;
}

export function createMealToggleRequest(
  requestedBy: string,
  memberName: string,
  memberId: string,
  date: string,
  mealType: MealType,
  isChecked: boolean,
  idSuffix = String(Date.now())
): PendingRequest {
  const mealLabel =
    mealType === 'breakfast' ? 'সকাল' : mealType === 'lunch' ? 'দুপুর' : 'রাত';
  return {
    id: `req_${idSuffix}`,
    type: 'MEAL_CHANGE',
    requestedBy,
    date,
    dataPayload: { memberId, mealType, isChecked, date },
    details: `${date} তারিখে ${memberName}-এর ${mealLabel} মিল ${isChecked ? 'অন' : 'অফ'} করার আবেদন`,
  };
}

export interface MemberDailyMealRow {
  date: string;
  dayOfMonth: string;
  breakfast: number;
  lunch: number;
  dinner: number;
  guest: number;
  total: number;
}

export interface MemberPeriodMealSummary {
  rows: MemberDailyMealRow[];
  totalBreakfast: number;
  totalLunch: number;
  totalDinner: number;
  totalGuest: number;
  grandTotal: number;
  activeDays: number;
}

function formatIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Generates an exact 30-day rolling meal breakdown ending on `anchorDate`
 * OR a full calendar month (`YYYY-MM`) breakdown for a specific member.
 */
export function buildMemberPeriodMealSummary(
  meals: MealsRecord,
  memberId: string,
  options: { mode: '30days'; anchorDate: string } | { mode: 'month'; yearMonth: string }
): MemberPeriodMealSummary {
  const dates: string[] = [];

  if (options.mode === '30days') {
    const parsed = new Date(`${options.anchorDate}T00:00:00`);
    const base = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
    for (let offset = 29; offset >= 0; offset--) {
      const d = new Date(base);
      d.setDate(base.getDate() - offset);
      dates.push(formatIsoDate(d));
    }
  } else {
    const [yStr, mStr] = options.yearMonth.split('-');
    const year = Number(yStr) || new Date().getFullYear();
    const month = Number(mStr) || new Date().getMonth() + 1;
    const daysInMonth = new Date(year, month, 0).getDate();
    for (let day = 1; day <= daysInMonth; day++) {
      const mPadded = String(month).padStart(2, '0');
      const dPadded = String(day).padStart(2, '0');
      dates.push(`${year}-${mPadded}-${dPadded}`);
    }
  }

  let totalBreakfast = 0;
  let totalLunch = 0;
  let totalDinner = 0;
  let totalGuest = 0;
  let activeDays = 0;

  const rows: MemberDailyMealRow[] = dates.map((date) => {
    const rec = meals[date]?.[memberId];
    const breakfast = Number(rec?.breakfast) || 0;
    const lunch = Number(rec?.lunch) || 0;
    const dinner = Number(rec?.dinner) || 0;
    const guest = Number(rec?.guest) || 0;
    const total = breakfast + lunch + dinner + guest;

    totalBreakfast += breakfast;
    totalLunch += lunch;
    totalDinner += dinner;
    totalGuest += guest;
    if (total > 0) activeDays += 1;

    return {
      date,
      dayOfMonth: date.slice(8, 10),
      breakfast,
      lunch,
      dinner,
      guest,
      total,
    };
  });

  return {
    rows,
    totalBreakfast,
    totalLunch,
    totalDinner,
    totalGuest,
    grandTotal: totalBreakfast + totalLunch + totalDinner + totalGuest,
    activeDays,
  };
}

/**
 * Normalizes Bangladeshi (01XXXXXXXXX -> 8801XXXXXXXXX) and international WhatsApp numbers
 * into digits-only format suitable for `https://wa.me/<number>`.
 */
export function formatWhatsAppNumber(rawPhone?: string): string {
  if (!rawPhone) return '';
  let digits = rawPhone.replace(/[^0-9]/g, '');
  if (digits.startsWith('00')) {
    digits = digits.slice(2);
  }
  if (digits.length === 11 && digits.startsWith('01')) {
    return `88${digits}`;
  }
  if (digits.length === 10 && digits.startsWith('1')) {
    return `880${digits}`;
  }
  return digits;
}

/**
 * Builds a semantic `https://wa.me/...` deep link without using `window.open`.
 */
export function buildWhatsAppShareUrl(rawPhone: string | undefined, message: string): string {
  const cleanDigits = formatWhatsAppNumber(rawPhone);
  const encoded = encodeURIComponent(message);
  if (cleanDigits.length >= 8) {
    return `https://wa.me/${cleanDigits}?text=${encoded}`;
  }
  return `https://wa.me/?text=${encoded}`;
}

export function buildBazarDutyWhatsAppMessage(
  req: Pick<BazarRequisition, 'date' | 'items' | 'estimatedAmount' | 'note'>,
  shopperNames: string[]
): string {
  const namesStr = shopperNames.length > 0 ? shopperNames.join(', ') : 'মেস মেম্বার';
  const lines = [
    '🛒 *মেস ম্যানেজার — বাজারের দায়িত্ব ও ফর্দ*',
    `📅 তারিখ: ${req.date}`,
    `👥 বাজারকারী (${shopperNames.length} জন): ${namesStr}`,
    `📝 কি কি কিনতে হবে: ${req.items}`,
  ];
  if (req.estimatedAmount > 0) {
    lines.push(`💰 সম্ভাব্য বাজেট / অগ্রিম: ৳ ${req.estimatedAmount.toLocaleString('en-US')}`);
  }
  if (req.note && req.note.trim()) {
    lines.push(`📌 নোট: ${req.note.trim()}`);
  }
  lines.push('— মেস এডমিন প্যানেল');
  return lines.join('\n');
}

export function buildBazarReceiptWhatsAppMessage(params: {
  receiptNo: string;
  date: string;
  shopperNames: string[];
  items: string;
  amount: number;
  advanceAmount?: number;
  mealRate?: number;
  note?: string;
}): string {
  const {
    receiptNo,
    date,
    shopperNames,
    items,
    amount,
    advanceAmount,
    mealRate,
    note,
  } = params;
  const namesStr = shopperNames.length > 0 ? shopperNames.join(', ') : 'মেস মেম্বার';
  const lines = [
    '🧾 *মেস ম্যানেজার — ডিজিটাল বাজার রশিদ*',
    `ভাউচার নং: ${receiptNo}`,
    `📅 তারিখ: ${date}`,
    `👥 বাজারকারী: ${namesStr}`,
    '------------------------',
    `🛍️ ক্রয়কৃত বাজার: ${items}`,
    `💵 মোট খরচ: ৳ ${amount.toLocaleString('en-US')}`,
  ];

  if (typeof advanceAmount === 'number' && advanceAmount > 0) {
    const diff = advanceAmount - amount;
    lines.push(`💳 প্রদত্ত অগ্রিম: ৳ ${advanceAmount.toLocaleString('en-US')}`);
    lines.push(
      diff >= 0
        ? `🔄 ফেরতযোগ্য ক্যাশ: ৳ ${diff.toLocaleString('en-US')}`
        : `⚠️ মেম্বার পাবে (বকেয়া): ৳ ${Math.abs(diff).toLocaleString('en-US')}`
    );
  }

  if (typeof mealRate === 'number' && mealRate > 0) {
    lines.push(`📊 বর্তমান মিল রেট: ৳ ${mealRate.toFixed(2)}`);
  }
  if (note && note.trim()) {
    lines.push(`📌 মন্তব্য: ${note.trim()}`);
  }
  lines.push('✅ অনুমোদিত — মেস এডমিন');
  return lines.join('\n');
}

/**
 * Pure Admin-only Bazar Entry updater that preserves every entry (zero deletion allowed)
 * and records an immutable audit trail (`previousAmount`, `editCount`, `editedAt`).
 */
export function updateBazarEntryByAdmin(
  bazar: BazarEntry[],
  entryId: string,
  patch: {
    date: string;
    shopperIds: string[];
    items: string;
    amount: number;
    note?: string;
  },
  editedAtDate = getTodayDateString()
): BazarEntry[] {
  const cleanAmount = Math.max(1, Number(patch.amount) || 0);
  return bazar.map((entry) => {
    if (entry.id !== entryId) return entry;
    const nextEditCount = (Number(entry.editCount) || 0) + 1;
    const nextPrevAmount =
      cleanAmount !== entry.amount ? entry.amount : entry.previousAmount;

    return {
      ...entry,
      date: patch.date,
      shopperIds: patch.shopperIds,
      items: patch.items.trim(),
      amount: cleanAmount,
      note: patch.note !== undefined ? patch.note.trim() || undefined : entry.note,
      previousAmount: nextPrevAmount,
      editedAt: editedAtDate,
      editCount: nextEditCount,
    };
  });
}

export interface MonthlyShopperRank {
  member: Member;
  trips: number;
  totalMarketValue: number;
  attributedSpend: number;
  sharePercent: number;
}

export interface MonthlyPurchasedItemStat {
  key: string;
  name: string;
  examples: string[];
  frequency: number;
  dates: string[];
  shopperNames: string[];
  allocatedSpend: number;
}

export interface MonthlyBazarReportData {
  selectedMonth: string; // 'YYYY-MM' or 'ALL'
  availableMonths: string[];
  totalExpenditure: number;
  pendingExpenditure: number;
  tripCount: number;
  averagePerTrip: number;
  highestSingleTrip: {
    id: string;
    date: string;
    amount: number;
    items: string;
    shopperNames: string;
  } | null;
  topShoppers: MonthlyShopperRank[];
  leadShopper: MonthlyShopperRank | null;
  itemBreakdown: MonthlyPurchasedItemStat[];
}

function normalizePurchasedItemLabel(rawToken: string): { key: string; displayName: string } {
  const cleaned = rawToken.replace(/\s+/g, ' ').trim();
  // Strip trailing numeric quantities + common Bengali/English market units so e.g. "চাল ১০ কেজি" groups with "চাল"
  const stripped = cleaned
    .replace(
      /\s+[\d০-৯.,/]+\s*(কেজি|গ্রাম|হালি|লিটার|পিস|প্যাকেট|বস্তা|ডজন|টা|টি|kg|gm|g|ltr|l|pcs|pc)?$/iu,
      ''
    )
    .trim();
  const base = stripped.length >= 2 ? stripped : cleaned;
  return {
    key: base.toLowerCase(),
    displayName: base,
  };
}

/**
 * Computes the Monthly Bazar Report: total market expenditures, top shoppers leaderboard,
 * and itemized breakdown of items purchased for a given `YYYY-MM` (or `'ALL'`).
 */
export function buildMonthlyBazarReport(
  members: Member[],
  bazar: BazarEntry[],
  yearMonth = 'ALL',
  fallbackCurrentMonth = getTodayDateString().slice(0, 7)
): MonthlyBazarReportData {
  const monthSet = new Set<string>();
  if (fallbackCurrentMonth && /^\d{4}-\d{2}$/.test(fallbackCurrentMonth)) {
    monthSet.add(fallbackCurrentMonth);
  }
  for (const entry of bazar) {
    if (entry.date && entry.date.length >= 7) {
      monthSet.add(entry.date.slice(0, 7));
    }
  }
  const availableMonths = Array.from(monthSet).sort((a, b) => b.localeCompare(a));

  const matchesPeriod = (dateStr: string) =>
    yearMonth === 'ALL' || !yearMonth ? true : dateStr.startsWith(yearMonth);

  const periodEntries = bazar.filter((b) => matchesPeriod(b.date));
  const approvedEntries = periodEntries.filter((b) => b.status === 'approved');
  const pendingEntries = periodEntries.filter((b) => b.status === 'pending');

  const totalExpenditure = approvedEntries.reduce((sum, b) => sum + (Number(b.amount) || 0), 0);
  const pendingExpenditure = pendingEntries.reduce((sum, b) => sum + (Number(b.amount) || 0), 0);
  const tripCount = approvedEntries.length;
  const averagePerTrip = tripCount > 0 ? totalExpenditure / tripCount : 0;

  const memberNameMap = new Map(members.map((m) => [m.id, m.name]));

  let highestSingleTrip: MonthlyBazarReportData['highestSingleTrip'] = null;
  for (const entry of approvedEntries) {
    if (!highestSingleTrip || entry.amount > highestSingleTrip.amount) {
      const names = entry.shopperIds
        .map((id) => memberNameMap.get(id))
        .filter(Boolean)
        .join(', ');
      highestSingleTrip = {
        id: entry.id,
        date: entry.date,
        amount: entry.amount,
        items: entry.items,
        shopperNames: names || 'মেস মেম্বার',
      };
    }
  }

  // Shopper rankings
  const shopperStats = new Map<
    string,
    { trips: number; totalMarketValue: number; attributedSpend: number }
  >();
  for (const m of members) {
    shopperStats.set(m.id, { trips: 0, totalMarketValue: 0, attributedSpend: 0 });
  }

  for (const entry of approvedEntries) {
    const validShoppers = entry.shopperIds.filter((id) => shopperStats.has(id));
    const splitCount = validShoppers.length > 0 ? validShoppers.length : 1;
    const splitAmount = (Number(entry.amount) || 0) / splitCount;

    for (const sId of validShoppers) {
      const st = shopperStats.get(sId)!;
      st.trips += 1;
      st.totalMarketValue += Number(entry.amount) || 0;
      st.attributedSpend += splitAmount;
    }
  }

  const topShoppers: MonthlyShopperRank[] = members
    .map((member) => {
      const st = shopperStats.get(member.id) || {
        trips: 0,
        totalMarketValue: 0,
        attributedSpend: 0,
      };
      const sharePercent =
        totalExpenditure > 0 ? (st.attributedSpend / totalExpenditure) * 100 : 0;
      return {
        member,
        trips: st.trips,
        totalMarketValue: st.totalMarketValue,
        attributedSpend: st.attributedSpend,
        sharePercent,
      };
    })
    .sort(
      (a, b) =>
        b.trips - a.trips ||
        b.attributedSpend - a.attributedSpend ||
        b.totalMarketValue - a.totalMarketValue ||
        a.member.name.localeCompare(b.member.name)
    );

  const leadShopper =
    topShoppers.length > 0 && topShoppers[0].trips > 0 ? topShoppers[0] : null;

  // Itemized breakdown across approved entries
  const itemMap = new Map<
    string,
    {
      key: string;
      name: string;
      examplesSet: Set<string>;
      frequency: number;
      datesSet: Set<string>;
      shoppersSet: Set<string>;
      allocatedSpend: number;
    }
  >();

  for (const entry of approvedEntries) {
    const rawTokens = String(entry.items || '')
      .split(/[,،;\n•|]+/)
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    if (rawTokens.length === 0) continue;

    const perTokenSpend = (Number(entry.amount) || 0) / rawTokens.length;
    const entryShopperNames = entry.shopperIds
      .map((id) => memberNameMap.get(id))
      .filter((n): n is string => Boolean(n));

    for (const token of rawTokens) {
      const { key, displayName } = normalizePurchasedItemLabel(token);
      if (!key) continue;

      const existing = itemMap.get(key);
      if (!existing) {
        itemMap.set(key, {
          key,
          name: displayName,
          examplesSet: new Set([token]),
          frequency: 1,
          datesSet: new Set([entry.date]),
          shoppersSet: new Set(entryShopperNames),
          allocatedSpend: perTokenSpend,
        });
      } else {
        existing.examplesSet.add(token);
        existing.frequency += 1;
        existing.datesSet.add(entry.date);
        for (const sName of entryShopperNames) {
          existing.shoppersSet.add(sName);
        }
        existing.allocatedSpend += perTokenSpend;
      }
    }
  }

  const itemBreakdown: MonthlyPurchasedItemStat[] = Array.from(itemMap.values())
    .map((it) => ({
      key: it.key,
      name: it.name,
      examples: Array.from(it.examplesSet),
      frequency: it.frequency,
      dates: Array.from(it.datesSet).sort((a, b) => b.localeCompare(a)),
      shopperNames: Array.from(it.shoppersSet),
      allocatedSpend: it.allocatedSpend,
    }))
    .sort(
      (a, b) =>
        b.frequency - a.frequency ||
        b.allocatedSpend - a.allocatedSpend ||
        a.name.localeCompare(b.name)
    );

  return {
    selectedMonth: yearMonth,
    availableMonths,
    totalExpenditure,
    pendingExpenditure,
    tripCount,
    averagePerTrip,
    highestSingleTrip,
    topShoppers,
    leadShopper,
    itemBreakdown,
  };
}

export const ADMIN_ONLY_TABS: ActiveTab[] = ['pending-requests', 'members', 'backup'];

export const MEMBER_ALLOWED_TABS: ActiveTab[] = [
  'meals',
  'bazar',
  'deposits',
  'analytics',
  'utilities',
];

export const ALL_WORKSPACE_TABS: ActiveTab[] = [
  'meals',
  'bazar',
  'analytics',
  'deposits',
  'pending-requests',
  'members',
  'utilities',
  'backup',
];

/**
 * Ensures initial app preview / session boot ALWAYS opens in Member Dashboard mode first,
 * even if `ADMIN_USER` was previously persisted in localStorage. Entering Admin Panel
 * always requires explicit password authentication during the session.
 */
export function resolveInitialPreviewUser(
  persistedUser: Partial<Member> | undefined,
  members: Member[]
): Member {
  const nonAdminMembers = members.filter((m) => !m.isAdmin);
  const fallbackMember = nonAdminMembers[0] || DEFAULT_MEMBERS[0];

  if (!persistedUser || persistedUser.isAdmin || !persistedUser.id) {
    return fallbackMember;
  }

  return nonAdminMembers.find((m) => m.id === persistedUser.id) || fallbackMember;
}

export function getAllowedTabsForRole(isAdmin: boolean): ActiveTab[] {
  return isAdmin ? ALL_WORKSPACE_TABS : MEMBER_ALLOWED_TABS;
}

export function sanitizeActiveTabForRole(tab: ActiveTab, isAdmin: boolean): ActiveTab {
  if (isAdmin) return tab;
  return MEMBER_ALLOWED_TABS.includes(tab) ? tab : 'meals';
}


