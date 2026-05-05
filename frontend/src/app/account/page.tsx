"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { useStore } from "@/store";
import { Order } from "@/types";

export default function AccountPage() {
  const { customer, logout, orders, isSessionReady } = useStore();
  const router = useRouter();
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (isSessionReady && !customer) router.replace("/");
  }, [customer, isSessionReady, router]);

  if (!isSessionReady) return null;
  if (!customer) return null;

  return (
    <main style={{ maxWidth: "1400px", margin: "0 auto", padding: "160px 40px 80px 40px" }}>
      <button
        onClick={() => { logout(); router.push("/"); }}
        style={{ background: "none", border: "none", fontSize: "11px", letterSpacing: "1.5px", fontWeight: 600, color: "#2A2520", display: "inline-flex", alignItems: "center", gap: "6px", marginBottom: "40px", cursor: "pointer", textTransform: "uppercase" }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        LOGOUT
      </button>

      <div style={{ marginBottom: "50px" }}>
        <h1 style={{ fontFamily: "var(--font-heading)", fontSize: "32px", fontWeight: 500, letterSpacing: "2px", color: "#2A2520", textTransform: "uppercase", marginBottom: "12px" }}>
          YOUR ACCOUNT
        </h1>
        <p style={{ fontSize: "14px", color: "#555", fontFamily: "var(--font-body)" }}>
          Welcome back, {customer.firstName || customer.phone || customer.email}
        </p>
      </div>

      <div style={{ display: "flex", gap: "60px", flexWrap: "wrap" }}>
        {/* Orders */}
        <div style={{ flex: 2, minWidth: "320px" }}>
          <h2 style={{ fontSize: "13px", fontWeight: 600, letterSpacing: "1.5px", color: "#2A2520", textTransform: "uppercase", marginBottom: "20px", borderBottom: "1px solid #ebebeb", paddingBottom: "12px", fontFamily: "var(--font-body)" }}>
            ORDERS ({orders.length})
          </h2>

          {orders.length === 0 ? (
            <>
              <p style={{ fontSize: "14px", color: "#666", marginBottom: "30px", fontFamily: "var(--font-body)" }}>
                You haven&apos;t placed any orders yet.
              </p>
              <Link href="/products" style={{ display: "inline-block", backgroundColor: "#3D0D16", color: "#C8A367", fontSize: "12px", fontWeight: 600, letterSpacing: "1.5px", textDecoration: "none", padding: "16px 32px", textTransform: "uppercase", fontFamily: "var(--font-body)" }}>
                CONTINUE SHOPPING
              </Link>
            </>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {orders.map((order: Order) => (
                <div key={order.id} style={{ border: "1px solid #ebebeb", padding: "20px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px", flexWrap: "wrap", gap: "8px" }}>
                    <div>
                      <p style={{ fontSize: "12px", color: "#888", marginBottom: "4px", fontFamily: "var(--font-body)" }}>
                        {new Date(order.date).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
                      </p>
                      <p style={{ fontSize: "11px", color: "#bbb", fontFamily: "var(--font-body)", letterSpacing: "1px" }}>
                        {order.paymentId}
                      </p>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <p style={{ fontSize: "16px", fontWeight: 700, color: "#3D0D16", fontFamily: "var(--font-body)" }}>
                        ₹{(order.subtotal + (order.shippingMethod === "express" && order.subtotal < 25000 ? 199 : 0)).toLocaleString("en-IN")}
                      </p>
                      <p style={{ fontSize: "11px", color: "#888", textTransform: "capitalize" }}>{order.shippingMethod} shipping</p>
                    </div>
                  </div>

                  {/* Item thumbnails */}
                  <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
                    {order.items.map(item => (
                      <div key={item.id} style={{ position: "relative", width: "48px", height: "64px", flexShrink: 0, border: "1px solid #f0f0f0" }}>
                        <Image src={item.image || "/images/products/saree1.png"} alt={item.name} fill style={{ objectFit: "cover" }} />
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={() => setExpanded(expanded === order.id ? null : order.id)}
                    style={{ fontSize: "12px", color: "#3D0D16", background: "none", border: "none", cursor: "pointer", textDecoration: "underline", padding: 0, fontFamily: "var(--font-body)" }}
                  >
                    {expanded === order.id ? "Hide details" : "View details"}
                  </button>

                  {expanded === order.id && (
                    <div style={{ marginTop: "16px", borderTop: "1px solid #f0f0f0", paddingTop: "16px" }}>
                      {order.items.map(item => (
                        <div key={item.id} style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", color: "#555", marginBottom: "8px", fontFamily: "var(--font-body)" }}>
                          <span>{item.name} × {item.quantity} <span style={{ color: "#bbb" }}>({item.size})</span></span>
                          <span>₹{(item.price * item.quantity).toLocaleString("en-IN")}</span>
                        </div>
                      ))}
                      <div style={{ fontSize: "13px", color: "#888", marginTop: "12px", fontFamily: "var(--font-body)" }}>
                        Shipped to: {order.shippingAddress.address}, {order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.pinCode}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Profile */}
        <div style={{ flex: 1, minWidth: "240px" }}>
          <h2 style={{ fontSize: "13px", fontWeight: 600, letterSpacing: "1.5px", color: "#2A2520", textTransform: "uppercase", marginBottom: "20px", borderBottom: "1px solid #ebebeb", paddingBottom: "12px", fontFamily: "var(--font-body)" }}>
            PROFILE
          </h2>
          <p style={{ fontSize: "14px", color: "#666", marginBottom: "8px", fontFamily: "var(--font-body)" }}>{customer.firstName} {customer.lastName}</p>
          {customer.email && <p style={{ fontSize: "14px", color: "#666", marginBottom: "8px", fontFamily: "var(--font-body)" }}>{customer.email}</p>}
          {customer.phone && <p style={{ fontSize: "14px", color: "#666", fontFamily: "var(--font-body)" }}>{customer.phone}</p>}
        </div>
      </div>
    </main>
  );
}
