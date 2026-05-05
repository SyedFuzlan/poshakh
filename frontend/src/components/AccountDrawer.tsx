"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/store";
import { loginWithPassword, signupWithPassword } from "@/lib/auth";

type View = "login" | "signup";

const benefits = [
  "Checkout faster",
  "Track orders",
  "Loyalty rewards",
  "Be the first to see new products & promotions",
];

const inputStyle: React.CSSProperties = {
  width: "100%", height: "50px", border: "1px solid rgba(201,168,76,0.3)",
  padding: "0 16px", fontSize: "14px", color: "#1A1410",
  fontFamily: "var(--font-body)", background: "#fff", boxSizing: "border-box",
  outline: "none",
};

const btnStyle: React.CSSProperties = {
  width: "100%", height: "52px", background: "#3D0D16", color: "#E0C275",
  fontSize: "11px", fontWeight: 600, letterSpacing: "2.5px",
  textTransform: "uppercase", border: "none", cursor: "pointer",
};

const linkBtnStyle: React.CSSProperties = {
  color: "#3D0D16", fontWeight: 600, textDecoration: "underline",
  padding: 0, background: "none", border: "none", fontSize: "13px", cursor: "pointer",
};

function BenefitIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="#3D0D16" stroke="#F5EFE6" strokeWidth="2" style={{ flexShrink: 0 }}>
      <circle cx="12" cy="12" r="10" />
      <path d="M8 12l3 3 5-6" />
    </svg>
  );
}

function BenefitsList() {
  return (
    <ul style={{ listStyle: "none", padding: 0, margin: "0 0 24px" }}>
      {benefits.map((b) => (
        <li key={b} style={{ display: "flex", alignItems: "center", gap: "12px", fontSize: "13px", color: "#2A2520", marginBottom: "10px" }}>
          <BenefitIcon />{b}
        </li>
      ))}
    </ul>
  );
}

function parseError(err: unknown): string {
  const msg = (err as { message?: string }).message ?? "";
  if (msg.includes("already exists")) return msg;
  if (msg.includes("Invalid credentials") || msg.includes("401")) return "Incorrect phone or password.";
  if (msg.includes("Password must")) return msg;
  return msg || "Something went wrong. Please try again.";
}

