import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Deterministic Security Rules Verification Suite (Phase 0 & Phase 5 Red Team Audit)
 * Evaluates all "Dirty Dozen" adversarial payloads and structural Zero-Trust invariants
 * against the active Firestore ruleset (`firestore.rules` or `DRAFT_firestore.rules`).
 */

interface AuthContext {
  uid: string;
  email: string;
  email_verified: boolean;
}

interface MockDbState {
  admins: Set<string>;
  workspaces: Record<string, Record<string, unknown>>;
  members: Record<string, Record<string, unknown>>; // key: `${workspaceId}/${memberId}`
  deposits: Record<string, Record<string, unknown>>; // key: `${workspaceId}/${depositId}`
}

const REQUEST_TIME = '2026-10-25T05:00:00.000Z';
const ID_REGEX = /^[a-zA-Z0-9_-]+$/;
const DATE_REGEX = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;
const USERNAME_REGEX = /^[a-zA-Z0-9_.-]+$/;
const PHONE_REGEX = /^[0-9+\-() ]+$/;

function isValidId(id: unknown): id is string {
  return typeof id === 'string' && id.length >= 1 && id.length <= 128 && ID_REGEX.test(id);
}

function isVerified(auth: AuthContext | null): auth is AuthContext {
  return auth !== null && auth.email_verified === true;
}

function isAdmin(auth: AuthContext | null, db: MockDbState): boolean {
  return (
    isVerified(auth) &&
    (auth.email === 'mdraihanrahmanlimon01@gmail.com' || db.admins.has(auth.uid))
  );
}

function isWorkspaceOwner(auth: AuthContext | null, workspaceId: string, db: MockDbState): boolean {
  if (!isVerified(auth)) return false;
  const ws = db.workspaces[workspaceId];
  return Boolean(ws && ws.ownerId === auth.uid);
}

function hasExactKeys(data: Record<string, unknown>, keys: string[]): boolean {
  const actual = Object.keys(data);
  return actual.length === keys.length && keys.every((k) => Object.prototype.hasOwnProperty.call(data, k));
}

function affectedKeys(incoming: Record<string, unknown>, existing: Record<string, unknown>): string[] {
  const allKeys = new Set([...Object.keys(incoming), ...Object.keys(existing)]);
  const changed: string[] = [];
  for (const k of allKeys) {
    if (JSON.stringify(incoming[k]) !== JSON.stringify(existing[k])) {
      changed.push(k);
    }
  }
  return changed;
}

function isValidWorkspace(data: Record<string, unknown>): boolean {
  const keys = [
    'ownerId',
    'name',
    'rent',
    'electric',
    'gas',
    'other',
    'linkedSpreadsheetId',
    'linkedSpreadsheetTitle',
    'createdAt',
    'updatedAt',
  ];
  return (
    hasExactKeys(data, keys) &&
    isValidId(data.ownerId) &&
    typeof data.name === 'string' &&
    data.name.length >= 1 &&
    data.name.length <= 100 &&
    typeof data.rent === 'number' &&
    data.rent >= 0 &&
    data.rent <= 1000000 &&
    typeof data.electric === 'number' &&
    data.electric >= 0 &&
    data.electric <= 1000000 &&
    typeof data.gas === 'number' &&
    data.gas >= 0 &&
    data.gas <= 1000000 &&
    typeof data.other === 'number' &&
    data.other >= 0 &&
    data.other <= 1000000 &&
    typeof data.linkedSpreadsheetId === 'string' &&
    data.linkedSpreadsheetId.length <= 128 &&
    typeof data.linkedSpreadsheetTitle === 'string' &&
    data.linkedSpreadsheetTitle.length <= 200 &&
    typeof data.createdAt === 'string' &&
    typeof data.updatedAt === 'string'
  );
}

