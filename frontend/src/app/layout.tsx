import type { Metadata } from "next";
import { Cormorant_Garamond, DM_Sans } from "next/font/google";
import "./globals.css";
import AnnouncementBar from "@/components/AnnouncementBar";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import AccountDrawer from "@/components/AccountDrawer";
import CartDrawer from "@/components/CartDrawer";
import SessionProvider from "@/components/SessionProvider";
import OrganizationSchema from "@/components/SEO/OrganizationSchema";
import WebsiteSchema from "@/components/SEO/WebsiteSchema";

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  style: ["normal", "italic"],
});

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://www.madebyzohra.in"),
  title: {
    default: "Made by Zohra | Ethnic Wear, Sarees & Elegant Fashion",
    template: "%s | Made by Zohra"
  },
  description: "Exquisite ethnic designer wear handcrafted in Hyderabad. Explore our curated collection of Sarees, Lehengas, and Anarkalis blending royal heritage with modern sensibility.",
  keywords: ["Made by Zohra", "Zohra clothing", "Zohra sarees", "designer wear Hyderabad", "ethnic wear", "Indian fashion", "handcrafted sarees"],
  authors: [{ name: "Zohra" }],
  creator: "Made by Zohra",
  publisher: "Made by Zohra",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: "https://www.madebyzohra.in",
    siteName: "Made by Zohra",
    title: "Made by Zohra | Ethnic Wear, Sarees & Elegant Fashion",
    description: "Exquisite ethnic designer wear handcrafted in Hyderabad. Explore Sarees, Lehengas, and Anarkalis.",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "Made by Zohra - Hyderabadi Designer Wear",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Made by Zohra | Ethnic Wear, Sarees & Elegant Fashion",
    description: "Exquisite ethnic designer wear handcrafted in Hyderabad. Explore Sarees, Lehengas, and Anarkalis.",
    images: ["/og-image.jpg"],
  },
  alternates: {
    canonical: "/",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${cormorant.variable} ${dmSans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-body bg-zohra-cream text-zohra-charcoal selection:bg-zohra-maroon selection:text-zohra-gold overflow-x-hidden">
        <OrganizationSchema />
        <WebsiteSchema />
        <SessionProvider>
          <AnnouncementBar />
          <Navbar />
          <main className="flex-grow relative">
            {children}
          </main>
          <Footer />
          <AccountDrawer />
          <CartDrawer />
        </SessionProvider>
      </body>
    </html>
  );
}
