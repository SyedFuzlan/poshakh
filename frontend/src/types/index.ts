export interface Product {
  id: string;
  name: string;
  price: number;
  formattedPrice: string;
  images: string[];
  category: string;
  description?: string;
  stock?: number;
  variants?: { id: string; size: string; stock: number }[];
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

export type Category = 'sarees' | 'sharara' | 'anarkali' | 'lehenga' | 'gowns' | 'new arrivals' | 'bestsellers' | 'bridal' | 'festive';

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