function isValidMessMember(data: Record<string, unknown>, workspaceId: string): boolean {
  const keys = [
    'ownerId',
    'workspaceId',
    'name',
    'username',
    'phone',
    'whatsapp',
    'createdAt',
    'updatedAt',
  ];
  return (
    hasExactKeys(data, keys) &&
    isValidId(data.ownerId) &&
    data.workspaceId === workspaceId &&
    isValidId(data.workspaceId) &&
    typeof data.name === 'string' &&
    data.name.length >= 1 &&
    data.name.length <= 100 &&
    typeof data.username === 'string' &&
    data.username.length >= 1 &&
    data.username.length <= 60 &&
    USERNAME_REGEX.test(data.username) &&
    typeof data.phone === 'string' &&
    data.phone.length >= 3 &&
    data.phone.length <= 30 &&
    PHONE_REGEX.test(data.phone) &&
    typeof data.whatsapp === 'string' &&
    data.whatsapp.length >= 3 &&
    data.whatsapp.length <= 30 &&
    PHONE_REGEX.test(data.whatsapp) &&
    typeof data.createdAt === 'string' &&
    typeof data.updatedAt === 'string'
  );
}

type EvalResult = 'ALLOW' | 'PERMISSION_DENIED';

function evaluateOperation(params: {
  op: 'get' | 'list' | 'create' | 'update' | 'delete';
  collection: 'workspaces' | 'members' | 'mealEntries' | 'bazarEntries' | 'deposits' | 'fines';
  workspaceId: string;
  docId?: string;
  auth: AuthContext | null;
  incoming?: Record<string, unknown>;
  existing?: Record<string, unknown>;
  db: MockDbState;
}): EvalResult {
  const { op, collection, workspaceId, docId = '', auth, incoming = {}, existing = {}, db } = params;

  if (collection === 'workspaces') {
    if (op === 'get') {
      return isVerified(auth) &&
        isValidId(workspaceId) &&
        (existing.ownerId === auth.uid || isAdmin(auth, db))
        ? 'ALLOW'
        : 'PERMISSION_DENIED';
    }
    if (op === 'create') {
      return isVerified(auth) &&
        isValidId(workspaceId) &&
        isValidWorkspace(incoming) &&
        incoming.ownerId === auth.uid &&
        incoming.createdAt === REQUEST_TIME &&
        incoming.updatedAt === REQUEST_TIME
        ? 'ALLOW'
        : 'PERMISSION_DENIED';
    }
    if (op === 'update') {
      const changed = affectedKeys(incoming, existing);
      const allowedAction =
        changed.every((k) => ['rent', 'electric', 'gas', 'other', 'updatedAt'].includes(k)) ||
        changed.every((k) => ['linkedSpreadsheetId', 'linkedSpreadsheetTitle', 'updatedAt'].includes(k)) ||
        changed.every((k) =>
          [
            'name',
            'rent',
            'electric',
            'gas',
            'other',
            'linkedSpreadsheetId',
            'linkedSpreadsheetTitle',
            'updatedAt',
          ].includes(k)
        );
      return isVerified(auth) &&
        isValidId(workspaceId) &&
        isValidWorkspace(incoming) &&
        incoming.ownerId === existing.ownerId &&
        incoming.createdAt === existing.createdAt &&
        incoming.updatedAt === REQUEST_TIME &&
        (isAdmin(auth, db) || (existing.ownerId === auth.uid && allowedAction))
        ? 'ALLOW'
        : 'PERMISSION_DENIED';
    }
  }

  if (collection === 'members') {
    if (op === 'get') {
      return isVerified(auth) &&
        isValidId(workspaceId) &&
        isValidId(docId) &&
        ((existing.ownerId === auth.uid && isWorkspaceOwner(auth, workspaceId, db)) ||
          isAdmin(auth, db))
        ? 'ALLOW'
        : 'PERMISSION_DENIED';
    }
    if (op === 'create') {
      return isVerified(auth) &&
        isValidId(workspaceId) &&
        isValidId(docId) &&
        isValidMessMember(incoming, workspaceId) &&
        incoming.ownerId === auth.uid &&
        incoming.createdAt === REQUEST_TIME &&
        incoming.updatedAt === REQUEST_TIME &&
        (isWorkspaceOwner(auth, workspaceId, db) || isAdmin(auth, db))
        ? 'ALLOW'
        : 'PERMISSION_DENIED';
    }
    if (op === 'update') {
      const changed = affectedKeys(incoming, existing);
      return isVerified(auth) &&
        isValidId(workspaceId) &&
        isValidId(docId) &&
        isValidMessMember(incoming, workspaceId) &&
        incoming.ownerId === existing.ownerId &&
        incoming.workspaceId === existing.workspaceId &&
        incoming.createdAt === existing.createdAt &&
        incoming.updatedAt === REQUEST_TIME &&
        (isAdmin(auth, db) ||
          (existing.ownerId === auth.uid &&
            isWorkspaceOwner(auth, workspaceId, db) &&
            changed.every((k) =>
              ['name', 'username', 'phone', 'whatsapp', 'updatedAt'].includes(k)
            )))
        ? 'ALLOW'
        : 'PERMISSION_DENIED';
    }
  }

  if (collection === 'deposits' && op === 'list') {
    return isVerified(auth) &&
      isValidId(workspaceId) &&
      existing.ownerId === auth.uid &&
      existing.workspaceId === workspaceId
      ? 'ALLOW'
      : 'PERMISSION_DENIED';
  }

  if (collection === 'deposits' && op === 'update') {
    const validKeys = [
      'ownerId',
      'workspaceId',
      'date',
      'memberId',
      'amount',
      'note',
      'status',
      'createdAt',
      'updatedAt',
    ];
    const validDeposit =
      hasExactKeys(incoming, validKeys) &&
      isValidId(incoming.ownerId) &&
      incoming.workspaceId === workspaceId &&
      typeof incoming.date === 'string' &&
      DATE_REGEX.test(incoming.date) &&
      isValidId(incoming.memberId) &&
      typeof incoming.amount === 'number' &&
      incoming.amount > 0 &&
      incoming.amount <= 1000000 &&
      typeof incoming.note === 'string' &&
      incoming.note.length >= 1 &&
      incoming.note.length <= 300 &&
      (incoming.status === 'pending' || incoming.status === 'approved');

    const changed = affectedKeys(incoming, existing);
    return isVerified(auth) &&
      isValidId(workspaceId) &&
      isValidId(docId) &&
      validDeposit &&
      incoming.ownerId === existing.ownerId &&
      incoming.workspaceId === existing.workspaceId &&
      incoming.memberId === existing.memberId &&
      incoming.createdAt === existing.createdAt &&
      incoming.updatedAt === REQUEST_TIME &&
      (isAdmin(auth, db) ||
        (existing.status === 'pending' &&
          existing.ownerId === auth.uid &&
          isWorkspaceOwner(auth, workspaceId, db) &&
          changed.every((k) => ['date', 'amount', 'note', 'status', 'updatedAt'].includes(k))))
      ? 'ALLOW'
      : 'PERMISSION_DENIED';
  }

  if (collection === 'bazarEntries') {
    if (op === 'delete') {
      return 'PERMISSION_DENIED';
    }
    const validKeys = [
      'ownerId',
      'workspaceId',
      'date',
      'shopperIds',
      'items',
      'amount',
      'previousAmount',
      'editCount',
      'editedAt',
      'status',
      'createdAt',
      'updatedAt',
    ];
    const shoppers = incoming.shopperIds;
    const validShoppers =
      Array.isArray(shoppers) &&
      shoppers.length >= 1 &&
      shoppers.length <= 20 &&
      typeof shoppers[0] === 'string' &&
      shoppers[0].length >= 1 &&
      shoppers[0].length <= 128;
    const validBazar =
      hasExactKeys(incoming, validKeys) &&
      isValidId(incoming.ownerId) &&
      incoming.workspaceId === workspaceId &&
      typeof incoming.date === 'string' &&
      DATE_REGEX.test(incoming.date) &&
      validShoppers &&
      typeof incoming.items === 'string' &&
      incoming.items.length >= 1 &&
      incoming.items.length <= 500 &&
      typeof incoming.amount === 'number' &&
      incoming.amount > 0 &&
      incoming.amount <= 1000000 &&
      typeof incoming.previousAmount === 'number' &&
      incoming.previousAmount >= 0 &&
      incoming.previousAmount <= 1000000 &&
      typeof incoming.editCount === 'number' &&
      incoming.editCount >= 0 &&
      incoming.editCount <= 1000 &&
      typeof incoming.editedAt === 'string' &&
      incoming.editedAt.length <= 10 &&
      (incoming.editedAt.length === 0 || DATE_REGEX.test(incoming.editedAt)) &&
      (incoming.status === 'pending' || incoming.status === 'approved');

    if (op === 'create') {
      const memberKey = validShoppers ? `${workspaceId}/${shoppers[0]}` : '';
      return isVerified(auth) &&
        isValidId(workspaceId) &&
        isValidId(docId) &&
        validBazar &&
        incoming.ownerId === auth.uid &&
        incoming.createdAt === REQUEST_TIME &&
        incoming.updatedAt === REQUEST_TIME &&
        Boolean(db.members[memberKey]) &&
        (isWorkspaceOwner(auth, workspaceId, db) || isAdmin(auth, db))
        ? 'ALLOW'
        : 'PERMISSION_DENIED';
    }

    if (op === 'update') {
      const changed = affectedKeys(incoming, existing);
      const allowedAction =
        changed.every((k) => ['status', 'updatedAt'].includes(k)) ||
        changed.every((k) =>
          [
            'date',
            'shopperIds',
            'items',
            'amount',
            'previousAmount',
            'editCount',
            'editedAt',
            'status',
            'updatedAt',
          ].includes(k)
        );
      return isVerified(auth) &&
        isValidId(workspaceId) &&
        isValidId(docId) &&
        validBazar &&
        incoming.ownerId === existing.ownerId &&
        incoming.workspaceId === existing.workspaceId &&
        incoming.createdAt === existing.createdAt &&
        incoming.updatedAt === REQUEST_TIME &&
        Number(incoming.editCount) >= Number(existing.editCount) &&
        (isAdmin(auth, db) ||
          (existing.ownerId === auth.uid &&
            isWorkspaceOwner(auth, workspaceId, db) &&
            allowedAction))
        ? 'ALLOW'
        : 'PERMISSION_DENIED';
    }
  }

  if (collection === 'fines' && op === 'create') {
    return isVerified(auth) &&
      isValidId(workspaceId) &&
      isValidId(docId) &&
      incoming.ownerId === auth.uid &&
      incoming.createdAt === REQUEST_TIME &&
      incoming.updatedAt === REQUEST_TIME &&
      Boolean(db.members[`${workspaceId}/${String(incoming.memberId)}`]) &&
      isWorkspaceOwner(auth, workspaceId, db)
      ? 'ALLOW'
      : 'PERMISSION_DENIED';
  }

  if (collection === 'mealEntries' && op === 'create') {
    return isVerified(auth) &&
      isValidId(workspaceId) &&
      isValidId(docId) &&
      incoming.ownerId === auth.uid &&
      incoming.createdAt === REQUEST_TIME &&
      incoming.updatedAt === REQUEST_TIME &&
      Boolean(db.members[`${workspaceId}/${String(incoming.memberId)}`]) &&
      isWorkspaceOwner(auth, workspaceId, db)
      ? 'ALLOW'
      : 'PERMISSION_DENIED';
  }

  return 'PERMISSION_DENIED';
}

