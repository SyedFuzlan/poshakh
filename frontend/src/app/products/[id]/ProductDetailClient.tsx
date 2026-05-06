"use client";
import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Product } from "@/types";
import { useStore } from "@/store";
import { getSimilarProducts } from "@/lib/products";
import ProductCard from "@/components/ProductCard";

// ── Color helpers ───────────────────────────────────────────────
const COLOR_SWATCHES: Record<string, string> = {
  red:     "#C62828", maroon: "#7B1C2D", wine: "#6D0F2A",
  pink:    "#F48FB1", rose:   "#EC407A", blush: "#F8BBD0",
  green:   "#388E3C", olive:  "#827717", teal:  "#00695C",
  blue:    "#1565C0", navy:   "#1A237E", sky:   "#0288D1",
  yellow:  "#F9A825", gold:   "#F0A500", mustard: "#E6A817",
  orange:  "#E64A19", rust:   "#BF360C",
  purple:  "#6A1B9A", violet: "#7B1FA2", lavender: "#CE93D8",
  white:   "#F5F5F5", ivory:  "#FFFFF0", cream: "#FFF8E1",
  black:   "#212121", grey:   "#757575", gray:  "#757575",
  brown:   "#5D4037", beige:  "#D7CCC8", copper: "#B87333",
};

function inferColor(name: string): string | null {
  const lower = name.toLowerCase();
  for (const [key, hex] of Object.entries(COLOR_SWATCHES)) {
    if (lower.includes(key)) return hex;
  }
  return null;
}

