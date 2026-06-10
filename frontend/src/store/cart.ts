import { fetchWithAuth } from "@/lib/apiClient";

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { getAuthToken, getCartItems, setCartItems } from '@/lib/storage';

const apiBase = import.meta.env.VITE_API_URL || '/api';

export type CartItem = {
  productId: string;
  title: string;
  unitPrice: number;
  quantity: number;
  image?: string;
  customImage?: string;
};

type CartState = {
  items: CartItem[];
  fetchCart: () => Promise<void>;
  addItem: (product: Pick<CartItem, 'productId' | 'title' | 'unitPrice' | 'image' | 'customImage'>) => Promise<void>;
  updateQuantity: (productId: string, quantity: number) => Promise<void>;
  removeItem: (productId: string) => Promise<void>;
  syncLocalCartToBackend: () => Promise<void>;
  clearLocalCart: () => void;
};

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: getCartItems(),

      fetchCart: async () => {
        const token = getAuthToken();
        if (!token) {
          // If not logged in, just rely on what is persisted
          return;
        }

    try {
      const res = await fetchWithAuth(`${apiBase}/cart`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        const mappedItems = data.items.map((item: any) => ({
          productId: item.productId._id || item.productId,
          title: item.productId.title || 'Unknown Item',
          unitPrice: item.productId.price || 0,
          quantity: item.quantity,
          image: item.productId.images?.[0] || undefined,
          customImage: item.customImage || undefined,
        }));
        set({ items: mappedItems });
      }
    } catch (err) {
      console.error('Failed to fetch cart', err);
    }
  },

  addItem: async (product) => {
    const token = getAuthToken();
    if (!token) {
      // Guest: update Zustand directly, it will persist
      const currentItems = get().items;
      const existing = currentItems.find((item) => item.productId === product.productId);

      let updatedItems;
      if (existing) {
        updatedItems = currentItems.map(item => item.productId === product.productId ? { ...item, quantity: item.quantity + 1 } : item);
      } else {
        updatedItems = [...currentItems, { ...product, quantity: 1 }];
      }

      setCartItems(updatedItems); // keep fallback in sync just in case
      set({ items: updatedItems });
      return;
    }

    // Logged in: update optimistically
    const currentItems = get().items;
    const existing = currentItems.find((item) => item.productId === product.productId);
    const newQuantity = existing ? existing.quantity + 1 : 1;

    const updatedItems = existing
      ? currentItems.map(item => item.productId === product.productId ? { ...item, quantity: newQuantity } : item)
      : [...currentItems, { ...product, quantity: 1 }];

    set({ items: updatedItems });

    try {
      const res = await fetchWithAuth(`${apiBase}/cart/items`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          productId: product.productId,
          quantity: newQuantity,
          customImage: product.customImage
        }),
      });

      if (!res.ok) {
        // Revert on failure
        await get().fetchCart();
      }
    } catch (err) {
      console.error('Failed to add item to cart', err);
      await get().fetchCart(); // Revert on failure
    }
  },

  updateQuantity: async (productId, quantity) => {
    const newQuantity = Math.max(1, quantity);
    const token = getAuthToken();

    if (!token) {
      // Guest
      const currentItems = get().items;
      const updated = currentItems.map(item =>
        item.productId === productId ? { ...item, quantity: newQuantity } : item
      );
      setCartItems(updated);
      set({ items: updated });
      return;
    }

    // Logged in: update optimistically
    const currentItems = get().items;
    const updated = currentItems.map(item =>
      item.productId === productId ? { ...item, quantity: newQuantity } : item
    );
    set({ items: updated });

    try {
      const res = await fetchWithAuth(`${apiBase}/cart/items`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ productId, quantity: newQuantity }),
      });

      if (!res.ok) {
        // Revert on failure
        await get().fetchCart();
      }
    } catch (err) {
      console.error('Failed to update quantity', err);
      await get().fetchCart(); // Revert on failure
    }
  },

  removeItem: async (productId) => {
    const token = getAuthToken();

    if (!token) {
      // Guest
      const currentItems = get().items;
      const updated = currentItems.filter(item => item.productId !== productId);
      setCartItems(updated);
      set({ items: updated });
      return;
    }

    // Logged in: update optimistically
    const currentItems = get().items;
    const updated = currentItems.filter(item => item.productId !== productId);
    set({ items: updated });

    try {
      const res = await fetchWithAuth(`${apiBase}/cart/items/${productId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        // Revert on failure
        await get().fetchCart();
      }
    } catch (err) {
      console.error('Failed to remove item', err);
      await get().fetchCart(); // Revert on failure
    }
  },

  syncLocalCartToBackend: async () => {
    const token = getAuthToken();
    if (!token) return;

    // Discard local items upon login and fetch the user's saved backend cart
    setCartItems([]);
    await get().fetchCart();
  },

      clearLocalCart: () => {
        setCartItems([]);
        set({ items: [] });
      }
    }),
    {
      name: 'kapdakraft_zustand_cart',
    }
  )
);
