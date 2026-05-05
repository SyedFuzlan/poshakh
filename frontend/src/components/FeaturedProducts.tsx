import { products } from "@/lib/products";
import ProductCard from "./ProductCard";

export default function FeaturedProducts() {
  const featured = products.slice(0, 4);

  return (
    <section className="bg-white py-14 px-5">
      <div className="max-w-[1440px] mx-auto">

        {/* Section heading — same style as lashkaraa.in section headers */}
        <div className="flex items-center gap-4 mb-8">
          <div className="flex-1 h-px bg-black/10" />
          <h2
            className="font-body font-medium uppercase text-[#343434] whitespace-nowrap"
            style={{ fontSize: "0.7rem", letterSpacing: "0.2em" }}
          >
            The Edit
          </h2>
          <div className="flex-1 h-px bg-black/10" />
        </div>

        <div
          className="grid"
          style={{ gridTemplateColumns: "repeat(4, 1fr)", gap: "0.35rem" }}
        >
          {featured.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>

        <div className="mt-10 text-center">
          <a
            href="/products"
            className="inline-block border border-[#343434] text-[#343434] font-body font-medium uppercase hover:bg-[#343434] hover:text-white transition-colors duration-200"
            style={{ fontSize: "0.7rem", letterSpacing: "0.15em", padding: "0.65rem 1.75rem" }}
          >
            View All
          </a>
        </div>
      </div>
    </section>
  );
}
