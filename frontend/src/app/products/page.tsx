import { Metadata } from "next";
import { Suspense } from "react";
import ProductsContent from "./ProductsContent";

const CATEGORY_META: Record<string, { title: string; description: string }> = {
  sarees: {
    title: "Designer Sarees Online | Made by Zohra",
    description: "Shop handcrafted designer sarees from Made by Zohra. Premium silk, georgette, and chiffon sarees blending Hyderabadi heritage with modern elegance.",
  },
  lehenga: {
    title: "Bridal & Party Lehengas | Made by Zohra",
    description: "Exquisite lehengas handcrafted in Hyderabad. Explore bridal, festive, and party lehengas with intricate embroidery and royal craftsmanship.",
  },
  anarkali: {
    title: "Anarkali Suits & Dresses | Made by Zohra",
    description: "Elegant Anarkali suits from Made by Zohra. Timeless silhouettes with modern detailing, handcrafted in Hyderabad.",
  },
  sharara: {
    title: "Sharara Sets & Ethnic Wear | Made by Zohra",
    description: "Shop beautiful sharara sets at Made by Zohra. Traditional Hyderabadi craftsmanship meets contemporary fashion.",
  },
  gowns: {
    title: "Designer Ethnic Gowns | Made by Zohra",
    description: "Floor-length designer gowns from Made by Zohra. Elegant fusion wear for weddings, receptions, and festive occasions.",
  },
  bridal: {
    title: "Bridal Wear Collection | Made by Zohra",
    description: "Complete your bridal look with Made by Zohra's exclusive bridal collection. Lehengas, sarees, and anarkalis fit for a Hyderabadi bride.",
  },
  festive: {
    title: "Festive Ethnic Wear | Made by Zohra",
    description: "Celebrate every occasion in style with Made by Zohra's festive collection. Handcrafted ethnic wear for Eid, Diwali, and special occasions.",
  },
  bestsellers: {
    title: "Bestselling Ethnic Wear | Made by Zohra",
    description: "Discover Made by Zohra's most-loved designs. Shop bestselling sarees, lehengas, and anarkalis loved by customers across India.",
  },
};

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ cat?: string }>;
}): Promise<Metadata> {
  const { cat } = await searchParams;
  const meta = cat ? CATEGORY_META[cat] : undefined;

  return {
    title: meta?.title ?? "Shop All Ethnic Wear | Made by Zohra",
    description:
      meta?.description ??
      "Explore the full collection of handcrafted ethnic wear at Made by Zohra. Sarees, lehengas, anarkalis, and more — crafted in Hyderabad.",
    alternates: {
      canonical: cat ? `/products?cat=${cat}` : "/products",
    },
  };
}

export default function ProductsPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-7xl mx-auto px-6 py-12 text-center">Loading...</div>
      }
    >
      <ProductsContent />
    </Suspense>
  );
}
