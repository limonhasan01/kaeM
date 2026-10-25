import type { MessState } from '../types/mess';
import {
  MESS_SHEET_TABS,
  buildMessWorkbookMatrices,
  formatSheetRange,
  parseWorkbookValuesToMessData,
  type ParsedWorkbookImport,
} from '../utils/sheetsFormatter';

export interface DriveSpreadsheetItem {
  id: string;
  name: string;
  modifiedTime: string;
  webViewLink: string;
}

export interface SheetTabMetadata {
  sheetId: number;
  title: string;
  rowCount: number;
  columnCount: number;
}

export interface SpreadsheetDetails {
  spreadsheetId: string;
  title: string;
  spreadsheetUrl: string;
  sheets: SheetTabMetadata[];
}

async function googleFetchJson<T>(
  url: string,
  accessToken: string,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });

  if (!res.ok) {
    let detail = `${res.status} ${res.statusText}`;
    try {
      const errBody = await res.json();
      if (errBody?.error?.message) {
        detail = errBody.error.message;
      }
    } catch {
      // Ignore non-JSON error body
    }
    if (res.status === 401 || res.status === 403) {
      throw new Error(`AUTH_REQUIRED:${detail}`);
    }
    throw new Error(detail);
  }

  return (await res.json()) as T;
}

/**
 * Lists Google Sheets files from the authenticated user's Google Drive.
 */
export async function listUserSpreadsheets(
  accessToken: string,
  searchQuery = ''
): Promise<DriveSpreadsheetItem[]> {
  const escapedSearch = searchQuery.trim().replace(/'/g, "\\'");
  const nameClause = escapedSearch ? ` and name contains '${escapedSearch}'` : '';
  const q = encodeURIComponent(
    `mimeType='application/vnd.google-apps.spreadsheet' and trashed=false${nameClause}`
  );
  const fields = encodeURIComponent('files(id,name,modifiedTime,webViewLink)');
  const url = `https://www.googleapis.com/drive/v3/files?q=${q}&orderBy=modifiedTime%20desc&pageSize=20&fields=${fields}`;

  const data = await googleFetchJson<{ files?: DriveSpreadsheetItem[] }>(url, accessToken);
  return Array.isArray(data.files) ? data.files : [];
}

/**
 * Inspects a spreadsheet's metadata to discover its actual tab titles (never hardcoding "Sheet1").
 */
export async function getSpreadsheetMetadata(
  accessToken: string,
  spreadsheetId: string
): Promise<SpreadsheetDetails> {
  const fields = encodeURIComponent(
    'spreadsheetId,spreadsheetUrl,properties.title,sheets.properties(sheetId,title,gridProperties)'
  );
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}?fields=${fields}`;

  interface RawMeta {
    spreadsheetId: string;
    spreadsheetUrl?: string;
    properties?: { title?: string };
    sheets?: {
      properties?: {
        sheetId?: number;
        title?: string;
        gridProperties?: { rowCount?: number; columnCount?: number };
      };
    }[];
  }

  const raw = await googleFetchJson<RawMeta>(url, accessToken);
  const sheets: SheetTabMetadata[] = (raw.sheets || []).map((s, idx) => ({
    sheetId: s.properties?.sheetId ?? idx,
    title: s.properties?.title || `Tab_${idx + 1}`,
    rowCount: s.properties?.gridProperties?.rowCount ?? 100,
    columnCount: s.properties?.gridProperties?.columnCount ?? 26,
  }));

  return {
    spreadsheetId: raw.spreadsheetId || spreadsheetId,
    title: raw.properties?.title || 'Untitled Spreadsheet',
    spreadsheetUrl:
      raw.spreadsheetUrl ||
      `https://docs.google.com/spreadsheets/d/${encodeURIComponent(spreadsheetId)}/edit`,
    sheets,
  };
}

/**
 * Reads cell values from a dynamically discovered tab title.
 */
export async function readSheetTabValues(
  accessToken: string,
  spreadsheetId: string,
  sheetTitle: string,
  cellRange = 'A1:Z60'
): Promise<string[][]> {
  const fullRange = encodeURIComponent(formatSheetRange(sheetTitle, cellRange));
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
    spreadsheetId
  )}/values/${fullRange}`;

  const data = await googleFetchJson<{ values?: string[][] }>(url, accessToken);
  return Array.isArray(data.values) ? data.values : [];
}

/**
 * Creates a brand-new 5-tab Mess Ledger Google Spreadsheet and populates all mess records.
 */
export async function createMessSpreadsheet(
  accessToken: string,
  title: string,
  messState: MessState
): Promise<SpreadsheetDetails> {
  const cleanTitle = title.trim() || 'মেস ম্যানেজার হিসাব খাতা';
  const createBody = {
    properties: {
      title: cleanTitle,
    },
    sheets: MESS_SHEET_TABS.map((tabName) => ({
      properties: {
        title: tabName,
        gridProperties: {
          frozenRowCount: 1,
        },
      },
    })),
  };

  interface CreatedSheetResponse {
    spreadsheetId: string;
    spreadsheetUrl?: string;
    properties?: { title?: string };
  }

  const created = await googleFetchJson<CreatedSheetResponse>(
    'https://sheets.googleapis.com/v4/spreadsheets',
    accessToken,
    {
      method: 'POST',
      body: JSON.stringify(createBody),
    }
  );

  const workbook = buildMessWorkbookMatrices(messState);
  const valueData = MESS_SHEET_TABS.map((tabName) => ({
    range: formatSheetRange(tabName, 'A1'),
    majorDimension: 'ROWS',
    values: workbook[tabName],
  }));

  await googleFetchJson(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      created.spreadsheetId
    )}/values:batchUpdate`,
    accessToken,
    {
      method: 'POST',
      body: JSON.stringify({
        valueInputOption: 'USER_ENTERED',
        data: valueData,
      }),
    }
  );

  return getSpreadsheetMetadata(accessToken, created.spreadsheetId);
}

