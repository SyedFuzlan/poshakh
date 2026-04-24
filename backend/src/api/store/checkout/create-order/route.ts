import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import Razorpay from "razorpay";

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const { amount_in_rupees } = req.body as { amount_in_rupees?: number };

  if (!amount_in_rupees || amount_in_rupees <= 0) {
    return res.status(400).json({ error: "Invalid amount" });
  }

  const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID!,
    key_secret: process.env.RAZORPAY_KEY_SECRET!,
  });

  const order = await razorpay.orders.create({
    amount: Math.round(amount_in_rupees * 100), // convert to paise
    currency: "INR",
    receipt: `poshakh_${Date.now()}`,
  });

  res.json({
    razorpay_order_id: order.id,
    amount: order.amount,
    currency: order.currency,
    key_id: process.env.RAZORPAY_KEY_ID,
  });
}
