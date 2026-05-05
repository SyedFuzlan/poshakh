import Link from "next/link";
import Image from "next/image";

const tiles = [
  { id: "new-arrivals", label: "NEW ARRIVALS", link: "/products?cat=new",        image: "/images/products/anarkali_ai.png" },
  { id: "bestsellers",  label: "BESTSELLERS",  link: "/products?cat=bestsellers", image: "/images/products/lehenga2.png" },
  { id: "bridal",       label: "BRIDAL",       link: "/products?cat=bridal",      image: "/images/products/lehenga_ai.png" },
  { id: "festive",      label: "FESTIVE",      link: "/products?cat=festive",     image: "/images/products/sharara_ai.png" },
];

export default function CategoryTiles() {
  return (
    <section className="flex flex-wrap md:flex-nowrap w-full" style={{ height: "auto" }}>
      {tiles.map((tile) => (
        <Link
          key={tile.id}
          href={tile.link}
          className="relative block overflow-hidden group w-1/2 h-[50vh] md:flex-1 md:w-auto md:h-[80vh]"
          style={{ backgroundColor: "#F5EFE6" }}
        >
          {/* Image with 5px gap */}
          <div
            className="absolute overflow-hidden"
            style={{ top: "5px", left: "5px", right: "5px", bottom: "5px" }}
          >
            <Image
              src={tile.image}
              alt={tile.label}
              fill
              className="object-cover transition-transform duration-500 ease-in-out group-hover:scale-[1.04]"
              sizes="(max-width: 768px) 50vw, 25vw"
            />
          </div>
          {/* Label overlay — bottom-left */}
          <div className="absolute inset-0 flex items-end p-8" style={{ zIndex: 10 }}>
            <span
              className="text-white font-body font-medium"
              style={{ fontSize: "14px", letterSpacing: "2px" }}
            >
              {tile.label}
            </span>
          </div>
        </Link>
      ))}
    </section>
  );
}
