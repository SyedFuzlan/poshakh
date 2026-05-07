"use client";
import Image from "next/image";
import Link from "next/link";


export default function HeroBanner() {
  return (
    <section className="relative w-full overflow-hidden" style={{ marginTop: "-60px" }}>
      <Link href="/products?cat=new" className="block relative w-full">
        {/* Desktop Image — returns to original full visual balance */}
        <div className="hidden md:block relative w-full" style={{ height: "calc(100vh - 26px)" }}>
          <Image
            src="/images/hero/zohra/web/hero1_web.png"
            alt="ZOHRA New Collection"
            fill
            className="object-cover object-top"
            priority
            sizes="100vw"
            quality={90}
          />
        </div>
        
        {/* Mobile Image — preserves the corrected 4:5 portrait layout */}
        <div className="block md:hidden relative w-full aspect-[4/5]">
          <Image
            src="/images/hero/zohra/mobile/hero1_mobile.png"
            alt="ZOHRA New Collection"
            fill
            className="object-cover object-center"
            priority
            sizes="100vw"
            quality={85}
          />
        </div>
      </Link>
    </section>
  );
}
