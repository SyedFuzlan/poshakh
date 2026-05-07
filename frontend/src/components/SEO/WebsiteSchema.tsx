export default function WebsiteSchema() {
  const schema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "Made by Zohra",
    "url": "https://www.madebyzohra.in",
    "potentialAction": {
      "@type": "SearchAction",
      "target": "https://www.madebyzohra.in/products?q={search_term_string}",
      "query-input": "required name=search_term_string"
    }
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
