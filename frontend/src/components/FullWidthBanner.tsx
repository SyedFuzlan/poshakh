import Link from "next/link";
import Image from "next/image";

export default function FullWidthBanner() {
  return (
    <section className="relative w-full h-[60vh] overflow-hidden my-20">
      <Image 
        src="/images/products/gown_ai.png" 
        alt="The Grand Finale" 
        fill 
        className="object-cover"
        // Adjust standard focal point
        style={{ objectPosition: 'center top' }}
      />
      <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center text-center px-4">
        <span className="text-poshakh-gold font-body tracking-[0.3em] font-semibold text-sm mb-4">
          EXCLUSIVE COLLECTION
        </span>
        <h2 className="font-heading text-5xl md:text-7xl text-white font-bold mb-8">
          The Grand Finale
        </h2>
        <Link 
          href="/products?cat=gowns" 
          className="bg-poshakh-cream text-poshakh-charcoal px-10 py-4 font-heading tracking-widest font-bold hover:bg-poshakh-gold hover:text-white transition-colors"
        >
          EXPLORE
        </Link>
      </div>
    </section>
  );
}