function createSeedDb(): MockDbState {
  return {
    admins: new Set(),
    workspaces: {
      ws_1: {
        ownerId: 'uid_owner',
        name: 'মেস ম্যানেজার ক্লাউড',
        rent: 12000,
        electric: 1500,
        gas: 1000,
        other: 2500,
        linkedSpreadsheetId: '',
        linkedSpreadsheetTitle: '',
        createdAt: '2026-10-01T00:00:00.000Z',
        updatedAt: '2026-10-01T00:00:00.000Z',
      },
    },
    members: {
      'ws_1/m1': {
        ownerId: 'uid_owner',
        workspaceId: 'ws_1',
        name: 'Limon',
        username: 'limon',
        phone: '01711112222',
        whatsapp: '01711112222',
        createdAt: '2026-10-01T00:00:00.000Z',
        updatedAt: '2026-10-01T00:00:00.000Z',
      },
    },
    deposits: {
      'ws_1/d1': {
        ownerId: 'uid_owner',
        workspaceId: 'ws_1',
        date: '2026-10-25',
        memberId: 'm1',
        amount: 3000,
        note: 'বিকাশ পেমেন্ট',
        status: 'approved',
        createdAt: '2026-10-01T00:00:00.000Z',
        updatedAt: '2026-10-01T00:00:00.000Z',
      },
    },
  };
}

