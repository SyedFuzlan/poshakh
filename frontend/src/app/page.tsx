import { Metadata } from "next";
import HeroBanner from "@/components/HeroBanner";
import CategoryTiles from "@/components/CategoryTiles";
import SecondaryHero from "@/components/SecondaryHero";
import FeaturedProducts from "@/components/FeaturedProducts";
import SocialGrid from "@/components/SocialGrid";

export const metadata: Metadata = {
  title: "Made by Zohra | Ethnic Wear, Sarees & Elegant Fashion",
  description: "Made by Zohra offers exquisite ethnic designer wear handcrafted in Hyderabad. Explore our collection of premium Sarees, Lehengas, and Anarkalis.",
};

export default function Home() {
  return (
    <>
      <h1 className="sr-only">Made by Zohra - Ethnic Wear, Sarees & Elegant Fashion in Hyderabad</h1>
      <HeroBanner />
      <CategoryTiles />
      <SecondaryHero />
      <FeaturedProducts />
      <SocialGrid />
    </>
  );
}
