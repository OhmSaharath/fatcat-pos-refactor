import React, { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn, formatPrice } from '../../lib/utils';
import { renderWithAnimatedEmojis } from '../../lib/renderEmoji';

export interface ShowcaseDish {
  id?: string;
  name: string;
  price: number;
  image: string;
  tag: string;
  targetQuery: string;
}

export const DEFAULT_SHOWCASE_DISHES: ShowcaseDish[] = [
  {
    id: '4192187c-536e-4651-91da-ee743b14def1',
    name: 'เซ็ตข้าวไก่ต้มน้ำปลา',
    price: 60,
    image: '/api/img/4192187c-536e-4651-91da-ee743b14def1',
    tag: '🏆 ขายดีอันดับ 1 ในคอนโด',
    targetQuery: 'ไก่ต้มน้ําปลา',
  },
  {
    id: '2ab9bb15-8413-498e-972b-555e6d9329f6',
    name: 'เซ็ตข้าวหมูสามชั้นต้มน้ำปลา',
    price: 80,
    image: '/api/img/2ab9bb15-8413-498e-972b-555e6d9329f6',
    tag: '🍲 ซิกเนเจอร์ต้มน้ำปลา',
    targetQuery: 'สามชั้นต้มน้ําปลา',
  },
  {
    id: '3d19216d-68d6-489d-9cec-abe5781d34e1',
    name: '[เซ็ตคู่หู2กล่อง สุดคุ้ม!] ไก่ต้มน้ำปลา+สามชั้น',
    price: 140,
    image: '/api/img/3d19216d-68d6-489d-9cec-abe5781d34e1',
    tag: '🍱 เซ็ตคู่หูสุดคุ้ม',
    targetQuery: 'คู่หู',
  },
  {
    id: '38576332-4c9a-4b56-8019-dee39205b1b8',
    name: '[กับข้าว] ไก่ต้มน้ำปลา+สามชั้นต้มน้ำปลา',
    price: 120,
    image: '/api/img/38576332-4c9a-4b56-8019-dee39205b1b8',
    tag: '🥘 กับข้าวต้มน้ำปลา',
    targetQuery: 'กับข้าว',
  },
  {
    id: 'd9337664-8a01-46b0-a354-1b06b9f5b8ba',
    name: 'มาม่าเกาหลี + ไก่ทอดชิ้นโตๆ',
    price: 99,
    image: '/api/img/d9337664-8a01-46b0-a354-1b06b9f5b8ba',
    tag: '🍜 มาม่าเกาหลียอดฮิต',
    targetQuery: 'มาม่าเกาหลี',
  },
  {
    id: '64e1c84e-4394-4457-b064-d97ad9ad7abf',
    name: 'ข้าวไข่ข้น',
    price: 75,
    image: '/api/img/64e1c84e-4394-4457-b064-d97ad9ad7abf',
    tag: '🍳 ซิกเนเจอร์ข้าวไข่ข้น',
    targetQuery: 'ไข่ข้น',
  },
];

interface MenuCarouselProps {
  onSelectItemByQuery?: (query: string, id?: string) => void;
  dishes?: ShowcaseDish[];
  isStoreOpen?: boolean;
}

