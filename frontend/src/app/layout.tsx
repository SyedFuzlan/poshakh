import type { Metadata } from "next";
import { Cormorant_Garamond, DM_Sans } from "next/font/google";
import "./globals.css";
import AnnouncementBar from "@/components/AnnouncementBar";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import AccountDrawer from "@/components/AccountDrawer";
import CartDrawer from "@/components/CartDrawer";
import SessionProvider from "@/components/SessionProvider";

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
  title: "POSHAKH — Hyderabadi Designer Wear",
  description: "Exquisite ethnic designer wear handcrafted in Hyderabad. Explore Sarees, Lehengas, and Anarkalis.",
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
      <body className="min-h-full flex flex-col font-body bg-poshakh-cream text-poshakh-charcoal selection:bg-poshakh-maroon selection:text-poshakh-gold overflow-x-hidden">
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
