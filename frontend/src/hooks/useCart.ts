import { useState, useEffect, useMemo, useCallback } from 'react';
import { CartItem } from '../types/menu';

const STORAGE_KEY = 'fatcat_cart_items';

export function useCart() {
  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch (e) {
      console.error('Failed to save cart to localStorage', e);
    }
  }, [items]);

  const addItem = useCallback((newItem: CartItem) => {
    setItems((prev) => {
      // Find matching item with same item_id, modifiers and note
      const matchIdx = prev.findIndex((it) => {
        if (it.item_id !== newItem.item_id) return false;
        if (it.item_note !== newItem.item_note) return false;
        if (it.modifiers.length !== newItem.modifiers.length) return false;
        const optIds1 = it.modifiers.map((m) => m.option_id).sort().join(',');
        const optIds2 = newItem.modifiers.map((m) => m.option_id).sort().join(',');
        return optIds1 === optIds2;
      });

      if (matchIdx >= 0) {
        const copy = [...prev];
        copy[matchIdx] = {
          ...copy[matchIdx],
          quantity: copy[matchIdx].quantity + newItem.quantity,
        };
        return copy;
      }
      return [...prev, newItem];
    });
  }, []);

  const updateQuantity = useCallback((cartId: string, delta: number) => {
    setItems((prev) => {
      return prev
        .map((it) => {
          if (it.id === cartId) {
            const nextQty = it.quantity + delta;
            return nextQty > 0 ? { ...it, quantity: nextQty } : null;
          }
          return it;
        })
        .filter(Boolean) as CartItem[];
    });
  }, []);

  const removeItem = useCallback((cartId: string) => {
    setItems((prev) => prev.filter((it) => it.id !== cartId));
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  const totalQuantity = useMemo(() => {
    return items.reduce((sum, it) => sum + it.quantity, 0);
  }, [items]);

  const grandTotal = useMemo(() => {
    return items.reduce((sum, it) => sum + it.unit_price * it.quantity, 0);
  }, [items]);

  return {
    items,
    addItem,
    updateQuantity,
    removeItem,
    clearCart,
    totalQuantity,
    grandTotal,
  };
}