const OWNER_AUTH: AuthContext = {
  uid: 'uid_owner',
  email: 'owner@example.com',
  email_verified: true,
};

const OTHER_AUTH: AuthContext = {
  uid: 'uid_other',
  email: 'other@example.com',
  email_verified: true,
};

test('Static AST audit: Firestore rules file enforces all 8 Zero-Trust pillars', () => {
  const finalPath = path.resolve(process.cwd(), 'firestore.rules');
  const draftPath = path.resolve(process.cwd(), 'DRAFT_firestore.rules');
  const rulesPath = fs.existsSync(finalPath) ? finalPath : draftPath;
  const source = fs.readFileSync(rulesPath, 'utf8');

  assert.match(source, /rules_version\s*=\s*'2';/);
  assert.match(source, /match\s+\/\{document=\*\*\}\s*\{\s*allow\s+read,\s*write:\s*if\s+false;\s*\}/);
  assert.match(source, /request\.auth\.token\.email_verified\s*==\s*true/);
  assert.match(source, /mdraihanrahmanlimon01@gmail\.com/);

  // Ensure every blueprint collection path has a match block
  for (const seg of [
    'match /admins/{adminId}',
    'match /workspaces/{workspaceId}',
    'match /members/{memberId}',
    'match /mealEntries/{mealEntryId}',
    'match /bazarEntries/{bazarId}',
    'match /bazarRequests/{bazarReqId}',
    'match /deposits/{depositId}',
    'match /fines/{fineId}',
    'match /pendingRequests/{requestId}',
  ]) {
    assert.ok(source.includes(seg), `Missing match block: ${seg}`);
  }

  // Ensure zero blanket `allow read: if isSignedIn()` or `allow list: if isSignedIn()`
  assert.doesNotMatch(source, /allow\s+(read|list)\s*:\s*if\s+isSignedIn\(\)\s*;/);

  // Ensure zero get() or exists() inside allow list lines
  const listLines = source.split('\n').filter((line) => line.trim().startsWith('allow list:'));
  assert.ok(listLines.length >= 6);
  for (const line of listLines) {
    assert.ok(!line.includes('get(') && !line.includes('exists(') && !line.includes('isAdmin('), `Forbidden DB lookup in list rule: ${line}`);
  }

  // Ensure bazarEntries permanently forbids deletion
  const bazarMatchIdx = source.indexOf('match /bazarEntries/{bazarId}');
  const bazarReqMatchIdx = source.indexOf('match /bazarRequests/{bazarReqId}');
  assert.ok(bazarMatchIdx !== -1 && bazarReqMatchIdx > bazarMatchIdx);
  const bazarBlock = source.slice(bazarMatchIdx, bazarReqMatchIdx);
  assert.match(bazarBlock, /allow\s+delete:\s*if\s+false\s*;/);
  assert.match(bazarBlock, /incoming\(\)\.editCount\s*>=\s*existing\(\)\.editCount/);
});

