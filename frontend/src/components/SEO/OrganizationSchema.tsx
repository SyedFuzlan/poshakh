export default function OrganizationSchema() {
  const schema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "Made by Zohra",
    "url": "https://www.madebyzohra.in",
    "logo": "https://www.madebyzohra.in/logo.png",
    "description": "Exquisite ethnic designer wear handcrafted in Hyderabad. Made by Zohra celebrates Timeless Elegance and royal heritage.",
    "address": {
      "@type": "PostalAddress",
      "addressLocality": "Hyderabad",
      "addressRegion": "Telangana",
      "addressCountry": "IN"
    },
    "sameAs": [
      "https://www.instagram.com/madebyzohra",
      "https://www.facebook.com/madebyzohra"
    ]
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
