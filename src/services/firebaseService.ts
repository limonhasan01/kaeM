import { initializeApp } from 'firebase/app';
import {
  GoogleAuthProvider,
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
  type User,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  getFirestore,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import type {
  BazarEntry,
  BazarRequisition,
  DepositEntry,
  FineEntry,
  MealsRecord,
  Member,
  MessState,
  PendingRequest,
} from '../types/mess';
import { ADMIN_USER, getTodayDateString } from '../utils/messCalculations';

// Single shared Firebase App, Firestore DB, and Auth instances
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

// Google Workspace OAuth scopes (Drive + Sheets)
export const SCOPES = [
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/spreadsheets.readonly',
];

const googleProvider = new GoogleAuthProvider();
for (const scope of SCOPES) {
  googleProvider.addScope(scope);
}
googleProvider.setCustomParameters({ prompt: 'consent' });

// Strictly in-memory OAuth access token cache (never stored in localStorage/sessionStorage)
let isSigningIn = false;
let cachedAccessToken: string | null = null;

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Validate connection to Firestore on application boot
let connectionChecked = false;
export async function testFirestoreConnection(): Promise<void> {
  if (connectionChecked) return;
  connectionChecked = true;
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

export const initAuth = (
  onAuthChange: (user: User | null, token: string | null) => void
) => {
  return onAuthStateChanged(auth, (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        onAuthChange(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        onAuthChange(user, null);
      }
    } else {
      cachedAccessToken = null;
      onAuthChange(null, null);
    }
  });
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string }> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, googleProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Google OAuth access token পাওয়া যায়নি। অনুগ্রহ করে আবার সাইন ইন করুন।');
    }
    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const logoutGoogle = async (): Promise<void> => {
  await auth.signOut();
  cachedAccessToken = null;
};

// ============================================================================
// Defensive Sanitization Constants Synched with firebase-blueprint.json
// ============================================================================
const ID_SAFE_REPLACE = /[^a-zA-Z0-9_-]/g;

function sanitizeId(raw: string, fallbackPrefix = 'id'): string {
  const cleaned = String(raw || '')
    .trim()
    .replace(ID_SAFE_REPLACE, '_')
    .slice(0, 128);
  return cleaned.length >= 1 ? cleaned : `${fallbackPrefix}_${Date.now()}`;
}

function sanitizeDate(raw: string): string {
  const trimmed = String(raw || '').trim();
  return /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(trimmed) ? trimmed : getTodayDateString();
}

function sanitizeUsername(raw: string, fallback: string): string {
  const cleaned = String(raw || '')
    .trim()
    .replace(/[^a-zA-Z0-9_.-]/g, '')
    .slice(0, 60);
  return cleaned.length >= 1 ? cleaned : fallback;
}

function sanitizePhone(raw: string): string {
  const cleaned = String(raw || '')
    .trim()
    .replace(/[^0-9+\-() ]/g, '')
    .slice(0, 30);
  return cleaned.length >= 3 ? cleaned : '01700000000';
}

function clampNum(val: number, min: number, max: number): number {
  const n = Number(val);
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

export interface CloudWorkspaceSummary {
  exists: boolean;
  workspaceName: string;
  linkedSpreadsheetId: string;
  linkedSpreadsheetTitle: string;
  updatedAtIso: string | null;
}

export function subscribeToWorkspaceMetadata(
  userId: string,
  onMetadata: (meta: CloudWorkspaceSummary) => void
): () => void {
  const workspaceId = sanitizeId(userId, 'ws');
  const wsPath = `workspaces/${workspaceId}`;
  return onSnapshot(
    doc(db, 'workspaces', workspaceId),
    (snap) => {
      if (!snap.exists()) {
        onMetadata({
          exists: false,
          workspaceName: 'মেস ম্যানেজার ক্লাউড',
          linkedSpreadsheetId: '',
          linkedSpreadsheetTitle: '',
          updatedAtIso: null,
        });
        return;
      }
      const data = snap.data();
      const ts = data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : null;
      onMetadata({
        exists: true,
        workspaceName: String(data.name || 'মেস ম্যানেজার ক্লাউড'),
        linkedSpreadsheetId: String(data.linkedSpreadsheetId || ''),
        linkedSpreadsheetTitle: String(data.linkedSpreadsheetTitle || ''),
        updatedAtIso: ts,
      });
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, wsPath);
    }
  );
}