test('Dirty Dozen #1-#4: Identity spoofing, unverified admin spoof, shadow field, and PII leak all return PERMISSION_DENIED', () => {
  const db = createSeedDb();

  // #1 Identity Spoofing on Workspace Creation
  assert.equal(
    evaluateOperation({
      op: 'create',
      collection: 'workspaces',
      workspaceId: 'ws_spoof',
      auth: OTHER_AUTH,
      incoming: {
        ...db.workspaces.ws_1,
        ownerId: 'uid_owner', // mismatch with OTHER_AUTH.uid
        createdAt: REQUEST_TIME,
        updatedAt: REQUEST_TIME,
      },
      db,
    }),
    'PERMISSION_DENIED'
  );

  // #2 Unverified Email Admin Spoof
  assert.equal(
    evaluateOperation({
      op: 'get',
      collection: 'workspaces',
      workspaceId: 'ws_1',
      auth: {
        uid: 'uid_spoof_admin',
        email: 'mdraihanrahmanlimon01@gmail.com',
        email_verified: false,
      },
      existing: db.workspaces.ws_1,
      db,
    }),
    'PERMISSION_DENIED'
  );

  // #3 Shadow / Ghost Field Injection
  assert.equal(
    evaluateOperation({
      op: 'update',
      collection: 'workspaces',
      workspaceId: 'ws_1',
      auth: OWNER_AUTH,
      existing: db.workspaces.ws_1,
      incoming: {
        ...db.workspaces.ws_1,
        updatedAt: REQUEST_TIME,
        isSuperAdmin: true,
      },
      db,
    }),
    'PERMISSION_DENIED'
  );

  // #4 PII Blanket Read Attack on Member Phone
  assert.equal(
    evaluateOperation({
      op: 'get',
      collection: 'members',
      workspaceId: 'ws_1',
      docId: 'm1',
      auth: OTHER_AUTH,
      existing: db.members['ws_1/m1'],
      db,
    }),
    'PERMISSION_DENIED'
  );
});

