"use client";
import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { useStore } from "@/store";

function OrderConfirmationContent() {
  const params = useSearchParams();
  const paymentId = params.get("paymentId");
  const { pendingOrder, setPendingOrder } = useStore();

  // Capture the order before it's cleared
  const order = pendingOrder;

  useEffect(() => {
    if (pendingOrder) {
      setPendingOrder(null);
    }
  }, [pendingOrder, setPendingOrder]);

  const isCOD = paymentId?.startsWith("COD-");

  return (
    <main style={{ maxWidth: "700px", margin: "0 auto", padding: "100px 40px 80px", fontFamily: "var(--font-body)" }}>
      {/* Success icon */}
      <div style={{ width: "80px", height: "80px", borderRadius: "50%", background: "#3D0D16", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 32px" }}>
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#E0C275" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>

      <h1 style={{ fontFamily: "var(--font-heading)", fontSize: "32px", letterSpacing: "3px", color: "#2A2520", textTransform: "uppercase", marginBottom: "12px", textAlign: "center" }}>
        Order Confirmed
      </h1>

      <p style={{ fontSize: "15px", color: "#555", lineHeight: 1.7, marginBottom: "8px", textAlign: "center" }}>
        {isCOD
          ? "Thank you for shopping with Poshakh! Your Cash on Delivery order has been placed successfully."
          : "Thank you for shopping with Poshakh. Your payment was successful and your order is being processed."}
      </p>

      {paymentId && (
        <p style={{ fontSize: "12px", color: "#999", letterSpacing: "1px", marginBottom: "32px", textAlign: "center" }}>
          {isCOD ? "Order Reference" : "Payment ID"}: {paymentId}
        </p>
      )}

      {/* Order Details Card */}
      {order && (
        <div style={{ border: "1px solid #e5e7eb", borderRadius: "8px", overflow: "hidden", marginBottom: "32px" }}>
          {/* Items */}
          <div style={{ padding: "20px 24px", borderBottom: "1px solid #e5e7eb" }}>
            <p style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "2px", textTransform: "uppercase", color: "#888", marginBottom: "16px" }}>
              Order Items
            </p>
            {order.items.map((item, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: i < order.items.length - 1 ? "12px" : 0, fontSize: "14px" }}>
                <div>
                  <span style={{ fontWeight: 600, color: "#1A1410" }}>{item.name}</span>
                  {item.size && <span style={{ color: "#888", marginLeft: "8px" }}>· {item.size}</span>}
                  <span style={{ color: "#888", marginLeft: "8px" }}>× {item.quantity}</span>
                </div>
                <span style={{ fontWeight: 600, color: "#1A1410" }}>₹{(item.price * item.quantity).toLocaleString("en-IN")}</span>
              </div>
            ))}
            <div style={{ borderTop: "1px solid #f0f0f0", marginTop: "16px", paddingTop: "12px", display: "flex", justifyContent: "space-between", fontSize: "16px", fontWeight: 700, color: "#3D0D16" }}>
              <span>Total</span>
              <span>₹{(order.subtotal + (order.shippingMethod === "express" && order.subtotal < 25000 ? 199 : 0)).toLocaleString("en-IN")}</span>
            </div>
          </div>

          {/* Delivery Address */}
          <div style={{ padding: "20px 24px", borderBottom: "1px solid #e5e7eb" }}>
            <p style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "2px", textTransform: "uppercase", color: "#888", marginBottom: "10px" }}>
              Delivery Address
            </p>
            <p style={{ fontSize: "14px", color: "#1A1410", lineHeight: 1.7 }}>
              {order.shippingAddress.firstName} {order.shippingAddress.lastName}<br />
              {order.shippingAddress.address}
              {order.shippingAddress.apartment ? `, ${order.shippingAddress.apartment}` : ""}<br />
              {order.shippingAddress.city}, {order.shippingAddress.state} – {order.shippingAddress.pinCode}<br />
              <span style={{ color: "#888" }}>📞 {order.shippingAddress.phone}</span>
            </p>
          </div>

          {/* Payment / COD info */}
          <div style={{ padding: "20px 24px", background: isCOD ? "#fffbf0" : "#f9fafb" }}>
            <p style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "2px", textTransform: "uppercase", color: "#888", marginBottom: "10px" }}>
              Payment
            </p>
            {isCOD ? (
              <>
                <p style={{ fontSize: "14px", color: "#1A1410", fontWeight: 600, marginBottom: "6px" }}>💵 Cash on Delivery</p>
                <p style={{ fontSize: "13px", color: "#555", lineHeight: 1.6 }}>
                  Please keep the exact amount ready at the time of delivery. Our delivery partner will collect payment when your order arrives.
                </p>
              </>
            ) : (
              <>
                <p style={{ fontSize: "14px", color: "#1A1410", fontWeight: 600, marginBottom: "4px" }}>
                  {paymentId?.startsWith("T") || /^\d{10,}$/.test(paymentId ?? "") ? "UPI Transfer" : "Online Payment"}
                </p>
                <p style={{ fontSize: "12px", color: "#999", letterSpacing: "1px" }}>{paymentId}</p>
              </>
            )}
          </div>
        </div>
      )}

      {/* Next steps message */}
      <p style={{ fontSize: "14px", color: "#555", marginBottom: "32px", textAlign: "center", lineHeight: 1.7 }}>
        {isCOD
          ? `Your order will be dispatched within 2–3 business days. Standard delivery takes 7–10 business days.`
          : `Our team will process your order shortly. Standard dispatch time is 7–10 business days.`}
      </p>

      <div style={{ display: "flex", gap: "16px", justifyContent: "center", flexWrap: "wrap" }}>
        <Link href="/products" style={{ display: "inline-block", backgroundColor: "#3D0D16", color: "#E0C275", fontSize: "12px", fontWeight: 600, letterSpacing: "2px", textDecoration: "none", padding: "16px 32px", textTransform: "uppercase", fontFamily: "var(--font-body)" }}>
          CONTINUE SHOPPING
        </Link>
        <Link href="/account" style={{ display: "inline-block", border: "1px solid #3D0D16", color: "#3D0D16", fontSize: "12px", fontWeight: 600, letterSpacing: "2px", textDecoration: "none", padding: "16px 32px", textTransform: "uppercase", fontFamily: "var(--font-body)" }}>
          VIEW MY ORDERS
        </Link>
      </div>
    </main>
  );
}

export default function OrderConfirmationPage() {
  return (
    <Suspense>
      <OrderConfirmationContent />
    </Suspense>
  );
}
