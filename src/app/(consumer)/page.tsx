import { Button } from '@/components/ui/Button';
import { StyleCard } from '@/components/ui/StyleCard';

export default function Home() {
  return (
    <div className="flex flex-col gap-24 py-16">
      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-8 w-full grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
        <div className="max-w-lg">
          <h1 className="text-display font-bold text-ink mb-2">
            Virtual Beauty,<br/>
            <span className="text-primary">Real Confidence</span>
          </h1>
          <p className="text-ink-second mb-8 text-base">
            Experience the future of nail artistry. Our AI-powered studio lets you visualize hundreds of styles instantly on your own hands with photorealistic precision.
          </p>
          <div className="flex gap-4">
            <Button variant="default">Start AI Try-On</Button>
            <Button variant="outline" className="rounded-full">Browse Catalog</Button>
          </div>
        </div>
        <div className="relative aspect-[4/5] rounded-card overflow-hidden shadow-2xl">
          <img src="https://images.unsplash.com/photo-1522337660859-02fbefca4702" alt="Hero Nail" className="w-full h-full object-cover" />
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-md px-4 py-2 rounded-full text-xs font-semibold shadow-lg text-ink flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-accent-green animate-pulse" />
            Try on styles instantly
          </div>
        </div>
      </section>

      {/* Precision AI Magic */}
      <section className="bg-surface-warm py-24 px-8 text-center">
        <h2 className="text-h1 font-bold text-ink mb-4">Precision AI Magic</h2>
        <p className="text-ink-second mb-12 max-w-xl mx-auto">
          See the difference. Our neural engine matches skin tones and lighting for a perfect look.
        </p>
        <div className="max-w-4xl mx-auto aspect-video bg-white rounded-card shadow-soft-glow overflow-hidden relative">
          <div className="absolute inset-0 flex items-center justify-center text-ink-light">
             [Before / After Comparison Slider Placeholder]
          </div>
        </div>
      </section>

      {/* Trending Styles */}
      <section className="max-w-7xl mx-auto px-8 w-full">
        <div className="flex justify-between items-end mb-8">
          <div>
            <h2 className="text-h1 font-bold text-ink mb-2">Trending Styles</h2>
            <p className="text-ink-second text-sm">The most loved designs this week</p>
          </div>
          <a href="/gallery" className="text-sm font-semibold hover:text-primary transition-colors">
            View all styles →
          </a>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <StyleCard 
            title="Modern Minimalist"
            description="Elegant micro-tips for every day"
            imageUrl="https://images.unsplash.com/photo-1519014816548-bf5fe059e98b"
            matchScore="98%"
          />
          <StyleCard 
            title="Cosmic Cat-Eye"
            description="Deep magnetic shimmer pigments"
            imageUrl="https://images.unsplash.com/photo-1519014816548-bf5fe059e98b"
            matchScore="95%"
          />
          <StyleCard 
            title="Winter Blossom"
            description="Hand painted frost and florals"
            imageUrl="https://images.unsplash.com/photo-1519014816548-bf5fe059e98b"
            matchScore="92%"
          />
        </div>
      </section>
      
      {/* Transformation Banner */}
      <section className="max-w-5xl mx-auto w-full px-8">
        <div className="bg-primary rounded-[24px] p-12 text-center text-white shadow-2xl relative overflow-hidden">
          <div className="relative z-10">
            <h2 className="text-h1 font-bold mb-4">Ready for your transformation?</h2>
            <p className="mb-8 opacity-90">Join 50,000+ beauty enthusiasts discovering their perfect look with NailsAgent.</p>
            <Button variant="secondary" size="lg" className="rounded-full">Launch AI Studio</Button>
          </div>
        </div>
      </section>
    </div>
  );
}
