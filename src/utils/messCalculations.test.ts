import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ADMIN_ONLY_TABS,
  ADMIN_USER,
  applyGuestMealToMeals,
  applyMealChangeToMeals,
  approvePendingRequestInState,
  buildBazarDutyWhatsAppMessage,
  buildBazarReceiptWhatsAppMessage,
  buildMemberPeriodMealSummary,
  buildMonthlyBazarReport,
  buildWhatsAppShareUrl,
  calculateBazarTripCounts,
  calculateMemberFinancials,
  calculateSummaryStats,
  calculateUtilityShare,
  createInitialMessState,
  createMealToggleRequest,
  formatWhatsAppNumber,
  getAllowedTabsForRole,
  rejectPendingRequestInState,
  resolveInitialPreviewUser,
  sanitizeActiveTabForRole,
  updateBazarEntryByAdmin,
  validateAdminPin,
} from './messCalculations';

test('initial seed state computes exact total meals, bazar, deposits, and meal rate', () => {
  const state = createInitialMessState('2026-10-25');
  const stats = calculateSummaryStats(state.members, state.meals, state.bazar, state.deposits);

  // Limon: 0.5 + 1 + 1 + 1 guest = 3.5
  // Sujoy: 0 + 1 + 1 + 0 = 2.0
  // Zisman: 0.5 + 0 + 1 + 0 = 1.5
  // Total = 7.0 meals
  assert.equal(stats.totalMeals, 7.0);
  assert.equal(stats.totalBazar, 1200);
  assert.equal(stats.totalDeposit, 7500);
  assert.equal(stats.cashBalance, 6300);
  assert.ok(Math.abs(stats.mealRate - 1200 / 7) < 0.0001);
});

test('breakfast counts as 0.5 meal and lunch/dinner count as 1.0 meal', () => {
  const state = createInitialMessState('2026-10-25');
  let meals = applyMealChangeToMeals(state.meals, '2026-10-25', 'm2', 'breakfast', true);
  assert.equal(meals['2026-10-25'].m2.breakfast, 0.5);

  meals = applyMealChangeToMeals(meals, '2026-10-25', 'm2', 'lunch', false);
  assert.equal(meals['2026-10-25'].m2.lunch, 0);

  meals = applyGuestMealToMeals(meals, '2026-10-25', 'm2', 2.5);
  assert.equal(meals['2026-10-25'].m2.guest, 2.5);
});

test('joint bazar shopping trip counter increments every participating member', () => {
  const state = createInitialMessState('2026-10-25');
  const bazar = [
    ...state.bazar,
    {
      id: 'b2',
      date: '2026-10-25',
      shopperIds: ['m2', 'm3'],
      items: 'মাছ ও সবজি',
      amount: 800,
      status: 'approved' as const,
    },
    {
      id: 'b3',
      date: '2026-10-25',
      shopperIds: ['m1', 'm3'],
      items: 'পেঁয়াজ ও আলু',
      amount: 300,
      status: 'pending' as const, // pending should not increment trip counter yet
    },
  ];

  const counts = calculateBazarTripCounts(state.members, bazar);
  assert.equal(counts.m1, 1);
  assert.equal(counts.m2, 2);
  assert.equal(counts.m3, 1);
});

test('member meal toggle request queues until admin approves and updates meals', () => {
  let state = createInitialMessState('2026-10-25');
  const req = createMealToggleRequest('Limon', 'Limon', 'm1', '2026-10-25', 'lunch', false, 'test1');

  state = {
    ...state,
    pendingRequests: [req],
  };

  // Before approval, lunch is still 1
  assert.equal(state.meals['2026-10-25'].m1.lunch, 1);
  assert.equal(state.pendingRequests.length, 1);

  // Switch to admin & approve
  state = { ...state, currentUser: ADMIN_USER };
  state = approvePendingRequestInState(state, 'req_test1', '999');

  assert.equal(state.pendingRequests.length, 0);
  assert.equal(state.meals['2026-10-25'].m1.lunch, 0);
});

test('rejecting a pending request removes it without mutating state', () => {
  let state = createInitialMessState('2026-10-25');
  const req = createMealToggleRequest('Sujoy', 'Sujoy', 'm2', '2026-10-25', 'dinner', false, 'rej1');
  state = { ...state, pendingRequests: [req] };

  const afterReject = rejectPendingRequestInState(state, 'req_rej1');
  assert.equal(afterReject.pendingRequests.length, 0);
  assert.equal(afterReject.meals['2026-10-25'].m2.dinner, 1);
});

