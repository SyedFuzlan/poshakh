export interface Product {
  id: string;
  name: string;
  slug: string;
  price: number;
  compare_at_price?: number;
  formattedPrice: string;
  formattedCompareAtPrice?: string;
  images: string[];
  category_id: number;
  category_name: string;
  category: string; // Legacy support
  description?: string;
  meta_title?: string;
  meta_description?: string;
  stock?: number;
  totalStock?: number;
  variants?: { id: string; size: string; color?: string; stock: number }[];
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  parent_id: number | null;
  position: number;
  description: string | null;
}

export interface CartItem {
  id: string; // unique cart item id (e.g. product_id + size)
  productId: string;
  name: string;
  price: number;
  quantity: number;
  image: string;
  size?: string;
  variantId?: string;
  lineItemId?: string;
}

export type CategoryType = 'sarees' | 'sharara' | 'anarkali' | 'lehenga' | 'gowns' | 'new arrivals' | 'bestsellers' | 'bridal' | 'festive';

export interface ShippingAddress {
  firstName: string;
  lastName: string;
  address: string;
  apartment?: string;
  city: string;
  state: string;
  pinCode: string;
  phone: string;
}

export interface Order {
  id: string;
  paymentId: string;
  date: string;
  items: CartItem[];
  subtotal: number;
  shippingAddress: ShippingAddress;
  shippingMethod: "free" | "express";
}
