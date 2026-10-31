import React from 'react';
import { cn } from '../../lib/utils';
import { MenuCategory } from '../../types/menu';
import { AnimatedFlame } from '../../lib/renderEmoji';

interface CategoryPillsProps {
  categories: MenuCategory[];
  activeCategoryId: string;
  onSelectCategory: (id: string) => void;
  totalCount: number;
}

export const CategoryPills: React.FC<CategoryPillsProps> = ({
  categories,
  activeCategoryId,
  onSelectCategory,
  totalCount,
}) => {
  return (
    <div className="flex gap-2 overflow-x-auto no-scrollbar py-2 px-4 select-none">
      <button
        type="button"
        onClick={() => onSelectCategory('all')}
        className={cn(
          'inline-flex items-center justify-center shrink-0 px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all duration-150',
          activeCategoryId === 'all'
            ? 'bg-chipotle-brown text-white shadow-sm'
            : 'bg-white border border-app-border-dark text-[#63574E] hover:border-chipotle-brown'
        )}
      >
        ทั้งหมด ({totalCount})
      </button>

      {categories.map((cat) => {
        const isActive = activeCategoryId === cat.id;
        const isRec = Boolean(cat.is_recommended);

        return (
          <button
            key={cat.id}
            type="button"
            onClick={() => onSelectCategory(cat.id)}
            className={cn(
              'inline-flex items-center justify-center shrink-0 px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all duration-150 gap-1.5',
              isActive
                ? 'bg-chipotle-brown text-white shadow-sm'
                : isRec
                ? 'bg-amber-50/80 border border-amber-300 text-amber-900 shadow-sm'
                : 'bg-white border border-app-border-dark text-[#63574E] hover:border-chipotle-brown'
            )}
          >
            {isRec ? <AnimatedFlame size="sm" /> : null}
            <span>{cat.name} ({cat.items.length})</span>
          </button>
        );
      })}
    </div>
  );
};