test('member financial health flags shortage when meal cost + fine exceeds deposit', () => {
  const state = createInitialMessState('2026-10-25');
  const fines = [{ id: 'f1', date: '2026-10-25', memberId: 'm3', reason: 'ফ্যান অন রাখা', amount: 1850 }];
  const financials = calculateMemberFinancials(
    state.members,
    state.meals,
    state.bazar,
    state.deposits,
    fines
  );

  const zisman = financials.find((f) => f.member.id === 'm3')!;
  // Zisman deposited 2000, meal cost ~ 1.5 * (1200/7) = 257.14, fine = 1850 => totalExpense = 2107.14 > 2000
  assert.equal(zisman.isShort, true);
  assert.ok(zisman.netBalance < 0);
});

test('utility splitter divides evenly across active members and validates admin pin', () => {
  const share = calculateUtilityShare({ rent: 12000, electric: 1500, gas: 1000, other: 2500 }, 3);
  assert.equal(share.total, 17000);
  assert.ok(Math.abs(share.perMember - 17000 / 3) < 0.01);

  assert.equal(validateAdminPin('limon1234@@'), true);
  assert.equal(validateAdminPin('1234'), false);
  assert.equal(validateAdminPin('0000'), false);
});

test('buildMemberPeriodMealSummary returns exact 30-day rolling window and full calendar month per member', () => {
  const state = createInitialMessState('2026-10-25');
  let meals = applyMealChangeToMeals(state.meals, '2026-10-10', 'm1', 'lunch', true);
  meals = applyMealChangeToMeals(meals, '2026-10-10', 'm1', 'dinner', true);

  const rolling30 = buildMemberPeriodMealSummary(meals, 'm1', {
    mode: '30days',
    anchorDate: '2026-10-25',
  });

  assert.equal(rolling30.rows.length, 30);
  assert.equal(rolling30.rows[0].date, '2026-09-26');
  assert.equal(rolling30.rows[29].date, '2026-10-25');
  assert.equal(rolling30.activeDays, 2);
  // 2026-10-25 has 3.5 meals + 2026-10-10 has 2.0 meals = 5.5
  assert.equal(rolling30.grandTotal, 5.5);

  // Sujoy (m2) on same 30-day window only has 2.0 meals on 2026-10-25
  const sujoy30 = buildMemberPeriodMealSummary(meals, 'm2', {
    mode: '30days',
    anchorDate: '2026-10-25',
  });
  assert.equal(sujoy30.rows.length, 30);
  assert.equal(sujoy30.grandTotal, 2.0);
  assert.equal(sujoy30.activeDays, 1);

  // Full calendar month October 2026 has 31 days
  const octMonth = buildMemberPeriodMealSummary(meals, 'm1', {
    mode: 'month',
    yearMonth: '2026-10',
  });
  assert.equal(octMonth.rows.length, 31);
  assert.equal(octMonth.rows[0].date, '2026-10-01');
  assert.equal(octMonth.rows[30].date, '2026-10-31');
  assert.equal(octMonth.grandTotal, 5.5);
});

test('WhatsApp number formatter and Bazar duty/receipt deep-link builders generate valid wa.me links', () => {
  assert.equal(formatWhatsAppNumber('01711112222'), '8801711112222');
  assert.equal(formatWhatsAppNumber('+880 1833-334444'), '8801833334444');
  assert.equal(formatWhatsAppNumber('1955556666'), '8801955556666');

  const dutyMsg = buildBazarDutyWhatsAppMessage(
    {
      date: '2026-10-26',
      items: 'চাল ১০ কেজি, ডিম ২ হালি, মুরগি ২ কেজি',
      estimatedAmount: 1600,
      note: 'সকাল ৯টার মধ্যে কিনবেন',
    },
    ['Limon', 'Sujoy']
  );
  assert.ok(dutyMsg.includes('2026-10-26'));
  assert.ok(dutyMsg.includes('Limon, Sujoy'));
  assert.ok(dutyMsg.includes('চাল ১০ কেজি'));

  const url = buildWhatsAppShareUrl('01711112222', dutyMsg);
  assert.ok(url.startsWith('https://wa.me/8801711112222?text='));

  const receiptMsg = buildBazarReceiptWhatsAppMessage({
    receiptNo: 'RSH-2026',
    date: '2026-10-26',
    shopperNames: ['Limon', 'Sujoy'],
    items: 'চাল, মুরগি ও সবজি',
    amount: 1450,
    advanceAmount: 1600,
    mealRate: 171.43,
    note: 'ক্যাশ ভাউচার সংযুক্ত',
  });
  assert.ok(receiptMsg.includes('RSH-2026'));
  assert.ok(receiptMsg.includes('1,450'));
  assert.ok(receiptMsg.includes('ফেরতযোগ্য ক্যাশ: ৳ 150'));
});