export default function AccountDrawer() {
  const { isAccountDrawerOpen, setAccountDrawerOpen, setCustomer, customer, logout } = useStore();
  const router = useRouter();

  const [view, setView] = useState<View>("login");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Login
  const [loginId, setLoginId] = useState("");
  const [loginPw, setLoginPw] = useState("");

  // Signup
  const [sigFirst, setSigFirst] = useState("");
  const [sigLast, setSigLast] = useState("");
  const [sigPhone, setSigPhone] = useState("");
  const [sigPw, setSigPw] = useState("");
  const [sigPwConfirm, setSigPwConfirm] = useState("");

  if (!isAccountDrawerOpen) return null;

  function go(v: View) {
    setView(v);
    setError("");
  }

  function onSuccess(c: { id: string; email: string | null; phone: string | null; firstName: string; lastName: string }) {
    setCustomer({
      id: c.id,
      email: c.email ?? "",
      phone: c.phone ?? "",
      firstName: c.firstName ?? "",
      lastName: c.lastName ?? "",
    });
    setAccountDrawerOpen(false);
    router.push("/account");
  }

  async function handleLogin(e: React.SyntheticEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const c = await loginWithPassword(loginId, loginPw);
      onSuccess(c);
    } catch (err) { setError(parseError(err)); }
    finally { setLoading(false); }
  }

  async function handleSignup(e: React.SyntheticEvent) {
    e.preventDefault();
    setError("");
    if (sigPw !== sigPwConfirm) { setError("Passwords do not match."); return; }
    if (sigPw.length < 8) { setError("Password must be at least 8 characters."); return; }
    setLoading(true);
    try {
      const c = await signupWithPassword(sigFirst, sigLast, sigPhone, sigPw);
      onSuccess(c);
    } catch (err) { setError(parseError(err)); }
    finally { setLoading(false); }
  }

  return (
    <>
      <div className="fixed inset-0 z-[10000]" style={{ background: "rgba(26,20,16,0.4)" }} onClick={() => setAccountDrawerOpen(false)} />

      <div className="fixed right-0 top-0 h-full flex flex-col z-[10001]"
        style={{ width: "420px", maxWidth: "100vw", background: "#F5EFE6", boxShadow: "-10px 0 40px rgba(0,0,0,0.1)" }}>

        {/* Header */}
        <div className="flex items-center justify-between" style={{ padding: "24px 30px", borderBottom: "1px solid rgba(201,168,76,0.3)" }}>
          <span style={{ fontFamily: "var(--font-heading)", fontSize: "18px", letterSpacing: "4px", color: "#2A080F" }}>ACCOUNT</span>
          <button onClick={() => setAccountDrawerOpen(false)} aria-label="Close" style={{ color: "#2A080F", background: "none", border: "none", cursor: "pointer" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div style={{ flex: 1, padding: "30px", overflowY: "auto" }}>

          {/* ── LOGGED-IN VIEW ── */}
          {customer && (
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              <p style={{ fontFamily: "var(--font-heading)", fontStyle: "italic", fontSize: "15px", color: "#2A2520" }}>
                Welcome back, {customer.firstName || customer.phone || customer.email}
              </p>
              <button
                onClick={() => { setAccountDrawerOpen(false); router.push("/account"); }}
                style={btnStyle}
              >
                MY ACCOUNT
              </button>
              <button
                onClick={() => { logout(); setAccountDrawerOpen(false); router.push("/"); }}
                style={{ ...btnStyle, background: "transparent", color: "#3D0D16", border: "1px solid #3D0D16" }}
              >
                LOGOUT
              </button>
            </div>
          )}

          {/* ── LOGIN VIEW ── */}
          {!customer && view === "login" && (
            <>
              <form onSubmit={handleLogin} style={{ marginBottom: "30px" }}>
                <div style={{ marginBottom: "14px" }}>
                  <input type="text" placeholder="Phone or Email" value={loginId}
                    onChange={e => setLoginId(e.target.value)} required style={inputStyle} />
                </div>
                <div style={{ marginBottom: "24px" }}>
                  <input type="password" placeholder="Password" value={loginPw}
                    onChange={e => setLoginPw(e.target.value)} required style={inputStyle} />
                </div>
                {error && <p style={{ fontSize: "12px", color: "#c0392b", marginBottom: "12px" }}>{error}</p>}
                <button type="submit" style={btnStyle} disabled={loading}>{loading ? "PLEASE WAIT…" : "LOGIN"}</button>
              </form>

              <div style={{ borderTop: "1px solid rgba(201,168,76,0.3)", paddingTop: "30px" }}>
                <h3 style={{ fontSize: "12px", fontWeight: 600, letterSpacing: "2.5px", marginBottom: "14px", color: "#1A1410", textTransform: "uppercase" }}>
                  DON&apos;T HAVE AN ACCOUNT?
                </h3>
                <p style={{ fontSize: "13px", color: "#2A2520", marginBottom: "18px", lineHeight: 1.55, fontFamily: "var(--font-heading)", fontStyle: "italic" }}>
                  Create an account to unlock a world of benefits:
                </p>
                <BenefitsList />
                <button onClick={() => go("signup")} style={btnStyle}>CREATE ACCOUNT</button>
              </div>
            </>
          )}

          {/* ── SIGNUP VIEW ── */}
          {!customer && view === "signup" && (
            <>
              <p style={{ fontSize: "13px", color: "#2A2520", marginBottom: "18px", lineHeight: 1.55, fontFamily: "var(--font-heading)", fontStyle: "italic" }}>
                Create your account to get started:
              </p>
              <BenefitsList />

              <form onSubmit={handleSignup}>
                <div style={{ marginBottom: "14px" }}>
                  <input type="text" placeholder="First name" value={sigFirst}
                    onChange={e => setSigFirst(e.target.value)} required style={inputStyle} />
                </div>
                <div style={{ marginBottom: "14px" }}>
                  <input type="text" placeholder="Last name" value={sigLast}
                    onChange={e => setSigLast(e.target.value)} required style={inputStyle} />
                </div>
                <div style={{ marginBottom: "14px" }}>
                  <input type="tel" placeholder="Phone Number (e.g. 8919273494)" value={sigPhone}
                    onChange={e => setSigPhone(e.target.value)} required style={inputStyle} />
                </div>
                <div style={{ marginBottom: "14px" }}>
                  <input type="password" placeholder="Password (min. 8 characters)" value={sigPw}
                    onChange={e => setSigPw(e.target.value)} required style={inputStyle} />
                </div>
                <div style={{ marginBottom: "18px" }}>
                  <input type="password" placeholder="Confirm password" value={sigPwConfirm}
                    onChange={e => setSigPwConfirm(e.target.value)} required style={inputStyle} />
                </div>
                {error && <p style={{ fontSize: "12px", color: "#c0392b", marginBottom: "12px" }}>{error}</p>}
                <button type="submit" style={btnStyle} disabled={loading}>{loading ? "PLEASE WAIT…" : "CREATE ACCOUNT"}</button>
              </form>

              <div style={{ marginTop: "22px", fontSize: "13px", color: "#2A2520", textAlign: "center" }}>
                Already have an account?{" "}
                <button onClick={() => go("login")} style={linkBtnStyle}>Login</button>
              </div>
            </>
          )}

        </div>
      </div>
    </>
  );
}
