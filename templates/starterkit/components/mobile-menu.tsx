"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X, ChevronDown } from "lucide-react";

interface MobileMenuProps {
  navLinks: any[];
  siteName: string;
  logoUrl: string;
  ctaLabel: string;
  ctaLink: string;
}

export function MobileMenu({ navLinks, siteName, logoUrl, ctaLabel, ctaLink }: MobileMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [expandedItems, setExpandedItems] = useState<string[]>([]);

  const toggleExpand = (label: string) => {
    setExpandedItems(prev => 
      prev.includes(label) ? prev.filter(i => i !== label) : [...prev, label]
    );
  };

  return (
    <div className="md:hidden flex items-center">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="text-gray-600 hover:text-blue-600 p-2"
        aria-label="Toggle menu"
      >
        {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </button>

      {isOpen && (
        <div className="fixed inset-0 top-[80px] bg-white z-50 overflow-y-auto animate-in slide-in-from-right duration-300">
          <div className="px-6 pt-4 pb-20 space-y-2">
            {navLinks.map((item: any, i: number) => {
              const hasChildren = item.children && item.children.length > 0;
              const isExpanded = expandedItems.includes(item.label);

              return (
                <div key={i} className="border-b border-gray-50 last:border-0">
                  {hasChildren ? (
                    <>
                      <button
                        onClick={() => toggleExpand(item.label)}
                        className="w-full flex items-center justify-between py-4 text-lg font-bold text-gray-900 uppercase tracking-tight"
                      >
                        {item.label}
                        <ChevronDown className={`w-5 h-5 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                      </button>
                      {isExpanded && (
                        <div className="pl-4 pb-4 space-y-2 animate-in fade-in duration-200">
                          {item.children.map((child: any, j: number) => {
                            const hasSubChildren = child.children && child.children.length > 0;
                            const isChildExpanded = expandedItems.includes(`${item.label}-${child.label}`);

                            return (
                              <div key={j}>
                                {hasSubChildren ? (
                                  <>
                                    <button
                                      onClick={() => toggleExpand(`${item.label}-${child.label}`)}
                                      className="w-full flex items-center justify-between py-3 text-base font-semibold text-gray-700"
                                    >
                                      {child.label}
                                      <ChevronDown className={`w-4 h-4 transition-transform ${isChildExpanded ? "rotate-180" : ""}`} />
                                    </button>
                                    {isChildExpanded && (
                                      <div className="pl-4 space-y-2 pb-2">
                                        {child.children.map((grandChild: any, k: number) => (
                                          <Link
                                            key={k}
                                            href={grandChild.url || "#"}
                                            onClick={() => setIsOpen(false)}
                                            className="block py-2 text-sm font-medium text-gray-500 hover:text-blue-600"
                                          >
                                            {grandChild.label}
                                          </Link>
                                        ))}
                                      </div>
                                    )}
                                  </>
                                ) : (
                                  <Link
                                    href={child.url || "#"}
                                    onClick={() => setIsOpen(false)}
                                    className="block py-3 text-base font-semibold text-gray-700"
                                  >
                                    {child.label}
                                  </Link>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </>
                  ) : (
                    <Link
                      href={item.url || "#"}
                      onClick={() => setIsOpen(false)}
                      className="block py-4 text-lg font-bold text-gray-900 uppercase tracking-tight"
                    >
                      {item.label}
                    </Link>
                  )}
                </div>
              );
            })}
            
            <div className="pt-8">
              <Link
                href={ctaLink}
                onClick={() => setIsOpen(false)}
                className="block w-full text-center bg-gray-900 text-white px-5 py-4 rounded-2xl text-base font-black uppercase tracking-widest hover:bg-blue-600 transition-all shadow-lg"
              >
                {ctaLabel}
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
