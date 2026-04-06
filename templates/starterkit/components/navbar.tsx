import Link from "next/link";
import { Layout, ChevronDown } from "lucide-react";
import { getNavbar, getGlobalSettings } from "@/lib/sacms";
import { MobileMenu } from "./mobile-menu";

export async function Navbar() {
  const navbar = await getNavbar();
  const settings = await getGlobalSettings();
  
  const brandName = (navbar?.brandName || settings?.siteName || "SaCMS") as string;
  const menuItems = (navbar?.menuItems || []) as any[];

  const rawLogo = navbar?.logo || settings?.logo;
  let logoUrl = "";
  
  if (typeof rawLogo === 'string') {
    logoUrl = rawLogo;
  } else if (rawLogo && typeof rawLogo === 'object' && (rawLogo as any).url) {
    logoUrl = (rawLogo as any).url;
  }

  if (logoUrl && logoUrl.startsWith('/upload')) {
    const baseUrl = process.env.NEXT_PUBLIC_SACMS_URL || "http://localhost:3000";
    logoUrl = `${baseUrl}${logoUrl}`;
  }

  const ctaLabel = (navbar?.ctaLabel || "Get Started") as string;
  const ctaLink = (navbar?.ctaLink || "#") as string;
  const slogan = (navbar?.slogan) as string;

  return (
    <nav className="border-b border-gray-100 bg-white/90 backdrop-blur-xl sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          {/* Brand & Logo */}
          <div className="flex items-center">
            <Link href="/" className="flex items-center gap-3 group">
              {logoUrl ? (
                <img 
                  src={logoUrl} 
                  alt={brandName} 
                  className="h-10 w-auto object-contain group-hover:scale-105 transition-transform"
                />
              ) : (
                <div className="bg-blue-600 p-2 rounded-xl text-white group-hover:rotate-6 transition-transform">
                  <Layout className="w-6 h-6" />
                </div>
              )}
              <div className="flex flex-col">
                <span className="text-xl font-black tracking-tight text-gray-900 uppercase leading-none">
                  {brandName}
                </span>
                {slogan && (
                  <span className="text-[10px] text-gray-500 font-bold leading-tight mt-1 tracking-wider uppercase">
                    {slogan}
                  </span>
                )}
              </div>
            </Link>
          </div>
          
          {/* Desktop Menu */}
          <div className="hidden md:flex gap-2 items-center">
            {menuItems.map((item: any, i: number) => (
              <div key={i} className="relative group/m1">
                {item.children && item.children.length > 0 ? (
                  <>
                    <button className="flex items-center gap-1.5 px-4 py-2 text-sm font-bold text-gray-600 uppercase tracking-wide hover:text-blue-600 transition-colors">
                      {item.label}
                      <ChevronDown className="w-4 h-4" />
                    </button>
                    {/* Level 2 Dropdown */}
                    <div className="absolute top-full left-0 pt-2 opacity-0 invisible group-hover/m1:opacity-100 group-hover/m1:visible transition-all duration-200 z-50">
                      <div className="bg-white border border-gray-100 shadow-xl rounded-2xl min-w-[220px] overflow-hidden p-2">
                        {item.children.map((child: any, j: number) => (
                          <div key={j} className="relative group/m2">
                            {child.children && child.children.length > 0 ? (
                              <>
                                <button className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-blue-50 hover:text-blue-600 rounded-xl transition-all">
                                  {child.label}
                                  <ChevronDown className="w-4 h-4 -rotate-90" />
                                </button>
                                {/* Level 3 Dropdown */}
                                <div className="absolute top-0 left-full pl-2 opacity-0 invisible group-hover/m2:opacity-100 group-hover/m2:visible transition-all duration-200">
                                  <div className="bg-white border border-gray-100 shadow-xl rounded-2xl min-w-[200px] overflow-hidden p-2">
                                    {child.children.map((grandChild: any, k: number) => (
                                      <Link
                                        key={k}
                                        href={grandChild.url || "#"}
                                        className="block px-4 py-3 text-sm font-medium text-gray-600 hover:bg-blue-50 hover:text-blue-600 rounded-xl transition-all"
                                      >
                                        {grandChild.label}
                                      </Link>
                                    ))}
                                  </div>
                                </div>
                              </>
                            ) : (
                              <Link
                                href={child.url || "#"}
                                className="block px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-blue-50 hover:text-blue-600 rounded-xl transition-all"
                              >
                                {child.label}
                              </Link>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                ) : (
                  <Link 
                    href={item.url || "#"} 
                    className="px-4 py-2 text-sm font-bold text-gray-600 uppercase tracking-wide hover:text-blue-600 transition-colors"
                  >
                    {item.label}
                  </Link>
                )}
              </div>
            ))}
          </div>

          {/* CTA */}
          <div className="hidden md:flex items-center">
            <Link 
              href={ctaLink}
              className="bg-gray-900 text-white px-7 py-3 rounded-full text-sm font-bold hover:bg-blue-600 hover:shadow-[0_0_20px_rgba(37,99,235,0.3)] transition-all shadow-sm"
            >
              {ctaLabel}
            </Link>
          </div>

          {/* Mobile Menu */}
          <MobileMenu 
            navLinks={menuItems} 
            siteName={brandName} 
            logoUrl={logoUrl} 
            ctaLabel={ctaLabel} 
            ctaLink={ctaLink} 
          />
        </div>
      </div>
    </nav>
  );
}
