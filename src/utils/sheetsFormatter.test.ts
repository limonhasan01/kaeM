import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialMessState } from './messCalculations';
import {
  buildMessWorkbookMatrices,
  extractSpreadsheetId,
  formatSheetRange,
  matrixToCsv,
  parseWorkbookValuesToMessData,
} from './sheetsFormatter';

test('extractSpreadsheetId parses full Google Sheets URLs and raw IDs cleanly', () => {
  assert.equal(
    extractSpreadsheetId(
      'https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit#gid=0'
    ),
    '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms'
  );
  assert.equal(
    extractSpreadsheetId('1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms'),
    '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms'
  );
  assert.equal(extractSpreadsheetId('   '), null);
  assert.equal(extractSpreadsheetId('https://example.com/not-a-sheet'), null);
});

test('formatSheetRange escapes single quotes in dynamic sheet tab names', () => {
  assert.equal(formatSheetRange("Limon's Oct Sheet", 'A1:H25'), "'Limon''s Oct Sheet'!A1:H25");
  assert.equal(formatSheetRange('Summary'), "'Summary'!A1:Z500");
});

test('buildMessWorkbookMatrices and parseWorkbookValuesToMessData round-trip mess records accurately', () => {
  const initial = createInitialMessState('2026-10-25');
  initial.fines = [
    { id: 'f1', date: '2026-10-25', memberId: 'm2', reason: 'লাইট অন রাখা', amount: 100 },
  ];

  const workbook = buildMessWorkbookMatrices(initial);

  assert.equal(workbook.Daily_Meals.length, 4); // header + 3 members
  assert.equal(workbook.Bazar_Ledger.length, 2); // header + 1 bazar
  assert.equal(workbook.Deposits.length, 4); // header + 3 deposits

  // Convert numbers to strings as Google Sheets Values API returns strings
  const stringifiedTabs: Record<string, string[][]> = {};
  for (const [tabName, matrix] of Object.entries(workbook)) {
    stringifiedTabs[tabName] = matrix.map((r) => r.map((c) => String(c ?? '')));
  }

  const parsed = parseWorkbookValuesToMessData(stringifiedTabs, '2026-10-25');
  assert.equal(parsed.importedCounts.members, 3);
  assert.equal(parsed.importedCounts.mealRows, 3);
  assert.equal(parsed.importedCounts.bazar, 1);
  assert.equal(parsed.importedCounts.deposits, 3);
  assert.equal(parsed.importedCounts.fines, 1);
  assert.equal(parsed.utilities?.rent, 12000);
  assert.equal(parsed.meals?.['2026-10-25']?.m1?.breakfast, 0.5);
  assert.equal(parsed.meals?.['2026-10-25']?.m1?.guest, 1);

  const csv = matrixToCsv(workbook.Bazar_Ledger);
  assert.ok(csv.includes('"চাল, সয়াবিন তেল, ডিম, মুরগি"'));
});
