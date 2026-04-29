"use client";
import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { Product } from "@/types";
import { useStore } from "@/store";

export default function ProductDetailClient({ product, whatsappUrl }: { product: Product, whatsappUrl: string }) {
  const { addToCart, setCartOpen } = useStore();

  // Derive stable values — safe even when variants is undefined
  const firstInStock = product?.variants?.find(v => v.stock > 0)?.size ?? null;
  const allOOS = !product?.variants?.length || product.variants.every(v => Number(v.stock) === 0);

  const [selectedSize, setSelectedSize] = useState<string | null>(firstInStock);
  const [isStitching, setIsStitching] = useState<boolean>(false);
  const [activeAccordion, setActiveAccordion] = useState<string>("details");
  const [showStickyBar, setShowStickyBar] = useState(false);

  useEffect(() => {
    const handleScroll = () => setShowStickyBar(window.scrollY > 600);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Guard moved below all hooks — fixes Rules of Hooks violation
  if (!product || !product.images || product.images.length === 0) {
    return <div className="max-w-7xl mx-auto px-6 py-12 text-center">Product not found</div>;
  }

  const handleAddToCart = () => {
    const variant = product.variants?.find(v => v.size === (isStitching ? "XL" : selectedSize));
    const cartItem = {
      id: `${product.id}-${isStitching ? 'custom' : selectedSize}`,
      productId: product.id,
      variantId: variant?.id,
      name: product.name,
      price: product.price,
      quantity: 1,
      image: product.images[0],
      size: isStitching ? 'Custom Stitching' : (selectedSize ?? ''),
    };
    addToCart(cartItem);
    setCartOpen(true);
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">

        {/* Left: Image Gallery */}
        <div className="space-y-4">
          <div className="relative w-full aspect-[3/4] bg-poshakh-cream border border-poshakh-gold/20">
            <Image src={product.images[0]} alt={product.name} fill className="object-cover" />
          </div>
          <div className="grid grid-cols-4 gap-4">
            {product.images.map((img, i) => (
              <div key={i} className="relative aspect-[3/4] bg-poshakh-cream border border-poshakh-gold/10 cursor-pointer opacity-70 hover:opacity-100 transition-opacity">
                 <Image src={img} alt={`Preview ${i}`} fill className="object-cover" />
              </div>
            ))}
          </div>
        </div>

        {/* Right: Interaction Details */}
        <div className="flex flex-col">
          <Link href={`/products?cat=${product.category}`} className="text-poshakh-gold tracking-widest text-sm uppercase mb-3 hover:text-poshakh-maroon transition-colors">{product.category}</Link>
          <h1 className="font-heading text-4xl lg:text-5xl text-poshakh-charcoal font-bold mb-4">{product.name}</h1>
          <p className="text-2xl text-poshakh-maroon font-medium mb-10">{product.formattedPrice}</p>

          {/* Variant Selector Logic */}
          <div className="mb-8">
            <div className="flex justify-between items-center border-b border-poshakh-gold/20 pb-4 mb-6">
              <button
                onClick={() => setIsStitching(false)}
                className={`font-heading tracking-widest uppercase font-bold text-lg pb-4 border-b-2 transition-colors ${!isStitching ? 'border-poshakh-maroon text-poshakh-maroon' : 'border-transparent text-poshakh-charcoal/50 hover:text-poshakh-charcoal'}`}
              >
                Standard Size
              </button>
              <button
                onClick={() => setIsStitching(true)}
                className={`font-heading tracking-widest uppercase font-bold text-lg pb-4 border-b-2 transition-colors ${isStitching ? 'border-poshakh-maroon text-poshakh-maroon' : 'border-transparent text-poshakh-charcoal/50 hover:text-poshakh-charcoal'}`}
              >
                Custom Stitching
              </button>
            </div>

            {!isStitching ? (
              <div className="space-y-4 animate-fade-in-up">
                <div className="flex justify-between items-center text-sm font-semibold text-poshakh-charcoal tracking-wide">
                  <span>Select Size</span>
                  <button className="underline text-poshakh-charcoal/60 hover:text-poshakh-maroon">Size Guide</button>
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
                            ? 'opacity-50 line-through cursor-not-allowed border-poshakh-gold/30 text-poshakh-charcoal/40'
                            : selectedSize === v.size
                              ? 'border-poshakh-maroon bg-poshakh-maroon text-poshakh-gold'
                              : 'border-poshakh-gold/50 text-poshakh-charcoal hover:border-poshakh-maroon hover:text-poshakh-maroon'
                          }`}
                      >
                        {v.size}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="bg-poshakh-cream p-6 border border-poshakh-gold/20 animate-fade-in-up">
                <p className="text-poshakh-charcoal/80 text-sm leading-relaxed mb-4 font-medium">
                  Opt for bespoke tailoring. Our designers will reach out via WhatsApp within 24 hours of placing the order to collect your exact measurements.
                </p>
                <div className="flex items-center gap-2 text-poshakh-maroon font-bold text-sm uppercase tracking-widest">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758a3 3 0 10-4.243 4.243 3 3 0 004.243-4.243zm0-5.758a3 3 0 10-4.243-4.243 3 3 0 004.243 4.243z" /></svg>
                  Includes Free Alterations
                </div>
              </div>
            )}
          </div>

          <div className="mt-4 space-y-4">
            {allOOS ? (
              <button
                disabled
                className="w-full py-5 bg-poshakh-charcoal/30 text-white font-heading tracking-widest text-lg uppercase font-bold cursor-not-allowed"
              >
                Out of Stock
              </button>
            ) : (
              <button
                onClick={handleAddToCart}
                className="w-full py-5 bg-poshakh-maroon text-poshakh-gold font-heading tracking-widest text-lg uppercase font-bold hover:bg-poshakh-maroon-dark transition-colors shadow-lg"
              >
                Add to Cart
              </button>
            )}
            <Link href={whatsappUrl} target="_blank" className="w-full flex items-center justify-center py-5 border border-[#25D366] text-[#25D366] font-heading tracking-widest text-lg uppercase font-bold hover:bg-[#25D366] hover:text-white transition-colors">
              Order on WhatsApp
            </Link>
          </div>

          {/* Accordions */}
          <div className="mt-12 border-t border-poshakh-gold/30">
            {['details', 'shipping'].map((section) => (
              <div key={section} className="border-b border-poshakh-gold/30">
                <button
                  onClick={() => setActiveAccordion(activeAccordion === section ? "" : section)}
                  className="w-full flex justify-between items-center py-5 font-heading text-lg font-bold uppercase tracking-widest text-poshakh-charcoal hover:text-poshakh-maroon transition-colors"
                >
                  {section === 'details' ? 'Product Details' : 'Shipping & Returns'}
                  <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 transition-transform duration-300 ${activeAccordion === section ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </button>
                <div className={`overflow-hidden transition-all duration-500 ease-in-out ${activeAccordion === section ? 'max-h-96 opacity-100 pb-6' : 'max-h-0 opacity-0'}`}>
                  {section === 'details' ? (
                    <p className="text-poshakh-charcoal/80 leading-relaxed">{product.description}</p>
                  ) : (
                    <p className="text-poshakh-charcoal/80 leading-relaxed text-sm">Free shipping across India. Standard dispatch time is 7-10 business days. Custom tailored items require an additional 5 business days. International shipping calculated at checkout.</p>
                  )}
                </div>
              </div>
            ))}
          </div>

        </div>
      </div>

      {/* Sticky Cart Bar (appears when scrolled past 600px) */}
      <div className={`fixed bottom-0 left-0 right-0 bg-white border-t border-poshakh-gold/20 shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.1)] z-40 transform transition-transform duration-500 ${showStickyBar ? 'translate-y-0' : 'translate-y-full'}`}>
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-16 relative border border-poshakh-gold/20 hidden md:block">
              <Image src={product.images[0]} alt={product.name} fill className="object-cover" />
            </div>
            <div>
              <h4 className="font-heading font-bold text-poshakh-charcoal line-clamp-1">{product.name}</h4>
              <p className="text-poshakh-maroon text-sm font-semibold">{product.formattedPrice}</p>
            </div>
          </div>
          {allOOS ? (
            <button
              disabled
              className="bg-poshakh-charcoal/30 text-white font-heading tracking-widest uppercase font-bold px-8 py-3 cursor-not-allowed"
            >
              Out of Stock
            </button>
          ) : (
            <button
              onClick={handleAddToCart}
              className="bg-poshakh-maroon text-poshakh-gold font-heading tracking-widest uppercase font-bold px-8 py-3 hover:bg-poshakh-maroon-dark transition-colors"
            >
              Add to Cart
            </button>
          )}
        </div>
      </div>

    </div>
  );
}
