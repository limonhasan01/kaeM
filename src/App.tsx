/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle2, ShieldCheck, XCircle } from 'lucide-react';
import type {
  ActiveTab,
  BazarEntry,
  MealType,
  Member,
  MessState,
  PendingRequest,
  UtilityConfig,
} from './types/mess';
import {
  ADMIN_USER,
  applyGuestMealToMeals,
  applyMealChangeToMeals,
  approvePendingRequestInState,
  calculateMemberFinancials,
  calculateSummaryStats,
  createInitialMessState,
  createMealToggleRequest,
  getTodayDateString,
  rejectPendingRequestInState,
  resolveInitialPreviewUser,
  sanitizeActiveTabForRole,
  updateBazarEntryByAdmin,
} from './utils/messCalculations';
import { MobileBottomNav, SecondaryWorkspaceTabs, TopNavBar } from './components/NavigationBars';
import { SummaryStatsStrip } from './components/SummaryStatsStrip';
import { PWAInstallBanner, OfflineIndicator } from './components/PWAInstallBanner';
import { MealsTab } from './components/MealsTab';
import { BazarTab } from './components/BazarTab';
import { AnalyticsTab } from './components/AnalyticsTab';
import { DepositsTab } from './components/DepositsTab';
import { PendingRequestsTab } from './components/PendingRequestsTab';
import { MembersTab } from './components/MembersTab';
import { UtilitiesTab } from './components/UtilitiesTab';
import { GoogleSheetsCloudTab } from './components/GoogleSheetsCloudTab';
import {
  AddBazarModal,
  AddDepositModal,
  AddMemberModal,
  BazarReceiptModal,
  BazarRequestModal,
  EditBazarModal,
  FineModal,
  ProfileEditModal,
  UserSwitchModal,
  type BazarReceiptModalSeed,
  type UserSwitchTargetMode,
} from './components/Modals';
import type { User } from 'firebase/auth';
import {
  googleSignIn,
  initAuth,
  loadMessStateFromFirestore,
  logoutGoogle,
  saveLinkedSpreadsheetToCloud,
  saveMessStateToFirestore,
  subscribeToWorkspaceMetadata,
  testFirestoreConnection,
  type CloudWorkspaceSummary,
} from './services/firebaseService';
import type { ParsedWorkbookImport } from './utils/sheetsFormatter';

const STORAGE_KEY = 'bachelor_mess_android_app_v1';

interface ToastItem {
  id: string;
  message: string;
  type: 'success' | 'error';
}

function loadPersistedState(): MessState {
  const today = getTodayDateString();
  const fallback = createInitialMessState(today);
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<MessState>;
    if (!parsed || !Array.isArray(parsed.members) || parsed.members.length === 0) {
      return fallback;
    }

    const normalizedMembers = parsed.members.map((m) => ({
      ...m,
      whatsapp: m.whatsapp || m.phone,
    }));

    // Always boot preview into Member Dashboard first; Admin Panel requires password entry per session
    const currentUser = resolveInitialPreviewUser(parsed.currentUser, normalizedMembers);

    return {
      currentUser,
      members: normalizedMembers,
      meals: parsed.meals || fallback.meals,
      bazar: Array.isArray(parsed.bazar) ? parsed.bazar : fallback.bazar,
      bazarRequests: Array.isArray(parsed.bazarRequests)
        ? parsed.bazarRequests
        : fallback.bazarRequests || [],
      deposits: Array.isArray(parsed.deposits) ? parsed.deposits : fallback.deposits,
      pendingRequests: Array.isArray(parsed.pendingRequests) ? parsed.pendingRequests : [],
      fines: Array.isArray(parsed.fines) ? parsed.fines : [],
      utilities: parsed.utilities || fallback.utilities,
    };
  } catch {
    return fallback;
  }
}

