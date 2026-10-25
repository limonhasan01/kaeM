import React, { useEffect, useMemo, useState } from 'react';
import { Check, Copy, ExternalLink, MessageCircle, Receipt, X } from 'lucide-react';
import type { BazarEntry, BazarRequisition, Member } from '../types/mess';
import {
  ADMIN_USER,
  buildBazarDutyWhatsAppMessage,
  buildBazarReceiptWhatsAppMessage,
  buildWhatsAppShareUrl,
  validateAdminPin,
} from '../utils/messCalculations';

interface ModalShellProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  maxWidthClass?: string;
}

const ModalShell: React.FC<ModalShellProps> = ({
  title,
  onClose,
  children,
  maxWidthClass = 'sm:max-w-md',
}) => {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/40 backdrop-blur-sm p-0 sm:p-4"
    >
      <div
        className={`w-full ${maxWidthClass} bg-white border-t sm:border border-slate-200 rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 space-y-4 max-h-[90vh] overflow-y-auto`}
      >
        <div className="w-10 h-1.5 bg-slate-200 rounded-full mx-auto mb-1 sm:hidden" />
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="font-bold text-slate-900 text-base">{title}</h3>
          <button
            type="button"
            aria-label="মোডাল বন্ধ করুন"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-slate-700 rounded-xl cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
};

/* 1. User Switch / Admin Login Modal */
export type UserSwitchTargetMode = 'current' | 'admin' | 'member';

interface UserSwitchModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: Member;
  members: Member[];
  initialTargetMode?: UserSwitchTargetMode;
  onSwitchUser: (nextUser: Member) => void;
}

export const UserSwitchModal: React.FC<UserSwitchModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  members,
  initialTargetMode = 'current',
  onSwitchUser,
}) => {
  const [selectedId, setSelectedId] = useState(currentUser.id);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (initialTargetMode === 'admin') {
        setSelectedId(ADMIN_USER.id);
      } else if (initialTargetMode === 'member') {
        setSelectedId(currentUser.isAdmin ? members[0]?.id || '' : currentUser.id);
      } else {
        setSelectedId(currentUser.id);
      }
      setPin('');
      setError('');
    }
  }, [isOpen, currentUser.id, currentUser.isAdmin, initialTargetMode, members]);

  if (!isOpen) return null;

  const isAdminSelected = selectedId === ADMIN_USER.id;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isAdminSelected) {
      if (!validateAdminPin(pin)) {
        setError('ভুল এডমিন পাসওয়ার্ড দেওয়া হয়েছে। অনুগ্রহ করে সঠিক পাসওয়ার্ড দিন।');
        return;
      }
      onSwitchUser(ADMIN_USER);
      onClose();
      return;
    }

    const found = members.find((m) => m.id === selectedId);
    if (found) {
      onSwitchUser(found);
      onClose();
    }
  };

  return (
    <ModalShell
      title={isAdminSelected ? 'এডমিন প্যানেলে প্রবেশ' : 'মেম্বার ড্যাশবোর্ড নির্বাচন'}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        <div>
          <label htmlFor="user-account-select" className="block text-slate-700 font-medium mb-1.5">
            অ্যাকাউন্ট নির্বাচন করুন
          </label>
          <select
            id="user-account-select"
            value={selectedId}
            onChange={(e) => {
              setSelectedId(e.target.value);
              setError('');
            }}
            className="w-full min-h-[44px] bg-slate-50 border border-slate-200 text-slate-900 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"
          >
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                মেম্বার: {m.name} (@{m.username})
              </option>
            ))}
            <option value={ADMIN_USER.id}>মেস এডমিন প্যানেল (পাসওয়ার্ড আবশ্যক)</option>
          </select>
        </div>

        {isAdminSelected && (
          <div>
            <label htmlFor="admin-pin-input" className="block text-slate-700 font-medium mb-1.5">
              এডমিন সিকিউরিটি পাসওয়ার্ড
            </label>
            <input
              id="admin-pin-input"
              type="password"
              autoFocus
              autoComplete="current-password"
              placeholder="এডমিন পাসওয়ার্ড লিখুন"
              value={pin}
              onChange={(e) => {
                setPin(e.target.value);
                setError('');
              }}
              className="w-full min-h-[44px] bg-slate-50 border border-slate-200 text-slate-900 rounded-xl px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-teal-600"
            />
          </div>
        )}

        {error && <p className="text-xs text-rose-600 font-medium">{error}</p>}

        <button
          type="submit"
          className="w-full min-h-[48px] bg-teal-600 hover:bg-teal-700 text-white font-semibold text-sm rounded-xl transition-colors cursor-pointer"
        >
          {isAdminSelected ? 'পাসওয়ার্ড দিয়ে এডমিন প্যানেলে প্রবেশ করুন' : 'মেম্বার ড্যাশবোর্ডে প্রবেশ করুন'}
        </button>
      </form>
    </ModalShell>
  );
};

/* 2. Joint Multi-Member Bazar Modal */
interface AddBazarModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultDate: string;
  members: Member[];
  onSubmitBazar: (payload: {
    date: string;
    shopperIds: string[];
    items: string;
    amount: number;
  }) => void;
}

