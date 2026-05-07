import Image from "next/image";
import Link from "next/link";
import { Product } from "@/types";
import { trackEvent } from "./PostHogProvider";

interface ProductCardProps {
  product: Product;
}

export default function ProductCard({ product }: ProductCardProps) {
  // Fallback image if none are available
  const imageUrl = product.images?.[0] || "/images/products/saree1.png";

  return (
    <div className="group relative overflow-hidden">
      <Link 
        href={`/products/${product.slug}`} 
        onClick={() => trackEvent('product_card_clicked', { product_id: product.id, name: product.name, price: product.price })}
        className="block relative w-full aspect-[3/4] overflow-hidden"
      >
        <Image
          src={imageUrl}
          alt={product.name}
          fill
          sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
          className="object-cover group-hover:scale-105 transition-transform duration-700 ease-in-out"
        />
        {product.compare_at_price && (
          <div className="absolute top-3 left-3 bg-zohra-maroon text-zohra-gold text-[10px] font-bold px-2 py-1 tracking-widest uppercase z-10">
            SALE
          </div>
        )}
        
        {product.totalStock === 0 ? (
          <div className="absolute inset-0 bg-white/40 flex items-center justify-center z-10 backdrop-blur-[2px]">
            <div className="bg-white/90 text-zohra-maroon border border-zohra-maroon text-[10px] font-bold px-4 py-2 tracking-[0.2em] uppercase shadow-sm">
              SOLD OUT
            </div>
          </div>
        ) : product.totalStock && product.totalStock < 5 ? (
          <div className="absolute top-3 right-3 bg-zohra-gold text-white text-[9px] font-bold px-2 py-1 tracking-wider uppercase z-10">
            LOW STOCK
          </div>
        ) : null}
        {/* Wishlist button — animates up from bottom-right on hover */}
        <button
          className="absolute bottom-[15px] right-[15px] bg-white w-9 h-9 rounded-full flex items-center justify-center text-zohra-charcoal hover:text-zohra-maroon shadow-md opacity-0 translate-y-2.5 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300 z-10"
          aria-label="Add to wishlist"
          onClick={(e) => {
            e.preventDefault();
            trackEvent('wishlist_added_clicked', { product_id: product.id, name: product.name });
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </button>
      </Link>
      <div className="pt-4 pb-2">
        <Link href={`/products/${product.slug}`}>
          <h3 className="font-body text-[14px] text-zohra-charcoal hover:text-zohra-maroon transition-colors line-clamp-1">
            {product.name}
          </h3>
        </Link>
        <div className="flex items-center gap-2 mt-1">
          <p className="text-zohra-gold font-semibold text-[14px]">{product.formattedPrice}</p>
          {product.compare_at_price && (
            <p className="text-zohra-charcoal/40 line-through text-[12px]">{product.formattedCompareAtPrice}</p>
          )}
        </div>
        
        {/* Color dots if variants have colors */}
        {(() => {
          const colors = Array.from(new Set(product.variants?.map(v => v.color).filter(Boolean)));
          if (colors.length <= 1) return null;
          return (
            <div className="flex gap-1.5 mt-2">
              {colors.slice(0, 5).map((color, i) => (
                <div
                  key={i}
                  className="w-2.5 h-2.5 rounded-full border border-black/10"
                  style={{ backgroundColor: color }}
                />
              ))}
              {colors.length > 5 && <span className="text-[9px] text-zohra-charcoal/50">+{colors.length - 5}</span>}
            </div>
          );
        })()}
      </div>
    </div>
  );
}
