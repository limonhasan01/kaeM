import type {
  BazarEntry,
  DayMemberMeal,
  DepositEntry,
  FineEntry,
  MealsRecord,
  Member,
  MessState,
  UtilityConfig,
} from '../types/mess';
import {
  calculateMemberFinancials,
  calculateSummaryStats,
  calculateUtilityShare,
  getDayMemberTotalMeals,
} from './messCalculations';

export type MessSheetTabName =
  | 'Summary'
  | 'Daily_Meals'
  | 'Bazar_Ledger'
  | 'Deposits'
  | 'Utilities_Fines';

export const MESS_SHEET_TABS: MessSheetTabName[] = [
  'Summary',
  'Daily_Meals',
  'Bazar_Ledger',
  'Deposits',
  'Utilities_Fines',
];

export type SheetMatrix = (string | number)[][];

export type FormattedMessWorkbook = Record<MessSheetTabName, SheetMatrix>;

/**
 * Extracts a clean Google Sheets spreadsheetId from either a full Google Docs URL or raw ID.
 */
export function extractSpreadsheetId(rawInput: string): string | null {
  const trimmed = rawInput.trim();
  if (!trimmed) return null;

  const urlMatch = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]{10,128})/);
  if (urlMatch && urlMatch[1]) {
    return urlMatch[1];
  }

  if (/^[a-zA-Z0-9_-]{10,128}$/.test(trimmed)) {
    return trimmed;
  }

  return null;
}

/**
 * Escapes a Google Sheets tab title for A1 notation (`'Tab Name'!A1:Z100`).
 */
