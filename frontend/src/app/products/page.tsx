"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { getProducts } from "@/lib/products";
import ProductClient from "./ProductClient";
import { Product } from "@/types";

function ProductsContent() {
  const searchParams = useSearchParams();
  const cat = searchParams.get("cat") ?? undefined;
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getProducts(cat).then((p) => {
      setProducts(p);
      setLoading(false);
    });
  }, [cat]);

  if (loading) {
    return <div className="max-w-7xl mx-auto px-6 py-12 text-center">Loading products...</div>;
  }

  return <ProductClient initialProducts={products} cat={cat} />;
}

export default function ProductsPage() {
  return (
    <Suspense fallback={<div className="max-w-7xl mx-auto px-6 py-12 text-center">Loading...</div>}>
      <ProductsContent />
    </Suspense>
  );
}
