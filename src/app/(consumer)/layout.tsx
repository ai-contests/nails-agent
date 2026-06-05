import { Search, Bell, User } from 'lucide-react';

export default function ConsumerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div suppressHydrationWarning className="min-h-screen bg-off-white text-ink font-sans flex flex-col">
      <header className="flex items-center justify-between px-8 py-4 bg-off-white sticky top-0 z-50">
        <div className="flex items-center gap-8">
          <div className="text-xl font-bold text-primary tracking-tight">Blush AI</div>
          <nav className="hidden md:flex gap-6 text-sm font-medium text-ink-second">
            <a href="/" className="hover:text-ink transition-colors">Discovery</a>
            <a href="/gallery" className="hover:text-ink transition-colors">Gallery</a>
            <a href="/hand" className="hover:text-ink transition-colors">AI Studio</a>
            <span className="cursor-not-allowed opacity-50">Community</span>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative hidden md:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-light" />
            <input 
              type="text" 
              placeholder="Find your style..." 
              className="pl-9 pr-4 py-2 bg-surface-warm rounded-pill text-sm focus:outline-none focus:ring-1 focus:ring-c-border-focus w-64"
            />
          </div>
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
            <div className="text-lg font-bold text-primary mb-4">Blush AI</div>
            <p className="text-sm text-ink-second max-w-sm mb-6">
              Your personal AI-driven nail artist. Creating beauty through technology and precision.
            </p>
          </div>
          <div>
            <h4 className="font-semibold text-ink mb-4">Explore</h4>
            <div className="flex flex-col gap-2 text-sm text-ink-second">
              <a href="/" className="hover:text-ink">Style Discovery</a>
              <a href="/gallery" className="hover:text-ink">Nail Gallery</a>
              <a href="/hand" className="hover:text-ink">Virtual Try-on</a>
            </div>
          </div>
          <div>
            <h4 className="font-semibold text-ink mb-4">Support</h4>
            <div className="flex flex-col gap-2 text-sm text-ink-second">
              <span className="cursor-pointer hover:text-ink">Help Center</span>
              <span className="cursor-pointer hover:text-ink">Privacy Policy</span>
              <span className="cursor-pointer hover:text-ink">Terms of Service</span>
            </div>
          </div>
        </div>
        <div className="max-w-7xl mx-auto mt-12 pt-8 border-t border-c-border flex justify-between text-xs text-ink-light">
          <span>© 2026 Blush AI. All rights reserved.</span>
          <span>Designed for Perfection · Powered by AI</span>
        </div>
      </footer>
    </div>
  );
}
