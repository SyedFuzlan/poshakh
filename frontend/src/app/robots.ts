import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/account',
        '/checkout',
        '/api',
        '/order-confirmation',
      ],
    },
    sitemap: 'https://www.madebyzohra.in/sitemap.xml',
  };
}
