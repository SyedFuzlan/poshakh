import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import crypto from "crypto";

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body as {
    razorpay_order_id?: string;
    razorpay_payment_id?: string;
    razorpay_signature?: string;
  };

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res.status(400).json({ error: "Missing payment details" });
  }

  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest("hex");

  if (expectedSignature !== razorpay_signature) {
    return res.status(401).json({ error: "Payment verification failed" });
  }

  res.json({ success: true, payment_id: razorpay_payment_id, order_id: razorpay_order_id });
}
