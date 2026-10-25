import React from 'react';
import {
  Bell,
  CalendarDays,
  ChartPie,
  FileSpreadsheet,
  Receipt,
  ShoppingBasket,
  UserCheck,
  Users,
  Wallet,
} from 'lucide-react';
import type { ActiveTab, Member } from '../types/mess';

interface TopNavBarProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  currentUser: Member;
  pendingCount: number;
  onOpenUserSwitch: () => void;
}

const ADMIN_DESKTOP_NAV_ITEMS: { id: ActiveTab; label: string }[] = [
  { id: 'meals', label: 'দৈনিক মিল' },
  { id: 'bazar', label: 'বাজার খাতা' },
  { id: 'deposits', label: 'জমা হিসাব' },
  { id: 'pending-requests', label: 'অ্যাপ্রুভাল হাব' },
  { id: 'backup', label: 'শিটস ও ক্লাউড' },
];

const MEMBER_DESKTOP_NAV_ITEMS: { id: ActiveTab; label: string }[] = [
  { id: 'meals', label: 'আমার ড্যাশবোর্ড' },
  { id: 'bazar', label: 'বাজার খাতা' },
  { id: 'deposits', label: 'জমা ও ব্যালেন্স' },
  { id: 'analytics', label: 'মাসিক রিপোর্ট' },
  { id: 'utilities', label: 'ইউটিলিটি বিল' },
];

