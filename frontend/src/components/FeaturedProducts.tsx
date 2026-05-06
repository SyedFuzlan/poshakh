"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Product } from "@/types";
import { getProducts } from "@/lib/products";

export default function FeaturedProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [hovered, setHovered] = useState<string | null>(null);

  useEffect(() => {
    getProducts().then((all) => setProducts(all.slice(0, 6)));
  }, []);

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
      {/* Heading */}
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

      {/* Product Grid */}
      <div className="fp-grid">
        {products.map((product) => (
          <Link
            key={product.id}
            href={`/products/${product.id}`}
            style={{ textDecoration: "none", color: "inherit" }}
            onMouseEnter={() => setHovered(product.id)}
            onMouseLeave={() => setHovered(null)}
          >
            <div style={{
              background: "#fff",
              overflow: "hidden",
              transition: "box-shadow 0.3s ease, transform 0.3s ease",
              boxShadow: hovered === product.id ? "0 12px 40px rgba(0,0,0,0.12)" : "0 2px 8px rgba(0,0,0,0.05)",
              transform: hovered === product.id ? "translateY(-4px)" : "translateY(0)",
            }}>
              {/* Image */}
              <div style={{ position: "relative", aspectRatio: "3/4", overflow: "hidden", background: "#f0ede8" }}>
                <Image
                  src={product.images[0] || "/images/products/saree1.png"}
                  alt={product.name}
                  fill
                  style={{
                    objectFit: "cover",
                    transition: "transform 0.5s ease",
                    transform: hovered === product.id ? "scale(1.05)" : "scale(1)",
                  }}
                  sizes="(max-width: 768px) 50vw, 33vw"
                />
                <div style={{
                  position: "absolute", top: "12px", left: "12px",
                  background: "#3D0D16", color: "#E0C275",
                  fontSize: "10px", fontWeight: 700, letterSpacing: "2px",
                  textTransform: "uppercase", padding: "4px 10px",
                }}>
                  New
                </div>
              </div>

              {/* Info */}
              <div style={{ padding: "16px 20px 20px" }}>
                <p style={{ fontSize: "11px", color: "#999", letterSpacing: "2px", textTransform: "uppercase", marginBottom: "6px" }}>
                  {product.category}
                </p>
                <h3 style={{
                  fontSize: "15px", fontWeight: 500, color: "#2A2520",
                  marginBottom: "10px", lineHeight: 1.3,
                  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                }}>
                  {product.name}
                </h3>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: "16px", fontWeight: 700, color: "#3D0D16" }}>
                    {product.formattedPrice || `₹${product.price?.toLocaleString("en-IN")}`}
                  </span>
                  <span style={{
                    fontSize: "10px", fontWeight: 600, letterSpacing: "1.5px",
                    textTransform: "uppercase", color: "#C8A367",
                    borderBottom: "1px solid #C8A367", paddingBottom: "1px",
                    opacity: hovered === product.id ? 1 : 0,
                    transition: "opacity 0.3s ease",
                  }}>
                    Shop →
                  </span>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* View More button */}
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
