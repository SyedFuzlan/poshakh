import { z } from "zod";

export const CreateOrderSchema = z.object({
  cart_id:          z.string().min(1, "cart_id required"),
  amount_in_rupees: z.number().positive().max(500000),
});

export const VerifyPaymentSchema = z.object({
  razorpay_order_id:   z.string().min(1),
  razorpay_payment_id: z.string().min(1),
  razorpay_signature:  z.string().min(1),
});

const AddressSchema = z.object({
  firstName:   z.string().min(1),
  lastName:    z.string().min(1),
  address:     z.string().min(1),
  apartment:   z.string().optional(),
  city:        z.string().min(1),
  state:       z.string().min(1),
  pinCode:     z.string().regex(/^\d{6}$/, "Invalid PIN code"),
  phone:       z.string().min(10),
  countryCode: z.string().length(2).default("in"),
});

export const CompleteCheckoutSchema = z.object({
  cart_id:               z.string().min(1),
  email:                 z.string().email(),
  customer_id:           z.string().optional(),
  shipping_option_id:    z.string().min(1),
  shipping_address:      AddressSchema,
  razorpay_payment_id:   z.string().optional(),
});
