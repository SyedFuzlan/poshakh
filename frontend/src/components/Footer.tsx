import Link from "next/link";

export default function Footer() {
  return (
    <footer className="bg-poshakh-maroon text-poshakh-gold-soft font-body" style={{ padding: "60px 0 0" }}>
      <div
        className="max-w-[1400px] mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10"
        style={{ padding: "0 40px", marginBottom: "40px" }}
      >
        {/* About */}
        <div>
          <h3 style={{ fontSize: "14px", fontWeight: 600, letterSpacing: "2px", marginBottom: "24px", textTransform: "uppercase", color: " #C8A367" }}>
            About Poshakh
          </h3>
          <p style={{ fontSize: "13px", lineHeight: 1.6, color: "#F6EFE3" }}>
            Born in the heart of Hyderabad, Poshakh celebrates the timeless elegance of Nawabi fashion. Every piece is handcrafted with love, blending royal heritage with modern sensibility.
          </p>
        </div>

        {/* Shop */}
        <div>
          <h3 style={{ fontSize: "14px", fontWeight: 600, letterSpacing: "2px", marginBottom: "24px", textTransform: "uppercase", color: " #C8A367" }}>
            Shop
          </h3>
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {[
              { label: "Sarees", href: "/products?cat=sarees" },
              { label: "Sharara Sets", href: "/products?cat=sharara" },
              { label: "Anarkali", href: "/products?cat=anarkali" },
              { label: "Lehenga", href: "/products?cat=lehenga" },
              { label: "Gowns", href: "/products?cat=gowns" },
            ].map((item) => (
              <li key={item.href} style={{ marginBottom: "12px" }}>
                <Link href={item.href} className="text-poshakh-varwhite hover:opacity-70 transition-opacity" style={{ fontSize: "13px" }}>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Customer Care */}
        <div>
          <h3 style={{ fontSize: "14px", fontWeight: 600, letterSpacing: "2px", marginBottom: "24px", textTransform: "uppercase", color: " #C8A367" }}>
            Customer Care
          </h3>
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {["Shipping & Delivery", "Returns & Exchange", "Size Guide", "Track Order", "Contact Us"].map((item) => (
              <li key={item} style={{ marginBottom: "12px" }}>
                <a href="#" className="text-poshakh-varwhite hover:opacity-70 transition-opacity" style={{ fontSize: "13px" }}>
                  {item}
                </a>
              </li>
            ))}
          </ul>
        </div>

        {/* Follow Us */}
        <div>
          <h3 style={{ fontSize: "14px", fontWeight: 600, letterSpacing: "2px", marginBottom: "24px", textTransform: "uppercase", color: " #C8A367" }}>
            Follow Us
          </h3>
          <div style={{ display: "flex", gap: "16px" }}>
            {/* Instagram */}
            <a href="#" aria-label="Instagram" className="text-poshakh-varwhite hover:opacity-70 transition-opacity">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
              </svg>
            </a>
            {/* Facebook */}
            <a href="#" aria-label="Facebook" className="text-poshakh-varwhite hover:opacity-70 transition-opacity">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
              </svg>
            </a>
            {/* WhatsApp */}
            <a href="https://wa.me/919999999999" aria-label="WhatsApp" className="text-poshakh-varwhite hover:opacity-70 transition-opacity">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
            </a>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div
        className="text-center"
        style={{
          paddingTop: "24px",
          paddingBottom: "24px",
          marginTop: "0",
          borderTop: "1px solid rgba(201,168,76,0.2)",
          fontSize: "12px",
          letterSpacing: "1px",
          color: "#C8A367",
        }}
      >
        &copy; {new Date().getFullYear()} POSHAKH — Hyderabadi Designer Wear. All rights reserved.
      </div>
    </footer>
  );
}
