import { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProductById, getProducts } from "@/lib/products";
import ProductDetailClient from "./ProductDetailClient";
import ProductSchema from "@/components/SEO/ProductSchema";

export async function generateStaticParams() {
  try {
    const products = await getProducts();
    return products.map((product) => ({
      id: product.slug || product.id,
    }));
  } catch (error) {
    console.error("Error generating static params:", error);
    return [];
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const product = await getProductById(id);

  if (!product) return {};

  const title = product.meta_title || `${product.name} | Made by Zohra`;
  const description = product.meta_description || product.description || `Exquisite ${product.name} from Made by Zohra. Handcrafted in Hyderabad.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: product.images,
    },
    alternates: {
      canonical: `/products/${product.slug || product.id}`,
    },
  };
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const product = await getProductById(id);

  if (!product) {
    notFound();
  }

  return (
    <>
      <ProductSchema product={product} />
      <ProductDetailClient key={product.id} product={product} />
    </>
  );
}
