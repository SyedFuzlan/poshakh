import { Product } from "@/types";

export default function ProductSchema({ product }: { product: Product }) {
  const slug = product.slug || product.id;
  const totalStock = product.totalStock ?? product.stock ?? 1;
  const availability = totalStock > 0
    ? "https://schema.org/InStock"
    : "https://schema.org/OutOfStock";

  const schema = {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": product.name,
    "image": product.images[0] ? (product.images[0].startsWith('http') ? product.images[0] : `https://www.madebyzohra.in${product.images[0]}`) : "",
    "description": product.description || `Buy ${product.name} at Made by Zohra. Elegant ${product.category} handcrafted in Hyderabad.`,
    "sku": product.id,
    "brand": {
      "@type": "Brand",
      "name": "Made by Zohra"
    },
    "offers": {
      "@type": "Offer",
      "url": `https://www.madebyzohra.in/products/${slug}`,
      "priceCurrency": "INR",
      "price": product.price,
      "availability": availability,
      "itemCondition": "https://schema.org/NewCondition"
    }
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
