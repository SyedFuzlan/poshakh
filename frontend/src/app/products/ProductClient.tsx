"use client";
import { useState } from "react";
import { Product } from "@/types";
import ProductCard from "@/components/ProductCard";

const categoryMeta: Record<string, { label: string; subs: string[] }> = {
  sarees: {
    label: "Sarees",
    subs: ["Casual Sarees", "Half & Half Sarees", "Lehenga Sarees", "Partywear", "Wedding Sarees", "View All Sarees"],
  },
  salwar: {
    label: "Salwar Kameez",
    subs: ["Straight Kurta", "Anarkali", "Palazzo", "Co-ord Sets", "View All"],
  },
  lehenga: {
    label: "Lehengas",
    subs: ["Bridal", "Party", "Mehendi", "View All"],
  },
  new: { label: "New Arrivals", subs: ["View All New Arrivals"] },
  bridal: { label: "Bridal", subs: ["Lehengas", "Sarees", "Sharara", "View All Bridal"] },
  festive: { label: "Festive", subs: ["View All Festive"] },
  bestsellers: { label: "Bestsellers", subs: ["View All Bestsellers"] },
};

export default function ProductClient({
  initialProducts,
  cat,
}: {
  initialProducts: Product[];
  cat?: string;
}) {
  const [selectedFabrics, setSelectedFabrics] = useState<string[]>([]);
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [maxPrice, setMaxPrice] = useState<number>(50000);
  const [isFilterOpen, setFilterOpen] = useState(false);

  const meta = cat
    ? (categoryMeta[cat] ?? { label: cat.toUpperCase(), subs: [] })
    : { label: "All Products", subs: [] };

  const toggleFabric = (f: string) =>
    setSelectedFabrics((prev) => (prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]));
  const toggleColor = (c: string) =>
    setSelectedColors((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));

  const filteredProducts = initialProducts.filter((p) => {
    const matchesPrice = p.price <= maxPrice;
    const text = (p.name + " " + p.description).toLowerCase();
    const matchesFabric =
      selectedFabrics.length === 0 || selectedFabrics.some((f) => text.includes(f.toLowerCase()));
    const matchesColor =
      selectedColors.length === 0 || selectedColors.some((c) => text.includes(c.toLowerCase()));
    return matchesPrice && matchesFabric && matchesColor;
  });

  const filterGroups = (
    <>
      <div style={{ marginBottom: "30px", paddingBottom: "30px", borderBottom: "1px solid #e0e0e0" }}>
        <h3 style={{ fontSize: "16px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "1px", marginBottom: "16px" }}>
          Fabric
        </h3>
        <div className="space-y-3">
          {["Silk", "Georgette", "Velvet", "Net", "Cotton"].map((f) => (
            <label key={f} className="flex items-center gap-2.5 cursor-pointer text-sm text-[#444] hover:text-poshakh-maroon transition-colors">
              <input
                type="checkbox"
                checked={selectedFabrics.includes(f)}
                onChange={() => toggleFabric(f)}
                className="accent-poshakh-maroon"
              />
              {f}
            </label>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: "30px", paddingBottom: "30px", borderBottom: "1px solid #e0e0e0" }}>
        <h3 style={{ fontSize: "16px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "1px", marginBottom: "16px" }}>
          Color
        </h3>
        <div className="space-y-3">
          {["Maroon", "Gold", "Ivory", "Navy", "Pink"].map((c) => (
            <label key={c} className="flex items-center gap-2.5 cursor-pointer text-sm text-[#444] hover:text-poshakh-maroon transition-colors">
              <input
                type="checkbox"
                checked={selectedColors.includes(c)}
                onChange={() => toggleColor(c)}
                className="accent-poshakh-maroon"
              />
              {c}
            </label>
          ))}
        </div>
      </div>

      <div>
        <h3 style={{ fontSize: "16px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "1px", marginBottom: "16px" }}>
          Price Range
        </h3>
        <input
          type="range"
          min="0"
          max="50000"
          step="5000"
          value={maxPrice}
          onChange={(e) => setMaxPrice(parseInt(e.target.value))}
          className="w-full accent-poshakh-maroon"
        />
        <p className="text-sm mt-2 text-[#444] font-medium">
          Under ₹{maxPrice.toLocaleString("en-IN")}
        </p>
      </div>
    </>
  );

  return (
    <div className="max-w-[1440px] mx-auto px-[5%]">
      {/* Page Header */}
      <header className="text-center py-12">
        <h1
          className="font-heading text-poshakh-charcoal mb-6"
          style={{ fontSize: "clamp(36px, 5vw, 56px)", letterSpacing: "2px" }}
        >
          {meta.label}
        </h1>
        {meta.subs.length > 0 && (
          <nav className="flex flex-wrap justify-center gap-6 md:gap-8">
            {meta.subs.map((sub) => (
              <a
                key={sub}
                href="#"
                className="text-[13px] font-semibold tracking-wide text-poshakh-charcoal border-b border-poshakh-charcoal pb-1 uppercase hover:text-poshakh-gold hover:border-poshakh-gold transition-colors"
              >
                {sub}
              </a>
            ))}
          </nav>
        )}
      </header>

      {/* Mobile filter button — hidden at 1024px+ */}
      <button
        onClick={() => setFilterOpen(true)}
        className="lg:hidden w-full flex items-center justify-center gap-2 py-3 border border-poshakh-charcoal font-body font-semibold text-sm tracking-widest uppercase mb-6 hover:bg-poshakh-charcoal hover:text-white transition-colors"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="4" y1="6" x2="20" y2="6" />
          <line x1="8" y1="12" x2="20" y2="12" />
          <line x1="12" y1="18" x2="20" y2="18" />
        </svg>
        Filters
      </button>

      {/* Layout: sidebar + grid */}
      <div className="flex gap-10 items-start pb-20">
        {/* Sidebar — hidden below 1024px */}
        <aside className="hidden lg:block flex-shrink-0" style={{ width: "250px" }}>
          <p className="text-poshakh-charcoal/60 text-sm mb-6">{filteredProducts.length} Results</p>
          {filterGroups}
        </aside>

        {/* Product grid */}
        <main className="flex-1 min-w-0">
          <p className="text-poshakh-charcoal/60 text-sm mb-4 lg:hidden">
            {filteredProducts.length} Results
          </p>

          {filteredProducts.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center border border-dashed border-poshakh-gold/50 bg-poshakh-cream">
              <p className="font-heading text-2xl text-poshakh-charcoal/50 mb-2">No matches found.</p>
              <button
                onClick={() => {
                  setSelectedColors([]);
                  setSelectedFabrics([]);
                  setMaxPrice(50000);
                }}
                className="text-poshakh-maroon font-bold text-sm tracking-widest uppercase hover:underline"
              >
                Clear Filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-[15px] lg:gap-[30px]">
              {filteredProducts.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          )}
        </main>
      </div>

      {/* Mobile Filter Drawer */}
      {isFilterOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-[10000]"
            onClick={() => setFilterOpen(false)}
          />
          <div className="fixed top-0 right-0 h-full bg-white z-[10001] overflow-y-auto flex flex-col" style={{ width: "85%", maxWidth: "350px", padding: "20px" }}>
            <div className="flex justify-between items-center pb-5 mb-5" style={{ borderBottom: "1px solid #eee" }}>
              <span className="font-body font-semibold text-lg tracking-widest uppercase">Filters</span>
              <button
                onClick={() => setFilterOpen(false)}
                aria-label="Close filters"
                className="text-poshakh-charcoal hover:text-poshakh-maroon transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {filterGroups}
            <button
              onClick={() => setFilterOpen(false)}
              className="w-full bg-poshakh-maroon text-white font-body font-semibold tracking-widest uppercase mt-6"
              style={{ padding: "16px" }}
            >
              APPLY FILTERS
            </button>
          </div>
        </>
      )}
    </div>
  );
}
