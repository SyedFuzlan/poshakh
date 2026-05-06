import { Product } from "@/types";

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:9000";

// Fallback images by category — used only when a DB product has no uploaded image
const FALLBACK_IMAGES_BY_CATEGORY: Record<string, string[]> = {
  sarees:  ["/images/products/saree1.png", "/images/products/saree2.png"],
  salwar:  ["/images/products/anarkali1.png", "/images/products/sharara1.png"],
  lehenga: ["/images/products/lehenga1.png", "/images/products/lehenga2.png"],
  gowns:   ["/images/products/gown1.png"],
};

interface RawProduct {
  id: number | string;
  name: string;
  price: number;
  formattedPrice: string;
  images?: string[];
  category: string;
  description?: string;
  variants?: any[];
}

function mapProduct(p: RawProduct): Product {
  return {
    id:             String(p.id),
    name:           p.name,
    price:          p.price,
    formattedPrice: p.formattedPrice,
    images:         p.images?.length ? p.images : (FALLBACK_IMAGES_BY_CATEGORY[p.category] ?? ["/images/products/saree1.png"]),
    category:       p.category as Product["category"],
    description:    p.description ?? "",
    variants:       p.variants ?? [],
  };
}

export async function getProducts(cat?: string): Promise<Product[]> {
  try {
    const url = cat && !["new", "bridal", "festive", "bestsellers"].includes(cat)
      ? `${BACKEND}/api/products?category=${encodeURIComponent(cat)}`
      : `${BACKEND}/api/products`;

    const res = await fetch(url, { next: { revalidate: 60 } });
    if (!res.ok) throw new Error(`API error: ${res.status}`);

    const { products: raw } = await res.json();
    return raw.map(mapProduct);
  } catch (err) {
    console.error("Product fetch error:", err);
    // No dummy fallback — return empty so we never show fake products
    return [];
  }
}

export async function getProductById(id: string): Promise<Product | null> {
  try {
    const res = await fetch(`${BACKEND}/api/products/${id}`, { next: { revalidate: 60 } });
    if (!res.ok) return null;
    const { product } = await res.json();
    return mapProduct(product);
  } catch {
    return null;
  }
}

// Fetch similar products: same category and/or similar price range, excluding current product, max 8 items
export async function getSimilarProducts(productId: string, category: string, price?: number): Promise<Product[]> {
  try {
    const url = `${BACKEND}/api/products?category=${encodeURIComponent(category)}`;
    const res = await fetch(url, { next: { revalidate: 60 } });
    if (!res.ok) return [];
    const { products: raw } = await res.json();
    
    let products = (raw as RawProduct[]).map(mapProduct).filter((p: Product) => p.id !== productId);
    
    if (price) {
      // Filter products within +/- 30% price range
      const min = price * 0.7;
      const max = price * 1.3;
      products = products.filter(p => p.price >= min && p.price <= max);
      
      // Sort by price proximity
      products.sort((a, b) => Math.abs(a.price - price) - Math.abs(b.price - price));
    }
    
    return products.slice(0, 8);
  } catch {
    return [];
  }
}

// Fetch products with the same base name (ignoring color) for variant switching
export async function getProductSiblings(product: Product): Promise<Product[]> {
  try {
    // Get all products in same category
    const url = `${BACKEND}/api/products?category=${encodeURIComponent(product.category)}`;
    const res = await fetch(url, { next: { revalidate: 60 } });
    if (!res.ok) return [];
    const { products: raw } = await res.json();
    
    const allInCat = (raw as RawProduct[]).map(mapProduct);
    
    // Simple heuristic: siblings have same base name
    // (e.g. "Saree - Red" and "Saree - Blue" both have "Saree")
    const getBaseName = (name: string) => name.split(/[\s-]+/)[0].toLowerCase();
    const base = getBaseName(product.name);
    
    return allInCat.filter(p => getBaseName(p.name) === base);
  } catch {
    return [];
  }
}

// Legacy no-op exports — kept so any import of these names doesn't break
export const products: Product[] = [];
export const getProductsByCategory = (): Product[] => [];
