"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { useStore } from "@/store";
import { ShippingAddress } from "@/types";
import { trackEvent, identifyUser } from "@/components/PostHogProvider";

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:9000";
const UPI_ID = "8919273494@ybl";

const INDIAN_STATES = [
  "Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh","Goa","Gujarat",
  "Haryana","Himachal Pradesh","Jharkhand","Karnataka","Kerala","Madhya Pradesh",
  "Maharashtra","Manipur","Meghalaya","Mizoram","Nagaland","Odisha","Punjab",
  "Rajasthan","Sikkim","Tamil Nadu","Telangana","Tripura","Uttar Pradesh",
  "Uttarakhand","West Bengal","Delhi","Jammu & Kashmir","Ladakh",
];

const inputStyle: React.CSSProperties = {
  width: "100%", height: "44px", border: "1px solid #d1d5db", padding: "0 12px",
  fontSize: "14px", color: "#1A1410", background: "#fff", outline: "none",
  borderRadius: "4px", boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  fontSize: "12px", fontWeight: 600, letterSpacing: "1px", color: "#555",
  textTransform: "uppercase", display: "block", marginBottom: "6px",
};

type Step = 1 | 2 | 3;
type UpiStep = "idle" | "awaiting" | "confirming";

// interface ShippingOption { id: string; name: string; amount: number; }