export const MenuCarousel: React.FC<MenuCarouselProps> = ({
  onSelectItemByQuery,
  dishes = DEFAULT_SHOWCASE_DISHES,
  isStoreOpen = true,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  const handleNext = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % dishes.length);
  }, [dishes.length]);

  const handlePrev = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + dishes.length) % dishes.length);
  }, [dishes.length]);

  // Auto-play interval
  useEffect(() => {
    const timer = setInterval(() => {
      handleNext();
    }, 4500);
    return () => clearInterval(timer);
  }, [handleNext]);

  return (
    <section className="relative w-full py-4 overflow-hidden bg-gradient-to-b from-[#FFFDF9] to-[#FBF8F5] border-b border-app-border">
      <div className="relative w-full h-[230px] flex items-center justify-center">
        {/* Carousel items */}
        <div className="relative w-full h-full flex items-center justify-center [perspective:800px]">
          {dishes.map((dish, idx) => {
            const total = dishes.length;
            const offset = (idx - currentIndex + total) % total;
            let pos = offset;
            if (pos > Math.floor(total / 2)) {
              pos = pos - total;
            }

            const isCenter = pos === 0;
            const isAdjacent = Math.abs(pos) === 1;

            return (
              <div
                key={idx}
                onClick={() => {
                  if (isCenter && onSelectItemByQuery) {
                    onSelectItemByQuery(dish.targetQuery, dish.id);
                  } else {
                    setCurrentIndex(idx);
                  }
                }}
                className={cn(
                  'absolute w-[190px] h-[190px] sm:w-[220px] sm:h-[220px] transition-all duration-500 ease-out cursor-pointer rounded-2xl overflow-hidden shadow-lg select-none',
                  isCenter ? 'z-20 scale-100 opacity-100 ring-2 ring-chipotle-brown/10' : 'z-10'
                )}
                style={{
                  transform: `translateX(${pos * 82}%) scale(${isCenter ? 1 : isAdjacent ? 0.82 : 0.65})`,
                  opacity: isCenter ? 1 : isAdjacent ? 0.45 : 0,
                  filter: isCenter ? 'blur(0px)' : 'blur(2px)',
                  visibility: Math.abs(pos) > 1 ? 'hidden' : 'visible',
                }}
              >
                {/* Top Badge */}
                <div className="absolute top-2 left-2 z-10 bg-black/80 text-white text-[10px] font-medium px-2 py-0.5 rounded-full backdrop-blur-sm border border-white/20 flex items-center gap-1">
                  {renderWithAnimatedEmojis(dish.tag)}
                </div>

                {/* Dish Square Image */}
                <img
                  src={dish.image}
                  alt={dish.name}
                  className="w-full h-full object-cover rounded-2xl bg-[#F4EFE8]"
                  style={{ imageRendering: '-webkit-optimize-contrast' }}
                  loading="lazy"
                />

                {/* Bottom Overlay Info */}
                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-2.5 pt-6 text-white flex flex-col gap-0.5">
                  <div className="text-xs font-semibold truncate drop-shadow-sm">{dish.name}</div>
                  <div className="flex items-center justify-between mt-0.5">
                    <span className="text-amber-400 font-bold text-sm tracking-tight">{formatPrice(dish.price)}</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onSelectItemByQuery) onSelectItemByQuery(dish.targetQuery, dish.id);
                      }}
                      className={cn(
                        "text-white text-[11px] font-semibold px-2.5 py-0.5 rounded-full shadow-md transition-all active:scale-95",
                        isStoreOpen ? "bg-chipotle-red hover:bg-rose-700" : "bg-gray-600 hover:bg-gray-700"
                      )}
                    >
                      {isStoreOpen ? '+ สั่ง' : 'ดูเมนู'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Navigation Arrows */}
        <button
          type="button"
          onClick={handlePrev}
          aria-label="Previous Dish"
          className="absolute left-2 top-1/2 -translate-y-1/2 z-30 w-8 h-8 rounded-full bg-white/90 shadow-md border border-gray-100 flex items-center justify-center text-gray-700 hover:text-chipotle-brown active:scale-90 transition-transform"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <button
          type="button"
          onClick={handleNext}
          aria-label="Next Dish"
          className="absolute right-2 top-1/2 -translate-y-1/2 z-30 w-8 h-8 rounded-full bg-white/90 shadow-md border border-gray-100 flex items-center justify-center text-gray-700 hover:text-chipotle-brown active:scale-90 transition-transform"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Dots Indicator */}
      <div className="flex justify-center items-center gap-1.5 mt-2">
        {dishes.map((_, dotIdx) => (
          <span
            key={dotIdx}
            onClick={() => setCurrentIndex(dotIdx)}
            className={cn(
              'h-1.5 rounded-full transition-all duration-300 cursor-pointer',
              currentIndex === dotIdx ? 'w-5 bg-chipotle-brown' : 'w-1.5 bg-gray-300 hover:bg-gray-400'
            )}
          />
        ))}
      </div>
    </section>
  );
};