export async function saveLinkedSpreadsheetToCloud(
  userId: string,
  spreadsheetId: string,
  spreadsheetTitle: string,
  currentState: MessState
): Promise<void> {
  const workspaceId = sanitizeId(userId, 'ws');
  const wsRef = doc(db, 'workspaces', workspaceId);
  const wsPath = `workspaces/${workspaceId}`;

  const cleanSheetId = spreadsheetId ? sanitizeId(spreadsheetId, 'sheet') : '';
  const cleanSheetTitle = String(spreadsheetTitle || '').trim().slice(0, 200);

  let existsAlready = false;
  try {
    const snap = await getDoc(wsRef);
    existsAlready = snap.exists();
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, wsPath);
  }

  if (existsAlready) {
    try {
      await updateDoc(wsRef, {
        linkedSpreadsheetId: cleanSheetId,
        linkedSpreadsheetTitle: cleanSheetTitle,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, wsPath);
    }
  } else {
    try {
      await setDoc(wsRef, {
        ownerId: userId,
        name: 'মেস ম্যানেজার ক্লাউড',
        rent: clampNum(currentState.utilities.rent, 0, 1000000),
        electric: clampNum(currentState.utilities.electric, 0, 1000000),
        gas: clampNum(currentState.utilities.gas, 0, 1000000),
        other: clampNum(currentState.utilities.other, 0, 1000000),
        linkedSpreadsheetId: cleanSheetId,
        linkedSpreadsheetTitle: cleanSheetTitle,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, wsPath);
    }
  }
}

export async function saveMessStateToFirestore(
  userId: string,
  state: MessState,
  linkedSpreadsheetId = '',
  linkedSpreadsheetTitle = ''
): Promise<void> {
  const workspaceId = sanitizeId(userId, 'ws');
  const wsRef = doc(db, 'workspaces', workspaceId);
  const wsPath = `workspaces/${workspaceId}`;

  const cleanSheetId = linkedSpreadsheetId ? sanitizeId(linkedSpreadsheetId, 'sheet') : '';
  const cleanSheetTitle = String(linkedSpreadsheetTitle || '').trim().slice(0, 200);

  // Step 1: Ensure root workspace document exists or update it
  let existingWsSnap;
  try {
    existingWsSnap = await getDoc(wsRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, wsPath);
  }

  if (!existingWsSnap.exists()) {
    try {
      await setDoc(wsRef, {
        ownerId: userId,
        name: 'মেস ম্যানেজার ক্লাউড',
        rent: clampNum(state.utilities.rent, 0, 1000000),
        electric: clampNum(state.utilities.electric, 0, 1000000),
        gas: clampNum(state.utilities.gas, 0, 1000000),
        other: clampNum(state.utilities.other, 0, 1000000),
        linkedSpreadsheetId: cleanSheetId,
        linkedSpreadsheetTitle: cleanSheetTitle,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, wsPath);
    }
  } else {
    const prevData = existingWsSnap.data();
    try {
      await updateDoc(wsRef, {
        name: 'মেস ম্যানেজার ক্লাউড',
        rent: clampNum(state.utilities.rent, 0, 1000000),
        electric: clampNum(state.utilities.electric, 0, 1000000),
        gas: clampNum(state.utilities.gas, 0, 1000000),
        other: clampNum(state.utilities.other, 0, 1000000),
        linkedSpreadsheetId: cleanSheetId || String(prevData.linkedSpreadsheetId || ''),
        linkedSpreadsheetTitle: cleanSheetTitle || String(prevData.linkedSpreadsheetTitle || ''),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, wsPath);
    }
  }

  // Step 2: Sync Members first (required by memberExists relational guard)
  const membersColPath = `workspaces/${workspaceId}/members`;
  let existingMembersSnap;
  try {
    existingMembersSnap = await getDocs(
      query(
        collection(db, 'workspaces', workspaceId, 'members'),
        where('ownerId', '==', userId),
        where('workspaceId', '==', workspaceId)
      )
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, membersColPath);
  }

  const existingMemberIds = new Set(existingMembersSnap.docs.map((d) => d.id));
  const activeMemberIds = new Set<string>();

  for (const m of state.members) {
    const memberId = sanitizeId(m.id, 'm');
    activeMemberIds.add(memberId);
    const memberRef = doc(db, 'workspaces', workspaceId, 'members', memberId);
    const mName = String(m.name || 'Member').trim().slice(0, 100) || 'Member';
    const mUser = sanitizeUsername(m.username, memberId);
    const mPhone = sanitizePhone(m.phone);
    const mWhatsapp = sanitizePhone(m.whatsapp || m.phone);

    if (existingMemberIds.has(memberId)) {
      try {
        await updateDoc(memberRef, {
          name: mName,
          username: mUser,
          phone: mPhone,
          whatsapp: mWhatsapp,
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `${membersColPath}/${memberId}`);
      }
    } else {
      try {
        await setDoc(memberRef, {
          ownerId: userId,
          workspaceId,
          name: mName,
          username: mUser,
          phone: mPhone,
          whatsapp: mWhatsapp,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, `${membersColPath}/${memberId}`);
      }
    }
  }

  for (const oldId of existingMemberIds) {
    if (!activeMemberIds.has(oldId)) {
      try {
        await deleteDoc(doc(db, 'workspaces', workspaceId, 'members', oldId));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `${membersColPath}/${oldId}`);
      }
    }
  }

  // Step 3: Sync MealEntries
  const mealsColPath = `workspaces/${workspaceId}/mealEntries`;
  let existingMealsSnap;
  try {
    existingMealsSnap = await getDocs(
      query(
        collection(db, 'workspaces', workspaceId, 'mealEntries'),
        where('ownerId', '==', userId),
        where('workspaceId', '==', workspaceId)
      )
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, mealsColPath);
  }
  const existingMealIds = new Set(existingMealsSnap.docs.map((d) => d.id));
  const activeMealIds = new Set<string>();

  for (const [rawDate, dayRecord] of Object.entries(state.meals)) {
    const date = sanitizeDate(rawDate);
    for (const [rawMemId, meal] of Object.entries(dayRecord || {})) {
      const memberId = sanitizeId(rawMemId, 'm');
      if (!activeMemberIds.has(memberId)) continue;
      const docId = sanitizeId(`${date}_${memberId}`, 'meal');
      activeMealIds.add(docId);

      const breakfast = Number(meal.breakfast) === 0.5 ? 0.5 : 0;
      const lunch = Number(meal.lunch) === 1 ? 1 : 0;
      const dinner = Number(meal.dinner) === 1 ? 1 : 0;
      const guest = clampNum(meal.guest, 0, 50);

      const mealRef = doc(db, 'workspaces', workspaceId, 'mealEntries', docId);
      if (existingMealIds.has(docId)) {
        try {
          await updateDoc(mealRef, {
            breakfast,
            lunch,
            dinner,
            guest,
            updatedAt: serverTimestamp(),
          });
        } catch (error) {
          handleFirestoreError(error, OperationType.UPDATE, `${mealsColPath}/${docId}`);
        }
      } else {
        try {
          await setDoc(mealRef, {
            ownerId: userId,
            workspaceId,
            date,
            memberId,
            breakfast,
            lunch,
            dinner,
            guest,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } catch (error) {
          handleFirestoreError(error, OperationType.CREATE, `${mealsColPath}/${docId}`);
        }
      }
    }
  }

  for (const oldMealId of existingMealIds) {
    if (!activeMealIds.has(oldMealId)) {
      try {
        await deleteDoc(doc(db, 'workspaces', workspaceId, 'mealEntries', oldMealId));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `${mealsColPath}/${oldMealId}`);
      }
    }
  }

  // Step 4: Sync BazarEntries (permanent non-deletable ledger with monotonic edit audit trail)
  const bazarColPath = `workspaces/${workspaceId}/bazarEntries`;
  let existingBazarSnap;
  try {
    existingBazarSnap = await getDocs(
      query(
        collection(db, 'workspaces', workspaceId, 'bazarEntries'),
        where('ownerId', '==', userId),
        where('workspaceId', '==', workspaceId)
      )
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, bazarColPath);
  }
  const existingBazarMap = new Map(existingBazarSnap.docs.map((d) => [d.id, d.data()]));

  for (const b of state.bazar) {
    const bId = sanitizeId(b.id, 'b');
    const shoppers = b.shopperIds
      .map((s) => sanitizeId(s, 'm'))
      .filter((s) => activeMemberIds.has(s))
      .slice(0, 20);
    if (shoppers.length === 0) continue;

    const cleanDate = sanitizeDate(b.date);
    const cleanItems = String(b.items || 'বাজার').trim().slice(0, 500) || 'বাজার';
    const cleanAmount = clampNum(b.amount, 1, 1000000);
    const cleanPrevAmount = clampNum(b.previousAmount || 0, 0, 1000000);
    const cleanEditCount = clampNum(b.editCount || 0, 0, 1000);
    const cleanEditedAt =
      b.editedAt && /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(b.editedAt) ? b.editedAt : '';
    const cleanStatus = b.status === 'pending' ? 'pending' : 'approved';

    const prevDoc = existingBazarMap.get(bId);
    if (!prevDoc) {
      try {
        await setDoc(doc(db, 'workspaces', workspaceId, 'bazarEntries', bId), {
          ownerId: userId,
          workspaceId,
          date: cleanDate,
          shopperIds: shoppers,
          items: cleanItems,
          amount: cleanAmount,
          previousAmount: cleanPrevAmount,
          editCount: cleanEditCount,
          editedAt: cleanEditedAt,
          status: cleanStatus,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, `${bazarColPath}/${bId}`);
      }
    } else {
      const prevShoppers = Array.isArray(prevDoc.shopperIds)
        ? prevDoc.shopperIds.map(String)
        : [];
      const hasChanges =
        String(prevDoc.date || '') !== cleanDate ||
        String(prevDoc.items || '') !== cleanItems ||
        Number(prevDoc.amount) !== cleanAmount ||
        Number(prevDoc.previousAmount || 0) !== cleanPrevAmount ||
        Number(prevDoc.editCount || 0) !== cleanEditCount ||
        String(prevDoc.editedAt || '') !== cleanEditedAt ||
        String(prevDoc.status || '') !== cleanStatus ||
        JSON.stringify(prevShoppers) !== JSON.stringify(shoppers);

      if (hasChanges) {
        const monotonicEditCount = Math.max(Number(prevDoc.editCount) || 0, cleanEditCount);
        try {
          await updateDoc(doc(db, 'workspaces', workspaceId, 'bazarEntries', bId), {
            date: cleanDate,
            shopperIds: shoppers,
            items: cleanItems,
            amount: cleanAmount,
            previousAmount: cleanPrevAmount,
            editCount: monotonicEditCount,
            editedAt: cleanEditedAt,
            status: cleanStatus,
            updatedAt: serverTimestamp(),
          });
        } catch (error) {
          handleFirestoreError(error, OperationType.UPDATE, `${bazarColPath}/${bId}`);
        }
      }
    }
  }

  // Step 5: Sync Deposits (respecting terminal lock on 'approved' records)
  const depositsColPath = `workspaces/${workspaceId}/deposits`;
  let existingDepSnap;
  try {
    existingDepSnap = await getDocs(
      query(
        collection(db, 'workspaces', workspaceId, 'deposits'),
        where('ownerId', '==', userId),
        where('workspaceId', '==', workspaceId)
      )
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, depositsColPath);
  }
  const existingDepIds = new Set(existingDepSnap.docs.map((d) => d.id));
  const activeDepIds = new Set<string>();

  for (const d of state.deposits) {
    const dId = sanitizeId(d.id, 'd');
    const memId = sanitizeId(d.memberId, 'm');
    if (!activeMemberIds.has(memId)) continue;

    activeDepIds.add(dId);
    if (!existingDepIds.has(dId)) {
      try {
        await setDoc(doc(db, 'workspaces', workspaceId, 'deposits', dId), {
          ownerId: userId,
          workspaceId,
          date: sanitizeDate(d.date),
          memberId: memId,
          amount: clampNum(d.amount, 1, 1000000),
          note: String(d.note || 'জমা').trim().slice(0, 300) || 'জমা',
          status: d.status === 'pending' ? 'pending' : 'approved',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, `${depositsColPath}/${dId}`);
      }
    }
  }

  for (const oldDepId of existingDepIds) {
    if (!activeDepIds.has(oldDepId)) {
      try {
        await deleteDoc(doc(db, 'workspaces', workspaceId, 'deposits', oldDepId));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `${depositsColPath}/${oldDepId}`);
      }
    }
  }

  // Step 6: Sync Fines
  const finesColPath = `workspaces/${workspaceId}/fines`;
  let existingFinesSnap;
  try {
    existingFinesSnap = await getDocs(
      query(
        collection(db, 'workspaces', workspaceId, 'fines'),
        where('ownerId', '==', userId),
        where('workspaceId', '==', workspaceId)
      )
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, finesColPath);
  }
  const existingFineIds = new Set(existingFinesSnap.docs.map((d) => d.id));
  const activeFineIds = new Set<string>();

  for (const f of state.fines) {
    const fId = sanitizeId(f.id, 'f');
    const memId = sanitizeId(f.memberId, 'm');
    if (!activeMemberIds.has(memId)) continue;

    activeFineIds.add(fId);
    if (!existingFineIds.has(fId)) {
      try {
        await setDoc(doc(db, 'workspaces', workspaceId, 'fines', fId), {
          ownerId: userId,
          workspaceId,
          date: sanitizeDate(f.date),
          memberId: memId,
          reason: String(f.reason || 'জরিমানা').trim().slice(0, 300) || 'জরিমানা',
          amount: clampNum(f.amount, 1, 100000),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, `${finesColPath}/${fId}`);
      }
    }
  }

  for (const oldFineId of existingFineIds) {
    if (!activeFineIds.has(oldFineId)) {
      try {
        await deleteDoc(doc(db, 'workspaces', workspaceId, 'fines', oldFineId));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `${finesColPath}/${oldFineId}`);
      }
    }
  }

  // Step 7: Sync BazarRequests (scheduled / completed bazar requisitions)
  const bazarReqColPath = `workspaces/${workspaceId}/bazarRequests`;
  let existingBazarReqSnap;
  try {
    existingBazarReqSnap = await getDocs(
      query(
        collection(db, 'workspaces', workspaceId, 'bazarRequests'),
        where('ownerId', '==', userId),
        where('workspaceId', '==', workspaceId)
      )
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, bazarReqColPath);
  }
  const existingBazarReqMap = new Map(existingBazarReqSnap.docs.map((d) => [d.id, d.data()]));
  const activeBazarReqIds = new Set<string>();

  for (const req of state.bazarRequests || []) {
    const reqId = sanitizeId(req.id, 'breq');
    const shoppers = req.shopperIds
      .map((s) => sanitizeId(s, 'm'))
      .filter((s) => activeMemberIds.has(s))
      .slice(0, 20);
    if (shoppers.length === 0) continue;

    activeBazarReqIds.add(reqId);
    const prevDoc = existingBazarReqMap.get(reqId);
    const nextStatus = req.status === 'completed' ? 'completed' : 'scheduled';

    if (!prevDoc) {
      try {
        await setDoc(doc(db, 'workspaces', workspaceId, 'bazarRequests', reqId), {
          ownerId: userId,
          workspaceId,
          date: sanitizeDate(req.date),
          shopperIds: shoppers,
          items: String(req.items || 'বাজার তালিকা').trim().slice(0, 500) || 'বাজার তালিকা',
          estimatedAmount: clampNum(req.estimatedAmount || 0, 0, 1000000),
          note: String(req.note || '').trim().slice(0, 300),
          status: nextStatus,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, `${bazarReqColPath}/${reqId}`);
      }
    } else if (prevDoc.status === 'scheduled' && nextStatus === 'completed') {
      try {
        await updateDoc(doc(db, 'workspaces', workspaceId, 'bazarRequests', reqId), {
          status: 'completed',
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `${bazarReqColPath}/${reqId}`);
      }
    }
  }

  for (const oldReqId of existingBazarReqMap.keys()) {
    if (!activeBazarReqIds.has(oldReqId)) {
      try {
        await deleteDoc(doc(db, 'workspaces', workspaceId, 'bazarRequests', oldReqId));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `${bazarReqColPath}/${oldReqId}`);
      }
    }
  }
}

export async function loadMessStateFromFirestore(
  userId: string,
  currentUserPreference: Member
): Promise<{
  state: MessState | null;
  linkedSpreadsheetId: string;
  linkedSpreadsheetTitle: string;
}> {
  const workspaceId = sanitizeId(userId, 'ws');
  const wsPath = `workspaces/${workspaceId}`;

  let wsSnap;
  try {
    wsSnap = await getDoc(doc(db, 'workspaces', workspaceId));
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, wsPath);
  }

  if (!wsSnap.exists()) {
    return {
      state: null,
      linkedSpreadsheetId: '',
      linkedSpreadsheetTitle: '',
    };
  }

  const wsData = wsSnap.data();

  const readScopedSubcol = async (subName: string) => {
    const subPath = `workspaces/${workspaceId}/${subName}`;
    try {
      return await getDocs(
        query(
          collection(db, 'workspaces', workspaceId, subName),
          where('ownerId', '==', userId),
          where('workspaceId', '==', workspaceId)
        )
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, subPath);
    }
  };

  const [membersSnap, mealsSnap, bazarSnap, bazarReqSnap, depSnap, finesSnap] = await Promise.all([
    readScopedSubcol('members'),
    readScopedSubcol('mealEntries'),
    readScopedSubcol('bazarEntries'),
    readScopedSubcol('bazarRequests'),
    readScopedSubcol('deposits'),
    readScopedSubcol('fines'),
  ]);

  const members: Member[] = membersSnap.docs.map((d) => {
    const data = d.data();
    const phone = String(data.phone || '');
    return {
      id: d.id,
      name: String(data.name || ''),
      username: String(data.username || d.id),
      phone,
      whatsapp: String(data.whatsapp || phone),
      isAdmin: false,
    };
  });

  if (members.length === 0) {
    return {
      state: null,
      linkedSpreadsheetId: String(wsData.linkedSpreadsheetId || ''),
      linkedSpreadsheetTitle: String(wsData.linkedSpreadsheetTitle || ''),
    };
  }

  const meals: MealsRecord = {};
  for (const d of mealsSnap.docs) {
    const data = d.data();
    const date = String(data.date || '');
    const memId = String(data.memberId || '');
    if (!date || !memId) continue;
    if (!meals[date]) meals[date] = {};
    meals[date][memId] = {
      breakfast: Number(data.breakfast) || 0,
      lunch: Number(data.lunch) || 0,
      dinner: Number(data.dinner) || 0,
      guest: Number(data.guest) || 0,
    };
  }

  const bazar: BazarEntry[] = bazarSnap.docs
    .map((d) => {
      const data = d.data();
      const prevAmt = Number(data.previousAmount) || 0;
      const editCnt = Number(data.editCount) || 0;
      const editedDate = String(data.editedAt || '');
      return {
        id: d.id,
        date: String(data.date || ''),
        shopperIds: Array.isArray(data.shopperIds) ? data.shopperIds.map(String) : [],
        items: String(data.items || ''),
        amount: Number(data.amount) || 0,
        status: (data.status === 'pending' ? 'pending' : 'approved') as 'pending' | 'approved',
        ...(prevAmt > 0 ? { previousAmount: prevAmt } : {}),
        ...(editCnt > 0 ? { editCount: editCnt } : {}),
        ...(editedDate ? { editedAt: editedDate } : {}),
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date));

  const deposits: DepositEntry[] = depSnap.docs
    .map((d) => {
      const data = d.data();
      return {
        id: d.id,
        date: String(data.date || ''),
        memberId: String(data.memberId || ''),
        amount: Number(data.amount) || 0,
        note: String(data.note || ''),
        status: (data.status === 'pending' ? 'pending' : 'approved') as 'pending' | 'approved',
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date));

  const fines: FineEntry[] = finesSnap.docs
    .map((d) => {
      const data = d.data();
      return {
        id: d.id,
        date: String(data.date || ''),
        memberId: String(data.memberId || ''),
        reason: String(data.reason || ''),
        amount: Number(data.amount) || 0,
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date));

  const bazarRequests: BazarRequisition[] = bazarReqSnap.docs
    .map((d) => {
      const data = d.data();
      return {
        id: d.id,
        date: String(data.date || ''),
        shopperIds: Array.isArray(data.shopperIds) ? data.shopperIds.map(String) : [],
        items: String(data.items || ''),
        estimatedAmount: Number(data.estimatedAmount) || 0,
        note: String(data.note || ''),
        status: (data.status === 'completed' ? 'completed' : 'scheduled') as
          | 'scheduled'
          | 'completed',
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date));

  const resolvedUser = currentUserPreference.isAdmin
    ? ADMIN_USER
    : members.find((m) => m.id === currentUserPreference.id) || members[0];

  const pendingRequests: PendingRequest[] = [];

  return {
    state: {
      currentUser: resolvedUser,
      members,
      meals,
      bazar,
      bazarRequests,
      deposits,
      pendingRequests,
      fines,
      utilities: {
        rent: Number(wsData.rent) || 0,
        electric: Number(wsData.electric) || 0,
        gas: Number(wsData.gas) || 0,
        other: Number(wsData.other) || 0,
      },
    },
    linkedSpreadsheetId: String(wsData.linkedSpreadsheetId || ''),
    linkedSpreadsheetTitle: String(wsData.linkedSpreadsheetTitle || ''),
  };
}