export function formatSheetRange(sheetTitle: string, cellRange = 'A1:Z500'): string {
  const escapedTitle = sheetTitle.replace(/'/g, "''");
  return `'${escapedTitle}'!${cellRange}`;
}

/**
 * Builds all 5 structured worksheet matrices from the current MessState.
 */
export function buildMessWorkbookMatrices(state: MessState): FormattedMessWorkbook {
  const stats = calculateSummaryStats(state.members, state.meals, state.bazar, state.deposits);
  const financials = calculateMemberFinancials(
    state.members,
    state.meals,
    state.bazar,
    state.deposits,
    state.fines
  );
  const utilityShare = calculateUtilityShare(state.utilities, state.members.length);

  // 1. Summary Sheet
  const summaryRows: SheetMatrix = [
    ['মেস ম্যানেজার — মাসিক সারসংক্ষেপ (Summary)', 'মান (Value)'],
    ['মোট মিল (Total Meals)', Number(stats.totalMeals.toFixed(2))],
    ['মোট জমা (Total Deposit BDT)', Number(stats.totalDeposit.toFixed(2))],
    ['মোট বাজার খরচ (Total Bazar BDT)', Number(stats.totalBazar.toFixed(2))],
    ['ক্যাশ ব্যালেন্স (Cash Balance BDT)', Number(stats.cashBalance.toFixed(2))],
    ['মিল রেট (Meal Rate BDT)', Number(stats.mealRate.toFixed(2))],
    ['মোট ইউটিলিটি ও ভাড়া (Total Utilities BDT)', Number(utilityShare.total.toFixed(2))],
    ['জনপ্রতি ইউটিলিটি (Utility Per Member BDT)', Number(utilityShare.perMember.toFixed(2))],
    [],
    [
      'Member ID',
      'Name',
      'Username',
      'Phone',
      'WhatsApp',
      'Total Meals',
      'Deposited (BDT)',
      'Meal Cost (BDT)',
      'Fines (BDT)',
      'Net Balance (BDT)',
      'Balance Status',
    ],
    ...financials.map((f) => [
      f.member.id,
      f.member.name,
      f.member.username,
      f.member.phone,
      f.member.whatsapp || f.member.phone,
      Number(f.totalMeals.toFixed(2)),
      Number(f.deposited.toFixed(2)),
      Number(f.mealCost.toFixed(2)),
      Number(f.finesTotal.toFixed(2)),
      Number(f.netBalance.toFixed(2)),
      f.isShort ? 'DUE' : 'SURPLUS',
    ]),
  ];

  // 2. Daily_Meals Sheet
  const mealRows: SheetMatrix = [
    ['Date', 'Member ID', 'Member Name', 'Breakfast', 'Lunch', 'Dinner', 'Guest', 'Day Total'],
  ];
  const sortedDates = Object.keys(state.meals).sort();
  for (const date of sortedDates) {
    const dayMap = state.meals[date] || {};
    for (const member of state.members) {
      const mRecord = dayMap[member.id];
      if (!mRecord) continue;
      const total = getDayMemberTotalMeals(mRecord);
      mealRows.push([
        date,
        member.id,
        member.name,
        Number(mRecord.breakfast) || 0,
        Number(mRecord.lunch) || 0,
        Number(mRecord.dinner) || 0,
        Number(mRecord.guest) || 0,
        Number(total.toFixed(2)),
      ]);
    }
  }

  // 3. Bazar_Ledger Sheet
  const bazarRows: SheetMatrix = [
    ['ID', 'Date', 'Shopper IDs', 'Shopper Names', 'Items', 'Amount (BDT)', 'Status'],
    ...state.bazar.map((entry) => {
      const names = entry.shopperIds
        .map((id) => state.members.find((m) => m.id === id)?.name || id)
        .join(', ');
      return [
        entry.id,
        entry.date,
        entry.shopperIds.join(','),
        names,
        entry.items,
        Number(entry.amount) || 0,
        entry.status,
      ];
    }),
  ];

  // 4. Deposits Sheet
  const depositRows: SheetMatrix = [
    ['ID', 'Date', 'Member ID', 'Member Name', 'Note / Method', 'Amount (BDT)', 'Status'],
    ...state.deposits.map((dep) => {
      const mem = state.members.find((m) => m.id === dep.memberId);
      return [
        dep.id,
        dep.date,
        dep.memberId,
        mem ? mem.name : dep.memberId,
        dep.note,
        Number(dep.amount) || 0,
        dep.status,
      ];
    }),
  ];

  // 5. Utilities_Fines Sheet
  const utilitiesAndFinesRows: SheetMatrix = [
    ['Utility Category', 'Monthly Amount (BDT)'],
    ['Rent', Number(state.utilities.rent) || 0],
    ['Electric', Number(state.utilities.electric) || 0],
    ['Gas', Number(state.utilities.gas) || 0],
    ['Other', Number(state.utilities.other) || 0],
    [],
    ['Fine ID', 'Date', 'Member ID', 'Member Name', 'Reason', 'Amount (BDT)'],
    ...state.fines.map((fine) => {
      const mem = state.members.find((m) => m.id === fine.memberId);
      return [
        fine.id,
        fine.date,
        fine.memberId,
        mem ? mem.name : fine.memberId,
        fine.reason,
        Number(fine.amount) || 0,
      ];
    }),
  ];

  return {
    Summary: summaryRows,
    Daily_Meals: mealRows,
    Bazar_Ledger: bazarRows,
    Deposits: depositRows,
    Utilities_Fines: utilitiesAndFinesRows,
  };
}

/**
 * Converts a SheetMatrix into RFC-4180 CSV text for instant local download.
 */
export function matrixToCsv(matrix: SheetMatrix): string {
  return matrix
    .map((row) =>
      row
        .map((cell) => {
          const text = String(cell ?? '');
          if (text.includes(',') || text.includes('"') || text.includes('\n')) {
            return `"${text.replace(/"/g, '""')}"`;
          }
          return text;
        })
        .join(',')
    )
    .join('\n');
}

export interface ParsedWorkbookImport {
  members?: Member[];
  meals?: MealsRecord;
  bazar?: BazarEntry[];
  deposits?: DepositEntry[];
  fines?: FineEntry[];
  utilities?: UtilityConfig;
  importedCounts: {
    members: number;
    mealRows: number;
    bazar: number;
    deposits: number;
    fines: number;
  };
}

function cleanDate(val: unknown, fallback: string): string {
  const s = String(val ?? '').trim();
  return /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(s) ? s : fallback;
}

function cleanId(val: unknown, fallback: string): string {
  const s = String(val ?? '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '_');
  return s.length >= 1 && s.length <= 128 ? s : fallback;
}

/**
 * Parses raw sheet tab value arrays read from Google Sheets back into MessState entities.
 */
export function parseWorkbookValuesToMessData(
  tabsData: Partial<Record<string, string[][]>>,
  fallbackDate: string
): ParsedWorkbookImport {
  const result: ParsedWorkbookImport = {
    importedCounts: {
      members: 0,
      mealRows: 0,
      bazar: 0,
      deposits: 0,
      fines: 0,
    },
  };

  // 1. Parse Members from Summary tab (rows below 'Member ID' header)
  const summary = tabsData.Summary;
  if (Array.isArray(summary) && summary.length > 0) {
    const headerIdx = summary.findIndex(
      (r) => String(r[0] || '').trim().toLowerCase() === 'member id'
    );
    if (headerIdx >= 0) {
      const headerRow = summary[headerIdx].map((h) => String(h || '').trim().toLowerCase());
      const hasWhatsappCol = headerRow[4] === 'whatsapp';
      const parsedMembers: Member[] = [];
      for (let i = headerIdx + 1; i < summary.length; i++) {
        const row = summary[i];
        if (!row || !row[0] || !row[1]) continue;
        const id = cleanId(row[0], `m_${i}`);
        const name = String(row[1]).trim().slice(0, 100);
        const username =
          String(row[2] || name.toLowerCase())
            .trim()
            .replace(/[^a-zA-Z0-9_.-]/g, '')
            .slice(0, 60) || `member_${i}`;
        const phone =
          String(row[3] || '01700000000')
            .trim()
            .replace(/[^0-9+\-() ]/g, '')
            .slice(0, 30) || '01700000000';
        const whatsapp = hasWhatsappCol
          ? String(row[4] || phone)
              .trim()
              .replace(/[^0-9+\-() ]/g, '')
              .slice(0, 30) || phone
          : phone;
        parsedMembers.push({
          id,
          name,
          username,
          phone,
          whatsapp,
          isAdmin: false,
        });
      }
      if (parsedMembers.length > 0) {
        result.members = parsedMembers;
        result.importedCounts.members = parsedMembers.length;
      }
    }
  }

  // 2. Parse Meals from Daily_Meals tab
  const mealSheet = tabsData.Daily_Meals;
  if (Array.isArray(mealSheet) && mealSheet.length > 1) {
    const meals: MealsRecord = {};
    let mealRows = 0;
    for (let i = 1; i < mealSheet.length; i++) {
      const row = mealSheet[i];
      if (!row || row.length < 6) continue;
      const date = cleanDate(row[0], fallbackDate);
      const memberId = cleanId(row[1], '');
      if (!memberId) continue;

      const rawBreakfast = Number(row[3]) || 0;
      const rawLunch = Number(row[4]) || 0;
      const rawDinner = Number(row[5]) || 0;
      const rawGuest = Math.max(0, Math.min(50, Number(row[6]) || 0));

      const entry: DayMemberMeal = {
        breakfast: rawBreakfast >= 0.5 ? 0.5 : 0,
        lunch: rawLunch >= 1 ? 1 : 0,
        dinner: rawDinner >= 1 ? 1 : 0,
        guest: rawGuest,
      };

      if (!meals[date]) meals[date] = {};
      meals[date][memberId] = entry;
      mealRows += 1;
    }
    if (mealRows > 0) {
      result.meals = meals;
      result.importedCounts.mealRows = mealRows;
    }
  }

  // 3. Parse Bazar from Bazar_Ledger tab
  const bazarSheet = tabsData.Bazar_Ledger;
  if (Array.isArray(bazarSheet) && bazarSheet.length > 1) {
    const bazar: BazarEntry[] = [];
    for (let i = 1; i < bazarSheet.length; i++) {
      const row = bazarSheet[i];
      if (!row || row.length < 6) continue;
      const id = cleanId(row[0], `b_imp_${i}`);
      const date = cleanDate(row[1], fallbackDate);
      const shopperIds = String(row[2] || '')
        .split(',')
        .map((s) => cleanId(s, ''))
        .filter(Boolean)
        .slice(0, 20);
      const items = String(row[4] || '').trim().slice(0, 500);
      const amount = Number(row[5]) || 0;
      const status = String(row[6] || '').trim().toLowerCase() === 'pending' ? 'pending' : 'approved';
      if (shopperIds.length > 0 && items && amount > 0) {
        bazar.push({ id, date, shopperIds, items, amount, status });
      }
    }
    if (bazar.length > 0) {
      result.bazar = bazar;
      result.importedCounts.bazar = bazar.length;
    }
  }

  // 4. Parse Deposits from Deposits tab
  const depositsSheet = tabsData.Deposits;
  if (Array.isArray(depositsSheet) && depositsSheet.length > 1) {
    const deposits: DepositEntry[] = [];
    for (let i = 1; i < depositsSheet.length; i++) {
      const row = depositsSheet[i];
      if (!row || row.length < 6) continue;
      const id = cleanId(row[0], `d_imp_${i}`);
      const date = cleanDate(row[1], fallbackDate);
      const memberId = cleanId(row[2], '');
      const note = String(row[4] || 'ক্যাশ জমা').trim().slice(0, 300) || 'ক্যাশ জমা';
      const amount = Number(row[5]) || 0;
      const status = String(row[6] || '').trim().toLowerCase() === 'pending' ? 'pending' : 'approved';
      if (memberId && amount > 0) {
        deposits.push({ id, date, memberId, note, amount, status });
      }
    }
    if (deposits.length > 0) {
      result.deposits = deposits;
      result.importedCounts.deposits = deposits.length;
    }
  }

  // 5. Parse Utilities & Fines from Utilities_Fines tab
  const utilSheet = tabsData.Utilities_Fines;
  if (Array.isArray(utilSheet) && utilSheet.length > 1) {
    const utilMap: Record<string, number> = {};
    let fineHeaderIdx = -1;
    for (let i = 0; i < utilSheet.length; i++) {
      const row = utilSheet[i];
      if (!row || row.length === 0) continue;
      const col0 = String(row[0] || '').trim().toLowerCase();
      if (col0 === 'fine id') {
        fineHeaderIdx = i;
        break;
      }
      if (['rent', 'electric', 'gas', 'other'].includes(col0)) {
        utilMap[col0] = Math.max(0, Number(row[1]) || 0);
      }
    }
    if (Object.keys(utilMap).length > 0) {
      result.utilities = {
        rent: utilMap.rent ?? 0,
        electric: utilMap.electric ?? 0,
        gas: utilMap.gas ?? 0,
        other: utilMap.other ?? 0,
      };
    }

    if (fineHeaderIdx >= 0) {
      const fines: FineEntry[] = [];
      for (let i = fineHeaderIdx + 1; i < utilSheet.length; i++) {
        const row = utilSheet[i];
        if (!row || row.length < 6) continue;
        const id = cleanId(row[0], `f_imp_${i}`);
        const date = cleanDate(row[1], fallbackDate);
        const memberId = cleanId(row[2], '');
        const reason = String(row[4] || '').trim().slice(0, 300);
        const amount = Number(row[5]) || 0;
        if (memberId && reason && amount > 0) {
          fines.push({ id, date, memberId, reason, amount });
        }
      }
      if (fines.length > 0) {
        result.fines = fines;
        result.importedCounts.fines = fines.length;
      }
    }
  }

  return result;
}
