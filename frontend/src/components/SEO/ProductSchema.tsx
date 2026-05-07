import { Product } from "@/types";

export default function ProductSchema({ product }: { product: Product }) {
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
      "url": `https://www.madebyzohra.in/products/${product.id}`,
      "priceCurrency": "INR",
      "price": product.price,
      "availability": "https://schema.org/InStock",
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
