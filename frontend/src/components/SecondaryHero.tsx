import Image from "next/image";
import Link from "next/link";

export default function SecondaryHero() {
  return (
    <section className="w-full relative overflow-hidden bg-zohra-cream">
      <Link href="/products?cat=sarees" className="block relative w-full">
        {/* Desktop Image */}
        <div className="hidden md:block relative w-full aspect-[21/9] lg:aspect-[21/7]">
          <Image
            src="/images/hero/zohra/web/hero2_web.jpg"
            alt="ZOHRA Collection Showcase"
            fill
            className="object-cover object-center"
            sizes="100vw"
            quality={90}
          />
        </div>
        
        {/* Mobile Image — 4:5 ratio consistent with Hero1 */}
        <div className="block md:hidden relative w-full aspect-[4/5]">
          <Image
            src="/images/hero/zohra/mobile/hero2_mobile.png"
            alt="ZOHRA Collection Showcase"
            fill
            className="object-cover object-center"
            sizes="100vw"
            quality={85}
          />
        </div>
      </Link>
    </section>
  );
}
