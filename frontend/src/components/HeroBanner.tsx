"use client";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

const slides = [
  {
    image: "/images/hero/hero4.png",
    link: "/products?cat=lehenga",
  },
  // {
  //   image: "/images/hero/hero2.png",
  //   link: "/products?cat=sarees",
  // },
  // {
  //   image: "/images/hero/hero3.png",
  //   link: "/products?cat=anarkali",
  // },
];

export default function HeroBanner() {
  const [current, setCurrent] = useState(0);

  const prev = useCallback(() => setCurrent((c) => (c - 1 + slides.length) % slides.length), []);
  const next = useCallback(() => setCurrent((c) => (c + 1) % slides.length), []);

  useEffect(() => {
    const t = setInterval(next, 5000);
    return () => clearInterval(t);
  }, [next]);

  return (
    <section
      className="relative w-full overflow-hidden cursor-pointer"
      style={{ height: "calc(100vh - 26px)", marginTop: "-60px" }}
    >
      {slides.map((slide, i) => (
        <Link
          key={i}
          href={slide.link}
          className="absolute inset-0 transition-opacity duration-1000 block"
          style={{ opacity: i === current ? 1 : 0, zIndex: i === current ? 1 : 0 }}
          tabIndex={i === current ? 0 : -1}
        >
          <Image
            src={slide.image}
            alt="Poshakh Collection"
            fill
            className="object-cover object-top"
            priority={i === 0}
            sizes="100vw"
          />
        </Link>
      ))}

      {/* Left Arrow */}
      <button
        onClick={(e) => { e.preventDefault(); prev(); }}
        aria-label="Previous slide"
        className="absolute left-5 top-1/2 -translate-y-1/2 text-white opacity-70 hover:opacity-100 transition-opacity p-5 hidden md:block"
        style={{ zIndex: 5 }}
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>

      {/* Right Arrow */}
      <button
        onClick={(e) => { e.preventDefault(); next(); }}
        aria-label="Next slide"
        className="absolute right-5 top-1/2 -translate-y-1/2 text-white opacity-70 hover:opacity-100 transition-opacity p-5 hidden md:block"
        style={{ zIndex: 5 }}
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <polyline points="9 6 15 12 9 18" />
        </svg>
      </button>

      {/* Dots */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-3" style={{ zIndex: 5 }}>
        {slides.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrent(i)}
            aria-label={`Go to slide ${i + 1}`}
            className="w-2 h-2 rounded-full transition-colors duration-300"
            style={{ backgroundColor: i === current ? "white" : "rgba(255,255,255,0.5)" }}
          />
        ))}
      </div>
    </section>
  );
}
