import { create } from 'zustand';
import { CartItem, ShippingAddress, Order } from '@/types';

interface Customer {
  id: string;
  email: string;
  phone?: string;
  firstName: string;
  lastName: string;
}

interface GlobalState {
  // Cart
  cart: CartItem[];
  cartId: string | null;
  addToCart: (item: CartItem) => void;
  removeFromCart: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  setCartId: (id: string | null) => void;
  updateLineItemId: (cartItemId: string, lineItemId: string) => void;

  // Auth
  customer: Customer | null;
  setCustomer: (customer: Customer) => void;
  logout: () => void;

  // Orders
  orders: Order[];
  addOrder: (order: Order) => void;
  clearOrders: () => void;

  // Pending order (transient — between checkout and order-confirmation)
  pendingOrder: Order | null;
  setPendingOrder: (order: Order | null) => void;

  // Saved address
  savedAddress: ShippingAddress | null;
  setSavedAddress: (address: ShippingAddress) => void;

  // Session
  isSessionReady: boolean;
  setSessionReady: () => void;

  // UI States
  isCartOpen: boolean;
  setCartOpen: (open: boolean) => void;
  isAccountDrawerOpen: boolean;
  setAccountDrawerOpen: (open: boolean) => void;
}

const persistCart = (cart: CartItem[]) => {
  if (typeof window !== "undefined") localStorage.setItem("poshakh_cart", JSON.stringify(cart));
};

const loadCart = (): CartItem[] => {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem("poshakh_cart");
    if (!raw) return [];
    const items = JSON.parse(raw) as CartItem[];
    // Strip lineItemId on restore — re-sync at checkout
    return items.map(i => ({ ...i, lineItemId: undefined }));
  } catch {
    return [];
  }
};

export const useStore = create<GlobalState>((set) => ({
  cart: loadCart(),
  cartId: typeof window !== "undefined" ? localStorage.getItem("poshakh_cart_id") : null,
  customer: null,
  orders: typeof window !== "undefined"
    ? (() => { try { return JSON.parse(localStorage.getItem("poshakh_orders") ?? "[]"); } catch { return []; } })()
    : [],
  savedAddress: null,
  pendingOrder: null,

  addToCart: (item) => set((state) => {
    const existing = state.cart.find((c) => c.id === item.id);
    const cart = existing
      ? state.cart.map((c) => c.id === item.id ? { ...c, quantity: c.quantity + item.quantity } : c)
      : [...state.cart, item];
    persistCart(cart);
    return { cart };
  }),

  removeFromCart: (id) => set((state) => {
    const cart = state.cart.filter((c) => c.id !== id);
    persistCart(cart);
    return { cart };
  }),

  updateQuantity: (id, quantity) => set((state) => {
    const cart = quantity <= 0
      ? state.cart.filter((c) => c.id !== id)
      : state.cart.map((c) => c.id === id ? { ...c, quantity } : c);
    persistCart(cart);
    return { cart };
  }),

  clearCart: () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("poshakh_cart");
      localStorage.removeItem("poshakh_cart_id");
    }
    set({ cart: [] });
  },
  setCartId: (id) => {
    if (typeof window !== "undefined") {
      if (id) localStorage.setItem("poshakh_cart_id", id);
      else localStorage.removeItem("poshakh_cart_id");
    }
    set({ cartId: id });
  },

  updateLineItemId: (cartItemId, lineItemId) => set((state) => ({
    cart: state.cart.map((c) => c.id === cartItemId ? { ...c, lineItemId } : c),
  })),

  setCustomer: (customer) => {
    if (typeof window !== "undefined") {
      const lastId = localStorage.getItem("poshakh_last_customer_id");
      if (lastId && lastId !== customer.id) {
        localStorage.removeItem("poshakh_orders");
      }
      localStorage.setItem("poshakh_last_customer_id", customer.id);
      set({
        customer,
        orders: lastId && lastId !== customer.id
          ? []
          : (() => { try { return JSON.parse(localStorage.getItem("poshakh_orders") ?? "[]"); } catch { return []; } })(),
        savedAddress: null,
      });
    } else {
      set({ customer });
    }
  },

  logout: async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    if (typeof window !== "undefined") {
      localStorage.removeItem("poshakh_orders");
      localStorage.removeItem("poshakh_last_customer_id");
    }
    set({ customer: null, orders: [], savedAddress: null, pendingOrder: null });
  },

  addOrder: (order) => set((state) => {
    const orders = [order, ...state.orders];
    if (typeof window !== "undefined") localStorage.setItem("poshakh_orders", JSON.stringify(orders));
    return { orders };
  }),

  clearOrders: () => {
    if (typeof window !== "undefined") localStorage.removeItem("poshakh_orders");
    set({ orders: [] });
  },

  setPendingOrder: (order) => set({ pendingOrder: order }),

  setSavedAddress: (address) => set({ savedAddress: address }),

  isSessionReady: false,
  setSessionReady: () => set({ isSessionReady: true }),

  isCartOpen: false,
  setCartOpen: (open) => set({ isCartOpen: open }),
  isAccountDrawerOpen: false,
  setAccountDrawerOpen: (open) => set({ isAccountDrawerOpen: open }),
}));
