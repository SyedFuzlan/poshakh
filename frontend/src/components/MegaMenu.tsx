import Link from 'next/link';
import Image from 'next/image';

interface MegaMenuProps {
  isOpen: boolean;
  category: string;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

export default function MegaMenu({ isOpen, category, onMouseEnter, onMouseLeave }: MegaMenuProps) {
  if (!isOpen) return null;

  return (
    <div 
      className="absolute top-[102%] left-0 w-[100vw] bg-poshakh-cream border-t border-poshakh-gold/20 shadow-2xl z-50 transition-all duration-300 origin-top"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="max-w-7xl mx-auto px-6 py-12 flex justify-between">
        
        {/* Left Side: Matrix Categorization */}
        <div className="flex gap-20 font-body">
          <div className="space-y-4">
            <h4 className="font-heading uppercase text-poshakh-charcoal font-bold tracking-widest border-b border-poshakh-maroon/20 pb-2">Shop By Style</h4>
            <ul className="space-y-3 text-poshakh-charcoal/80 text-sm flex flex-col font-medium">
              <Link href={`/products?cat=${category}&style=classic`} className="hover:text-poshakh-maroon transition-colors">Classic {category}</Link>
              <Link href={`/products?cat=${category}&style=ruffle`} className="hover:text-poshakh-maroon transition-colors">Ruffle Draped</Link>
              <Link href={`/products?cat=${category}&style=indowestern`} className="hover:text-poshakh-maroon transition-colors">Indo-Western</Link>
            </ul>
          </div>
          
          <div className="space-y-4">
            <h4 className="font-heading uppercase text-poshakh-charcoal font-bold tracking-widest border-b border-poshakh-maroon/20 pb-2">Shop By Fabric</h4>
            <ul className="space-y-3 text-poshakh-charcoal/80 text-sm flex flex-col font-medium">
              <Link href={`/products?cat=${category}&fabric=silk`} className="hover:text-poshakh-maroon transition-colors">Banarasi Silk</Link>
              <Link href={`/products?cat=${category}&fabric=georgette`} className="hover:text-poshakh-maroon transition-colors">Georgette</Link>
              <Link href={`/products?cat=${category}&fabric=velvet`} className="hover:text-poshakh-maroon transition-colors">Velvet</Link>
            </ul>
          </div>

          <div className="space-y-4">
            <h4 className="font-heading uppercase text-poshakh-charcoal font-bold tracking-widest border-b border-poshakh-maroon/20 pb-2">Shop By Occasion</h4>
            <ul className="space-y-3 text-poshakh-charcoal/80 text-sm flex flex-col font-medium">
              <Link href={`/products?cat=${category}&occ=bridal`} className="hover:text-poshakh-maroon transition-colors">Bridal Wear</Link>
              <Link href={`/products?cat=${category}&occ=sangeet`} className="hover:text-poshakh-maroon transition-colors">Sangeet</Link>
              <Link href={`/products?cat=${category}&occ=festive`} className="hover:text-poshakh-maroon transition-colors">Festive</Link>
            </ul>
          </div>
        </div>

        {/* Right Side: Embedded Promotional Feature */}
        <div className="w-[300px] h-[220px] relative overflow-hidden group border border-poshakh-gold/20 shadow-md cursor-pointer">
          <Link href={`/products?cat=${category}`}>
            <Image 
              src="/images/products/saree_ai.png" 
              alt="Featured Collection" 
              fill 
              className="object-cover group-hover:scale-105 transition-transform duration-700" 
              style={{ objectPosition: 'top center' }}
            />
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center p-4">
              <span className="text-poshakh-gold font-heading tracking-widest uppercase font-bold border border-poshakh-gold px-6 py-3 hover:bg-poshakh-gold hover:text-poshakh-maroon transition-colors bg-black/20 backdrop-blur-sm">
                Explore {category}
              </span>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
