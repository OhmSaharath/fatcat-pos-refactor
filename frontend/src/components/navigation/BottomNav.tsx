import React from 'react';
import { Utensils, RotateCcw, Trophy, Clock } from 'lucide-react';
import { cn } from '../../lib/utils';

export type TabType = 'menu' | 'reorder' | 'rewards' | 'history';

interface BottomNavProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, onTabChange }) => {
  const tabs = [
    { id: 'menu', label: 'Menu', icon: Utensils },
    { id: 'reorder', label: 'Reorder', icon: RotateCcw },
    { id: 'rewards', label: 'Rewards', icon: Trophy },
    { id: 'history', label: 'History', icon: Clock },
  ] as const;

  return (
    <nav className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 bg-white/95 backdrop-blur-md border border-app-border-dark/60 rounded-full py-1.5 px-2 flex items-center gap-1 shadow-lg max-w-[95%]">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;

        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabChange(tab.id)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all duration-200 select-none',
              isActive
                ? 'bg-rose-50 text-chipotle-red font-semibold'
                : 'text-gray-500 hover:text-chipotle-brown'
            )}
          >
            <Icon className={cn('w-[18px] h-[18px]', isActive ? 'text-chipotle-red stroke-[2.2]' : 'stroke-[1.8]')} />
            <span
              className={cn(
                'text-xs transition-all overflow-hidden whitespace-nowrap',
                isActive ? 'max-w-[80px] opacity-100' : 'max-w-0 opacity-0 hidden sm:inline-block'
              )}
            >
              {tab.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
};
