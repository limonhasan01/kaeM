export type MealType = 'breakfast' | 'lunch' | 'dinner';

export interface Member {
  id: string;
  name: string;
  phone: string;
  whatsapp?: string;
  username: string;
  isAdmin: boolean;
  avatarUrl?: string;
  pin?: string;
}

export interface DayMemberMeal {
  breakfast: number; // 0 or 0.5
  lunch: number; // 0 or 1
  dinner: number; // 0 or 1
  guest: number; // >= 0 (step 0.5)
}

export type MealsRecord = Record<string, Record<string, DayMemberMeal>>;

export interface BazarEntry {
  id: string;
  date: string;
  shopperIds: string[];
  items: string;
  amount: number;
  advanceAmount?: number;
  receiptNo?: string;
  note?: string;
  previousAmount?: number;
  editedAt?: string;
  editCount?: number;
  status: 'approved' | 'pending';
}

export interface BazarRequisition {
  id: string;
  date: string;
  shopperIds: string[];
  items: string;
  estimatedAmount: number;
  note: string;
  status: 'scheduled' | 'completed';
}

export interface DepositEntry {
  id: string;
  date: string;
  memberId: string;
  amount: number;
  note: string;
  method?: string;
  transactionId?: string;
  status: 'approved' | 'pending';
}

export interface FineEntry {
  id: string;
  date: string;
  memberId: string;
  reason: string;
  amount: number;
}

export interface MessNoticeItem {
  id: string;
  date: string;
  category: 'menu' | 'bazar' | 'notice';
  title: string;
  message: string;
}

export interface FeedbackMessage {
  id: string;
  date: string;
  memberId: string;
  memberName: string;
  category: 'complaint' | 'suggestion';
  message: string;
  status: 'pending' | 'acknowledged';
}

export type RequestType =
  | 'MEAL_CHANGE'
  | 'GUEST_MEAL'
  | 'BAZAR_ENTRY'
  | 'DEPOSIT_ENTRY'
  | 'PROFILE_EDIT'
  | 'TIME_EXTENSION'
  | 'MESS_LEAVE'
  | 'FEEDBACK';

export interface MealChangePayload {
  memberId: string;
  mealType: MealType;
  isChecked: boolean;
  date: string;
}

export interface GuestMealPayload {
  memberId: string;
  date: string;
  count: number;
}

export interface BazarRequestPayload {
  date: string;
  shopperIds: string[];
  items: string;
  amount: number;
}

export interface DepositRequestPayload {
  date: string;
  memberId: string;
  amount: number;
  method?: string;
  transactionId?: string;
  note: string;
}

export interface ProfileEditPayload {
  memberId: string;
  newName: string;
  newPhone: string;
  newWhatsapp?: string;
  newUsername: string;
  newAvatarUrl?: string;
  newPin?: string;
}

export interface TimeExtensionPayload {
  memberId: string;
  date: string;
  mealType: MealType;
  desiredState: boolean;
  reason: string;
}

export interface MessLeavePayload {
  memberId: string;
  startDate: string;
  endDate: string;
  reason: string;
}

export interface FeedbackRequestPayload {
  memberId: string;
  category: 'complaint' | 'suggestion';
  message: string;
}

export type PendingRequest =
  | {
      id: string;
      type: 'MEAL_CHANGE';
      requestedBy: string;
      date: string;
      details: string;
      dataPayload: MealChangePayload;
    }
  | {
      id: string;
      type: 'GUEST_MEAL';
      requestedBy: string;
      date: string;
      details: string;
      dataPayload: GuestMealPayload;
    }
  | {
      id: string;
      type: 'BAZAR_ENTRY';
      requestedBy: string;
      date: string;
      details: string;
      dataPayload: BazarRequestPayload;
    }
  | {
      id: string;
      type: 'DEPOSIT_ENTRY';
      requestedBy: string;
      date: string;
      details: string;
      dataPayload: DepositRequestPayload;
    }
  | {
      id: string;
      type: 'PROFILE_EDIT';
      requestedBy: string;
      date: string;
      details: string;
      dataPayload: ProfileEditPayload;
    }
  | {
      id: string;
      type: 'TIME_EXTENSION';
      requestedBy: string;
      date: string;
      details: string;
      dataPayload: TimeExtensionPayload;
    }
  | {
      id: string;
      type: 'MESS_LEAVE';
      requestedBy: string;
      date: string;
      details: string;
      dataPayload: MessLeavePayload;
    }
  | {
      id: string;
      type: 'FEEDBACK';
      requestedBy: string;
      date: string;
      details: string;
      dataPayload: FeedbackRequestPayload;
    };

export interface UtilityConfig {
  rent: number;
  electric: number;
  gas: number;
  other: number;
}

export interface MessState {
  currentUser: Member;
  members: Member[];
  meals: MealsRecord;
  bazar: BazarEntry[];
  bazarRequests?: BazarRequisition[];
  deposits: DepositEntry[];
  pendingRequests: PendingRequest[];
  fines: FineEntry[];
  utilities: UtilityConfig;
  notices?: MessNoticeItem[];
  feedbackLog?: FeedbackMessage[];
}

export type ActiveTab =
  | 'dashboard'
  | 'meals'
  | 'bazar'
  | 'analytics'
  | 'deposits'
  | 'notices'
  | 'pending-requests'
  | 'members'
  | 'utilities'
  | 'backup';
