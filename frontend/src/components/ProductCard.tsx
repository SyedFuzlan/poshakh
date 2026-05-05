import Image from "next/image";
import Link from "next/link";
import { Product } from "@/types";

interface ProductCardProps {
  product: Product;
}

export default function ProductCard({ product }: ProductCardProps) {
  // Fallback image if none are available
  const imageUrl = product.images?.[0] || "/images/products/saree1.png";

  return (
    <div className="group relative overflow-hidden">
      <Link href={`/products/${product.id}`} className="block relative w-full aspect-[3/4] overflow-hidden">
        <Image
          src={imageUrl}
          alt={product.name}
          fill
          sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
          className="object-cover group-hover:scale-105 transition-transform duration-700 ease-in-out"
        />
        {/* Wishlist button — animates up from bottom-right on hover */}
        <button
          className="absolute bottom-[15px] right-[15px] bg-white w-9 h-9 rounded-full flex items-center justify-center text-poshakh-charcoal hover:text-poshakh-maroon shadow-md opacity-0 translate-y-2.5 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300 z-10"
          aria-label="Add to wishlist"
          onClick={(e) => e.preventDefault()}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </button>
      </Link>
      <div className="pt-4 pb-2">
        <Link href={`/products/${product.id}`}>
          <h3 className="font-body text-[14px] text-poshakh-charcoal hover:text-poshakh-maroon transition-colors line-clamp-1">
            {product.name}
          </h3>
        </Link>
        <p className="text-poshakh-gold font-semibold text-[14px] mt-1">{product.formattedPrice}</p>
      </div>
    </div>
  );
}
