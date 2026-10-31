import React from 'react';
import { MenuItem } from '../../types/menu';
import { cleanFrontName, formatPrice, cn } from '../../lib/utils';
import { renderWithAnimatedEmojis } from '../../lib/renderEmoji';

interface DishCardProps {
  item: MenuItem;
  onClick: (item: MenuItem) => void;
  isOpen: boolean;
}

export const DishCard: React.FC<DishCardProps> = ({ item, onClick, isOpen }) => {
  const isSoldOut = item.is_available === false || (item.stock_count !== null && item.stock_count !== undefined && item.stock_count <= 0);
  const badgeText = item.badge || (item.is_recommended ? '⭐ แนะนำ' : '');
  const isBestseller = badgeText.includes('ขายดี');

  return (
    <article
      onClick={() => onClick(item)}
      className={cn(
        'bg-white border border-app-border rounded-2xl p-3.5 mb-3 flex items-center gap-3.5 cursor-pointer shadow-xs transition-all duration-150 active:scale-[0.985] select-none hover:shadow-sm',
        isSoldOut && 'opacity-60 grayscale-[0.2]'
      )}
    >
      {/* 1:1 Square Thumbnail */}
      <div className="w-[84px] h-[84px] rounded-xl overflow-hidden shrink-0 bg-[#F4EFE8] flex items-center justify-center border border-gray-100">
        {item.image_url ? (
          <img
            src={item.image_url}
            alt={cleanFrontName(item.name)}
            className="w-full h-full object-cover rounded-xl"
            style={{ imageRendering: '-webkit-optimize-contrast' }}
            loading="lazy"
            decoding="async"
          />
        ) : (
          <span className="text-2xl">🍲</span>
        )}
      </div>

      {/* Dish Info */}
      <div className="flex-1 min-w-0 flex flex-col justify-between self-stretch">
        <div>
          {/* Badges Row */}
          <div className="flex items-center gap-1.5 flex-wrap mb-1">
            {badgeText && (
              <span
                className={cn(
                  'text-[10px] font-semibold px-2 py-0.5 rounded-md inline-flex items-center gap-1',
                  isBestseller
                    ? 'bg-gradient-to-r from-amber-100 to-amber-200 text-amber-900 border border-amber-400 shadow-xs'
                    : 'bg-amber-100 text-amber-800 border border-amber-300'
                )}
              >
                {renderWithAnimatedEmojis(badgeText)}
              </span>
            )}
            {item.modifier_groups && item.modifier_groups.length > 0 && (
              <span className="bg-chipotle-brown text-white text-[9px] font-bold px-1.5 py-0.5 rounded tracking-wide">
                CUSTOMIZE
              </span>
            )}
            {isSoldOut && (
              <span className="bg-red-100 text-red-700 text-[10px] font-semibold px-1.5 py-0.5 rounded">
                หมดชั่วคราว
              </span>
            )}
          </div>

          {/* Dish Title */}
          <h3 className="text-sm font-medium text-chipotle-brown leading-snug line-clamp-2">
            {cleanFrontName(item.name)}
          </h3>

          {/* Description */}
          {item.description && (
            <p className="text-[11px] text-app-muted line-clamp-1 mt-0.5">
              {item.description}
            </p>
          )}
        </div>

        {/* Bottom Price Bar */}
        <div className="flex items-center justify-between mt-2">
          <span className="text-base font-semibold text-chipotle-brown font-en tracking-tight">
            {formatPrice(item.price)}
          </span>

          {isSoldOut ? (
            <span className="text-[11px] font-semibold text-red-600">หมด</span>
          ) : !isOpen ? (
            <span className="text-[11px] font-medium text-rose-700 bg-rose-50 border border-rose-200 px-2.5 py-0.5 rounded-full">
              🔴 ร้านปิด
            </span>
          ) : (
            <span className="text-[11px] font-medium text-chipotle-red bg-rose-50 hover:bg-rose-100 px-2.5 py-0.5 rounded-full transition-colors">
              + เลือก
            </span>
          )}
        </div>
      </div>
    </article>
  );
};
