import HeroBanner from "@/components/HeroBanner";
import CategoryTiles from "@/components/CategoryTiles";
import SecondaryHero from "@/components/SecondaryHero";
import FeaturedProducts from "@/components/FeaturedProducts";
import SocialGrid from "@/components/SocialGrid";

export default function Home() {
  return (
    <>
      <HeroBanner />
      <CategoryTiles />
      <SecondaryHero />
      <FeaturedProducts />
      <SocialGrid />
    </>
  );
}