export const TopNavBar: React.FC<TopNavBarProps> = ({
  activeTab,
  onSelectTab,
  currentUser,
  pendingCount,
  onOpenUserSwitch,
}) => {
  const navItems = currentUser.isAdmin ? ADMIN_DESKTOP_NAV_ITEMS : MEMBER_DESKTOP_NAV_ITEMS;

  return (
    <header className="sticky top-0 z-30 h-14 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 md:px-6 flex items-center justify-between gap-8">
      {/* Zone 1: Single text element wordmark */}
      <a
        href="#meals"
        onClick={(e) => {
          e.preventDefault();
          onSelectTab('meals');
        }}
        className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
      >
        মেস ম্যানেজার
      </a>

      {/* Zone 2: 5 concise single-line text links */}
      <nav
        aria-label="প্রধান নেভিগেশন"
        className="hidden md:flex items-center gap-6 text-sm font-medium"
      >
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          const labelText =
            item.id === 'pending-requests' && pendingCount > 0
              ? `অ্যাপ্রুভাল (${pendingCount})`
              : item.label;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(item.id)}
              className={`min-h-[44px] px-1 transition-colors whitespace-nowrap shrink-0 border-b-2 cursor-pointer ${
                isActive
                  ? 'border-teal-600 text-teal-800 font-semibold'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              {labelText}
            </button>
          );
        })}
      </nav>

      {/* Zone 3: 1 primary action (User / Role Switcher) */}
      <div className="flex items-center shrink-0">
        <button
          type="button"
          data-testid="top-user-switch-btn"
          onClick={onOpenUserSwitch}
          aria-label={`লগইন প্রোফাইল পরিবর্তন করুন (${currentUser.name})`}
          className={`min-h-[44px] px-4 py-2 text-white text-xs font-semibold rounded-xl transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer ${
            currentUser.isAdmin
              ? 'bg-slate-900 hover:bg-slate-800'
              : 'bg-teal-600 hover:bg-teal-700'
          }`}
        >
          <UserCheck className="w-4 h-4 shrink-0" />
          <span className="truncate max-w-[150px]">
            {currentUser.name} · {currentUser.isAdmin ? 'এডমিন' : 'মেম্বার'}
          </span>
        </button>
      </div>
    </header>
  );
};

interface SecondaryWorkspaceTabsProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  pendingCount: number;
  isAdmin: boolean;
}

export const SecondaryWorkspaceTabs: React.FC<SecondaryWorkspaceTabsProps> = ({
  activeTab,
  onSelectTab,
  pendingCount,
  isAdmin,
}) => {
  const adminTabs: { id: ActiveTab; label: string; icon: React.ReactNode }[] = [
    { id: 'meals', label: 'দৈনিক মিল', icon: <CalendarDays className="w-4 h-4" /> },
    { id: 'bazar', label: 'বাজার খাতা', icon: <ShoppingBasket className="w-4 h-4" /> },
    { id: 'analytics', label: 'অ্যানালিটিক্স', icon: <ChartPie className="w-4 h-4" /> },
    { id: 'deposits', label: 'জমা ও ব্যালেন্স', icon: <Wallet className="w-4 h-4" /> },
    {
      id: 'pending-requests',
      label: pendingCount > 0 ? `অ্যাপ্রুভাল (${pendingCount})` : 'অ্যাপ্রুভাল হাব',
      icon: <Bell className="w-4 h-4" />,
    },
    { id: 'members', label: 'মেম্বার তালিকা', icon: <Users className="w-4 h-4" /> },
    { id: 'utilities', label: 'ইউটিলিটি ও বিল', icon: <Receipt className="w-4 h-4" /> },
    {
      id: 'backup',
      label: 'Google Sheets ও ক্লাউড',
      icon: <FileSpreadsheet className="w-4 h-4" />,
    },
  ];

  const memberTabs: { id: ActiveTab; label: string; icon: React.ReactNode }[] = [
    { id: 'meals', label: 'আমার ড্যাশবোর্ড', icon: <CalendarDays className="w-4 h-4" /> },
    { id: 'bazar', label: 'বাজার খাতা', icon: <ShoppingBasket className="w-4 h-4" /> },
    { id: 'deposits', label: 'জমা ও ব্যালেন্স', icon: <Wallet className="w-4 h-4" /> },
    { id: 'analytics', label: 'মাসিক রিপোর্ট', icon: <ChartPie className="w-4 h-4" /> },
    { id: 'utilities', label: 'ইউটিলিটি বিল', icon: <Receipt className="w-4 h-4" /> },
  ];

  const visibleTabs = isAdmin ? adminTabs : memberTabs;

  return (
    <div
      role="tablist"
      aria-label="মেস সেকশন ট্যাব"
      className="flex overflow-x-auto lg:flex-wrap hide-scrollbar gap-1 bg-slate-100 p-1.5 rounded-2xl border border-slate-200/80"
    >
      {visibleTabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            role="tab"
            type="button"
            aria-selected={isActive}
            onClick={() => onSelectTab(tab.id)}
            className={`min-h-[44px] px-3 py-2 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
              isActive
                ? 'bg-white text-teal-800 border border-slate-200/80'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
};

interface MobileBottomNavProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  pendingCount: number;
  isAdmin: boolean;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  onSelectTab,
  pendingCount,
  isAdmin,
}) => {
  const adminItems: { id: ActiveTab; label: string; icon: React.ReactNode }[] = [
    { id: 'meals', label: 'মিল', icon: <CalendarDays className="w-5 h-5" /> },
    { id: 'bazar', label: 'বাজার', icon: <ShoppingBasket className="w-5 h-5" /> },
    { id: 'deposits', label: 'জমা', icon: <Wallet className="w-5 h-5" /> },
    {
      id: 'pending-requests',
      label: pendingCount > 0 ? `রিকোয়েস্ট (${pendingCount})` : 'রিকোয়েস্ট',
      icon: <Bell className="w-5 h-5" />,
    },
    { id: 'backup', label: 'শিটস', icon: <FileSpreadsheet className="w-5 h-5" /> },
  ];

  const memberItems: { id: ActiveTab; label: string; icon: React.ReactNode }[] = [
    { id: 'meals', label: 'ড্যাশবোর্ড', icon: <CalendarDays className="w-5 h-5" /> },
    { id: 'bazar', label: 'বাজার', icon: <ShoppingBasket className="w-5 h-5" /> },
    { id: 'deposits', label: 'জমা', icon: <Wallet className="w-5 h-5" /> },
    { id: 'analytics', label: 'রিপোর্ট', icon: <ChartPie className="w-5 h-5" /> },
    { id: 'utilities', label: 'বিল', icon: <Receipt className="w-5 h-5" /> },
  ];

  const items = isAdmin ? adminItems : memberItems;

  return (
    <nav
      aria-label="মোবাইল নিচের নেভিগেশন"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 h-16 bg-white/95 backdrop-blur-md border-t border-slate-200 grid grid-cols-5 items-center px-1"
    >
      {items.map((item) => {
        const isActive = activeTab === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelectTab(item.id)}
            className={`min-h-[48px] flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer ${
              isActive ? 'text-teal-700 font-semibold' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {item.icon}
            <span className="text-[10px] leading-none whitespace-nowrap truncate max-w-[68px]">
              {item.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
};

