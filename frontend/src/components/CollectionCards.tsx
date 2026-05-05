import Image from "next/image";
import Link from "next/link";

const collections = [
  { name: 'Rosalie',  image: '/images/hero/hero1.png',          link: '/products?cat=lehenga' },
  { name: 'Noor',     image: '/images/hero/hero2.png',          link: '/products?cat=sarees' },
  { name: 'Zarina',   image: '/images/hero/hero3.png',          link: '/products?cat=anarkali' },
  { name: 'Gulbahar', image: '/images/products/sharara_ai.png', link: '/products?cat=sharara' },
  { name: 'Tarang',   image: '/images/products/gown_ai.png',    link: '/products?cat=gowns' },
  { name: 'Bandhan',  image: '/images/products/lehenga_ai.png', link: '/products?cat=lehenga' },
];

export default function CollectionCards() {
  return (
    <section className="bg-white w-full">
      {/* Desktop: 3-col | Mobile: 2-col */}
      <div
        className="hidden sm:grid w-full"
        style={{ gridTemplateColumns: "repeat(3, 1fr)", gap: "0.35rem" }}
      >
        {collections.map((col) => (
          <Link key={col.name} href={col.link} className="group relative overflow-hidden block">
            <div className="relative w-full" style={{ aspectRatio: "3/4" }}>
              <Image
                src={col.image}
                alt={col.name}
                fill
                className="object-cover object-top group-hover:scale-[1.03] transition-transform duration-700 ease-in-out"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 pb-6 text-center">
                <span
                  className="text-white font-body font-light uppercase"
                  style={{ fontSize: "0.75rem", letterSpacing: "0.18em" }}
                >
                  {col.name}
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Mobile: 2-col grid */}
      <div
        className="grid sm:hidden w-full"
        style={{ gridTemplateColumns: "repeat(2, 1fr)", gap: "0.35rem" }}
      >
        {collections.map((col) => (
          <Link key={col.name} href={col.link} className="group relative overflow-hidden block">
            <div className="relative w-full" style={{ aspectRatio: "3/4" }}>
              <Image
                src={col.image}
                alt={col.name}
                fill
                className="object-cover object-top group-hover:scale-[1.03] transition-transform duration-700 ease-in-out"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 pb-5 text-center">
                <span
                  className="text-white font-body font-light uppercase"
                  style={{ fontSize: "0.65rem", letterSpacing: "0.15em" }}
                >
                  {col.name}
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
