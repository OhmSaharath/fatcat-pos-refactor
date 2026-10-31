import { useState, useEffect, useMemo } from 'react';
import { MenuCategory, MenuItem, StoreSettings } from '../types/menu';
import { fetchMenu } from '../lib/api';

export function useMenu() {
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [settings, setSettings] = useState<StoreSettings>(() => {
    try {
      const cached = localStorage.getItem('fatcat_store_settings');
      if (cached) return JSON.parse(cached);
    } catch {}
    return { is_open: false, store_name: 'แมวอ้วน' };
  });
  const [showcaseDishes, setShowcaseDishes] = useState<any[]>([]);
  const [isSettingsLoaded, setIsSettingsLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeCategoryId, setActiveCategoryId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);

  useEffect(() => {
    let mounted = true;
    fetchMenu()
      .then((data) => {
        if (!mounted) return;
        if (data.ok) {
          const rawCats = data.categories || [];
          const rawItems: MenuItem[] = (data.items || []).map((it: any) => ({
            ...it,
            modifier_groups: it.modifiers || it.modifier_groups || [],
          }));

          // Group items into categories
          const mappedCategories: MenuCategory[] = rawCats.map((cat: any) => ({
            id: cat.id,
            name: cat.name,
            color: cat.color,
            is_recommended: cat.is_recommended,
            badge: cat.badge,
            items: rawItems.filter((it) => it.category_id === cat.id),
          }));

          // Add unassigned items to 'other' if any
          const assignedIds = new Set(mappedCategories.flatMap((c) => c.items.map((i) => i.id)));
          const unassigned = rawItems.filter((i) => !assignedIds.has(i.id));
          if (unassigned.length > 0) {
            mappedCategories.push({
              id: 'other',
              name: 'อื่นๆ',
              items: unassigned,
            });
          }

          setCategories(mappedCategories);
          if (Array.isArray(data.showcase_dishes)) {
            setShowcaseDishes(data.showcase_dishes);
          }
          if (data.settings) {
            setSettings(data.settings);
            try {
              localStorage.setItem('fatcat_store_settings', JSON.stringify(data.settings));
            } catch {}
          }
          setIsSettingsLoaded(true);
        } else {
          setError('ไม่สามารถโหลดเมนูอาหารได้');
        }
      })
      .catch((err) => {
        if (!mounted) return;
        setError(err.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อ');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  // Filtered categories based on activeCategoryId and searchQuery
  const filteredCategories = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return categories
      .map((cat) => {
        if (activeCategoryId !== 'all' && cat.id !== activeCategoryId) {
          return null;
        }

        const itemsList = cat.items || [];
        const filteredItems = itemsList.filter((item) => {
          if (!query) return true;
          return (
            item.name.toLowerCase().includes(query) ||
            (item.description && item.description.toLowerCase().includes(query))
          );
        });

        if (filteredItems.length === 0) return null;

        return {
          ...cat,
          items: filteredItems,
        };
      })
      .filter(Boolean) as MenuCategory[];
  }, [categories, activeCategoryId, searchQuery]);

  const totalDishesCount = useMemo(() => {
    return categories.reduce((sum, c) => sum + (c.items ? c.items.length : 0), 0);
  }, [categories]);

  return {
    categories,
    filteredCategories,
    settings,
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
  };
}