// ── Component ───────────────────────────────────────────────────
export default function ProductDetailClient({ product }: { product: Product }) {
  const { addToCart, setCartOpen } = useStore();
  const router = useRouter();

  const firstInStock = product?.variants?.find(v => v.stock > 0)?.size ?? null;
  const allOOS = !product?.variants?.length || product.variants.every(v => Number(v.stock) === 0);

  const [selectedSize, setSelectedSize] = useState<string | null>(firstInStock);
  const [isStitching, setIsStitching] = useState<boolean>(false);
  const [activeAccordion, setActiveAccordion] = useState<string>("details");
  const [showStickyBar, setShowStickyBar] = useState(false);
  const [activeImage, setActiveImage] = useState<string>(product?.images?.[0] ?? "");
  const [similar, setSimilar] = useState<Product[]>([]);
  const [siblings, setSiblings] = useState<Product[]>([]);

  useEffect(() => {
    const handleScroll = () => setShowStickyBar(window.scrollY > 600);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Load similar products and siblings
  useEffect(() => {
    if (product?.id && product?.category) {
      getSimilarProducts(product.id, product.category, product.price).then(setSimilar);
      import("@/lib/products").then(lib => {
        lib.getProductSiblings(product).then(setSiblings);
      });
    }
  }, [product]);

  if (!product || !product.images || product.images.length === 0) {
    return <div className="max-w-7xl mx-auto px-6 py-12 text-center">Product not found</div>;
  }

  // ── Color variants: derive from product name
  // const productColor = inferColor(product.name);

  const buildCartItem = () => {
    const variant = isStitching ? undefined : product.variants?.find(v => v.size === selectedSize);
    return {
      id: `${product.id}-${isStitching ? "custom" : selectedSize}`,
      productId: product.id,
      variantId: variant?.id,
      name: product.name,
      price: product.price,
      quantity: 1,
      image: product.images[0],
      size: isStitching ? "Custom Stitching" : (selectedSize ?? ""),
    };
  };

  const handleAddToCart = () => { addToCart(buildCartItem()); setCartOpen(true); };
  const handleBuyNow   = () => { addToCart(buildCartItem()); router.push("/checkout"); };

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">

        {/* Left: Image Gallery */}
        <div className="space-y-4">
          {/* Main image */}
          <div className="relative w-full aspect-[3/4] bg-zohra-cream border border-zohra-gold/20">
            <Image src={activeImage || product.images[0]} alt={product.name} fill className="object-cover" />
          </div>
          {/* Thumbnails — only show if >1 image */}
          {product.images.length > 1 && (
            <div className="grid grid-cols-4 gap-4">
              {product.images.map((img, i) => (
                <button
                  key={i}
                  onClick={() => setActiveImage(img)}
                  className={`relative aspect-[3/4] bg-zohra-cream border transition-all ${activeImage === img ? "border-zohra-maroon" : "border-zohra-gold/10 opacity-70 hover:opacity-100"}`}
                >
                  <Image src={img} alt={`Preview ${i + 1}`} fill className="object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right: Interaction Details */}
        <div className="flex flex-col">
          <Link href={`/products?cat=${product.category}`} className="text-zohra-gold tracking-widest text-sm uppercase mb-3 hover:text-zohra-maroon transition-colors">
            {product.category}
          </Link>
          <h1 className="font-heading text-4xl lg:text-5xl text-zohra-charcoal font-bold mb-4">{product.name}</h1>
          <p className="text-2xl text-zohra-maroon font-medium mb-6">{product.formattedPrice}</p>

          {/* Color variants — show clickable swatches for siblings */}
          {siblings.length > 1 && (
            <div className="mb-6">
              <p className="text-xs font-semibold tracking-widest uppercase text-zohra-charcoal/60 mb-3">Available Colors</p>
              <div className="flex flex-wrap gap-4">
                {siblings.map((sibling) => {
                  const color = inferColor(sibling.name);
                  return (
                    <Link
                      key={sibling.id}
                      href={`/products/${sibling.id}`}
                      className={`group relative w-10 h-10 rounded-full border-2 transition-all p-0.5 ${
                        sibling.id === product.id ? "border-zohra-maroon scale-110 shadow-md" : "border-transparent hover:border-zohra-gold/50"
                      }`}
                      title={sibling.name}
                    >
                      <div
                        className="w-full h-full rounded-full border border-black/5"
                        style={{ backgroundColor: color || "#ccc" }}
                      />
                      <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[10px] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity font-bold text-zohra-charcoal">
                        {sibling.name.split("-").pop()?.trim()}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {/* Variant / Size Selector */}
          <div className="mb-8">
            <div className="flex justify-between items-center border-b border-zohra-gold/20 pb-4 mb-6">
              <button
                onClick={() => setIsStitching(false)}
                className={`font-heading tracking-widest uppercase font-bold text-lg pb-4 border-b-2 transition-colors ${!isStitching ? "border-zohra-maroon text-zohra-maroon" : "border-transparent text-zohra-charcoal/50 hover:text-zohra-charcoal"}`}
              >
                Standard Size
              </button>
              <button
                onClick={() => setIsStitching(true)}
                className={`font-heading tracking-widest uppercase font-bold text-lg pb-4 border-b-2 transition-colors ${isStitching ? "border-zohra-maroon text-zohra-maroon" : "border-transparent text-zohra-charcoal/50 hover:text-zohra-charcoal"}`}
              >
                Custom Stitching
              </button>
            </div>

            {!isStitching ? (
              <div className="space-y-4 animate-fade-in-up">
                <div className="flex justify-between items-center text-sm font-semibold text-zohra-charcoal tracking-wide">
                  <span>Select Size</span>
                  <button className="underline text-zohra-charcoal/60 hover:text-zohra-maroon">Size Guide</button>
                </div>
                <div className="flex gap-4 flex-wrap">
                  {product.variants?.map(v => {
                    const oos = v.stock === 0;
                    return (
                      <button
                        key={v.size}
                        onClick={() => !oos && setSelectedSize(v.size)}
                        disabled={oos}
                        className={`w-14 h-14 border flex items-center justify-center font-bold transition-all
                          ${oos
                            ? "opacity-50 line-through cursor-not-allowed border-zohra-gold/30 text-zohra-charcoal/40"
                            : selectedSize === v.size
                              ? "border-zohra-maroon bg-zohra-maroon text-zohra-gold"
                              : "border-zohra-gold/50 text-zohra-charcoal hover:border-zohra-maroon hover:text-zohra-maroon"
                          }`}
                      >
                        {v.size}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="bg-zohra-cream p-6 border border-zohra-gold/20 animate-fade-in-up">
                <p className="text-zohra-charcoal/80 text-sm leading-relaxed mb-4 font-medium">
                  Opt for bespoke tailoring. Our designers will reach out via WhatsApp within 24 hours of placing the order to collect your exact measurements.
                </p>
                <div className="flex items-center gap-2 text-zohra-maroon font-bold text-sm uppercase tracking-widest">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758a3 3 0 10-4.243 4.243 3 3 0 004.243-4.243zm0-5.758a3 3 0 10-4.243-4.243 3 3 0 004.243 4.243z" />
                  </svg>
                  Includes Free Alterations
                </div>
              </div>
            )}
          </div>

          {/* CTAs */}
          <div className="mt-4 space-y-4">
            {allOOS && !isStitching ? (
              <button disabled className="w-full py-5 bg-zohra-charcoal/30 text-white font-heading tracking-widest text-lg uppercase font-bold cursor-not-allowed">
                Out of Stock
              </button>
            ) : (
              <button onClick={handleAddToCart} className="w-full py-5 bg-zohra-maroon text-zohra-gold font-heading tracking-widest text-lg uppercase font-bold hover:bg-zohra-maroon-dark transition-colors shadow-lg">
                Add to Cart
              </button>
            )}
            <button onClick={handleBuyNow} className="w-full flex items-center justify-center py-5 border border-zohra-maroon text-zohra-maroon font-heading tracking-widest text-lg uppercase font-bold hover:bg-zohra-maroon hover:text-zohra-gold transition-colors">
              Buy Now
            </button>
          </div>

          {/* Accordions */}
          <div className="mt-12 border-t border-zohra-gold/30">
            {["details", "shipping"].map((section) => (
              <div key={section} className="border-b border-zohra-gold/30">
                <button
                  onClick={() => setActiveAccordion(activeAccordion === section ? "" : section)}
                  className="w-full flex justify-between items-center py-5 font-heading text-lg font-bold uppercase tracking-widest text-zohra-charcoal hover:text-zohra-maroon transition-colors"
                >
                  {section === "details" ? "Product Details" : "Shipping & Returns"}
                  <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 transition-transform duration-300 ${activeAccordion === section ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                <div className={`overflow-hidden transition-all duration-500 ease-in-out ${activeAccordion === section ? "max-h-96 opacity-100 pb-6" : "max-h-0 opacity-0"}`}>
                  {section === "details" ? (
                    <p className="text-zohra-charcoal/80 leading-relaxed">{product.description || "Premium quality ethnic wear from ZOHRA."}</p>
                  ) : (
                    <p className="text-zohra-charcoal/80 leading-relaxed text-sm">Free shipping across India. Standard dispatch time is 7–10 business days. Custom tailored items require an additional 5 business days.</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Similar Products ─────────────────────────────────── */}
      {similar.length > 0 && (
        <section className="mt-20 border-t border-zohra-gold/20 pt-16">
          <div className="text-center mb-10">
            <p className="text-xs font-semibold tracking-[4px] text-zohra-gold uppercase mb-3">You May Also Like</p>
            <h2 className="font-heading text-3xl text-zohra-charcoal" style={{ letterSpacing: "2px" }}>Similar Products</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 lg:gap-8">
            {similar.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}

      {/* ── Sticky Cart Bar ───────────────────────────────────── */}
      <div className={`fixed bottom-0 left-0 right-0 bg-white border-t border-zohra-gold/20 shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.1)] z-40 transform transition-transform duration-500 ${showStickyBar ? "translate-y-0" : "translate-y-full"}`}>
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-16 relative border border-zohra-gold/20 hidden md:block">
              <Image src={product.images[0]} alt={product.name} fill className="object-cover" />
            </div>
            <div>
              <h4 className="font-heading font-bold text-zohra-charcoal line-clamp-1">{product.name}</h4>
              <p className="text-zohra-maroon text-sm font-semibold">{product.formattedPrice}</p>
            </div>
          </div>
          {allOOS && !isStitching ? (
            <button disabled className="bg-zohra-charcoal/30 text-white font-heading tracking-widest uppercase font-bold px-8 py-3 cursor-not-allowed">
              Out of Stock
            </button>
          ) : (
            <button onClick={handleAddToCart} className="bg-zohra-maroon text-zohra-gold font-heading tracking-widest uppercase font-bold px-8 py-3 hover:bg-zohra-maroon-dark transition-colors">
              Add to Cart
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
