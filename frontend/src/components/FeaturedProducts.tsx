import Link from "next/link";
import { getProducts } from "@/lib/products";
import FeaturedProductCard from "./FeaturedProductCard";

export default async function FeaturedProducts() {
  const products = (await getProducts()).slice(0, 6);

  if (products.length === 0) return null;

  return (
    <section style={{ background: "#FAF8F5", padding: "80px 40px" }}>
      <style>{`
        .fp-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
          gap: 28px;
          max-width: 1280px;
          margin: 0 auto 48px;
        }
        @media (max-width: 768px) {
          .fp-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 15px;
            padding: 0 5px;
          }
        }
      `}</style>
      <div style={{ textAlign: "center", marginBottom: "48px" }}>
        <p style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "4px", color: "#C8A367", textTransform: "uppercase", marginBottom: "12px" }}>
          Handpicked for You
        </p>
        <h2 style={{
          fontFamily: "var(--font-heading, serif)",
          fontSize: "clamp(28px, 4vw, 42px)",
          fontWeight: 400,
          color: "#2A2520",
          letterSpacing: "2px",
          lineHeight: 1.2,
        }}>
          New Arrivals
        </h2>
      </div>

      <div className="fp-grid">
        {products.map((product) => (
          <FeaturedProductCard key={product.id} product={product} />
        ))}
      </div>

      <div style={{ textAlign: "center" }}>
        <Link
          href="/products"
          style={{
            display: "inline-block",
            border: "1.5px solid #3D0D16",
            color: "#3D0D16",
            padding: "14px 48px",
            fontSize: "11px",
            fontWeight: 700,
            letterSpacing: "3px",
            textTransform: "uppercase",
            textDecoration: "none",
          }}
        >
          View All Products
        </Link>
      </div>
    </section>
  );
}
