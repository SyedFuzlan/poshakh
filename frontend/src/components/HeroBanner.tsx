"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:9000";

export default function HeroBanner() {
  const [heroImg, setHeroImg] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${BACKEND}/api/settings`)
      .then(res => res.json())
      .then(data => {
        if (data.hero_banner_image) {
          setHeroImg(data.hero_banner_image);
        }
      })
      .catch(() => {});
  }, []);

  return (
    <section className="relative w-full overflow-hidden" style={{ marginTop: "-60px" }}>
      <Link href="/products?cat=new" className="block relative w-full">
        {/* Desktop Image */}
        <div className="hidden md:block relative w-full" style={{ height: "calc(100vh - 26px)" }}>
          <Image
            src={heroImg || "/images/hero/zohra/web/hero1_web.png"}
            alt="ZOHRA New Collection"
            fill
            className="object-cover object-top"
            priority
            sizes="100vw"
            quality={90}
          />
        </div>

        {/* Mobile Image */}
        <div className="block md:hidden relative w-full aspect-[4/5]">
          <Image
            src={heroImg || "/images/hero/zohra/mobile/hero1_mobile.png"}
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
