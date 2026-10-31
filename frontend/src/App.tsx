import { useState, useMemo, useEffect } from 'react';
import { Header } from './components/navigation/Header';
import { BottomNav, TabType } from './components/navigation/BottomNav';
import { MenuCarousel, DEFAULT_SHOWCASE_DISHES } from './components/carousel/MenuCarousel';
import { CustomerProfileModal } from './components/profile/CustomerProfileModal';
import { CategoryPills } from './components/menu/CategoryPills';
import { DishCard } from './components/menu/DishCard';
import { ItemCustomizerModal } from './components/modal/ItemCustomizerModal';
import { CartFloatingPill } from './components/cart/CartFloatingPill';
import { CheckoutModal } from './components/cart/CheckoutModal';
import { ReorderView } from './components/reorder/ReorderView';
import { HistoryView } from './components/history/HistoryView';
import { RewardsView } from './components/rewards/RewardsView';
import { useMenu } from './hooks/useMenu';
import { useCart } from './hooks/useCart';
import { cleanFrontName } from './lib/utils';
import { AnimatedFlame } from './lib/renderEmoji';
import { initLiff, LineUserProfile } from './lib/liff';
import { Search } from 'lucide-react';

export function App() {
  const [activeTab, setActiveTab] = useState<TabType>('menu');
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [lineProfile, setLineProfile] = useState<LineUserProfile | null>(() => {
    try {
      const uid = localStorage.getItem('fatcat_line_user_id');
      const name = localStorage.getItem('fatcat_line_display_name');
      const pic = localStorage.getItem('fatcat_line_picture_url');
      if (uid && name) {
        return { userId: uid, displayName: name, pictureUrl: pic || '' };
      }
    } catch {}
    return null;
  });

  const {
    filteredCategories,
    categories,
    loading,
    isSettingsLoaded,
    error,
    activeCategoryId,
    setActiveCategoryId,
    searchQuery,
    setSearchQuery,
    selectedItem,
    setSelectedItem,
    totalDishesCount,
    showcaseDishes,
    settings,
  } = useMenu();

  const {
    items: cartItems,
    addItem: addToCart,
    removeItem: removeFromCart,
    clearCart,
    totalQuantity: cartCount,
    grandTotal,
  } = useCart();

  // Handle clicking "+ สั่ง" on carousel by matching dish id or query
  const handleCarouselSelect = (targetQuery: string, dishId?: string) => {
    const allItems = categories.flatMap((c) => c.items);
    if (dishId) {
      const match = allItems.find((it) => it.id === dishId);
      if (match) {
        setSelectedItem(match);
        return;
      }
    }
    const matchByQuery = allItems.find((it) => it.name.includes(targetQuery));
    if (matchByQuery) {
      setSelectedItem(matchByQuery);
      return;
    }
    // Fallback: set search query
    setSearchQuery(targetQuery);
  };

  const handleReorderItems = (items: { name: string; quantity: number; modifiers?: any[]; item_note?: string; note?: string }[]) => {
    // Add items directly to cart matching by name, preserving modifiers and auto-filling required groups
    items.forEach((re) => {
      for (const cat of categories) {
        const match = cat.items.find((it) => cleanFrontName(it.name) === cleanFrontName(re.name));
        if (match) {
          const restoredMods: { group_id: string; group_name: string; option_id: string; name: string; price: number }[] = [];
          const prevMods = Array.isArray(re.modifiers) ? re.modifiers : [];
          const groups = match.modifier_groups || [];

          groups.forEach((grp) => {
            // 1. Try to restore options from the previous order for this group
            const matchedInGrp: typeof restoredMods = [];
            prevMods.forEach((pm) => {
              const foundOpt = grp.options.find(
                (o) => o.is_available !== false && ((pm.option_id && o.id === pm.option_id) || o.name === pm.name)
              );
              if (foundOpt && !matchedInGrp.some((m) => m.option_id === foundOpt.id)) {
                if (grp.max_selection === 0 || matchedInGrp.length < grp.max_selection) {
                  matchedInGrp.push({
                    group_id: grp.id,
                    group_name: grp.name,
                    option_id: foundOpt.id,
                    name: foundOpt.name,
                    price: Number(foundOpt.price || 0),
                  });
                }
              }
            });

            // 2. If group is required and still below min_selection, auto-pick first available option(s)
            const isReq = grp.is_required || grp.min_selection > 0;
            const minReq = grp.min_selection > 0 ? grp.min_selection : isReq ? 1 : 0;
            if (matchedInGrp.length < minReq) {
              for (const opt of grp.options) {
                if (opt.is_available !== false && !matchedInGrp.some((m) => m.option_id === opt.id)) {
                  matchedInGrp.push({
                    group_id: grp.id,
                    group_name: grp.name,
                    option_id: opt.id,
                    name: opt.name,
                    price: Number(opt.price || 0),
                  });
                  if (matchedInGrp.length >= minReq) break;
                }
              }
            }

            restoredMods.push(...matchedInGrp);
          });

          const modPriceSum = restoredMods.reduce((s, m) => s + Number(m.price || 0), 0);
          addToCart({
            id: `${match.id}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            item_id: match.id,
            name: match.name,
            base_price: match.price,
            unit_price: Number(match.price || 0) + modPriceSum,
            quantity: re.quantity,
            modifiers: restoredMods,
            item_note: re.item_note || re.note || '',
            image_url: match.image_url,
          });
          break;
        }
      }
    });
    setIsCheckoutOpen(true);
  };

  // Dynamically compute showcase carousel dishes matching live menu items
  const carouselDishes = useMemo(() => {
    const allItems = categories.flatMap((c) => c.items);
    if (allItems.length === 0) return DEFAULT_SHOWCASE_DISHES;

    if (showcaseDishes && showcaseDishes.length > 0) {
      const mapped = showcaseDishes
        .map((sd: any) => {
          const live = allItems.find((it) => it.id === sd.id);
          if (live) {
            return {
              id: live.id,
              name: live.name,
              price: live.price,
              image: live.image_url || `/api/img/${live.id}`,
              tag: sd.tag || live.badge || '🔥 เมนูแนะนำ',
              targetQuery: live.name,
            };
          }
          return null;
        })
        .filter(Boolean) as any[];

      if (mapped.length > 0) return mapped;
    }

    return DEFAULT_SHOWCASE_DISHES.map((d) => {
      const live =
        (d.id ? allItems.find((it) => it.id === d.id) : null) ||
        (d.targetQuery ? allItems.find((it) => it.name.includes(d.targetQuery)) : null);
      if (live) {
        return {
          ...d,
          id: live.id,
          name: live.name,
          price: live.price,
          image: live.image_url || d.image,
          tag: live.badge || d.tag,
        };
      }
      return d;
    });
  }, [categories, showcaseDishes]);

  useEffect(() => {
    const liffId = settings?.line_liff_id || '2012182991-8OyKKKRl';
    if (liffId) {
      initLiff(liffId).then((p) => {
        if (p) setLineProfile(p);
      });
    }
  }, [settings?.line_liff_id]);

  return (
    <div className="bg-[#1A0D07] text-app-primary flex justify-center min-h-screen">
      <div className="w-full max-w-[500px] min-h-screen bg-app-bg relative shadow-2xl flex flex-col pb-24">
      {/* 1. Sticky Header */}
      <Header
        cartCount={cartCount}
        onOpenCart={() => setIsCheckoutOpen(true)}
        onOpenProfile={() => setIsProfileOpen(true)}
        profileAvatarUrl={lineProfile?.pictureUrl}
        isOpen={settings.is_open}
        announcement={settings.announcement}
        closedMessage={settings.closed_message}
        isLoading={!isSettingsLoaded}
      />

      {/* 2. Main Tab View */}
      {activeTab === 'menu' && (
        <main className="flex-1">
          {/* Top 1:1 Showcase Food Carousel */}
          <MenuCarousel
            dishes={carouselDishes}
            onSelectItemByQuery={handleCarouselSelect}
            isStoreOpen={settings.is_open}
          />

          {/* Search Box */}
          <div className="p-4 pb-1 sticky top-[94px] z-20 bg-app-bg">
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ค้นหาเมนู เช่น ไก่ต้มน้ำปลา, กะเพรา, มาม่า..."
                className="w-full text-xs py-2.5 pl-10 pr-4 rounded-xl border border-app-border-dark bg-[#F8F5F1] focus:bg-white focus:outline-none focus:ring-1 focus:ring-chipotle-brown transition-all"
              />
            </div>
          </div>

          {/* Horizontal Category Pills */}
          <CategoryPills
            categories={categories}
            activeCategoryId={activeCategoryId}
            onSelectCategory={setActiveCategoryId}
            totalCount={totalDishesCount}
          />

          {/* Dishes List */}
          <div className="p-4">
            {loading ? (
              <div className="text-center py-16 text-xs text-app-muted">
                กำลังโหลดเมนูหน้าร้าน...
              </div>
            ) : error ? (
              <div className="text-center py-16 text-xs text-red-500">
                {error}
              </div>
            ) : filteredCategories.length === 0 ? (
              <div className="text-center py-16 text-xs text-app-muted">
                ไม่พบเมนูที่ค้นหา
              </div>
            ) : (
              filteredCategories.map((cat) => (
                <section key={cat.id} className="mb-6">
                  <div className="flex items-center gap-2 mb-2.5">
                    <h2 className="text-base font-semibold text-chipotle-brown inline-flex items-center gap-1.5">
                      {cat.is_recommended ? <AnimatedFlame size="md" /> : null}
                      <span>{cat.name}</span>
                    </h2>
                    <span className="text-xs font-medium text-app-muted">
                      ({cat.items.length})
                    </span>
                    {cat.is_recommended && (
                      <span className="bg-amber-100 text-amber-800 text-[10px] font-semibold px-2 py-0.5 rounded-full">
                        แนะนำ
                      </span>
                    )}
                  </div>

                  <div className="space-y-3">
                    {cat.items.map((item) => (
                      <DishCard
                        key={item.id}
                        item={item}
                        isOpen={settings.is_open}
                        onClick={(it) => setSelectedItem(it)}
                      />
                    ))}
                  </div>
                </section>
              ))
            )}
          </div>
        </main>
      )}

      {/* Reorder View */}
      {activeTab === 'reorder' && (
        <ReorderView
          onReorderItems={handleReorderItems}
          onGoToMenu={() => setActiveTab('menu')}
        />
      )}

      {/* Rewards View */}
      {activeTab === 'rewards' && (
        <RewardsView
          lineProfile={lineProfile}
          onGoToMenu={() => setActiveTab('menu')}
        />
      )}

      {/* History View */}
      {activeTab === 'history' && (
        <HistoryView
          lineProfile={lineProfile}
          onReorderItems={handleReorderItems}
          onGoToMenu={() => setActiveTab('menu')}
        />
      )}

      {/* 3. Item Customizer Modal */}
      {selectedItem && (
        <ItemCustomizerModal
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onAddToCart={addToCart}
          isStoreOpen={settings.is_open}
        />
      )}

      {/* 4. Cart Floating Pill */}
      <CartFloatingPill
        totalQuantity={cartCount}
        grandTotal={grandTotal}
        onOpenCheckout={() => setIsCheckoutOpen(true)}
        isStoreOpen={settings.is_open}
      />

      {/* 5. Checkout & Payment Modal */}
      <CheckoutModal
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        cartItems={cartItems}
        onRemoveItem={removeFromCart}
        grandTotal={grandTotal}
        lineProfile={lineProfile}
        isStoreOpen={settings.is_open}
        closedMessage={settings.closed_message}
        onOrderSuccess={(orderCode) => {
          clearCart();
          alert(`ส่งออเดอร์สำเร็จ! รหัสออเดอร์ของคุณคือ #${orderCode}`);
          setActiveTab('history');
        }}
      />

      {/* 6. Customer Profile Modal */}
      <CustomerProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        lineProfile={lineProfile}
      />

      {/* 7. Dynamic Island Floating Bottom Navigation */}
      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
      </div>
    </div>
  );
}

export default App;
