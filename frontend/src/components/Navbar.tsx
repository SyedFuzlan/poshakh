"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import MobileDrawer from "./MobileDrawer";
import { useStore } from "@/store";

const navLinks = [
  { label: "NEW ARRIVALS", href: "/products?cat=new" },
  { label: "SALWAR KAMEEZ", href: "/products?cat=salwar" },
  { label: "SAREES", href: "/products?cat=sarees" },
  { label: "LEHENGAS", href: "/products?cat=lehenga" },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [isMobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const { setAccountDrawerOpen, cart, setCartOpen, customer, isSessionReady } = useStore();
  const router = useRouter();
  const pathname = usePathname();
  const isHome = pathname === "/";
  const isScrolled = !isHome || scrolled;

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 5);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navBg = isScrolled
    ? "bg-poshakh-cream border-b border-poshakh-gold shadow-sm"
    : "bg-transparent border-b border-transparent";
  const logoColor = isScrolled ? "text-poshakh-gold" : "text-white";
  const taglineColor = isScrolled ? "text-poshakh-charcoal" : "text-white/80";
  const linkColor = isScrolled ? "text-poshakh-charcoal hover:text-poshakh-maroon" : "text-white hover:opacity-70";
  const iconColor = isScrolled ? "text-poshakh-charcoal hover:text-poshakh-maroon" : "text-white hover:opacity-70";
  const barColor = isScrolled ? "bg-poshakh-maroon" : "bg-white";
  const badgeBg = isScrolled ? "bg-poshakh-maroon text-poshakh-gold" : "bg-white text-poshakh-charcoal";

  return (
    <>
      <nav className={`sticky top-0 z-[999] w-full transition-all duration-300 ${navBg}`}>
        <div
          className="max-w-[1200px] mx-auto px-[5%] h-[60px] flex items-center justify-between relative"
        >
          {/* Hamburger — mobile only, left */}
          <button
            className="flex flex-col gap-[5px] p-2.5 lg:hidden"
            onClick={() => setMobileDrawerOpen(true)}
            aria-label="Open menu"
          >
            <span className={`block w-6 h-[2px] transition-colors ${barColor}`} />
            <span className={`block w-6 h-[2px] transition-colors ${barColor}`} />
            <span className={`block w-6 h-[2px] transition-colors ${barColor}`} />
          </button>

          {/* Logo — absolute center on mobile, static (left) on desktop */}
          <Link
            href="/"
            className="flex flex-col items-center justify-center text-center absolute left-1/2 -translate-x-1/2 lg:static lg:left-auto lg:translate-x-0"
          >
            <span
              className={`font-heading font-medium leading-none transition-colors ${logoColor}`}
              style={{ fontSize: "32px", letterSpacing: "2px" }}
            >
              POSHAKH
            </span>
            <span
              className={`font-body uppercase transition-colors mt-1 ${taglineColor}`}
              style={{ fontSize: "8px", letterSpacing: "2px" }}
            >
              HYDERABADI DESIGNER WEAR
            </span>
          </Link>

          {/* Nav Links — desktop only, middle */}
          <ul className="hidden lg:flex items-center gap-8 list-none p-0 m-0">
            {navLinks.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`font-body font-medium relative group transition-colors ${linkColor}`}
                  style={{ fontSize: "13px", letterSpacing: "1.5px" }}
                >
                  {item.label}
                  <span className="absolute bottom-0 left-0 h-px w-0 group-hover:w-full transition-all duration-300 bg-current" />
                </Link>
              </li>
            ))}
          </ul>

          {/* Right Icons */}
          <div className="flex items-center gap-5">
            {/* Search — desktop only */}
            <button
              aria-label="Search"
              className={`hidden lg:block transition-colors ${iconColor}`}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </button>

            {/* Account — desktop only */}
            <button
              onClick={() => {
                if (!isSessionReady) return;
                customer ? router.push("/account") : setAccountDrawerOpen(true);
              }}
              aria-label="Account"
              className={`hidden lg:block transition-colors ${iconColor}`}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </button>

            {/* Cart */}
            <button
              onClick={() => setCartOpen(true)}
              aria-label="Cart"
              className={`relative transition-colors ${iconColor}`}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <path d="M16 10a4 4 0 0 1-8 0" />
              </svg>
              {cart.length > 0 && (
                <span className={`absolute -top-2 -right-2 text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center ${badgeBg}`}>
                  {cart.reduce((t, i) => t + i.quantity, 0)}
                </span>
              )}
            </button>
          </div>
        </div>
      </nav>

      <MobileDrawer isOpen={isMobileDrawerOpen} onClose={() => setMobileDrawerOpen(false)} />
    </>
  );
}
