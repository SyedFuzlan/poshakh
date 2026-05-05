"use client";
import { useState } from "react";
import Image from "next/image";
import SocialModal from "./SocialModal";

const instagramPosts = [
  { id: 1,  img: "/images/products/saree1.png",       caption: "@kaysha.raj keeps it light, effortless, and a little bit dreamy in our Off White Embroidered Georgette Sharara.\n\n#Poshakh" },
  { id: 2,  img: "/images/products/anarkali_ai.png",  caption: "Elegance redefined. The perfect ensemble for your next celebration.\n\n#DesignerWear" },
  { id: 3,  img: "/images/products/lehenga_ai.png",   caption: "A timeless classic designed for the modern woman.\n\n#PoshakhDesigns" },
  { id: 4,  img: "/images/products/sharara_ai.png",   caption: "Details that speak for themselves. Zari work perfected.\n\n#Craftsmanship" },
  { id: 5,  img: "/images/products/gown_ai.png",      caption: "Embrace the festive season in style with our latest collection.\n\n#FestiveStyle" },
  { id: 6,  img: "/images/products/lehenga2.png",     caption: "Hand-embroidered florals cascading on luxurious silk.\n\n#SilkSaree" },
  { id: 7,  img: "/images/products/saree1.png",       caption: "Make a statement wherever you go.\n\n#PoshakhBride" },
  { id: 8,  img: "/images/products/anarkali_ai.png",  caption: "The perfect blend of tradition and modernity.\n\n#ClientDiaries" },
  { id: 9,  img: "/images/products/lehenga_ai.png",   caption: "Every thread tells a story of our heritage.\n\n#HeritageCollection" },
  { id: 10, img: "/images/products/sharara_ai.png",   caption: "Ready for the wedding season.\n\n#Poshakh" },
];

export default function SocialGrid() {
  const [selectedPost, setSelectedPost] = useState<{ id: number; img: string; caption: string } | null>(null);

  return (
    <section style={{ backgroundColor: "#061d2d", paddingTop: "40px" }}>
      <div className="text-center" style={{ paddingBottom: "40px" }}>
        <h2
          className="font-heading font-medium italic text-poshakh-gold"
          style={{ fontSize: "36px", letterSpacing: "2px" }}
        >
          @Poshakh
        </h2>
      </div>

      <div
        className="grid w-full grid-cols-2 md:grid-cols-5"
        style={{ gap: 0 }}
      >
        {instagramPosts.map((post) => (
          <div
            key={post.id}
            className="relative cursor-pointer group overflow-hidden"
            style={{ aspectRatio: "1 / 1" }}
            onClick={() => setSelectedPost(post)}
          >
            <Image
              src={post.img}
              alt={`Social Post ${post.id}`}
              fill
              className="object-cover transition-transform duration-500 ease-in-out group-hover:scale-[1.08]"
              sizes="20vw"
            />
            <div
              className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300"
              style={{ background: "rgba(0,0,0,0.4)" }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
                <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
              </svg>
            </div>
          </div>
        ))}
      </div>

      <SocialModal isOpen={!!selectedPost} post={selectedPost} onClose={() => setSelectedPost(null)} />
    </section>
  );
}
