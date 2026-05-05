"use client";
import Link from "next/link";
import { useEffect } from "react";
import { useStore } from "@/store";

interface MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function MobileDrawer({ isOpen, onClose }: MobileDrawerProps) {
  const { customer } = useStore();
  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/60 transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />
      
      {/* Drawer */}
      <div className="relative w-4/5 max-w-sm bg-poshakh-cream h-full shadow-2xl flex flex-col transform transition-transform duration-300">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-poshakh-gold/20">
          <span className="font-heading text-2xl tracking-widest font-bold text-poshakh-maroon">MENU</span>
          <button onClick={onClose} className="text-poshakh-maroon hover:text-poshakh-gold transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Links */}
        <div className="flex flex-col py-6 overflow-y-auto font-heading uppercase text-lg tracking-widest text-poshakh-charcoal">
          <Link href="/products?cat=sarees" onClick={onClose} className="px-6 py-4 border-b border-poshakh-gold/10 hover:text-poshakh-maroon">Sarees</Link>
          <Link href="/products?cat=sharara" onClick={onClose} className="px-6 py-4 border-b border-poshakh-gold/10 hover:text-poshakh-maroon">Sharara</Link>
          <Link href="/products?cat=anarkali" onClick={onClose} className="px-6 py-4 border-b border-poshakh-gold/10 hover:text-poshakh-maroon">Anarkali</Link>
          <Link href="/products?cat=lehenga" onClick={onClose} className="px-6 py-4 border-b border-poshakh-gold/10 hover:text-poshakh-maroon">Lehenga</Link>
          <Link href="/products?cat=gowns" onClick={onClose} className="px-6 py-4 border-b border-poshakh-gold/10 hover:text-poshakh-maroon">Gowns</Link>
        </div>

        {/* Bottom Actions */}
        <div className="mt-auto p-6 bg-poshakh-maroon/5 flex flex-col gap-4">
          <Link href="/account" onClick={onClose} className="flex items-center justify-center w-full py-4 border border-poshakh-maroon text-poshakh-maroon font-semibold tracking-wider hover:bg-poshakh-maroon hover:text-poshakh-gold transition-colors">
            {customer ? `MY ACCOUNT (${customer.firstName || customer.phone || "Profile"})` : "SIGN IN / REGISTER"}
          </Link>
          <Link href="/account?tab=wishlist" onClick={onClose} className="flex items-center justify-center w-full py-4 bg-poshakh-maroon text-poshakh-gold font-semibold tracking-wider hover:bg-poshakh-maroon-dark transition-colors">
            MY WISHLIST
          </Link>
        </div>
      </div>
    </div>
  );
}
