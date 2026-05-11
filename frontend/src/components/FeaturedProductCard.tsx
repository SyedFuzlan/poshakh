"use client";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Product } from "@/types";

export default function FeaturedProductCard({ product }: { product: Product }) {
  const [hovered, setHovered] = useState(false);

  return (
    <Link
      href={`/products/${product.id}`}
      style={{ textDecoration: "none", color: "inherit" }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={{
        background: "#fff",
        overflow: "hidden",
        transition: "box-shadow 0.3s ease, transform 0.3s ease",
        boxShadow: hovered ? "0 12px 40px rgba(0,0,0,0.12)" : "0 2px 8px rgba(0,0,0,0.05)",
        transform: hovered ? "translateY(-4px)" : "translateY(0)",
      }}>
        <div style={{ position: "relative", aspectRatio: "3/4", overflow: "hidden", background: "#f0ede8" }}>
          <Image
            src={product.images[0] || "/images/products/saree1.png"}
            alt={product.name}
            fill
            style={{
              objectFit: "cover",
              transition: "transform 0.5s ease",
              transform: hovered ? "scale(1.05)" : "scale(1)",
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
              opacity: hovered ? 1 : 0,
              transition: "opacity 0.3s ease",
            }}>
              Shop →
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