test('buildMonthlyBazarReport summarizes monthly market expenditure, top shoppers, and item breakdown', () => {
  const state = createInitialMessState('2026-10-25');
  const bazar = [
    ...state.bazar, // b1: 2026-10-25, ['m1', 'm2'], 'চাল, সয়াবিন তেল, ডিম, মুরগি', 1200, approved
    {
      id: 'b2',
      date: '2026-10-18',
      shopperIds: ['m2'],
      items: 'চাল ১০ কেজি, ডিম ২ হালি, আলু ৩ কেজি',
      amount: 900,
      status: 'approved' as const,
    },
    {
      id: 'b3',
      date: '2026-09-28',
      shopperIds: ['m3'],
      items: 'মাছ, সবজি',
      amount: 700,
      status: 'approved' as const,
    },
    {
      id: 'b4',
      date: '2026-10-26',
      shopperIds: ['m3'],
      items: 'মসলা',
      amount: 250,
      status: 'pending' as const,
    },
  ];

  const octReport = buildMonthlyBazarReport(state.members, bazar, '2026-10', '2026-10');
  assert.equal(octReport.totalExpenditure, 2100);
  assert.equal(octReport.pendingExpenditure, 250);
  assert.equal(octReport.tripCount, 2);
  assert.equal(octReport.averagePerTrip, 1050);
  assert.equal(octReport.highestSingleTrip?.amount, 1200);

  // Sujoy (m2) did 2 trips in Oct (600 + 900 = 1500 attributed); Limon (m1) did 1 trip (600 attributed)
  assert.equal(octReport.leadShopper?.member.id, 'm2');
  assert.equal(octReport.leadShopper?.trips, 2);
  assert.equal(octReport.leadShopper?.attributedSpend, 1500);

  // "চাল" and "চাল ১০ কেজি" normalize to the same base item "চাল" with frequency 2
  const riceStat = octReport.itemBreakdown.find((i) => i.name === 'চাল');
  assert.ok(riceStat);
  assert.equal(riceStat.frequency, 2);

  const eggStat = octReport.itemBreakdown.find((i) => i.name === 'ডিম');
  assert.ok(eggStat);
  assert.equal(eggStat.frequency, 2);
});

test('updateBazarEntryByAdmin updates amount and records immutable anti-tamper audit trail without deleting entries', () => {
  const state = createInitialMessState('2026-10-25');
  const updated = updateBazarEntryByAdmin(
    state.bazar,
    'b1',
    {
      date: '2026-10-25',
      shopperIds: ['m1', 'm2'],
      items: 'চাল, সয়াবিন তেল, ডিম, মুরগি ও পেঁয়াজ',
      amount: 1350,
      note: 'ভাউচার মিলিয়ে সংশোধিত',
    },
    '2026-10-26'
  );

  // Non-deletion invariant: record count never decreases
  assert.equal(updated.length, state.bazar.length);
  assert.equal(updated[0].amount, 1350);
  assert.equal(updated[0].previousAmount, 1200);
  assert.equal(updated[0].editCount, 1);
  assert.equal(updated[0].editedAt, '2026-10-26');
  assert.equal(updated[0].note, 'ভাউচার মিলিয়ে সংশোধিত');
});

test('resolveInitialPreviewUser always boots into Member Dashboard first even if Admin was saved', () => {
  const state = createInitialMessState('2026-10-25');

  // When persisted user was ADMIN_USER, boot must reset to first Member so Admin requires password
  const fromAdmin = resolveInitialPreviewUser(ADMIN_USER, state.members);
  assert.equal(fromAdmin.isAdmin, false);
  assert.equal(fromAdmin.id, 'm1');

  // When persisted user was a specific non-admin member (e.g. Sujoy m2), preserve that member
  const fromSujoy = resolveInitialPreviewUser(state.members[1], state.members);
  assert.equal(fromSujoy.isAdmin, false);
  assert.equal(fromSujoy.id, 'm2');

  // When persisted user is undefined or unknown, fall back to first member
  const fromEmpty = resolveInitialPreviewUser(undefined, state.members);
  assert.equal(fromEmpty.isAdmin, false);
  assert.equal(fromEmpty.id, 'm1');
});

test('getAllowedTabsForRole and sanitizeActiveTabForRole hide Admin-only tabs from Member Dashboard', () => {
  const memberTabs = getAllowedTabsForRole(false);
  for (const adminTab of ADMIN_ONLY_TABS) {
    assert.equal(memberTabs.includes(adminTab), false);
    assert.equal(sanitizeActiveTabForRole(adminTab, false), 'meals');
  }

  assert.equal(sanitizeActiveTabForRole('bazar', false), 'bazar');
  assert.equal(sanitizeActiveTabForRole('deposits', false), 'deposits');
  assert.equal(sanitizeActiveTabForRole('analytics', false), 'analytics');
  assert.equal(sanitizeActiveTabForRole('utilities', false), 'utilities');

  const adminTabs = getAllowedTabsForRole(true);
  assert.equal(adminTabs.length, 8);
  assert.equal(sanitizeActiveTabForRole('pending-requests', true), 'pending-requests');
  assert.equal(sanitizeActiveTabForRole('members', true), 'members');
  assert.equal(sanitizeActiveTabForRole('backup', true), 'backup');
});



