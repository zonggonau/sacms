import Link from "next/link";
import { Layout, Github, Twitter, Linkedin, Facebook, Instagram } from "lucide-react";
import { getFooter, getGlobalSettings } from "@/lib/sacms";

const iconMap: any = {
  github: Github,
  twitter: Twitter,
  linkedin: Linkedin,
  facebook: Facebook,
  instagram: Instagram
};

export async function Footer() {
  const footer = await getFooter();
  const settings = await getGlobalSettings();
  
  const siteName = (settings?.siteName || "SaCMS") as string;
  const description = (footer?.description || settings?.description || "Built with SaCMS - The Headless CMS for Papuan Developers.") as string;
  const sections = (footer?.sections || []) as any[];
  const socialLinks = (footer?.socialLinks || settings?.socialLinks || []) as any[];
  const copyright = (footer?.copyright || `© ${new Date().getFullYear()} ${siteName}. All rights reserved.`) as string;

  return (
    <footer className="bg-slate-50 border-t border-slate-200 pt-24 pb-12 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-16 mb-20">
          <div className="lg:col-span-2">
            <Link href="/" className="flex items-center gap-3 mb-6 group">
              <div className="bg-blue-600 p-2 rounded-xl text-white group-hover:rotate-6 transition-transform">
                <Layout className="w-6 h-6" />
              </div>
              <span className="text-2xl font-black tracking-tight text-slate-900 uppercase">
                {siteName}
              </span>
            </Link>
            <p className="text-slate-500 text-lg leading-relaxed max-w-md mb-8">
              {description}
            </p>
            <div className="flex gap-4">
              {socialLinks.map((link: any, i: number) => {
                const Icon = iconMap[link.label.toLowerCase()] || Layout;
                return (
                  <a 
                    key={i}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-blue-600 hover:border-blue-600 hover:shadow-lg transition-all"
                    title={link.label}
                  >
                    <Icon className="w-5 h-5" />
                  </a>
                );
              })}
            </div>
          </div>
          
          {sections.length > 0 ? (
            sections.map((section: any, i: number) => (
              <div key={i}>
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-8">
                  {section.title}
                </h3>
                <ul className="space-y-4">
                  {section.links?.map((link: any, j: number) => (
                    <li key={j}>
                      <Link 
                        href={link.url} 
                        className="text-slate-500 hover:text-blue-600 font-medium transition-colors inline-block"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          ) : (
            <>
              <div>
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-8">Resources</h3>
                <ul className="space-y-4">
                  <li><Link href="/blog" className="text-slate-500 hover:text-blue-600 font-medium transition-colors">Blog</Link></li>
                  <li><Link href="/docs" className="text-slate-500 hover:text-blue-600 font-medium transition-colors">Documentation</Link></li>
                  <li><Link href="/help" className="text-slate-500 hover:text-blue-600 font-medium transition-colors">Help Center</Link></li>
                </ul>
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-8">Company</h3>
                <ul className="space-y-4">
                  <li><Link href="/about" className="text-slate-500 hover:text-blue-600 font-medium transition-colors">About Us</Link></li>
                  <li><Link href="/careers" className="text-slate-500 hover:text-blue-600 font-medium transition-colors">Careers</Link></li>
                  <li><Link href="/contact" className="text-slate-500 hover:text-blue-600 font-medium transition-colors">Contact</Link></li>
                </ul>
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-8">Legal</h3>
                <ul className="space-y-4">
                  <li><Link href="/privacy" className="text-slate-500 hover:text-blue-600 font-medium transition-colors">Privacy Policy</Link></li>
                  <li><Link href="/terms" className="text-slate-500 hover:text-blue-600 font-medium transition-colors">Terms of Service</Link></li>
                </ul>
              </div>
            </>
          )}
        </div>
        
        <div className="border-t border-slate-200 pt-10 flex flex-col md:flex-row justify-between items-center gap-6">
          <p className="text-slate-400 font-medium text-sm">
            {copyright}
          </p>
          <div className="flex gap-8 text-xs font-bold text-slate-400 uppercase tracking-widest">
            <Link href="/privacy" className="hover:text-slate-600 transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-slate-600 transition-colors">Terms</Link>
            <Link href="/cookies" className="hover:text-slate-600 transition-colors">Cookies</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