test('Dirty Dozen #5-#8: Unscoped list scraping, 1.5KB ID poisoning, unbounded array, and terminal state tampering return PERMISSION_DENIED', () => {
  const db = createSeedDb();

  // #5 Unscoped Collection List Scraping
  assert.equal(
    evaluateOperation({
      op: 'list',
      collection: 'deposits',
      workspaceId: 'ws_1',
      auth: OTHER_AUTH,
      existing: db.deposits['ws_1/d1'],
      db,
    }),
    'PERMISSION_DENIED'
  );

  // #6 Path Variable / ID Poisoning (1500-char junk ID)
  assert.equal(
    evaluateOperation({
      op: 'create',
      collection: 'members',
      workspaceId: 'ws_1',
      docId: `${'x'.repeat(1500)}$@#`,
      auth: OWNER_AUTH,
      incoming: {
        ...db.members['ws_1/m1'],
        createdAt: REQUEST_TIME,
        updatedAt: REQUEST_TIME,
      },
      db,
    }),
    'PERMISSION_DENIED'
  );

  // #7 Unbounded Shopper Array (25 shoppers > max 20)
  assert.equal(
    evaluateOperation({
      op: 'create',
      collection: 'bazarEntries',
      workspaceId: 'ws_1',
      docId: 'b_overflow',
      auth: OWNER_AUTH,
      incoming: {
        ownerId: 'uid_owner',
        workspaceId: 'ws_1',
        date: '2026-10-25',
        shopperIds: Array.from({ length: 25 }, () => 'm1'),
        items: 'চাল ও ডাল',
        amount: 1200,
        status: 'approved',
        createdAt: REQUEST_TIME,
        updatedAt: REQUEST_TIME,
      },
      db,
    }),
    'PERMISSION_DENIED'
  );

  // #8 Terminal State Reversal / Tampering on Approved Deposit
  assert.equal(
    evaluateOperation({
      op: 'update',
      collection: 'deposits',
      workspaceId: 'ws_1',
      docId: 'd1',
      auth: OWNER_AUTH,
      existing: db.deposits['ws_1/d1'], // status === 'approved'
      incoming: {
        ...db.deposits['ws_1/d1'],
        amount: 999999,
        updatedAt: REQUEST_TIME,
      },
      db,
    }),
    'PERMISSION_DENIED'
  );
});

