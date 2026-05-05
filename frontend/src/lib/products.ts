import { Product } from "@/types";

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:9000";

// Maps category slug → URL param used in the frontend
const CATEGORY_MAP: Record<string, string> = {
  sarees: "sarees",
  salwar: "salwar",
  lehenga: "lehenga",
  gowns: "gowns",
};

// Fallback images by category (used when no products in DB yet)
const FALLBACK_IMAGES_BY_CATEGORY: Record<string, string[]> = {
  sarees:  ["/images/products/saree1.png", "/images/products/saree2.png"],
  salwar:  ["/images/products/anarkali1.png", "/images/products/sharara1.png"],
  lehenga: ["/images/products/lehenga1.png", "/images/products/lehenga2.png"],
  gowns:   ["/images/products/gown1.png"],
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapProduct(p: any): Product {
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

// Static fallback used when backend is not yet running
const staticProducts: Product[] = [
  { id: "1", name: "Maroon Banarasi Silk Saree",   price: 5999,  formattedPrice: "₹5,999",  images: ["/images/products/saree1.png", "/images/products/saree2.png"],     category: "sarees",  description: "A luxurious deep maroon banarasi silk saree with gold zari work." },
  { id: "2", name: "Gold Embroidered Sharara Set",  price: 4499,  formattedPrice: "₹4,499",  images: ["/images/products/sharara1.png", "/images/products/sharara2.png"], category: "salwar",  description: "Elegant cream sharara set with gold embroidery." },
  { id: "3", name: "Ivory Anarkali Suit",           price: 3499,  formattedPrice: "₹3,499",  images: ["/images/products/anarkali1.png"],                                 category: "salwar",  description: "Floor-length ivory Anarkali with delicate embroidery." },
  { id: "4", name: "Blush Pink Bridal Lehenga",     price: 12999, formattedPrice: "₹12,999", images: ["/images/products/lehenga1.png", "/images/products/lehenga2.png"], category: "lehenga", description: "Exquisite blush pink bridal lehenga with zardozi work." },
  { id: "5", name: "Navy Velvet Evening Gown",      price: 4999,  formattedPrice: "₹4,999",  images: ["/images/products/gown1.png"],                                     category: "gowns",   description: "Regal navy velvet indo-western evening gown." },
];

export async function getProducts(cat?: string): Promise<Product[]> {
  try {
    const url = cat && !["new", "bridal", "festive", "bestsellers"].includes(cat)
      ? `${BACKEND}/api/products?category=${encodeURIComponent(cat)}`
      : `${BACKEND}/api/products`;

    const res = await fetch(url, { next: { revalidate: 60 } });
    if (!res.ok) throw new Error(`API error: ${res.status}`);

    const { products } = await res.json();
    const mapped: Product[] = products.map(mapProduct);

    if (mapped.length === 0) {
      return cat ? staticProducts.filter((p) => p.category === cat || ["new","bridal","festive","bestsellers"].includes(cat)) : staticProducts;
    }
    return mapped;
  } catch (err) {
    console.error("Product fetch error, using static fallback:", err);
    if (!cat) return staticProducts;
    if (["new", "bridal", "festive", "bestsellers"].includes(cat)) return staticProducts;
    return staticProducts.filter((p) => p.category === cat);
  }
}

export async function getProductById(id: string): Promise<Product | null> {
  try {
    const res = await fetch(`${BACKEND}/api/products/${id}`, { next: { revalidate: 60 } });
    if (!res.ok) return staticProducts.find((p) => p.id === id) ?? null;
    const { product } = await res.json();
    return mapProduct(product);
  } catch {
    return staticProducts.find((p) => p.id === id) ?? null;
  }
}

export const products = staticProducts;
export const getProductsByCategory = (cat: string) =>
  staticProducts.filter((p) => p.category === cat);
