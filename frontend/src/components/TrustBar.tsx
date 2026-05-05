const pillars = [
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
        <line x1="1" y1="10" x2="23" y2="10" />
      </svg>
    ),
    title: "Secure Payments",
    sub: "Razorpay encrypted checkout",
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 12H3l9-9 9 9h-2" />
        <path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
        <path d="M9 21v-6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v6" />
      </svg>
    ),
    title: "Free Shipping",
    sub: "On orders above ₹25,000",
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="23 4 23 10 17 10" />
        <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
      </svg>
    ),
    title: "Easy Returns",
    sub: "7-day hassle-free returns",
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
    title: "100% Authentic",
    sub: "Hyderabadi designer originals",
  },
];

export default function TrustBar() {
  return (
    <section
      style={{
        borderTop: "1px solid rgba(200,163,103,0.2)",
        borderBottom: "1px solid rgba(200,163,103,0.2)",
        background: "#FAF6F0",
        padding: "36px 5%",
      }}
    >
      <div
        style={{
          maxWidth: "1100px",
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "32px",
        }}
      >
        {pillars.map((p) => (
          <div
            key={p.title}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              textAlign: "center",
              gap: "10px",
            }}
          >
            <span style={{ color: "#3D0D16" }}>{p.icon}</span>
            <div>
              <p
                style={{
                  margin: 0,
                  fontSize: "12px",
                  fontWeight: 600,
                  letterSpacing: "1.5px",
                  textTransform: "uppercase",
                  color: "#1A1410",
                }}
              >
                {p.title}
              </p>
              <p
                style={{
                  margin: "4px 0 0",
                  fontSize: "12px",
                  color: "#888",
                  lineHeight: 1.4,
                }}
              >
                {p.sub}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