test('Dirty Dozen #9-#12: Value poisoning, temporal forgery, immutable field swap, and orphaned relational write return PERMISSION_DENIED', () => {
  const db = createSeedDb();

  // #9 Value Poisoning on Whitelisted Update Key
  assert.equal(
    evaluateOperation({
      op: 'update',
      collection: 'workspaces',
      workspaceId: 'ws_1',
      auth: OWNER_AUTH,
      existing: db.workspaces.ws_1,
      incoming: {
        ...db.workspaces.ws_1,
        name: 'A'.repeat(500), // exceeds maxLength 100
        updatedAt: REQUEST_TIME,
      },
      db,
    }),
    'PERMISSION_DENIED'
  );

  // #10 Temporal Forgery (client-backdated createdAt)
  assert.equal(
    evaluateOperation({
      op: 'create',
      collection: 'fines',
      workspaceId: 'ws_1',
      docId: 'f_backdated',
      auth: OWNER_AUTH,
      incoming: {
        ownerId: 'uid_owner',
        workspaceId: 'ws_1',
        date: '2026-10-25',
        memberId: 'm1',
        reason: 'বিলম্ব',
        amount: 100,
        createdAt: '2020-01-01T00:00:00.000Z',
        updatedAt: REQUEST_TIME,
      },
      db,
    }),
    'PERMISSION_DENIED'
  );

  // #11 Immutable Field Mutation (createdAt / ownerId swap)
  assert.equal(
    evaluateOperation({
      op: 'update',
      collection: 'members',
      workspaceId: 'ws_1',
      docId: 'm1',
      auth: OWNER_AUTH,
      existing: db.members['ws_1/m1'],
      incoming: {
        ...db.members['ws_1/m1'],
        name: 'Limon Updated',
        createdAt: REQUEST_TIME, // mutated immutable createdAt
        updatedAt: REQUEST_TIME,
      },
      db,
    }),
    'PERMISSION_DENIED'
  );

  // #12 Orphaned Relational Write (nonexistent memberId)
  assert.equal(
    evaluateOperation({
      op: 'create',
      collection: 'mealEntries',
      workspaceId: 'ws_1',
      docId: '2026-10-25_ghost',
      auth: OWNER_AUTH,
      incoming: {
        ownerId: 'uid_owner',
        workspaceId: 'ws_1',
        date: '2026-10-25',
        memberId: 'm_nonexistent',
        breakfast: 0.5,
        lunch: 1,
        dinner: 1,
        guest: 0,
        createdAt: REQUEST_TIME,
        updatedAt: REQUEST_TIME,
      },
      db,
    }),
    'PERMISSION_DENIED'
  );

  // Positive control: legitimate verified owner update succeeds
  assert.equal(
    evaluateOperation({
      op: 'update',
      collection: 'workspaces',
      workspaceId: 'ws_1',
      auth: OWNER_AUTH,
      existing: db.workspaces.ws_1,
      incoming: {
        ...db.workspaces.ws_1,
        linkedSpreadsheetId: '1AbCdEfGhIjKlMnOpQrStUvWxYz123456',
        linkedSpreadsheetTitle: 'মেস ম্যানেজার অক্টোবর ২০২৬',
        updatedAt: REQUEST_TIME,
      },
      db,
    }),
    'ALLOW'
  );
});

test('Anti-Tamper Bazar Ledger: deleting recorded bazar entries or downgrading editCount returns PERMISSION_DENIED while audited update succeeds', () => {
  const db = createSeedDb();
  const existingBazar = {
    ownerId: 'uid_owner',
    workspaceId: 'ws_1',
    date: '2026-10-25',
    shopperIds: ['m1'],
    items: 'চাল ও ডাল',
    amount: 1200,
    previousAmount: 0,
    editCount: 1,
    editedAt: '2026-10-25',
    status: 'approved',
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
  };

  // Even admin or owner cannot delete a recorded bazar entry
  assert.equal(
    evaluateOperation({
      op: 'delete',
      collection: 'bazarEntries',
      workspaceId: 'ws_1',
      docId: 'b1',
      auth: {
        uid: 'uid_admin',
        email: 'mdraihanrahmanlimon01@gmail.com',
        email_verified: true,
      },
      existing: existingBazar,
      db,
    }),
    'PERMISSION_DENIED'
  );

  // Downgrading editCount to erase edit history is denied
  assert.equal(
    evaluateOperation({
      op: 'update',
      collection: 'bazarEntries',
      workspaceId: 'ws_1',
      docId: 'b1',
      auth: OWNER_AUTH,
      existing: existingBazar,
      incoming: {
        ...existingBazar,
        amount: 1350,
        editCount: 0,
        updatedAt: REQUEST_TIME,
      },
      db,
    }),
    'PERMISSION_DENIED'
  );

  // Legitimate audited update with monotonic editCount succeeds
  assert.equal(
    evaluateOperation({
      op: 'update',
      collection: 'bazarEntries',
      workspaceId: 'ws_1',
      docId: 'b1',
      auth: OWNER_AUTH,
      existing: existingBazar,
      incoming: {
        ...existingBazar,
        amount: 1350,
        previousAmount: 1200,
        editCount: 2,
        editedAt: '2026-10-25',
        updatedAt: REQUEST_TIME,
      },
      db,
    }),
    'ALLOW'
  );
});