export default function App() {
  const [state, setState] = useState<MessState>(loadPersistedState);
  const [activeTab, setActiveTab] = useState<ActiveTab>('meals');
  const [selectedDate, setSelectedDate] = useState<string>(getTodayDateString);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  // Modal visibility & focused member states
  const [focusedMealMemberId, setFocusedMealMemberId] = useState<string | null>(null);
  const [isUserSwitchOpen, setIsUserSwitchOpen] = useState(false);
  const [userSwitchMode, setUserSwitchMode] = useState<UserSwitchTargetMode>('current');
  const [isAddBazarOpen, setIsAddBazarOpen] = useState(false);
  const [isBazarRequestOpen, setIsBazarRequestOpen] = useState(false);
  const [receiptModalSeed, setReceiptModalSeed] = useState<BazarReceiptModalSeed | null>(null);
  const [isAddDepositOpen, setIsAddDepositOpen] = useState(false);
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [isFineModalOpen, setIsFineModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [editingBazarEntry, setEditingBazarEntry] = useState<BazarEntry | null>(null);

  // Firebase Auth + Google Sheets OAuth state
  const [authReady, setAuthReady] = useState(false);
  const [googleUser, setGoogleUser] = useState<User | null>(null);
  const [googleAccessToken, setGoogleAccessToken] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [cloudMeta, setCloudMeta] = useState<CloudWorkspaceSummary | null>(null);
  const [isCloudBusy, setIsCloudBusy] = useState(false);
  const [autoCloudSync, setAutoCloudSync] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Storage quota or restricted iframe storage ignored safely
    }
  }, [state]);

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev, { id, message, type }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  // Boot Firestore connection check & Auth state listener
  useEffect(() => {
    void testFirestoreConnection();
    const unsubscribe = initAuth((user, token) => {
      setGoogleUser(user);
      setGoogleAccessToken(token);
      setAuthReady(true);
      if (!user) {
        setCloudMeta(null);
        setAutoCloudSync(false);
      }
    });
    return () => unsubscribe();
  }, []);

  // Attach Firestore workspace metadata listener only when auth is ready and user is authenticated
  useEffect(() => {
    if (!authReady || !googleUser) return;
    let unsub: (() => void) | undefined;
    try {
      unsub = subscribeToWorkspaceMetadata(googleUser.uid, (meta) => {
        setCloudMeta(meta);
      });
    } catch (err) {
      console.error('Workspace subscription error:', err);
    }
    return () => {
      if (unsub) unsub();
    };
  }, [authReady, googleUser]);

  // Optional auto-sync to Firestore on state changes when enabled by user
  useEffect(() => {
    if (!authReady || !googleUser || !autoCloudSync) return;
    const timer = window.setTimeout(() => {
      saveMessStateToFirestore(
        googleUser.uid,
        state,
        cloudMeta?.linkedSpreadsheetId || '',
        cloudMeta?.linkedSpreadsheetTitle || ''
      ).catch((err) => {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('Quota exceeded')) {
          showToast('Firestore দৈনিক ফ্রি কোটা শেষ হয়েছে। আগামীকাল পুনরায় রিসেট হবে।', 'error');
          setAutoCloudSync(false);
        }
      });
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [
    authReady,
    autoCloudSync,
    cloudMeta?.linkedSpreadsheetId,
    cloudMeta?.linkedSpreadsheetTitle,
    googleUser,
    showToast,
    state,
  ]);

  const summaryStats = useMemo(
    () => calculateSummaryStats(state.members, state.meals, state.bazar, state.deposits),
    [state.members, state.meals, state.bazar, state.deposits]
  );

  const memberFinancials = useMemo(
    () =>
      calculateMemberFinancials(
        state.members,
        state.meals,
        state.bazar,
        state.deposits,
        state.fines
      ),
    [state.members, state.meals, state.bazar, state.deposits, state.fines]
  );

  const currentMemberFinancial = useMemo(
    () => memberFinancials.find((f) => f.member.id === state.currentUser.id),
    [memberFinancials, state.currentUser.id]
  );

  const effectiveActiveTab = useMemo(
    () => sanitizeActiveTabForRole(activeTab, state.currentUser.isAdmin),
    [activeTab, state.currentUser.isAdmin]
  );

  const openUserSwitch = useCallback((mode: UserSwitchTargetMode = 'current') => {
    setUserSwitchMode(mode);
    setIsUserSwitchOpen(true);
  }, []);

  // Handlers
  const handleSwitchUser = (nextUser: Member) => {
    setState((prev) => ({ ...prev, currentUser: nextUser }));
    if (!nextUser.isAdmin) {
      setFocusedMealMemberId(nextUser.id);
      setActiveTab((prevTab) => sanitizeActiveTabForRole(prevTab, false));
    }
    showToast(
      nextUser.isAdmin
        ? 'এডমিন প্যানেলে স্বাগতম!'
        : `${nextUser.name}-এর মেম্বার ড্যাশবোর্ড চালু হয়েছে`
    );
  };

  const handleReturnToMemberDashboard = () => {
    const defaultMember = state.members[0];
    if (!defaultMember) return;
    handleSwitchUser(defaultMember);
  };

  const handleViewMemberMealHistory = (memberId: string) => {
    setFocusedMealMemberId(memberId);
    setActiveTab('meals');
  };

  const handleToggleMeal = (
    date: string,
    memberId: string,
    mealType: MealType,
    isChecked: boolean
  ) => {
    const member = state.members.find((m) => m.id === memberId);
    if (!member) return;

    if (state.currentUser.isAdmin) {
      setState((prev) => ({
        ...prev,
        meals: applyMealChangeToMeals(prev.meals, date, memberId, mealType, isChecked),
      }));
      showToast(`এডমিন আপডেট করেছেন: ${member.name}`);
    } else {
      const req = createMealToggleRequest(
        state.currentUser.name,
        member.name,
        memberId,
        date,
        mealType,
        isChecked
      );
      setState((prev) => ({
        ...prev,
        pendingRequests: [...prev.pendingRequests, req],
      }));
      showToast('অনুরোধ এডমিনের কাছে পাঠানো হয়েছে');
    }
  };

  const handleUpdateGuestMeal = (date: string, memberId: string, count: number) => {
    const member = state.members.find((m) => m.id === memberId);
    if (!member) return;
    const cleanCount = Math.max(0, Number(count) || 0);

    if (state.currentUser.isAdmin) {
      setState((prev) => ({
        ...prev,
        meals: applyGuestMealToMeals(prev.meals, date, memberId, cleanCount),
      }));
      showToast(`গেস্ট মিল আপডেট হয়েছে (${member.name})`);
    } else {
      const req: PendingRequest = {
        id: `req_${Date.now()}`,
        type: 'GUEST_MEAL',
        requestedBy: state.currentUser.name,
        date,
        dataPayload: { memberId, date, count: cleanCount },
        details: `${date} তারিখে ${member.name}-এর জন্য ${cleanCount} টি গেস্ট মিল যুক্ত করার আবেদন`,
      };
      setState((prev) => ({
        ...prev,
        pendingRequests: [...prev.pendingRequests, req],
      }));
      showToast('গেস্ট মিলের আবেদন এডমিনের কাছে পাঠানো হয়েছে');
    }
  };

  const handleSubmitBazar = (payload: {
    date: string;
    shopperIds: string[];
    items: string;
    amount: number;
  }) => {
    const shopperNames = payload.shopperIds
      .map((id) => state.members.find((m) => m.id === id)?.name)
      .filter(Boolean)
      .join(', ');

    if (state.currentUser.isAdmin) {
      setState((prev) => ({
        ...prev,
        bazar: [
          {
            id: `b_${Date.now()}`,
            date: payload.date,
            shopperIds: payload.shopperIds,
            items: payload.items,
            amount: payload.amount,
            status: 'approved',
          },
          ...prev.bazar,
        ],
      }));
      showToast('যৌথ বাজার এন্ট্রি যুক্ত হয়েছে');
    } else {
      const req: PendingRequest = {
        id: `req_${Date.now()}`,
        type: 'BAZAR_ENTRY',
        requestedBy: state.currentUser.name,
        date: payload.date,
        dataPayload: payload,
        details: `${shopperNames}-এর ${payload.date} তারিখে ৳${payload.amount} টাকার যৌথ বাজার (${payload.items})`,
      };
      setState((prev) => ({
        ...prev,
        pendingRequests: [...prev.pendingRequests, req],
      }));
      showToast('যৌথ বাজার খরচের আবেদন এডমিনের কাছে পাঠানো হয়েছে');
    }
  };

  const handleSubmitDeposit = (payload: {
    date: string;
    memberId: string;
    amount: number;
    note: string;
  }) => {
    const mem = state.members.find((m) => m.id === payload.memberId);
    const memName = mem ? mem.name : 'মেম্বার';

    if (state.currentUser.isAdmin) {
      setState((prev) => ({
        ...prev,
        deposits: [
          {
            id: `d_${Date.now()}`,
            date: payload.date,
            memberId: payload.memberId,
            amount: payload.amount,
            note: payload.note,
            status: 'approved',
          },
          ...prev.deposits,
        ],
      }));
      showToast('টাকা জমা রেকর্ড করা হয়েছে');
    } else {
      const req: PendingRequest = {
        id: `req_${Date.now()}`,
        type: 'DEPOSIT_ENTRY',
        requestedBy: state.currentUser.name,
        date: payload.date,
        dataPayload: payload,
        details: `${memName}-এর ${payload.date} তারিখে ৳${payload.amount} টাকা জমার আবেদন (${payload.note})`,
      };
      setState((prev) => ({
        ...prev,
        pendingRequests: [...prev.pendingRequests, req],
      }));
      showToast('জমার আবেদন এডমিনের কাছে পাঠানো হয়েছে');
    }
  };

  const handleSubmitProfileEdit = (payload: {
    memberId: string;
    newName: string;
    newPhone: string;
    newWhatsapp: string;
    newUsername: string;
  }) => {
    const mem = state.members.find((m) => m.id === payload.memberId);
    if (!mem) return;

    if (state.currentUser.isAdmin) {
      setState((prev) => ({
        ...prev,
        members: prev.members.map((m) =>
          m.id === payload.memberId
            ? {
                ...m,
                name: payload.newName,
                phone: payload.newPhone,
                whatsapp: payload.newWhatsapp || payload.newPhone,
                username: payload.newUsername,
              }
            : m
        ),
      }));
      showToast('প্রোফাইল ও WhatsApp নম্বর আপডেট হয়েছে');
    } else {
      const req: PendingRequest = {
        id: `req_${Date.now()}`,
        type: 'PROFILE_EDIT',
        requestedBy: state.currentUser.name,
        date: getTodayDateString(),
        dataPayload: payload,
        details: `${mem.name}-এর নাম (${payload.newName}), ফোন (${payload.newPhone}), WhatsApp (${payload.newWhatsapp}) হালনাগাদ আবেদন`,
      };
      setState((prev) => ({
        ...prev,
        pendingRequests: [...prev.pendingRequests, req],
      }));
      showToast('প্রোফাইল পরিবর্তনের অনুরোধ এডমিনের কাছে পাঠানো হয়েছে');
    }
  };

  const handleAddMember = (payload: {
    name: string;
    username: string;
    phone: string;
    whatsapp: string;
  }) => {
    if (!state.currentUser.isAdmin) {
      showToast('শুধুমাত্র এডমিন মেম্বার যুক্ত করতে পারবেন', 'error');
      return;
    }

    const newMem: Member = {
      id: `m_${Date.now()}`,
      name: payload.name,
      username: payload.username,
      phone: payload.phone,
      whatsapp: payload.whatsapp || payload.phone,
      isAdmin: false,
    };

    setState((prev) => ({
      ...prev,
      members: [...prev.members, newMem],
    }));
    showToast('নতুন মেম্বার ও WhatsApp নম্বর যুক্ত হয়েছে');
  };

  const handleCreateBazarRequest = (payload: {
    date: string;
    shopperIds: string[];
    items: string;
    estimatedAmount: number;
    note: string;
  }) => {
    if (!state.currentUser.isAdmin) {
      showToast('শুধুমাত্র এডমিন বাজারের দায়িত্ব বণ্টন করতে পারবেন', 'error');
      return;
    }

    setState((prev) => ({
      ...prev,
      bazarRequests: [
        {
          id: `breq_${Date.now()}`,
          date: payload.date,
          shopperIds: payload.shopperIds,
          items: payload.items,
          estimatedAmount: payload.estimatedAmount,
          note: payload.note,
          status: 'scheduled',
        },
        ...(prev.bazarRequests || []),
      ],
    }));
    showToast('বাজারের ফর্দ ও রিকোয়েস্ট সংরক্ষিত হয়েছে');
  };

  const handleDeleteBazarRequest = (reqId: string) => {
    if (!state.currentUser.isAdmin) return;
    setState((prev) => ({
      ...prev,
      bazarRequests: (prev.bazarRequests || []).filter((r) => r.id !== reqId),
    }));
    showToast('বাজারের রিকোয়েস্ট মুছে ফেলা হয়েছে');
  };

  const handleSaveReceiptToBazar = (payload: {
    receiptNo: string;
    date: string;
    shopperIds: string[];
    items: string;
    amount: number;
    advanceAmount: number;
    note: string;
    addToBazar: boolean;
    completedRequestId?: string;
  }) => {
    if (!payload.addToBazar) {
      if (payload.completedRequestId) {
        setState((prev) => ({
          ...prev,
          bazarRequests: (prev.bazarRequests || []).map((r) =>
            r.id === payload.completedRequestId ? { ...r, status: 'completed' } : r
          ),
        }));
      }
      showToast(`রশিদ (${payload.receiptNo}) প্রস্তুত হয়েছে — বাজার খাতায় যুক্ত করা হয়নি`);
      return;
    }

    setState((prev) => ({
      ...prev,
      bazar: [
        {
          id: `b_${Date.now()}`,
          date: payload.date,
          shopperIds: payload.shopperIds,
          items: payload.items,
          amount: payload.amount,
          advanceAmount: payload.advanceAmount > 0 ? payload.advanceAmount : undefined,
          receiptNo: payload.receiptNo,
          note: payload.note || undefined,
          status: state.currentUser.isAdmin ? 'approved' : 'pending',
        },
        ...prev.bazar,
      ],
      bazarRequests: payload.completedRequestId
        ? (prev.bazarRequests || []).map((r) =>
            r.id === payload.completedRequestId ? { ...r, status: 'completed' } : r
          )
        : prev.bazarRequests || [],
    }));
    showToast(`ডিজিটাল বাজার রশিদ (${payload.receiptNo}) বাজার খাতায় সংরক্ষিত হয়েছে`);
  };

  const handleUpdateBazarEntry = (payload: {
    id: string;
    date: string;
    shopperIds: string[];
    items: string;
    amount: number;
    note: string;
  }) => {
    if (!state.currentUser.isAdmin) {
      showToast('শুধুমাত্র এডমিন বাজারের হিসাব সংশোধন করতে পারবেন', 'error');
      return;
    }
    setState((prev) => ({
      ...prev,
      bazar: updateBazarEntryByAdmin(
        prev.bazar,
        payload.id,
        {
          date: payload.date,
          shopperIds: payload.shopperIds,
          items: payload.items,
          amount: payload.amount,
          note: payload.note,
        },
        getTodayDateString()
      ),
    }));
    showToast('বাজারের হিসাব সংশোধন করা হয়েছে (পূর্বের হিসাব অডিটে সংরক্ষিত)');
  };

  const handleDeleteMember = (memberId: string) => {
    if (!state.currentUser.isAdmin) return;
    if (state.members.length <= 1) {
      showToast('মেসে কমপক্ষে ১ জন মেম্বার থাকা আবশ্যক', 'error');
      return;
    }
    setState((prev) => {
      const nextMembers = prev.members.filter((m) => m.id !== memberId);
      const nextCurrentUser =
        prev.currentUser.id === memberId ? nextMembers[0] : prev.currentUser;
      return {
        ...prev,
        members: nextMembers,
        currentUser: nextCurrentUser,
      };
    });
    showToast('মেম্বার ডিলিট করা হয়েছে');
  };

  const handleApproveRequest = (reqId: string) => {
    if (!state.currentUser.isAdmin) return;
    setState((prev) => approvePendingRequestInState(prev, reqId));
    showToast('রিকোয়েস্ট অ্যাপ্রুভ হয়েছে');
  };

  const handleRejectRequest = (reqId: string) => {
    if (!state.currentUser.isAdmin) return;
    setState((prev) => rejectPendingRequestInState(prev, reqId));
    showToast('রিকোয়েস্ট বাতিল করা হয়েছে', 'error');
  };

  const handleOpenFineModal = () => {
    if (!state.currentUser.isAdmin) {
      showToast('শুধুমাত্র এডমিন জরিমানা ধার্য করতে পারবেন', 'error');
      return;
    }
    setIsFineModalOpen(true);
  };

  const handleSubmitFine = (payload: { memberId: string; reason: string; amount: number }) => {
    if (!state.currentUser.isAdmin) return;
    setState((prev) => ({
      ...prev,
      fines: [
        {
          id: `f_${Date.now()}`,
          date: getTodayDateString(),
          memberId: payload.memberId,
          reason: payload.reason,
          amount: payload.amount,
        },
        ...prev.fines,
      ],
    }));
    showToast('জরিমানা ধার্য করা হয়েছে');
  };

  const handleUpdateUtilities = (next: UtilityConfig) => {
    setState((prev) => ({ ...prev, utilities: next }));
  };

  const handleGoogleLogin = async () => {
    setIsSigningIn(true);
    try {
      const result = await googleSignIn();
      setGoogleUser(result.user);
      setGoogleAccessToken(result.accessToken);
      showToast(`Google অ্যাকাউন্ট সংযুক্ত হয়েছে (${result.user.email || result.user.displayName})`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes('popup-closed-by-user')) {
        showToast('Google সাইন-ইন সম্পন্ন হয়নি', 'error');
      }
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleGoogleLogout = async () => {
    await logoutGoogle();
    setGoogleUser(null);
    setGoogleAccessToken(null);
    setCloudMeta(null);
    setAutoCloudSync(false);
    showToast('Google অ্যাকাউন্ট থেকে সাইন আউট করা হয়েছে');
  };

  const handleSaveToFirestore = async () => {
    if (!googleUser) return;
    setIsCloudBusy(true);
    try {
      await saveMessStateToFirestore(
        googleUser.uid,
        state,
        cloudMeta?.linkedSpreadsheetId || '',
        cloudMeta?.linkedSpreadsheetTitle || ''
      );
      showToast('মেসের সকল হিসাব Firebase Firestore ক্লাউডে সংরক্ষিত হয়েছে');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('Quota exceeded')) {
        showToast('Firestore ফ্রি কোটা শেষ হয়েছে। আগামীকাল পুনরায় রিসেট হবে।', 'error');
      } else {
        showToast('ক্লাউডে সেভ করতে সমস্যা হয়েছে', 'error');
      }
    } finally {
      setIsCloudBusy(false);
    }
  };

  const handleLoadFromFirestore = async () => {
    if (!googleUser) return;
    setIsCloudBusy(true);
    try {
      const loaded = await loadMessStateFromFirestore(googleUser.uid, state.currentUser);
      if (!loaded.state) {
        showToast('ক্লাউডে এখনো কোনো সংরক্ষিত ডেটা নেই', 'error');
        return;
      }
      setState(loaded.state);
      showToast('Firebase ক্লাউড থেকে মেসের হিসাব লোড করা হয়েছে');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('Quota exceeded')) {
        showToast('Firestore ফ্রি কোটা শেষ হয়েছে। আগামীকাল পুনরায় রিসেট হবে।', 'error');
      } else {
        showToast('ক্লাউড থেকে ডেটা লোড করা যায়নি', 'error');
      }
    } finally {
      setIsCloudBusy(false);
    }
  };

  const handleLinkSpreadsheetInCloud = async (sheetId: string, sheetTitle: string) => {
    if (!googleUser) return;
    try {
      await saveLinkedSpreadsheetToCloud(googleUser.uid, sheetId, sheetTitle, state);
    } catch (err) {
      console.error('Failed to persist linked spreadsheet metadata:', err);
    }
  };

  const handleApplyImportedSheetData = (imported: ParsedWorkbookImport) => {
    setState((prev) => {
      const nextMembers =
        imported.members && imported.members.length > 0 ? imported.members : prev.members;
      const nextCurrentUser = prev.currentUser.isAdmin
        ? ADMIN_USER
        : nextMembers.find((m) => m.id === prev.currentUser.id) || nextMembers[0];

      return {
        ...prev,
        currentUser: nextCurrentUser,
        members: nextMembers,
        meals: imported.meals || prev.meals,
        bazar: imported.bazar || prev.bazar,
        deposits: imported.deposits || prev.deposits,
        fines: imported.fines || prev.fines,
        utilities: imported.utilities || prev.utilities,
      };
    });
  };

  return (
    <div className="min-h-full flex flex-col bg-slate-50 text-slate-800 pb-20 md:pb-8">
      <OfflineIndicator />

      {/* Top Navigation Bar */}
      <TopNavBar
        activeTab={effectiveActiveTab}
        onSelectTab={setActiveTab}
        currentUser={state.currentUser}
        pendingCount={state.pendingRequests.length}
        onOpenUserSwitch={() =>
          openUserSwitch(state.currentUser.isAdmin ? 'member' : 'current')
        }
      />

      {/* Toast Feedback Stack */}
      <div
        aria-live="polite"
        className="fixed top-16 right-4 z-50 flex flex-col gap-2 pointer-events-none"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`px-4 py-2.5 rounded-xl border text-xs font-semibold flex items-center gap-2 pointer-events-auto transition-opacity ${
              t.type === 'error'
                ? 'bg-rose-50 border-rose-200 text-rose-800'
                : 'bg-teal-50 border-teal-200 text-teal-900'
            }`}
          >
            {t.type === 'error' ? (
              <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />
            )}
            <span>{t.message}</span>
          </div>
        ))}
      </div>

      {/* Main Content Container */}
      <main className="flex-1 w-full max-w-6xl mx-auto px-4 md:px-6 py-5 space-y-6">
        {/* Android Installable App Banner */}
        <PWAInstallBanner />

        {/* Admin Mode Active Workspace Bar */}
        {state.currentUser.isAdmin && (
          <div
            data-testid="admin-mode-banner"
            className="bg-slate-900 text-white rounded-2xl px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
          >
            <div className="flex items-center gap-2.5 text-xs">
              <ShieldCheck className="w-4 h-4 text-teal-400 shrink-0" />
              <span className="font-semibold">এডমিন প্যানেল সক্রিয়</span>
              <span aria-hidden="true" className="text-slate-500">·</span>
              <span className="text-slate-300 tabular-nums">
                পেন্ডিং অনুমোদন: {state.pendingRequests.length} টি
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {effectiveActiveTab !== 'pending-requests' && (
                <button
                  type="button"
                  onClick={() => setActiveTab('pending-requests')}
                  className="min-h-[36px] px-3 py-1.5 bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold rounded-xl transition-colors whitespace-nowrap cursor-pointer"
                >
                  অ্যাপ্রুভাল হাব ({state.pendingRequests.length})
                </button>
              )}
              <button
                type="button"
                data-testid="exit-admin-btn"
                onClick={handleReturnToMemberDashboard}
                className="min-h-[36px] px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-semibold rounded-xl transition-colors inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>মেম্বার ড্যাশবোর্ডে ফিরুন</span>
              </button>
            </div>
          </div>
        )}

        {/* Summary KPI Strip (Personal Member KPIs vs Full Mess Admin KPIs) */}
        <SummaryStatsStrip
          isAdmin={state.currentUser.isAdmin}
          totalMeals={summaryStats.totalMeals}
          totalDeposit={summaryStats.totalDeposit}
          totalBazar={summaryStats.totalBazar}
          cashBalance={summaryStats.cashBalance}
          mealRate={summaryStats.mealRate}
          memberFinancial={currentMemberFinancial}
        />

        {/* Workspace Section Tab Bar (5 Member Tabs vs 8 Admin Tabs) */}
        <SecondaryWorkspaceTabs
          activeTab={effectiveActiveTab}
          onSelectTab={setActiveTab}
          pendingCount={state.pendingRequests.length}
          isAdmin={state.currentUser.isAdmin}
        />

        {/* Active Tab View */}
        {effectiveActiveTab === 'meals' && (
          <MealsTab
            selectedDate={selectedDate}
            onChangeDate={setSelectedDate}
            members={state.members}
            currentUser={state.currentUser}
            meals={state.meals}
            pendingRequests={state.pendingRequests}
            focusedMemberId={focusedMealMemberId}
            onSelectFocusedMember={setFocusedMealMemberId}
            onToggleMeal={handleToggleMeal}
            onUpdateGuestMeal={handleUpdateGuestMeal}
            onOpenEditOwnProfile={() => {
              const own = state.members.find((m) => m.id === state.currentUser.id);
              if (own) setEditingMember(own);
            }}
            onOpenMemberSwitch={() => openUserSwitch('member')}
            onOpenAdminLogin={() => openUserSwitch('admin')}
          />
        )}

        {effectiveActiveTab === 'bazar' && (
          <BazarTab
            currentUser={state.currentUser}
            members={state.members}
            bazar={state.bazar}
            bazarRequests={state.bazarRequests || []}
            onOpenAddBazar={() => setIsAddBazarOpen(true)}
            onOpenBazarRequestModal={() => setIsBazarRequestOpen(true)}
            onOpenBazarReceiptModal={(seed) => setReceiptModalSeed(seed)}
            onOpenEditBazar={(entry) => setEditingBazarEntry(entry)}
            onDeleteBazarRequest={handleDeleteBazarRequest}
          />
        )}

        {effectiveActiveTab === 'analytics' && (
          <AnalyticsTab
            currentUser={state.currentUser}
            financials={memberFinancials}
            members={state.members}
            bazar={state.bazar}
          />
        )}

        {effectiveActiveTab === 'deposits' && (
          <DepositsTab
            currentUser={state.currentUser}
            members={state.members}
            deposits={state.deposits}
            financials={memberFinancials}
            onOpenAddDeposit={() => setIsAddDepositOpen(true)}
          />
        )}

        {state.currentUser.isAdmin && effectiveActiveTab === 'pending-requests' && (
          <PendingRequestsTab
            currentUser={state.currentUser}
            members={state.members}
            bazarRequests={state.bazarRequests || []}
            pendingRequests={state.pendingRequests}
            onApprove={handleApproveRequest}
            onReject={handleRejectRequest}
            onOpenUserSwitch={() => openUserSwitch('admin')}
            onOpenBazarRequestModal={() => setIsBazarRequestOpen(true)}
            onOpenBazarReceiptModal={(seed) => setReceiptModalSeed(seed)}
            onDeleteBazarRequest={handleDeleteBazarRequest}
          />
        )}

        {state.currentUser.isAdmin && effectiveActiveTab === 'members' && (
          <MembersTab
            members={state.members}
            currentUser={state.currentUser}
            onOpenAddMember={() => setIsAddMemberOpen(true)}
            onOpenEditProfile={(mem) => setEditingMember(mem)}
            onDeleteMember={handleDeleteMember}
            onViewMemberMealHistory={handleViewMemberMealHistory}
          />
        )}

        {effectiveActiveTab === 'utilities' && (
          <UtilitiesTab
            members={state.members}
            currentUser={state.currentUser}
            fines={state.fines}
            utilities={state.utilities}
            onUpdateUtilities={handleUpdateUtilities}
            onOpenFineModal={handleOpenFineModal}
          />
        )}

        {state.currentUser.isAdmin && effectiveActiveTab === 'backup' && (
          <GoogleSheetsCloudTab
            messState={state}
            selectedDate={selectedDate}
            googleUser={googleUser}
            accessToken={googleAccessToken}
            isSigningIn={isSigningIn}
            autoCloudSync={autoCloudSync}
            onToggleAutoCloudSync={setAutoCloudSync}
            cloudMeta={cloudMeta}
            isCloudBusy={isCloudBusy}
            onGoogleLogin={handleGoogleLogin}
            onGoogleLogout={handleGoogleLogout}
            onSaveToFirestore={handleSaveToFirestore}
            onLoadFromFirestore={handleLoadFromFirestore}
            onLinkSpreadsheetInCloud={handleLinkSpreadsheetInCloud}
            onApplyImportedSheetData={handleApplyImportedSheetData}
            onShowToast={showToast}
          />
        )}
      </main>

      {/* Mobile Bottom Tab Bar */}
      <MobileBottomNav
        activeTab={effectiveActiveTab}
        onSelectTab={setActiveTab}
        pendingCount={state.pendingRequests.length}
        isAdmin={state.currentUser.isAdmin}
      />

      {/* Modals */}
      <UserSwitchModal
        isOpen={isUserSwitchOpen}
        onClose={() => setIsUserSwitchOpen(false)}
        currentUser={state.currentUser}
        members={state.members}
        initialTargetMode={userSwitchMode}
        onSwitchUser={handleSwitchUser}
      />

      <AddBazarModal
        isOpen={isAddBazarOpen}
        onClose={() => setIsAddBazarOpen(false)}
        defaultDate={selectedDate}
        members={state.members}
        onSubmitBazar={handleSubmitBazar}
      />

      <AddDepositModal
        isOpen={isAddDepositOpen}
        onClose={() => setIsAddDepositOpen(false)}
        isAdmin={state.currentUser.isAdmin}
        defaultDate={selectedDate}
        members={state.members}
        defaultMemberId={
          state.currentUser.isAdmin ? state.members[0]?.id || '' : state.currentUser.id
        }
        onSubmitDeposit={handleSubmitDeposit}
      />

      <ProfileEditModal
        member={editingMember}
        isAdmin={state.currentUser.isAdmin}
        onClose={() => setEditingMember(null)}
        onSubmitProfileEdit={handleSubmitProfileEdit}
      />

      <AddMemberModal
        isOpen={isAddMemberOpen}
        onClose={() => setIsAddMemberOpen(false)}
        onAddMember={handleAddMember}
      />

      <FineModal
        isOpen={isFineModalOpen}
        onClose={() => setIsFineModalOpen(false)}
        members={state.members}
        onSubmitFine={handleSubmitFine}
      />

      <BazarRequestModal
        isOpen={isBazarRequestOpen}
        onClose={() => setIsBazarRequestOpen(false)}
        defaultDate={selectedDate}
        members={state.members}
        onCreateBazarRequest={handleCreateBazarRequest}
      />

      <BazarReceiptModal
        seed={receiptModalSeed}
        onClose={() => setReceiptModalSeed(null)}
        defaultDate={selectedDate}
        members={state.members}
        mealRate={summaryStats.mealRate}
        nextReceiptNumber={`RSH-${1001 + state.bazar.length}`}
        onSaveReceiptToBazar={handleSaveReceiptToBazar}
      />

      <EditBazarModal
        entry={editingBazarEntry}
        onClose={() => setEditingBazarEntry(null)}
        members={state.members}
        onUpdateBazar={handleUpdateBazarEntry}
      />
    </div>
  );
}