export default function CheckoutPage() {
  const { cart, customer, savedAddress, setSavedAddress, clearCart, setPendingOrder, addOrder } = useStore();
  const router = useRouter();

  const [step, setStep] = useState<Step>(1);
  const [guestEmail, setGuestEmail] = useState("");
  const [addr, setAddr] = useState<ShippingAddress>(savedAddress ?? {
    firstName: customer?.firstName ?? "",
    lastName: customer?.lastName ?? "",
    address: "", apartment: "", city: "", state: "", pinCode: "",
    phone: customer?.phone ?? "",
  });
  const [shipping, setShipping] = useState<"free" | "express">("free");
  const [paying, setPaying] = useState(false);

  // Promo code state
  const [promoCode, setPromoCode] = useState("");
  const [appliedPromo, setAppliedPromo] = useState<{ code: string; discount_paise: number } | null>(null);
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoError, setPromoError] = useState("");

  // UPI flow state
  const [upiStep, setUpiStep] = useState<UpiStep>("idle");
  const [upiUtr, setUpiUtr] = useState("");

  const subtotal = cart.reduce((t, i) => t + i.price * i.quantity, 0);
  const shippingCost = shipping === "express" && subtotal < 25000 ? 199 : 0;
  const discount = appliedPromo?.discount_paise ? Math.floor(appliedPromo.discount_paise / 100) : 0;
  const total = Math.max(0, subtotal + shippingCost - discount);

  // Track checkout start
  useEffect(() => {
    if (cart.length > 0) {
      trackEvent('checkout_started', {
        cart_total: total,
        item_count: cart.length,
        items: cart.map(i => ({ name: i.name, id: i.productId, price: i.price }))
      });
    }

    if (customer?.id) {
      identifyUser(customer.id, {
        email: customer.email,
        name: `${customer.firstName} ${customer.lastName}`
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (cart.length === 0) {
    return (
      <main style={{ maxWidth: "600px", margin: "0 auto", padding: "160px 40px", textAlign: "center" }}>
        <p style={{ fontSize: "16px", color: "#555", marginBottom: "24px" }}>Your cart is empty.</p>
        <Link href="/products" style={{ backgroundColor: "#3D0D16", color: "#E0C275", padding: "14px 32px", textDecoration: "none", fontSize: "12px", fontWeight: 600, letterSpacing: "2px", textTransform: "uppercase" }}>
          SHOP NOW
        </Link>
      </main>
    );
  }

  const handleAddrChange = (field: keyof ShippingAddress, value: string) =>
    setAddr((prev) => ({ ...prev, [field]: value }));

  const handleInfoSubmit = (e: React.SyntheticEvent) => {
    e.preventDefault();
    setSavedAddress(addr);
    setStep(2);
    
    // Track checkout intent (Abandoned Cart Recovery)
    const checkoutId = `CK-${Date.now()}`; // Or use a persistent ID
    fetch(`${BACKEND}/api/checkouts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: checkoutId,
        customer_name: `${addr.firstName} ${addr.lastName}`,
        customer_phone: addr.phone,
        customer_email: customer?.email ?? guestEmail,
        items_json: JSON.stringify(cart.map(i => ({ name: i.name, productId: i.productId, quantity: i.quantity, price: i.price, size: i.size }))),
        total_paise: total * 100
      })
    }).catch(err => console.error("Failed to track checkout intent:", err));
  };

  // Build order payload from current cart state
  function buildOrderData(paymentMethod?: string) {
    return {
      customer_name: `${addr.firstName} ${addr.lastName}`.trim(),
      customer_phone: addr.phone,
      customer_email: customer?.email ?? guestEmail,
      payment_method: paymentMethod,
      address: {
        line1: addr.address,
        line2: addr.apartment ?? "",
        city: addr.city,
        state: addr.state,
        pin_code: addr.pinCode,
      },
      items: cart.map((item) => ({
        product_id: item.productId,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        size: item.size ?? "",
        image: item.image,
      })),
      subtotal,
      shipping_method: shipping,
      shipping_cost: shippingCost,
      promo_code: appliedPromo?.code ?? null,
      discount_paise: appliedPromo?.discount_paise ?? 0,
      total,
    };
  }

  // After payment confirmed by backend: update UI state and redirect
  const finishOrder = (paymentId: string) => {
    const pendingOrder = {
      id: `ORD-${Date.now()}`,
      paymentId,
      date: new Date().toISOString(),
      items: [...cart],
      subtotal,
      shippingAddress: addr,
      shippingMethod: shipping,
    };
    setPendingOrder(pendingOrder);
    addOrder(pendingOrder);
    
    // Track purchase
    trackEvent('purchase_completed', {
      order_id: pendingOrder.id,
      payment_id: paymentId,
      total_revenue: total,
      item_count: cart.length,
      shipping_method: shipping
    });

    clearCart();
    router.push(`/order-confirmation?paymentId=${paymentId}`);
  };

  const handleUpiConfirm = async () => {
    if (!upiUtr.trim()) {
      alert("Please enter your UTR / Transaction ID after completing the payment.");
      return;
    }
    setUpiStep("confirming");
    try {
      const res = await fetch(`${BACKEND}/api/payments/upi-confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ utr: upiUtr.trim(), order_data: buildOrderData("upi") }),
      });
      const data = await res.json();
      if (data.success) finishOrder(upiUtr.trim());
      else { alert(data.error ?? "Failed to confirm order. Please try again."); setUpiStep("awaiting"); }
    } catch { alert("Network error. Please try again."); setUpiStep("awaiting"); }
  };

  const handleCOD = async () => {
    setPaying(true);
    try {
      const res = await fetch(`${BACKEND}/api/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_data: buildOrderData("COD") }),
      });
      const data = await res.json();
      if (data.success) finishOrder(`COD-${data.order_id ?? Date.now()}`);
      else alert(data.error ?? "Failed to place order. Please try again.");
    } catch { alert("Network error. Please try again."); }
    finally { setPaying(false); }
  };

  const handleApplyPromo = async () => {
    if (!promoCode) return;
    setPromoLoading(true);
    setPromoError("");
    try {
      const res = await fetch(`${BACKEND}/api/promo/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: promoCode, order_amount_paise: subtotal * 100 }),
      });
      const data = await res.json();
      if (data.valid) {
        setAppliedPromo({ code: promoCode, discount_paise: data.discount_paise });
        trackEvent('promo_applied', { code: promoCode, discount: data.discount_paise / 100 });
      } else {
        setPromoError(data.error || "Invalid promo code");
      }
    } catch {
      setPromoError("Failed to validate promo code");
    } finally {
      setPromoLoading(false);
    }
  };

  const upiLink = `upi://pay?pa=${encodeURIComponent(UPI_ID)}&pn=${encodeURIComponent("ZOHRA")}&am=${total.toFixed(2)}&cu=INR&tn=${encodeURIComponent("ZOHRA Order")}`;

  const breadcrumb = ["Cart", "Information", "Shipping", "Payment"];
  const stepIndex = step === 1 ? 1 : step === 2 ? 2 : 3;

  return (
    <div style={{ minHeight: "100vh", background: "#fff" }}>
      {/* Header */}
      <header style={{ borderBottom: "1px solid #e5e7eb", padding: "20px 40px", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Link href="/" style={{ display: "flex", flexDirection: "column", alignItems: "center", textDecoration: "none" }}>
          <span style={{ fontSize: "8px", letterSpacing: "2px", color: "#555", marginBottom: "-2px" }}>MADE BY</span>
          <span style={{ fontFamily: "var(--font-heading)", fontSize: "24px", letterSpacing: "3px", color: "#2A2520", fontWeight: 500 }}>ZOHRA</span>
        </Link>
      </header>

      <div style={{ display: "flex", maxWidth: "1100px", margin: "0 auto", padding: "40px 20px", gap: "60px", flexWrap: "wrap" }}>

        {/* LEFT — Form */}
        <div style={{ flex: "1 1 480px" }}>
          {/* Breadcrumb */}
          <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "32px", fontSize: "13px" }}>
            {breadcrumb.map((b, i) => (
              <span key={b} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                {i > 0 && <span style={{ color: "#ccc" }}>›</span>}
                <span style={{ color: i === stepIndex ? "#3D0D16" : i < stepIndex ? "#555" : "#bbb", fontWeight: i === stepIndex ? 600 : 400 }}>{b}</span>
              </span>
            ))}
          </div>

          {/* STEP 1 — Information */}
          {step === 1 && (
            <form onSubmit={handleInfoSubmit}>
              <h2 style={{ fontSize: "18px", fontWeight: 600, color: "#1A1410", marginBottom: "8px" }}>Contact</h2>
              <div style={{ marginBottom: "20px" }}>
                <input
                  type="email"
                  value={customer?.email ?? guestEmail}
                  onChange={e => !customer && setGuestEmail(e.target.value)}
                  readOnly={!!customer}
                  required={!customer}
                  placeholder="Email address"
                  style={{ ...inputStyle, background: customer ? "#f9f9f9" : "#fff", color: customer ? "#888" : "#1A1410" }}
                />
                {!customer && <p style={{ fontSize: "12px", color: "#888", marginTop: "6px" }}>
                  Checking out as guest &nbsp;·&nbsp; <Link href="/account" style={{ color: "#3D0D16" }}>Sign in</Link> for faster checkout
                </p>}
              </div>

              <h2 style={{ fontSize: "18px", fontWeight: 600, color: "#1A1410", marginBottom: "20px" }}>Shipping address</h2>

              <div style={{ marginBottom: "14px" }}>
                <label style={labelStyle}>Country / Region</label>
                <input type="text" value="India" readOnly style={{ ...inputStyle, background: "#f9f9f9", color: "#888" }} />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "14px" }}>
                <div>
                  <label style={labelStyle}>First name</label>
                  <input type="text" value={addr.firstName} onChange={e => handleAddrChange("firstName", e.target.value)} required style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Last name</label>
                  <input type="text" value={addr.lastName} onChange={e => handleAddrChange("lastName", e.target.value)} required style={inputStyle} />
                </div>
              </div>

              <div style={{ marginBottom: "14px" }}>
                <label style={labelStyle}>Address</label>
                <input type="text" value={addr.address} onChange={e => handleAddrChange("address", e.target.value)} required style={inputStyle} />
              </div>

              <div style={{ marginBottom: "14px" }}>
                <label style={labelStyle}>Apartment, suite, etc. (optional)</label>
                <input type="text" value={addr.apartment ?? ""} onChange={e => handleAddrChange("apartment", e.target.value)} style={inputStyle} />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "14px", marginBottom: "14px" }}>
                <div>
                  <label style={labelStyle}>City</label>
                  <input type="text" value={addr.city} onChange={e => handleAddrChange("city", e.target.value)} required style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>State</label>
                  <select value={addr.state} onChange={e => handleAddrChange("state", e.target.value)} required style={{ ...inputStyle, cursor: "pointer" }}>
                    <option value="">Select</option>
                    {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>PIN Code</label>
                  <input type="text" value={addr.pinCode} onChange={e => handleAddrChange("pinCode", e.target.value)} required maxLength={6} style={inputStyle} />
                </div>
              </div>

              <div style={{ marginBottom: "28px" }}>
                <label style={labelStyle}>Phone (10-digit Indian number)</label>
                <input
                  type="tel"
                  value={addr.phone}
                  onChange={e => {
                    const digits = e.target.value.replace(/\D/g, "").slice(0, 10);
                    handleAddrChange("phone", digits);
                  }}
                  required
                  maxLength={10}
                  minLength={10}
                  pattern="[6-9][0-9]{9}"
                  title="Enter a valid 10-digit Indian mobile number starting with 6, 7, 8 or 9"
                  placeholder="e.g. 9876543210"
                  style={{
                    ...inputStyle,
                    borderColor: addr.phone.length > 0 && (addr.phone.length !== 10 || !/^[6-9]/.test(addr.phone)) ? "#ef4444" : "#d1d5db",
                  }}
                />
                {addr.phone.length > 0 && addr.phone.length < 10 && (
                  <p style={{ fontSize: "11px", color: "#ef4444", marginTop: "4px" }}>
                    {10 - addr.phone.length} more digit{10 - addr.phone.length !== 1 ? "s" : ""} needed
                  </p>
                )}
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Link href="/products" style={{ fontSize: "13px", color: "#555", textDecoration: "none" }}>← Return to cart</Link>
                <button type="submit" style={{ backgroundColor: "#3D0D16", color: "#E0C275", padding: "14px 32px", border: "none", cursor: "pointer", fontSize: "13px", fontWeight: 600, letterSpacing: "1.5px", textTransform: "uppercase" }}>
                  Continue to shipping
                </button>
              </div>
            </form>
          )}

          {/* STEP 2 — Shipping */}
          {step === 2 && (
            <div>
              {/* Summary boxes */}
              <div style={{ border: "1px solid #e5e7eb", borderRadius: "6px", marginBottom: "24px" }}>
                {[
                  { label: "Contact", value: customer?.email ?? addr.phone },
                  { label: "Ship to", value: `${addr.address}${addr.apartment ? ", " + addr.apartment : ""}, ${addr.city}, ${addr.state} ${addr.pinCode}, India` },
                ].map((row, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderBottom: i === 0 ? "1px solid #e5e7eb" : "none", fontSize: "14px" }}>
                    <span style={{ color: "#888", minWidth: "70px" }}>{row.label}</span>
                    <span style={{ color: "#1A1410", flex: 1, margin: "0 12px" }}>{row.value}</span>
                    <button onClick={() => setStep(1)} style={{ color: "#3D0D16", background: "none", border: "none", cursor: "pointer", fontSize: "13px", textDecoration: "underline" }}>Change</button>
                  </div>
                ))}
              </div>

              <h2 style={{ fontSize: "18px", fontWeight: 600, color: "#1A1410", marginBottom: "16px" }}>Shipping method</h2>
              <div style={{ border: "1px solid #e5e7eb", borderRadius: "6px", marginBottom: "28px" }}>
                {([["free", "Free Shipping", "7–10 business days", "FREE"],
                   ["express", "Express Shipping", "3–5 business days", subtotal >= 25000 ? "FREE" : "₹199"]] as const).map(([val, name, days, price]) => (
                  <label key={val} style={{ display: "flex", alignItems: "center", padding: "14px 16px", borderBottom: val === "free" ? "1px solid #e5e7eb" : "none", cursor: "pointer", gap: "12px" }}>
                    <input type="radio" name="shipping" value={val} checked={shipping === val} onChange={() => setShipping(val)} style={{ accentColor: "#3D0D16" }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 500, fontSize: "14px" }}>{name}</div>
                      <div style={{ fontSize: "12px", color: "#888" }}>{days}</div>
                    </div>
                    <span style={{ fontWeight: 600, fontSize: "14px" }}>{price}</span>
                  </label>
                ))}
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <button onClick={() => setStep(1)} style={{ fontSize: "13px", color: "#555", background: "none", border: "none", cursor: "pointer" }}>← Return to information</button>
                <button onClick={() => setStep(3)} style={{ backgroundColor: "#3D0D16", color: "#E0C275", padding: "14px 32px", border: "none", cursor: "pointer", fontSize: "13px", fontWeight: 600, letterSpacing: "1.5px", textTransform: "uppercase" }}>
                  Continue to payment
                </button>
              </div>
            </div>
          )}

          {/* STEP 3 — Payment */}
          {step === 3 && (
            <div>
              {/* Summary boxes */}
              <div style={{ border: "1px solid #e5e7eb", borderRadius: "6px", marginBottom: "24px" }}>
                {[
                  { label: "Contact", value: customer?.email ?? addr.phone },
                  { label: "Ship to", value: `${addr.address}${addr.apartment ? ", " + addr.apartment : ""}, ${addr.city} ${addr.pinCode}` },
                  { label: "Shipping", value: shipping === "free" || subtotal >= 25000 ? "Free Shipping · FREE" : "Express Shipping · ₹199" },
                ].map((row, i, arr) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderBottom: i < arr.length - 1 ? "1px solid #e5e7eb" : "none", fontSize: "14px" }}>
                    <span style={{ color: "#888", minWidth: "70px" }}>{row.label}</span>
                    <span style={{ color: "#1A1410", flex: 1, margin: "0 12px" }}>{row.value}</span>
                    <button onClick={() => setStep(i === 2 ? 2 : 1)} style={{ color: "#3D0D16", background: "none", border: "none", cursor: "pointer", fontSize: "13px", textDecoration: "underline" }}>Change</button>
                  </div>
                ))}
              </div>

              <h2 style={{ fontSize: "18px", fontWeight: 600, color: "#1A1410", marginBottom: "8px" }}>Payment</h2>
              <p style={{ fontSize: "13px", color: "#888", marginBottom: "20px" }}>All transactions are secure and encrypted.</p>

              <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: upiStep !== "idle" ? "0" : "28px" }}>
                {/* Razorpay */}
{/* Razorpay disabled for Phase 4 initial launch
                <button
                  onClick={handleRazorpay}
                  disabled={paying || upiStep !== "idle"}
                  style={{ backgroundColor: "#3D0D16", color: "#E0C275", padding: "16px", border: "none", cursor: "pointer", fontSize: "13px", fontWeight: 600, letterSpacing: "2px", textTransform: "uppercase", opacity: (paying || upiStep !== "idle") ? 0.5 : 1 }}
                >
                  {paying ? "PREPARING..." : `PAY ₹${total.toLocaleString("en-IN")} WITH RAZORPAY`}
                </button>
                */}

                {/* UPI — temporarily disabled
                <button
                  onClick={upiStep !== "idle" ? () => setUpiStep("idle") : handleUPI}
                  disabled={paying}
                  style={{ backgroundColor: upiStep !== "idle" ? "#f3f4f6" : "#4f46e5", color: upiStep !== "idle" ? "#6b7280" : "#fff", padding: "16px", border: upiStep !== "idle" ? "1px solid #e5e7eb" : "none", cursor: "pointer", fontSize: "13px", fontWeight: 600, letterSpacing: "1.5px", textTransform: "uppercase", opacity: paying ? 0.5 : 1 }}
                >
                  {upiStep !== "idle" ? "CANCEL UPI PAYMENT" : `PAY ₹${total.toLocaleString("en-IN")} WITH UPI / PHONEPE / GPAY`}
                </button>
                */}

                {/* COD */}
                <button
                  onClick={handleCOD}
                  disabled={paying || upiStep !== "idle"}
                  style={{ backgroundColor: "#f9f6f0", color: "#3D0D16", padding: "16px", border: "1px solid #C8A367", cursor: "pointer", fontSize: "13px", fontWeight: 600, letterSpacing: "1.5px", textTransform: "uppercase", opacity: (paying || upiStep !== "idle") ? 0.5 : 1 }}
                >
                  {paying ? "PLACING ORDER..." : `CASH ON DELIVERY (COD)`}
                </button>

                {process.env.NEXT_PUBLIC_DEV_SIMULATE === "true" && (
                  <button
                    onClick={() => finishOrder(`pay_dev_${Date.now()}`)}
                    style={{ padding: "12px", border: "1px solid #d1d5db", background: "#f9f9f9", cursor: "pointer", fontSize: "12px", color: "#888", letterSpacing: "1px", textTransform: "uppercase" }}
                  >
                    [DEV] Simulate Payment
                  </button>
                )}
              </div>

              {/* UPI Payment Panel */}
              {upiStep !== "idle" && (
                <div style={{ border: "1px solid #e0e7ff", borderRadius: "6px", padding: "24px", background: "#f8f9ff", marginBottom: "28px" }}>
                  <p style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "2px", color: "#4f46e5", textTransform: "uppercase", marginBottom: "16px" }}>
                    UPI Payment — ₹{total.toLocaleString("en-IN")}
                  </p>

                  {/* UPI ID display */}
                  <div style={{ background: "#fff", border: "1px solid #e0e7ff", borderRadius: "4px", padding: "16px", marginBottom: "16px", textAlign: "center" }}>
                    <p style={{ fontSize: "11px", color: "#888", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "1px" }}>Send payment to this UPI ID</p>
                    <p style={{ fontSize: "20px", fontWeight: 700, color: "#1a1410", letterSpacing: "1px", fontFamily: "monospace", marginBottom: "4px" }}>{UPI_ID}</p>
                    <p style={{ fontSize: "11px", color: "#888" }}>PhonePe · Google Pay · Paytm · BHIM · Any UPI App</p>
                  </div>

                  {/* Deep link button — opens UPI app on mobile */}
                  <a
                    href={upiLink}
                    style={{ display: "block", textAlign: "center", background: "#3D0D16", color: "#E0C275", padding: "14px 16px", textDecoration: "none", fontSize: "13px", fontWeight: 600, letterSpacing: "2px", textTransform: "uppercase", borderRadius: "4px", marginBottom: "20px" }}
                  >
                    OPEN UPI APP ON THIS DEVICE
                  </a>

                  {/* UTR input */}
                  <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: "20px" }}>
                    <label style={{ ...labelStyle, marginBottom: "8px" }}>
                      After paying — enter Transaction ID (UTR):
                    </label>
                    <input
                      type="text"
                      value={upiUtr}
                      onChange={e => setUpiUtr(e.target.value)}
                      placeholder="e.g. T2504282123456 or 425012345678"
                      style={{ ...inputStyle, marginBottom: "12px" }}
                    />
                    <button
                      onClick={handleUpiConfirm}
                      disabled={upiStep === "confirming"}
                      style={{ width: "100%", backgroundColor: "#16a34a", color: "#fff", padding: "14px", border: "none", cursor: "pointer", fontSize: "13px", fontWeight: 600, letterSpacing: "1.5px", textTransform: "uppercase", borderRadius: "4px", opacity: upiStep === "confirming" ? 0.6 : 1 }}
                    >
                      {upiStep === "confirming" ? "CONFIRMING ORDER..." : "CONFIRM PAYMENT & PLACE ORDER"}
                    </button>
                  </div>
                </div>
              )}

              <button onClick={() => setStep(2)} style={{ fontSize: "13px", color: "#555", background: "none", border: "none", cursor: "pointer" }}>← Return to shipping</button>
            </div>
          )}
        </div>

        {/* RIGHT — Order Summary */}
        <div style={{ flex: "0 0 340px", borderLeft: "1px solid #e5e7eb", paddingLeft: "40px" }}>
          <div style={{ position: "sticky", top: "40px" }}>
            {cart.map(item => (
              <div key={item.id} style={{ display: "flex", gap: "14px", marginBottom: "18px", alignItems: "center" }}>
                <div style={{ position: "relative", width: "60px", height: "80px", flexShrink: 0, border: "1px solid #e5e7eb" }}>
                  <span style={{ position: "absolute", top: "-8px", right: "-8px", background: "#3D0D16", color: "#fff", borderRadius: "50%", width: "20px", height: "20px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: 700, zIndex: 1 }}>{item.quantity}</span>
                  <Image src={item.image || "/images/products/saree1.png"} alt={item.name} fill style={{ objectFit: "cover" }} />
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: "14px", fontWeight: 500, color: "#1A1410", marginBottom: "4px" }}>{item.name}</p>
                  <p style={{ fontSize: "12px", color: "#888" }}>{item.size}</p>
                </div>
                <p style={{ fontSize: "14px", fontWeight: 600, color: "#1A1410" }}>₹{(item.price * item.quantity).toLocaleString("en-IN")}</p>
              </div>
            ))}

            {/* Promo Code Input */}
            <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: "20px", marginTop: "20px" }}>
              <div style={{ display: "flex", gap: "10px" }}>
                <input
                  type="text"
                  placeholder="Promo code"
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                  style={{ ...inputStyle, flex: 1 }}
                  disabled={!!appliedPromo || promoLoading}
                />
                <button
                  onClick={handleApplyPromo}
                  disabled={!promoCode || !!appliedPromo || promoLoading}
                  style={{
                    backgroundColor: appliedPromo ? "#16a34a" : "#3D0D16",
                    color: "#fff",
                    padding: "0 20px",
                    border: "none",
                    borderRadius: "4px",
                    fontSize: "12px",
                    fontWeight: 600,
                    cursor: "pointer",
                    opacity: (!promoCode || promoLoading) && !appliedPromo ? 0.5 : 1
                  }}
                >
                  {appliedPromo ? "APPLIED" : promoLoading ? "..." : "APPLY"}
                </button>
              </div>
              {promoError && <p style={{ fontSize: "12px", color: "#ef4444", marginTop: "8px" }}>{promoError}</p>}
              {appliedPromo && (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "10px" }}>
                  <span style={{ fontSize: "13px", color: "#16a34a", fontWeight: 500 }}>
                    Code {appliedPromo.code} applied!
                  </span>
                  <button
                    onClick={() => { setAppliedPromo(null); setPromoCode(""); }}
                    style={{ background: "none", border: "none", color: "#888", fontSize: "12px", cursor: "pointer", textDecoration: "underline" }}
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>

            <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: "16px", marginTop: "24px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px", color: "#555", marginBottom: "10px" }}>
                <span>Subtotal</span><span>₹{subtotal.toLocaleString("en-IN")}</span>
              </div>
              {discount > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px", color: "#16a34a", marginBottom: "10px" }}>
                  <span>Discount</span><span>-₹{discount.toLocaleString("en-IN")}</span>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px", color: "#555", marginBottom: "16px" }}>
                <span>Shipping</span>
                <span>{shippingCost === 0 ? "FREE" : `₹${shippingCost}`}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "18px", fontWeight: 700, color: "#1A1410", borderTop: "1px solid #e5e7eb", paddingTop: "16px" }}>
                <span>Total</span>
                <span style={{ fontSize: "13px", color: "#888", alignSelf: "flex-end", marginRight: "4px" }}>INR</span>
                <span>₹{total.toLocaleString("en-IN")}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Add handleApplyPromo inside the component
// I'll add it after handleCOD
