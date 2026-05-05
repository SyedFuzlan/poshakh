"use client";
import { useEffect } from "react";
import Image from "next/image";

interface SocialModalProps {
  isOpen: boolean;
  post: { img: string; caption: string } | null;
  onClose: () => void;
}

export default function SocialModal({ isOpen, post, onClose }: SocialModalProps) {
  useEffect(() => {
    if (isOpen) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "unset";
    return () => { document.body.style.overflow = "unset"; };
  }, [isOpen]);

  if (!isOpen || !post) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div 
        className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      
      <div className="relative bg-white max-w-4xl w-full flex flex-col md:flex-row overflow-hidden shadow-2xl z-10 animate-fade-in-up">
        {/* Close Button */}
        <button 
          onClick={onClose} 
          className="absolute top-4 right-4 md:text-poshakh-charcoal text-white z-20 hover:text-poshakh-maroon transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Image Side */}
        <div className="relative w-full md:w-3/5 h-[50vh] md:h-[70vh]">
          <Image src={post.img} alt="Instagram Post" fill className="object-cover" />
        </div>

        {/* Caption Side */}
        <div className="w-full md:w-2/5 flex flex-col p-8 bg-poshakh-cream">
          <div className="flex items-center gap-3 border-b border-poshakh-gold/20 pb-4 mb-6">
            <div className="w-10 h-10 rounded-full bg-poshakh-maroon text-poshakh-gold flex justify-center items-center font-bold font-heading">
              P
            </div>
            <span className="font-bold text-poshakh-charcoal tracking-wide">@poshakh_official</span>
          </div>
          <p className="text-poshakh-charcoal/80 flex-grow font-medium leading-relaxed">
            {post.caption}
          </p>
          <a href="#" className="mt-8 block text-center bg-transparent border border-poshakh-maroon text-poshakh-maroon hover:bg-poshakh-maroon hover:text-poshakh-gold transition-colors py-3 uppercase tracking-widest font-heading font-semibold">
            View on Instagram
          </a>
        </div>
      </div>
    </div>
  );
}
