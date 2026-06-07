import { Search, Bell, User } from 'lucide-react';
import { Link } from '@/src/i18n/routing';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { LanguageSwitcher } from '@/src/components/ui/LanguageSwitcher';

export default async function ConsumerLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const tNav = await getTranslations('nav');
  const tFooter = await getTranslations('footer');

  return (
    <div suppressHydrationWarning className="min-h-screen bg-off-white text-ink font-sans flex flex-col">
      <header className="flex items-center justify-between px-8 py-4 bg-off-white sticky top-0 z-50">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-3 group">
            <img src="/logo.png" alt="Nails Agent Logo" className="h-12 w-auto object-contain transition-transform group-hover:scale-105" />
            <span className="text-xl font-bold text-primary tracking-tight">Nails Agent</span>
          </Link>
          <nav className="hidden md:flex gap-6 text-sm font-medium text-ink-second">
            <Link href="/" className="hover:text-ink transition-colors">{tNav('discovery')}</Link>
            <Link href="/gallery" className="hover:text-ink transition-colors">{tNav('gallery')}</Link>
            <Link href="/hand" className="hover:text-ink transition-colors">{tNav('studio')}</Link>
            <Link href="/favorites" className="hover:text-ink transition-colors">{tNav('favorites')}</Link>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative hidden md:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-light" />
            <input 
              type="text" 
              placeholder={tNav('placeholder')} 
              className="pl-9 pr-4 py-2 bg-surface-warm rounded-pill text-sm focus:outline-none focus:ring-1 focus:ring-c-border-focus w-64"
            />
          </div>
          <LanguageSwitcher />
          <button className="p-2 text-ink hover:bg-surface-warm rounded-full transition-colors">
            <Bell className="w-5 h-5" />
          </button>
          <div className="w-8 h-8 bg-blush-light rounded-full flex items-center justify-center border border-c-border overflow-hidden">
             <User className="w-4 h-4 text-primary" />
          </div>
        </div>
      </header>

      <main className="flex-1">
        {children}
      </main>

      <footer className="bg-surface-warm py-12 px-8 mt-24">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="col-span-2">
            <Link href="/" className="flex items-center gap-2 mb-4 group">
              <img src="/logo.png" alt="Nails Agent Logo" className="h-6 w-auto object-contain" />
              <span className="text-lg font-bold text-primary">Nails Agent</span>
            </Link>
            <p className="text-sm text-ink-second max-w-sm mb-6">
              {tFooter('desc')}
            </p>
          </div>
          <div>
            <h4 className="font-semibold text-ink mb-4">{tFooter('explore')}</h4>
            <div className="flex flex-col gap-2 text-sm text-ink-second">
              <Link href="/" className="hover:text-ink">{tFooter('discovery')}</Link>
              <Link href="/gallery" className="hover:text-ink">{tFooter('gallery')}</Link>
              <Link href="/hand" className="hover:text-ink">{tFooter('tryon')}</Link>
            </div>
          </div>
          <div>
            <h4 className="font-semibold text-ink mb-4">{tFooter('support')}</h4>
            <div className="flex flex-col gap-2 text-sm text-ink-second">
              <span className="cursor-pointer hover:text-ink">{tFooter('help')}</span>
              <span className="cursor-pointer hover:text-ink">{tFooter('privacy')}</span>
              <span className="cursor-pointer hover:text-ink">{tFooter('terms')}</span>
            </div>
          </div>
        </div>
        <div className="max-w-7xl mx-auto mt-12 pt-8 border-t border-c-border flex justify-between text-xs text-ink-light">
          <span>{tFooter('rights')}</span>
          <span>{tFooter('sub')}</span>
        </div>
      </footer>
    </div>
  );
}

