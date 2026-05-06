"use client";
import { useRouter } from "next/navigation";
import { useStore } from "@/store";
import { removeLineItem, updateLineItem } from "@/lib/cart";
import Image from "next/image";
import Link from "next/link";

export default function CartDrawer() {
  const { isCartOpen, setCartOpen, cart, cartId, removeFromCart, updateQuantity } = useStore();
  const router = useRouter();

  const handleCheckout = () => {
    setCartOpen(false);
    router.push("/checkout");
  };

  const handleRemove = (itemId: string, lineItemId?: string) => {
    removeFromCart(itemId);
    if (cartId && lineItemId) {
      removeLineItem(cartId, lineItemId).catch(() => {});
    }
  };

  const handleQtyChange = (itemId: string, newQty: number, lineItemId?: string) => {
    updateQuantity(itemId, newQty);
    if (cartId && lineItemId) {
      if (newQty <= 0) {
        removeLineItem(cartId, lineItemId).catch(() => {});
      } else {
        updateLineItem(cartId, lineItemId, newQty).catch(() => {});
      }
    }
  };

  const FREE_SHIPPING_THRESHOLD = 25000;
  const subtotal = cart.reduce((total, item) => total + (item.price * item.quantity), 0);
  const amountAway = FREE_SHIPPING_THRESHOLD - subtotal;
  const progressPercent = Math.min((subtotal / FREE_SHIPPING_THRESHOLD) * 100, 100);

  if (!isCartOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/60 transition-opacity" onClick={() => setCartOpen(false)} />
      
      {/* Drawer */}
      <div className="relative w-full max-w-md bg-zohra-cream h-full flex flex-col shadow-2xl animate-slide-in-right z-10">
        <div className="flex items-center justify-between p-6 border-b border-zohra-gold/20 bg-white">
          <span className="font-heading text-2xl tracking-widest font-bold text-zohra-charcoal uppercase">My Bag ({cart.length})</span>
          <button onClick={() => setCartOpen(false)} className="text-zohra-charcoal hover:text-zohra-maroon transition-colors">
             <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Psychological Gamification Bar */}
        <div className="p-6 bg-zohra-maroon/5 border-b border-zohra-gold/10">
          <p className="text-center font-semibold text-zohra-charcoal text-sm mb-3 tracking-wide">
            {subtotal >= FREE_SHIPPING_THRESHOLD 
              ? "🎉 You have achieved FREE EXPEDITED SHIPPING!" 
              : `You're exactly ₹${amountAway.toLocaleString('en-IN')} away from FREE SHIPPING.`}
          </p>
          <div className="w-full bg-zohra-gold/30 h-1.5 rounded-full overflow-hidden">
            <div 
              className="bg-zohra-maroon h-full transition-all duration-1000 ease-out" 
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Dynamic Cart Items */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-zohra-charcoal/50">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
              <p className="font-bold tracking-wider font-heading uppercase text-lg">Your Bag is empty</p>
              <Link href="/products" onClick={() => setCartOpen(false)} className="mt-8 border border-zohra-maroon text-zohra-maroon uppercase tracking-widest font-semibold px-8 py-3 hover:bg-zohra-maroon hover:text-zohra-gold transition-colors">Start Shopping</Link>
            </div>
          ) : (
            cart.map(item => (
              <div key={item.id} className="flex gap-4 items-start bg-white p-3 border border-zohra-gold/10 shadow-sm">
                <div className="relative w-20 h-28 flex-shrink-0 border border-zohra-gold/20">
                  <Image src={item.image || "/images/products/saree1.png"} alt={item.name} fill className="object-cover" />
                </div>
                <div className="flex-1">
                  <h4 className="font-heading font-semibold text-zohra-charcoal line-clamp-1">{item.name}</h4>
                  <p className="text-zohra-charcoal/60 text-xs mt-1 uppercase tracking-wider">Size: {item.size || 'Custom Stitch'}</p>
                  <p className="text-zohra-maroon font-bold mt-2">₹{item.price.toLocaleString('en-IN')}</p>
                  <div className="flex items-center gap-2 mt-3">
                    <button onClick={() => handleQtyChange(item.id, item.quantity - 1, item.lineItemId)} className="w-7 h-7 border border-zohra-gold/40 text-zohra-charcoal flex items-center justify-center hover:border-zohra-maroon hover:text-zohra-maroon transition-colors font-bold">−</button>
                    <span className="w-6 text-center text-sm font-semibold text-zohra-charcoal">{item.quantity}</span>
                    <button onClick={() => handleQtyChange(item.id, item.quantity + 1, item.lineItemId)} className="w-7 h-7 border border-zohra-gold/40 text-zohra-charcoal flex items-center justify-center hover:border-zohra-maroon hover:text-zohra-maroon transition-colors font-bold">+</button>
                  </div>
                </div>
                <button onClick={() => handleRemove(item.id, item.lineItemId)} className="text-zohra-charcoal/40 hover:text-red-500 p-1 transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {cart.length > 0 && (
          <div className="p-6 bg-white border-t border-zohra-gold/20 shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.1)]">
            <div className="flex justify-between font-heading text-xl font-bold text-zohra-charcoal mb-2">
              <span>Subtotal</span>
              <span>₹{subtotal.toLocaleString('en-IN')}</span>
            </div>
            <p className="text-xs text-zohra-charcoal/60 text-center mb-6">Taxes and shipping calculated at checkout</p>
            <button
              onClick={handleCheckout}
              className="w-full bg-zohra-maroon text-zohra-gold font-heading tracking-widest font-bold uppercase py-4 hover:bg-zohra-maroon-dark transition-colors shadow-md"
            >
              SECURE CHECKOUT
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