export const AddBazarModal: React.FC<AddBazarModalProps> = ({
  isOpen,
  onClose,
  defaultDate,
  members,
  onSubmitBazar,
}) => {
  const [date, setDate] = useState(defaultDate);
  const [shopperIds, setShopperIds] = useState<string[]>([]);
  const [items, setItems] = useState('');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setDate(defaultDate);
      setShopperIds([]);
      setItems('');
      setAmount('');
      setError('');
    }
  }, [isOpen, defaultDate]);

  if (!isOpen) return null;

  const toggleShopper = (id: string) => {
    setShopperIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
    setError('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (shopperIds.length === 0) {
      setError('কমপক্ষে ১ জন বাজারকারী মেম্বার নির্বাচন করুন।');
      return;
    }
    const cleanItems = items.trim();
    if (!cleanItems) {
      setError('বাজারের আইটেম বিবরণ লিখুন।');
      return;
    }
    const numAmount = Number(amount);
    if (!numAmount || numAmount <= 0) {
      setError('সঠিক খরচের পরিমাণ (টাকা) লিখুন।');
      return;
    }

    onSubmitBazar({
      date,
      shopperIds,
      items: cleanItems,
      amount: numAmount,
    });
    onClose();
  };

  return (
    <ModalShell title="যৌথ বাজার এন্ট্রি" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        <div>
          <label htmlFor="bazar-date" className="block text-slate-700 font-medium mb-1.5">
            তারিখ
          </label>
          <input
            id="bazar-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
            className="w-full min-h-[44px] bg-slate-50 border border-slate-200 text-slate-900 rounded-xl px-3 py-2 font-mono focus:outline-none focus:ring-2 focus:ring-teal-600"
          />
        </div>

        <fieldset>
          <legend className="block text-slate-700 font-medium mb-2">
            বাজারে অংশগ্রহণকারী মেম্বারবৃন্দ (একাধিক নির্বাচন করা যাবে)
          </legend>
          <div className="grid grid-cols-2 gap-2">
            {members.map((m) => {
              const checked = shopperIds.includes(m.id);
              return (
                <label
                  key={m.id}
                  className={`min-h-[44px] px-3 py-2 rounded-xl border flex items-center gap-2.5 cursor-pointer transition-colors ${
                    checked
                      ? 'bg-teal-50 border-teal-500 text-teal-900 font-semibold'
                      : 'bg-slate-50 border-slate-200 text-slate-700'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleShopper(m.id)}
                    className="w-4 h-4 accent-teal-600"
                  />
                  <span>{m.name}</span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <div>
          <label htmlFor="bazar-items" className="block text-slate-700 font-medium mb-1.5">
            বাজারের বিবরণ · আইটেমসমূহ
          </label>
          <input
            id="bazar-items"
            type="text"
            placeholder="চাল, মুরগি, তেল, পেঁয়াজ"
            value={items}
            onChange={(e) => {
              setItems(e.target.value);
              setError('');
            }}
            className="w-full min-h-[44px] bg-slate-50 border border-slate-200 text-slate-900 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"
          />
        </div>

        <div>
          <label htmlFor="bazar-amount" className="block text-slate-700 font-medium mb-1.5">
            মোট খরচ (টাকা)
          </label>
          <input
            id="bazar-amount"
            type="number"
            min="1"
            placeholder="1500"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              setError('');
            }}
            className="w-full min-h-[44px] bg-slate-50 border border-slate-200 text-slate-900 rounded-xl px-3 py-2 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-teal-600"
          />
        </div>

        {error && <p className="text-xs text-rose-600 font-medium">{error}</p>}

        <button
          type="submit"
          className="w-full min-h-[48px] bg-teal-600 hover:bg-teal-700 text-white font-semibold text-sm rounded-xl transition-colors cursor-pointer"
        >
          বাজার জমা দিন
        </button>
      </form>
    </ModalShell>
  );
};

/* 3. Deposit Entry Modal */
interface AddDepositModalProps {
  isOpen: boolean;
  onClose: () => void;
  isAdmin: boolean;
  defaultDate: string;
  members: Member[];
  defaultMemberId: string;
  onSubmitDeposit: (payload: {
    date: string;
    memberId: string;
    amount: number;
    note: string;
  }) => void;
}

export const AddDepositModal: React.FC<AddDepositModalProps> = ({
  isOpen,
  onClose,
  isAdmin,
  defaultDate,
  members,
  defaultMemberId,
  onSubmitDeposit,
}) => {
  const [date, setDate] = useState(defaultDate);
  const [memberId, setMemberId] = useState(defaultMemberId);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setDate(defaultDate);
      const validId = members.some((m) => m.id === defaultMemberId)
        ? defaultMemberId
        : members[0]?.id || '';
      setMemberId(validId);
      setAmount('');
      setNote('');
      setError('');
    }
  }, [isOpen, defaultDate, defaultMemberId, members]);

  if (!isOpen) return null;

  const lockedMember = members.find((m) => m.id === memberId) || members[0];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberId) {
      setError('মেম্বার নির্বাচন করুন।');
      return;
    }
    const numAmount = Number(amount);
    if (!numAmount || numAmount <= 0) {
      setError('সঠিক জমার পরিমাণ (৳) লিখুন।');
      return;
    }
    const cleanNote = note.trim();
    if (!cleanNote) {
      setError('মেথড বা নোট লিখুন (যেমন: বিকাশ / ক্যাশ)।');
      return;
    }

    onSubmitDeposit({
      date,
      memberId,
      amount: numAmount,
      note: cleanNote,
    });
    onClose();
  };

  return (
    <ModalShell
      title={isAdmin ? 'টাকা জমা এন্ট্রি (এডমিন)' : 'আপনার টাকা জমার আবেদন'}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        <div>
          <label htmlFor="deposit-date" className="block text-slate-700 font-medium mb-1.5">
            তারিখ
          </label>
          <input
            id="deposit-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
            className="w-full min-h-[44px] bg-slate-50 border border-slate-200 text-slate-900 rounded-xl px-3 py-2 font-mono focus:outline-none focus:ring-2 focus:ring-teal-600"
          />
        </div>

        <div>
          <label htmlFor="deposit-member" className="block text-slate-700 font-medium mb-1.5">
            মেম্বার
          </label>
          {isAdmin ? (
            <select
              id="deposit-member"
              value={memberId}
              onChange={(e) => setMemberId(e.target.value)}
              className="w-full min-h-[44px] bg-slate-50 border border-slate-200 text-slate-900 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"
            >
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          ) : (
            <div
              id="deposit-member"
              className="w-full min-h-[44px] bg-slate-100 border border-slate-200 text-slate-800 rounded-xl px-3 py-2.5 text-sm font-semibold flex items-center"
            >
              {lockedMember ? `${lockedMember.name} (@${lockedMember.username})` : ''}
            </div>
          )}
        </div>

        <div>
          <label htmlFor="deposit-amount" className="block text-slate-700 font-medium mb-1.5">
            জমার পরিমাণ (৳)
          </label>
          <input
            id="deposit-amount"
            type="number"
            min="1"
            placeholder="2000"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              setError('');
            }}
            className="w-full min-h-[44px] bg-slate-50 border border-slate-200 text-slate-900 rounded-xl px-3 py-2 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-teal-600"
          />
        </div>

        <div>
          <label htmlFor="deposit-note" className="block text-slate-700 font-medium mb-1.5">
            মেথড · নোট
          </label>
          <input
            id="deposit-note"
            type="text"
            placeholder="বিকাশ / ক্যাশ জমা"
            value={note}
            onChange={(e) => {
              setNote(e.target.value);
              setError('');
            }}
            className="w-full min-h-[44px] bg-slate-50 border border-slate-200 text-slate-900 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"
          />
        </div>

        {error && <p className="text-xs text-rose-600 font-medium">{error}</p>}

        <button
          type="submit"
          className="w-full min-h-[48px] bg-teal-600 hover:bg-teal-700 text-white font-semibold text-sm rounded-xl transition-colors cursor-pointer"
        >
          জমা সংরক্ষণ করুন
        </button>
      </form>
    </ModalShell>
  );
};

/* 4. Profile Edit Modal */
interface ProfileEditModalProps {
  member: Member | null;
  isAdmin: boolean;
  onClose: () => void;
  onSubmitProfileEdit: (payload: {
    memberId: string;
    newName: string;
    newPhone: string;
    newWhatsapp: string;
    newUsername: string;
  }) => void;
}

export const ProfileEditModal: React.FC<ProfileEditModalProps> = ({
  member,
  isAdmin,
  onClose,
  onSubmitProfileEdit,
}) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (member) {
      setName(member.name);
      setPhone(member.phone);
      setWhatsapp(member.whatsapp || member.phone);
      setUsername(member.username);
      setError('');
    }
  }, [member]);

  if (!member) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim() || !username.trim()) {
      setError('নাম, ফোন নম্বর এবং ইউজারনেম পূরণ করা আবশ্যক।');
      return;
    }

    onSubmitProfileEdit({
      memberId: member.id,
      newName: name.trim(),
      newPhone: phone.trim(),
      newWhatsapp: whatsapp.trim() || phone.trim(),
      newUsername: username.trim().toLowerCase(),
    });
    onClose();
  };

  return (
    <ModalShell title="প্রোফাইল তথ্য এডিট" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        <div>
          <label htmlFor="edit-profile-name" className="block text-slate-700 font-medium mb-1.5">
            নাম
          </label>
          <input
            id="edit-profile-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full min-h-[44px] bg-slate-50 border border-slate-200 text-slate-900 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="edit-profile-phone" className="block text-slate-700 font-medium mb-1.5">
              ফোন নম্বর
            </label>
            <input
              id="edit-profile-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full min-h-[44px] bg-slate-50 border border-slate-200 text-slate-900 rounded-xl px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-teal-600"
            />
          </div>

          <div>
            <label
              htmlFor="edit-profile-whatsapp"
              className="block text-slate-700 font-medium mb-1.5"
            >
              WhatsApp নম্বর
            </label>
            <input
              id="edit-profile-whatsapp"
              type="tel"
              placeholder="01700000000"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              className="w-full min-h-[44px] bg-slate-50 border border-slate-200 text-slate-900 rounded-xl px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-teal-600"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="edit-profile-username"
            className="block text-slate-700 font-medium mb-1.5"
          >
            ইউজারনেম
          </label>
          <input
            id="edit-profile-username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full min-h-[44px] bg-slate-50 border border-slate-200 text-slate-900 rounded-xl px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-teal-600"
          />
        </div>

        {!isAdmin && (
          <p className="text-xs text-amber-700">
            মেম্বারদের প্রোফাইল পরিবর্তনের অনুরোধ এডমিন অনুমোদন করলে হালনাগাদ হবে।
          </p>
        )}

        {error && <p className="text-xs text-rose-600 font-medium">{error}</p>}

        <button
          type="submit"
          className="w-full min-h-[48px] bg-teal-600 hover:bg-teal-700 text-white font-semibold text-sm rounded-xl transition-colors cursor-pointer"
        >
          আপডেট জমা দিন
        </button>
      </form>
    </ModalShell>
  );
};

/* 5. Admin Add Member Modal */
interface AddMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddMember: (payload: {
    name: string;
    username: string;
    phone: string;
    whatsapp: string;
  }) => void;
}

export const AddMemberModal: React.FC<AddMemberModalProps> = ({
  isOpen,
  onClose,
  onAddMember,
}) => {
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [phone, setPhone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setName('');
      setUsername('');
      setPhone('');
      setWhatsapp('');
      setError('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !username.trim() || !phone.trim()) {
      setError('নতুন মেম্বারের সবগুলো তথ্য সঠিকভাবে পূরণ করুন।');
      return;
    }

    const cleanPhone = phone.trim();
    const cleanWhatsapp = whatsapp.trim() || cleanPhone;

    onAddMember({
      name: name.trim(),
      username: username.trim().toLowerCase(),
      phone: cleanPhone,
      whatsapp: cleanWhatsapp,
    });
    onClose();
  };

  return (
    <ModalShell title="নতুন মেম্বার যুক্ত করুন" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        <div>
          <label htmlFor="new-member-name" className="block text-slate-700 font-medium mb-1.5">
            মেম্বারের নাম
          </label>
          <input
            id="new-member-name"
            type="text"
            placeholder="যেমন: Rahat"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full min-h-[44px] bg-slate-50 border border-slate-200 text-slate-900 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"
          />
        </div>

        <div>
          <label
            htmlFor="new-member-username"
            className="block text-slate-700 font-medium mb-1.5"
          >
            ইউজারনেম (মেম্বার আইডি)
          </label>
          <input
            id="new-member-username"
            type="text"
            placeholder="rahat"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full min-h-[44px] bg-slate-50 border border-slate-200 text-slate-900 rounded-xl px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-teal-600"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="new-member-phone" className="block text-slate-700 font-medium mb-1.5">
              ফোন নম্বর
            </label>
            <input
              id="new-member-phone"
              type="tel"
              placeholder="01700000000"
              value={phone}
              onChange={(e) => {
                const next = e.target.value;
                setPhone(next);
                if (!whatsapp) {
                  setWhatsapp(next);
                }
              }}
              className="w-full min-h-[44px] bg-slate-50 border border-slate-200 text-slate-900 rounded-xl px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-teal-600"
            />
          </div>

          <div>
            <label
              htmlFor="new-member-whatsapp"
              className="block text-slate-700 font-medium mb-1.5"
            >
              WhatsApp নম্বর
            </label>
            <input
              id="new-member-whatsapp"
              type="tel"
              placeholder="01700000000"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              className="w-full min-h-[44px] bg-slate-50 border border-slate-200 text-slate-900 rounded-xl px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-teal-600"
            />
          </div>
        </div>

        {error && <p className="text-xs text-rose-600 font-medium">{error}</p>}

        <button
          type="submit"
          className="w-full min-h-[48px] bg-teal-600 hover:bg-teal-700 text-white font-semibold text-sm rounded-xl transition-colors cursor-pointer"
        >
          মেম্বার তৈরি করুন
        </button>
      </form>
    </ModalShell>
  );
};

/* 6. Add Fine Modal (Admin) */
interface FineModalProps {
  isOpen: boolean;
  onClose: () => void;
  members: Member[];
  onSubmitFine: (payload: { memberId: string; reason: string; amount: number }) => void;
}

export const FineModal: React.FC<FineModalProps> = ({
  isOpen,
  onClose,
  members,
  onSubmitFine,
}) => {
  const [memberId, setMemberId] = useState('');
  const [reason, setReason] = useState('');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setMemberId(members[0]?.id || '');
      setReason('');
      setAmount('');
      setError('');
    }
  }, [isOpen, members]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberId) {
      setError('মেম্বার নির্বাচন করুন।');
      return;
    }
    if (!reason.trim()) {
      setError('জরিমানার কারণ উল্লেখ করুন।');
      return;
    }
    const numAmount = Number(amount);
    if (!numAmount || numAmount <= 0) {
      setError('সঠিক জরিমানার পরিমাণ (৳) লিখুন।');
      return;
    }

    onSubmitFine({
      memberId,
      reason: reason.trim(),
      amount: numAmount,
    });
    onClose();
  };

  return (
    <ModalShell title="জরিমানা যুক্ত করুন" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        <div>
          <label htmlFor="fine-member" className="block text-slate-700 font-medium mb-1.5">
            মেম্বার
          </label>
          <select
            id="fine-member"
            value={memberId}
            onChange={(e) => setMemberId(e.target.value)}
            className="w-full min-h-[44px] bg-slate-50 border border-slate-200 text-slate-900 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"
          >
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="fine-reason" className="block text-slate-700 font-medium mb-1.5">
            কারণ
          </label>
          <input
            id="fine-reason"
            type="text"
            placeholder="ফ্যানের সুইচ অন রাখা"
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              setError('');
            }}
            className="w-full min-h-[44px] bg-slate-50 border border-slate-200 text-slate-900 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"
          />
        </div>

        <div>
          <label htmlFor="fine-amount" className="block text-slate-700 font-medium mb-1.5">
            জরিমানার পরিমাণ (৳)
          </label>
          <input
            id="fine-amount"
            type="number"
            min="1"
            placeholder="50"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              setError('');
            }}
            className="w-full min-h-[44px] bg-slate-50 border border-slate-200 text-slate-900 rounded-xl px-3 py-2 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-teal-600"
          />
        </div>

        {error && <p className="text-xs text-rose-600 font-medium">{error}</p>}

        <button
          type="submit"
          className="w-full min-h-[48px] bg-rose-600 hover:bg-rose-700 text-white font-semibold text-sm rounded-xl transition-colors cursor-pointer"
        >
          জরিমানা এন্ট্রি দিন
        </button>
      </form>
    </ModalShell>
  );
};

/* 7. Admin Bazar Duty / Shopping Request Modal (1-Click WhatsApp Send) */
interface BazarRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultDate: string;
  members: Member[];
  onCreateBazarRequest: (payload: {
    date: string;
    shopperIds: string[];
    items: string;
    estimatedAmount: number;
    note: string;
  }) => void;
}

export const BazarRequestModal: React.FC<BazarRequestModalProps> = ({
  isOpen,
  onClose,
  defaultDate,
  members,
  onCreateBazarRequest,
}) => {
  const [date, setDate] = useState(defaultDate);
  const [shopperIds, setShopperIds] = useState<string[]>([]);
  const [items, setItems] = useState('');
  const [estimatedAmount, setEstimatedAmount] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setDate(defaultDate);
      setShopperIds(members.slice(0, 2).map((m) => m.id));
      setItems('');
      setEstimatedAmount('');
      setNote('');
      setError('');
    }
  }, [isOpen, defaultDate, members]);

  const selectedShoppers = useMemo(
    () => members.filter((m) => shopperIds.includes(m.id)),
    [members, shopperIds]
  );

  const previewMessage = useMemo(
    () =>
      buildBazarDutyWhatsAppMessage(
        {
          date,
          items: items.trim() || 'বাজারের তালিকা নির্ধারণ করুন',
          estimatedAmount: Number(estimatedAmount) || 0,
          note,
        },
        selectedShoppers.map((s) => s.name)
      ),
    [date, items, estimatedAmount, note, selectedShoppers]
  );

  if (!isOpen) return null;

  const toggleShopper = (id: string) => {
    setShopperIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
    setError('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (shopperIds.length === 0) {
      setError('কমপক্ষে ১ জন (বা ২ জন যৌথ) বাজারকারী মেম্বার নির্বাচন করুন।');
      return;
    }
    if (!items.trim()) {
      setError('কি কি বাজার কিনতে হবে তার তালিকা লিখুন।');
      return;
    }

    onCreateBazarRequest({
      date,
      shopperIds,
      items: items.trim(),
      estimatedAmount: Math.max(0, Number(estimatedAmount) || 0),
      note: note.trim(),
    });
    onClose();
  };

  const canDirectShare = shopperIds.length > 0 && items.trim().length > 0;

  return (
    <ModalShell
      title="বাজারের দায়িত্ব ও ফর্দ তৈরি (WhatsApp)"
      onClose={onClose}
      maxWidthClass="sm:max-w-lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="breq-date" className="block text-slate-700 font-medium mb-1.5">
              বাজারের তারিখ
            </label>
            <input
              id="breq-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              className="w-full min-h-[44px] bg-slate-50 border border-slate-200 text-slate-900 rounded-xl px-3 py-2 font-mono focus:outline-none focus:ring-2 focus:ring-teal-600"
            />
          </div>

          <div>
            <label htmlFor="breq-budget" className="block text-slate-700 font-medium mb-1.5">
              সম্ভাব্য বাজেট / অগ্রিম (৳)
            </label>
            <input
              id="breq-budget"
              type="number"
              min="0"
              placeholder="1500"
              value={estimatedAmount}
              onChange={(e) => setEstimatedAmount(e.target.value)}
              className="w-full min-h-[44px] bg-slate-50 border border-slate-200 text-slate-900 rounded-xl px-3 py-2 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-teal-600"
            />
          </div>
        </div>

        <fieldset>
          <legend className="block text-slate-700 font-medium mb-2">
            বাজারের দায়িত্বপ্রাপ্ত মেম্বার নির্বাচন করুন (১ জন বা ২+ জন যৌথ বাজার)
          </legend>
          <div className="grid grid-cols-2 gap-2">
            {members.map((m) => {
              const checked = shopperIds.includes(m.id);
              const wpNum = m.whatsapp || m.phone;
              return (
                <label
                  key={m.id}
                  className={`min-h-[44px] px-3 py-2 rounded-xl border flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                    checked
                      ? 'bg-teal-50 border-teal-500 text-teal-900 font-semibold'
                      : 'bg-slate-50 border-slate-200 text-slate-700'
                  }`}
                >
                  <span className="flex items-center gap-2 truncate">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleShopper(m.id)}
                      className="w-4 h-4 accent-teal-600 shrink-0"
                    />
                    <span className="truncate">{m.name}</span>
                  </span>
                  <span className="font-mono text-[10px] text-slate-500 tabular-nums shrink-0">
                    {wpNum}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <div>
          <label htmlFor="breq-items" className="block text-slate-700 font-medium mb-1.5">
            কি কি কিনতে হবে (বাজারের তালিকা)
          </label>
          <textarea
            id="breq-items"
            rows={2}
            placeholder="যেমন: চাল ১০ কেজি, মুরগি ২ কেজি, ডিম ২ হালি, পেঁয়াজ ২ কেজি"
            value={items}
            onChange={(e) => {
              setItems(e.target.value);
              setError('');
            }}
            className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"
          />
        </div>

        <div>
          <label htmlFor="breq-note" className="block text-slate-700 font-medium mb-1.5">
            এডমিন নোট (ঐচ্ছিক)
          </label>
          <input
            id="breq-note"
            type="text"
            placeholder="সকাল ১০টার মধ্যে বাজার আনার অনুরোধ"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full min-h-[44px] bg-slate-50 border border-slate-200 text-slate-900 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"
          />
        </div>

        {canDirectShare && (
          <div className="bg-slate-50 rounded-2xl p-3.5 space-y-2.5">
            <div className="text-[11px] font-semibold text-slate-700">
              ওয়ান-ক্লিক ডিরেক্ট WhatsApp প্রেরণ ({selectedShoppers.length} জন বাজারকারী):
            </div>
            <div className="flex flex-wrap gap-2">
              {selectedShoppers.map((shopper) => {
                const wpPhone = shopper.whatsapp || shopper.phone;
                const href = buildWhatsAppShareUrl(wpPhone, previewMessage);
                return (
                  <a
                    key={shopper.id}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-h-[44px] px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
                  >
                    <MessageCircle className="w-4 h-4 shrink-0" />
                    <span>{shopper.name}-কে WhatsApp পাঠান</span>
                    <ExternalLink className="w-3.5 h-3.5 opacity-80 shrink-0" />
                  </a>
                );
              })}
            </div>
          </div>
        )}

        {error && <p className="text-xs text-rose-600 font-medium">{error}</p>}

        <button
          type="submit"
          className="w-full min-h-[48px] bg-teal-600 hover:bg-teal-700 text-white font-semibold text-sm rounded-xl transition-colors cursor-pointer"
        >
          বাজার রিকোয়েস্ট সংরক্ষণ করুন
        </button>
      </form>
    </ModalShell>
  );
};

/* 8. Digital Bazar Receipt ("রশিদ") Generator & 1-Click WhatsApp Modal */
export type BazarReceiptModalSeed =
  | { mode: 'new' }
  | { mode: 'from-request'; request: BazarRequisition }
  | { mode: 'existing-bazar'; entry: BazarEntry };

interface BazarReceiptModalProps {
  seed: BazarReceiptModalSeed | null;
  onClose: () => void;
  defaultDate: string;
  members: Member[];
  mealRate: number;
  nextReceiptNumber: string;
  onSaveReceiptToBazar: (payload: {
    receiptNo: string;
    date: string;
    shopperIds: string[];
    items: string;
    amount: number;
    advanceAmount: number;
    note: string;
    addToBazar: boolean;
    completedRequestId?: string;
  }) => void;
}

export const BazarReceiptModal: React.FC<BazarReceiptModalProps> = ({
  seed,
  onClose,
  defaultDate,
  members,
  mealRate,
  nextReceiptNumber,
  onSaveReceiptToBazar,
}) => {
  const [receiptNo, setReceiptNo] = useState(nextReceiptNumber);
  const [date, setDate] = useState(defaultDate);
  const [shopperIds, setShopperIds] = useState<string[]>([]);
  const [items, setItems] = useState('');
  const [amount, setAmount] = useState('');
  const [advanceAmount, setAdvanceAmount] = useState('');
  const [note, setNote] = useState('');
  const [addToBazar, setAddToBazar] = useState(true);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!seed) return;
    setCopied(false);
    setError('');
    setAddToBazar(true);

    if (seed.mode === 'from-request') {
      setReceiptNo(nextReceiptNumber);
      setDate(seed.request.date);
      setShopperIds(seed.request.shopperIds);
      setItems(seed.request.items);
      setAmount(seed.request.estimatedAmount > 0 ? String(seed.request.estimatedAmount) : '');
      setAdvanceAmount(
        seed.request.estimatedAmount > 0 ? String(seed.request.estimatedAmount) : ''
      );
      setNote(seed.request.note || '');
    } else if (seed.mode === 'existing-bazar') {
      setReceiptNo(seed.entry.receiptNo || `RSH-${seed.entry.id.slice(-4).toUpperCase()}`);
      setDate(seed.entry.date);
      setShopperIds(seed.entry.shopperIds);
      setItems(seed.entry.items);
      setAmount(String(seed.entry.amount));
      setAdvanceAmount(seed.entry.advanceAmount ? String(seed.entry.advanceAmount) : '');
      setNote(seed.entry.note || '');
    } else {
      setReceiptNo(nextReceiptNumber);
      setDate(defaultDate);
      setShopperIds(members.slice(0, 2).map((m) => m.id));
      setItems('');
      setAmount('');
      setAdvanceAmount('');
      setNote('');
    }
  }, [seed, defaultDate, members, nextReceiptNumber]);

  const selectedShoppers = useMemo(
    () => members.filter((m) => shopperIds.includes(m.id)),
    [members, shopperIds]
  );

  const numericAmount = Math.max(0, Number(amount) || 0);
  const numericAdvance = Math.max(0, Number(advanceAmount) || 0);

  const receiptMessage = useMemo(
    () =>
      buildBazarReceiptWhatsAppMessage({
        receiptNo: receiptNo.trim() || nextReceiptNumber,
        date,
        shopperNames: selectedShoppers.map((s) => s.name),
        items: items.trim() || 'বাজারের বিবরণ',
        amount: numericAmount,
        advanceAmount: numericAdvance > 0 ? numericAdvance : undefined,
        mealRate,
        note,
      }),
    [
      receiptNo,
      nextReceiptNumber,
      date,
      selectedShoppers,
      items,
      numericAmount,
      numericAdvance,
      mealRate,
      note,
    ]
  );

  if (!seed) return null;

  const isExistingEntry = seed.mode === 'existing-bazar';

  const toggleShopper = (id: string) => {
    if (isExistingEntry) return;
    setShopperIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
    setError('');
  };

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(receiptMessage);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (shopperIds.length === 0) {
      setError('কমপক্ষে ১ জন বাজারকারী নির্বাচন করুন।');
      return;
    }
    if (!items.trim()) {
      setError('ক্রয়কৃত বাজারের বিবরণ লিখুন।');
      return;
    }
    if (numericAmount <= 0) {
      setError('সঠিক মোট খরচের পরিমাণ (৳) লিখুন।');
      return;
    }

    onSaveReceiptToBazar({
      receiptNo: receiptNo.trim() || nextReceiptNumber,
      date,
      shopperIds,
      items: items.trim(),
      amount: numericAmount,
      advanceAmount: numericAdvance,
      note: note.trim(),
      addToBazar,
      completedRequestId: seed.mode === 'from-request' ? seed.request.id : undefined,
    });
    onClose();
  };

  const groupShareUrl = buildWhatsAppShareUrl(undefined, receiptMessage);
  const diffAmount = numericAdvance - numericAmount;

  return (
    <ModalShell
      title="ডিজিটাল বাজার রশিদ (ভাউচার) ও WhatsApp প্রেরণ"
      onClose={onClose}
      maxWidthClass="sm:max-w-xl"
    >
      <form onSubmit={handleSave} className="space-y-4 text-xs">
        {!isExistingEntry && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="receipt-no" className="block text-slate-700 font-medium mb-1.5">
                  রশিদ / ভাউচার নং
                </label>
                <input
                  id="receipt-no"
                  type="text"
                  value={receiptNo}
                  onChange={(e) => setReceiptNo(e.target.value)}
                  className="w-full min-h-[44px] bg-slate-50 border border-slate-200 text-slate-900 rounded-xl px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
              </div>

              <div>
                <label htmlFor="receipt-date" className="block text-slate-700 font-medium mb-1.5">
                  বাজারের তারিখ
                </label>
                <input
                  id="receipt-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  className="w-full min-h-[44px] bg-slate-50 border border-slate-200 text-slate-900 rounded-xl px-3 py-2 font-mono focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
              </div>
            </div>

            <fieldset>
              <legend className="block text-slate-700 font-medium mb-2">
                বাজারকারী মেম্বারবৃন্দ
              </legend>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {members.map((m) => {
                  const checked = shopperIds.includes(m.id);
                  return (
                    <label
                      key={m.id}
                      className={`min-h-[44px] px-3 py-2 rounded-xl border flex items-center gap-2 cursor-pointer transition-colors ${
                        checked
                          ? 'bg-teal-50 border-teal-500 text-teal-900 font-semibold'
                          : 'bg-slate-50 border-slate-200 text-slate-700'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleShopper(m.id)}
                        className="w-4 h-4 accent-teal-600 shrink-0"
                      />
                      <span className="truncate">{m.name}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <div>
              <label htmlFor="receipt-items" className="block text-slate-700 font-medium mb-1.5">
                ক্রয়কৃত বাজারের বিবরণ
              </label>
              <input
                id="receipt-items"
                type="text"
                placeholder="চাল, মুরগি, ডিম, সবজি, তেল"
                value={items}
                onChange={(e) => {
                  setItems(e.target.value);
                  setError('');
                }}
                className="w-full min-h-[44px] bg-slate-50 border border-slate-200 text-slate-900 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="receipt-amount" className="block text-slate-700 font-medium mb-1.5">
                  মোট খরচ (৳)
                </label>
                <input
                  id="receipt-amount"
                  type="number"
                  min="1"
                  placeholder="1450"
                  value={amount}
                  onChange={(e) => {
                    setAmount(e.target.value);
                    setError('');
                  }}
                  className="w-full min-h-[44px] bg-slate-50 border border-slate-200 text-slate-900 rounded-xl px-3 py-2 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
              </div>

              <div>
                <label
                  htmlFor="receipt-advance"
                  className="block text-slate-700 font-medium mb-1.5"
                >
                  প্রদত্ত অগ্রিম (৳ · ঐচ্ছিক)
                </label>
                <input
                  id="receipt-advance"
                  type="number"
                  min="0"
                  placeholder="1500"
                  value={advanceAmount}
                  onChange={(e) => setAdvanceAmount(e.target.value)}
                  className="w-full min-h-[44px] bg-slate-50 border border-slate-200 text-slate-900 rounded-xl px-3 py-2 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
              </div>
            </div>

            {/* Option to Add or Not Add Receipt Amount to Bazar Ledger */}
            <div className="space-y-2">
              <span className="block text-slate-700 font-medium">
                বাজার খাতায় যুক্ত করার অপশন:
              </span>
              <div
                role="group"
                aria-label="বাজার খাতায় যুক্ত করার অপশন"
                className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-xl"
              >
                <button
                  type="button"
                  data-testid="receipt-add-to-bazar-yes"
                  aria-pressed={addToBazar}
                  onClick={() => setAddToBazar(true)}
                  className={`min-h-[42px] px-3 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    addToBazar
                      ? 'bg-white text-teal-800 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  বাজার খাতায় খরচ যুক্ত করুন
                </button>
                <button
                  type="button"
                  data-testid="receipt-add-to-bazar-no"
                  aria-pressed={!addToBazar}
                  onClick={() => setAddToBazar(false)}
                  className={`min-h-[42px] px-3 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    !addToBazar
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  শুধু রশিদ পাঠান (যুক্ত হবে না)
                </button>
              </div>
              <p className="text-[11px] text-slate-500">
                {addToBazar
                  ? 'এই রশিদের টাকা বাজার খাতায় স্থায়ীভাবে যুক্ত হবে (একবার তোলা হলে মুছা যাবে না, শুধু এডমিন এডিট করতে পারবেন)।'
                  : 'শুধুমাত্র WhatsApp-এ রশিদ পাঠানোর জন্য — মেসের বাজার খাতায় এই টাকা তোলা হবে না।'}
              </p>
            </div>
          </>
        )}

        {/* Digital Receipt Voucher Preview Surface (Flat neutral surface, zero nested borders) */}
        <div className="bg-slate-50 rounded-2xl p-4 space-y-2.5">
          <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
            <div className="flex items-center gap-2">
              <Receipt className="w-4 h-4 text-teal-700" />
              <span className="font-bold text-slate-900 text-sm">মেস ম্যানেজার — বাজার রশিদ</span>
            </div>
            <span className="font-mono text-xs font-semibold text-teal-700 tabular-nums">
              {receiptNo || nextReceiptNumber}
            </span>
          </div>

          <div className="space-y-1.5 text-xs text-slate-700">
            <div className="flex justify-between gap-2">
              <span className="text-slate-500">তারিখ</span>
              <span className="font-mono tabular-nums font-medium text-slate-900">{date}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-slate-500">বাজারকারী</span>
              <span className="font-semibold text-slate-900 text-right">
                {selectedShoppers.map((s) => s.name).join(', ') || 'নির্বাচিত নয়'}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-slate-500 shrink-0">বাজারের বিবরণ</span>
              <span className="text-slate-800 text-right">{items || '—'}</span>
            </div>
            <div className="pt-2 border-t border-slate-200/80 flex justify-between items-center">
              <span className="font-semibold text-slate-800">মোট বাজার খরচ</span>
              <span className="text-base font-bold text-teal-700 tabular-nums">
                ৳ {numericAmount.toLocaleString('en-US')}
              </span>
            </div>
            {numericAdvance > 0 && (
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-slate-500">
                  অগ্রিম: ৳ {numericAdvance.toLocaleString('en-US')}
                </span>
                <span
                  className={`font-semibold tabular-nums ${
                    diffAmount >= 0 ? 'text-emerald-700' : 'text-rose-700'
                  }`}
                >
                  {diffAmount >= 0
                    ? `ফেরতযোগ্য ক্যাশ: ৳ ${diffAmount.toLocaleString('en-US')}`
                    : `মেম্বার পাবে: ৳ ${Math.abs(diffAmount).toLocaleString('en-US')}`}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Direct 1-Click WhatsApp Share Actions */}
        <div className="space-y-2.5 pt-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-800">
              রশিদটি সরাসরি WhatsApp-এ পাঠান (১-ক্লিক):
            </span>
            <button
              type="button"
              onClick={handleCopyText}
              className="min-h-[36px] px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg inline-flex items-center gap-1.5 font-medium transition-colors cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-teal-700" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'কপি হয়েছে' : 'টেক্সট কপি'}</span>
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {selectedShoppers.map((shopper) => {
              const wpPhone = shopper.whatsapp || shopper.phone;
              const url = buildWhatsAppShareUrl(wpPhone, receiptMessage);
              return (
                <a
                  key={shopper.id}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-h-[44px] px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
                >
                  <MessageCircle className="w-4 h-4 shrink-0" />
                  <span>
                    {shopper.name} ({wpPhone})
                  </span>
                  <ExternalLink className="w-3.5 h-3.5 opacity-80 shrink-0" />
                </a>
              );
            })}

            <a
              href={groupShareUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-[44px] px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white font-semibold rounded-xl inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
            >
              <MessageCircle className="w-4 h-4 shrink-0" />
              <span>মেস গ্রুপ / অন্য নম্বরে পাঠান</span>
              <ExternalLink className="w-3.5 h-3.5 opacity-80 shrink-0" />
            </a>
          </div>
        </div>

        {error && <p className="text-xs text-rose-600 font-medium">{error}</p>}

        {!isExistingEntry && (
          <button
            type="submit"
            className={`w-full min-h-[48px] text-white font-semibold text-sm rounded-xl transition-colors cursor-pointer ${
              addToBazar
                ? 'bg-teal-600 hover:bg-teal-700'
                : 'bg-slate-700 hover:bg-slate-800'
            }`}
          >
            {addToBazar
              ? 'রশিদ ও যৌথ বাজার খাতায় সংরক্ষণ করুন'
              : 'বাজার খাতায় যুক্ত না করে সম্পন্ন করুন'}
          </button>
        )}
      </form>
    </ModalShell>
  );
};

/* 9. Admin Edit Bazar Entry Modal (Anti-Tamper: Editable by Admin, Non-Deletable) */
interface EditBazarModalProps {
  entry: BazarEntry | null;
  onClose: () => void;
  members: Member[];
  onUpdateBazar: (payload: {
    id: string;
    date: string;
    shopperIds: string[];
    items: string;
    amount: number;
    note: string;
  }) => void;
}

export const EditBazarModal: React.FC<EditBazarModalProps> = ({
  entry,
  onClose,
  members,
  onUpdateBazar,
}) => {
  const [date, setDate] = useState('');
  const [shopperIds, setShopperIds] = useState<string[]>([]);
  const [items, setItems] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (entry) {
      setDate(entry.date);
      setShopperIds(entry.shopperIds);
      setItems(entry.items);
      setAmount(String(entry.amount));
      setNote(entry.note || '');
      setError('');
    }
  }, [entry]);

  if (!entry) return null;

  const toggleShopper = (id: string) => {
    setShopperIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
    setError('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (shopperIds.length === 0) {
      setError('কমপক্ষে ১ জন বাজারকারী নির্বাচন করুন।');
      return;
    }
    if (!items.trim()) {
      setError('বাজারের আইটেম বিবরণ লিখুন।');
      return;
    }
    const numAmount = Number(amount);
    if (!numAmount || numAmount <= 0) {
      setError('সঠিক বাজার খরচের টাকা (৳) লিখুন।');
      return;
    }

    onUpdateBazar({
      id: entry.id,
      date,
      shopperIds,
      items: items.trim(),
      amount: numAmount,
      note: note.trim(),
    });
    onClose();
  };

  return (
    <ModalShell title="বাজারের হিসাব সংশোধন (এডমিন এডিট)" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        <div className="bg-slate-50 rounded-2xl p-3.5 space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-800">বর্তমান তোলা টাকা</span>
            <span className="font-bold text-amber-700 tabular-nums">
              ৳ {entry.amount.toLocaleString('en-US')}
            </span>
          </div>
          <p className="text-[11px] text-slate-500">
            স্বচ্ছতা নীতি: একবার বাজারের টাকা তোলা হলে তা কখনো মুছা যায় না। এডমিন সংশোধন করলে পূর্বের টাকার পরিমাণ অডিট হিসেবে সংরক্ষিত ও দৃশ্যমান থাকবে।
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="edit-bazar-date" className="block text-slate-700 font-medium mb-1.5">
              বাজারের তারিখ
            </label>
            <input
              id="edit-bazar-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              className="w-full min-h-[44px] bg-slate-50 border border-slate-200 text-slate-900 rounded-xl px-3 py-2 font-mono focus:outline-none focus:ring-2 focus:ring-teal-600"
            />
          </div>

          <div>
            <label htmlFor="edit-bazar-amount" className="block text-slate-700 font-medium mb-1.5">
              সংশোধিত মোট খরচ (৳)
            </label>
            <input
              id="edit-bazar-amount"
              type="number"
              min="1"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setError('');
              }}
              className="w-full min-h-[44px] bg-slate-50 border border-slate-200 text-slate-900 rounded-xl px-3 py-2 text-sm font-bold tabular-nums focus:outline-none focus:ring-2 focus:ring-teal-600"
            />
          </div>
        </div>

        <fieldset>
          <legend className="block text-slate-700 font-medium mb-2">বাজারকারী মেম্বারবৃন্দ</legend>
          <div className="grid grid-cols-2 gap-2">
            {members.map((m) => {
              const checked = shopperIds.includes(m.id);
              return (
                <label
                  key={m.id}
                  className={`min-h-[44px] px-3 py-2 rounded-xl border flex items-center gap-2 cursor-pointer transition-colors ${
                    checked
                      ? 'bg-teal-50 border-teal-500 text-teal-900 font-semibold'
                      : 'bg-slate-50 border-slate-200 text-slate-700'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleShopper(m.id)}
                    className="w-4 h-4 accent-teal-600 shrink-0"
                  />
                  <span className="truncate">{m.name}</span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <div>
          <label htmlFor="edit-bazar-items" className="block text-slate-700 font-medium mb-1.5">
            আইটেম বিবরণ
          </label>
          <input
            id="edit-bazar-items"
            type="text"
            value={items}
            onChange={(e) => {
              setItems(e.target.value);
              setError('');
            }}
            className="w-full min-h-[44px] bg-slate-50 border border-slate-200 text-slate-900 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"
          />
        </div>

        <div>
          <label htmlFor="edit-bazar-note" className="block text-slate-700 font-medium mb-1.5">
            সংশোধনের কারণ / নোট (ঐচ্ছিক)
          </label>
          <input
            id="edit-bazar-note"
            type="text"
            placeholder="যেমন: ভাউচার মিলিয়ে সংশোধন করা হলো"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full min-h-[44px] bg-slate-50 border border-slate-200 text-slate-900 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"
          />
        </div>

        {error && <p className="text-xs text-rose-600 font-medium">{error}</p>}

        <button
          type="submit"
          className="w-full min-h-[48px] bg-teal-600 hover:bg-teal-700 text-white font-semibold text-sm rounded-xl transition-colors cursor-pointer"
        >
          সংশোধিত বাজার হিসাব সংরক্ষণ করুন
        </button>
      </form>
    </ModalShell>
  );
};