/**
 * Syncs/overwrites the 5 Mess Ledger tabs in an existing Google Spreadsheet.
 * CALLER MUST OBTAIN EXPLICIT USER CONFIRMATION BEFORE INVOKING THIS FUNCTION.
 */
export async function syncMessToExistingSpreadsheet(
  accessToken: string,
  spreadsheetId: string,
  messState: MessState
): Promise<SpreadsheetDetails> {
  const meta = await getSpreadsheetMetadata(accessToken, spreadsheetId);
  const existingTitles = new Set(meta.sheets.map((s) => s.title));

  const missingTabs = MESS_SHEET_TABS.filter((tab) => !existingTitles.has(tab));
  if (missingTabs.length > 0) {
    await googleFetchJson(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
        spreadsheetId
      )}:batchUpdate`,
      accessToken,
      {
        method: 'POST',
        body: JSON.stringify({
          requests: missingTabs.map((tab) => ({
            addSheet: {
              properties: {
                title: tab,
                gridProperties: { frozenRowCount: 1 },
              },
            },
          })),
        }),
      }
    );
  }

  // Clear previous contents on the 5 target tabs so shorter tables leave no stale trailing rows
  await googleFetchJson(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      spreadsheetId
    )}/values:batchClear`,
    accessToken,
    {
      method: 'POST',
      body: JSON.stringify({
        ranges: MESS_SHEET_TABS.map((tab) => formatSheetRange(tab, 'A1:Z1000')),
      }),
    }
  );

  const workbook = buildMessWorkbookMatrices(messState);
  await googleFetchJson(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      spreadsheetId
    )}/values:batchUpdate`,
    accessToken,
    {
      method: 'POST',
      body: JSON.stringify({
        valueInputOption: 'USER_ENTERED',
        data: MESS_SHEET_TABS.map((tab) => ({
          range: formatSheetRange(tab, 'A1'),
          majorDimension: 'ROWS',
          values: workbook[tab],
        })),
      }),
    }
  );

  return getSpreadsheetMetadata(accessToken, spreadsheetId);
}

/**
 * Reads available Mess Ledger tabs from a spreadsheet and parses them into a preview object.
 */
export async function fetchWorkbookTabsForImport(
  accessToken: string,
  spreadsheetId: string,
  fallbackDate: string
): Promise<{ meta: SpreadsheetDetails; parsed: ParsedWorkbookImport }> {
  const meta = await getSpreadsheetMetadata(accessToken, spreadsheetId);
  const existingTitles = new Set(meta.sheets.map((s) => s.title));
  const targetTabs = MESS_SHEET_TABS.filter((t) => existingTitles.has(t));

  if (targetTabs.length === 0) {
    throw new Error(
      'এই স্প্রেডশিটে মেস ম্যানেজারের নির্ধারিত ট্যাব (Summary, Daily_Meals, Bazar_Ledger, Deposits) পাওয়া যায়নি।'
    );
  }

  const rangesQuery = targetTabs
    .map((t) => `ranges=${encodeURIComponent(formatSheetRange(t, 'A1:Z500'))}`)
    .join('&');

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
    spreadsheetId
  )}/values:batchGet?${rangesQuery}`;

  interface BatchGetResponse {
    valueRanges?: { range?: string; values?: string[][] }[];
  }

  const batchData = await googleFetchJson<BatchGetResponse>(url, accessToken);
  const tabsData: Partial<Record<string, string[][]>> = {};

  targetTabs.forEach((tabName, index) => {
    const vr = batchData.valueRanges?.[index];
    tabsData[tabName] = Array.isArray(vr?.values) ? vr.values : [];
  });

  const parsed = parseWorkbookValuesToMessData(tabsData, fallbackDate);
  return { meta, parsed };
}

/**
 * Moves a Google Spreadsheet file in Google Drive to Trash.
 * CALLER MUST OBTAIN EXPLICIT USER CONFIRMATION BEFORE INVOKING THIS FUNCTION.
 */
export async function trashDriveSpreadsheet(
  accessToken: string,
  fileId: string
): Promise<void> {
  await googleFetchJson(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`,
    accessToken,
    {
      method: 'PATCH',
      body: JSON.stringify({ trashed: true }),
    }
  );
}
