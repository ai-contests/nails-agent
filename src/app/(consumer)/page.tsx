'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { StyleCard } from '@/components/ui/StyleCard';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();
  const [sliderPosition, setSliderPosition] = useState(50);

  return (
    <div className="flex flex-col gap-24 py-16">
      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-8 w-full grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
        <div className="max-w-lg">
          <h1 className="text-display font-bold text-ink mb-2">
            Virtual Beauty,<br/>
            <span className="text-primary">Real Confidence</span>
          </h1>
          <p className="text-ink-second mb-8 text-base leading-relaxed">
            Experience the future of nail artistry. Our AI-powered studio lets you visualize hundreds of styles instantly on your own hands with photorealistic precision.
          </p>
          <div className="flex gap-4">
            <Link href="/hand">
              <Button variant="default">Start AI Try-On</Button>
            </Link>
            <Link href="/gallery">
              <Button variant="outline" className="rounded-full bg-white">Browse Catalog</Button>
            </Link>
          </div>
        </div>
        <div className="relative aspect-[4/5] rounded-card overflow-hidden shadow-2xl">
          <img 
            src="/data/tryon_v2/canon_062_two_hands_clasped_fair.png" 
            alt="Hero Nail Art Design" 
            className="w-full h-full object-cover" 
          />
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-md px-4 py-2 rounded-full text-xs font-semibold shadow-lg text-ink flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-accent-green animate-pulse" />
            Try on styles instantly
          </div>
        </div>
      </section>

      {/* Precision AI Magic (Interactive Slider) */}
      <section className="bg-surface-warm py-24 px-8 text-center border-y border-c-border">
        <h2 className="text-h1 font-bold text-ink mb-4">Precision AI Magic</h2>
        <p className="text-ink-second mb-12 max-w-xl mx-auto">
          See the difference. Our neural engine matches skin tones and lighting for a perfect look. Drag the slider to preview the transformation.
        </p>
        
        <div className="max-w-md mx-auto aspect-[3/4] bg-white rounded-card shadow-soft-glow overflow-hidden relative border border-c-border select-none">
          {/* BEFORE Image (Underneath) */}
          <img 
            src="/data/hand_models/pool/hand_palm_down_top_fair_offwhite.png" 
            alt="Original Hand Profile Scan" 
            className="absolute inset-0 w-full h-full object-cover"
          />
          
          {/* AFTER Image (Clipped using clipPath) */}
          <div 
            className="absolute inset-0"
            style={{ clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` }}
          >
            <img 
              src="/data/tryon_v2/canon_000_palm_down_top_fair.png" 
              alt="Nail Design Virtual Try-On Result" 
              className="absolute inset-0 w-full h-full object-cover"
            />
          </div>
          
          {/* Slider Line */}
          <div 
            className="absolute inset-y-0 w-0.5 bg-white shadow-[0_0_10px_rgba(0,0,0,0.3)] z-20 pointer-events-none"
            style={{ left: `${sliderPosition}%` }}
          />
          
          <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-sm text-white text-[10px] px-2.5 py-1 rounded">BEFORE</div>
          <div className="absolute bottom-4 right-4 bg-black/60 backdrop-blur-sm text-white text-[10px] px-2.5 py-1 rounded">AFTER</div>
          
          <input 
            type="range" 
            min="0" max="100" 
            value={sliderPosition} 
            onChange={(e) => setSliderPosition(Number(e.target.value))}
            className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize z-10"
          />
          
          {/* Slider bar thumb indicator */}
          <div 
            className="absolute top-1/2 -translate-y-1/2 w-8 h-8 bg-white rounded-full shadow-lg flex items-center justify-center pointer-events-none z-20 border border-c-border"
            style={{ left: `calc(${sliderPosition}% - 16px)` }}
          >
            <div className="flex gap-0.5">
              <div className="w-0.5 h-3 bg-gray-400 rounded-full" />
              <div className="w-0.5 h-3 bg-gray-400 rounded-full" />
            </div>
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
          <Link href="/gallery" className="text-sm font-semibold hover:text-primary transition-colors">
            View all styles →
          </Link>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <Link href="/styles/STYLE001" className="block no-underline">
            <StyleCard 
              title="Rose Quartz Shimmer"
              description="Translucent pink bases with a crushed-mineral shimmer finish."
              imageUrl="/data/tryon_v2/canon_029_palm_down_top_medium.png"
              matchScore="98%"
              onTryOnClick={() => router.push('/styles/STYLE001?autoTryOn=true')}
            />
          </Link>
          <Link href="/styles/STYLE002" className="block no-underline">
            <StyleCard 
              title="Cosmic Cat-Eye"
              description="Deep magnetic shimmer pigments for cosmic depth."
              imageUrl="/data/tryon_v2/canon_027_fingers_cupped_deep.png"
              matchScore="95%"
              onTryOnClick={() => router.push('/styles/STYLE002?autoTryOn=true')}
            />
          </Link>
          <Link href="/styles/STYLE003" className="block no-underline">
            <StyleCard 
              title="Winter Blossom"
              description="Hand painted frost and florals on medium coffin bases."
              imageUrl="/data/tryon_v2/canon_043_palm_down_top_medium.png"
              matchScore="92%"
              onTryOnClick={() => router.push('/styles/STYLE003?autoTryOn=true')}
            />
          </Link>
        </div>
      </section>
      
      {/* Transformation Banner */}
      <section className="max-w-5xl mx-auto w-full px-8">
        <div className="bg-primary rounded-[24px] p-12 text-center text-white shadow-2xl relative overflow-hidden">
          <div className="relative z-10">
            <h2 className="text-h1 font-bold mb-4">Ready for your transformation?</h2>
            <p className="mb-8 opacity-90">Join 50,000+ beauty enthusiasts discovering their perfect look with Blush AI.</p>
            <Link href="/hand">
              <Button variant="secondary" size="lg" className="rounded-full px-8">Launch AI Studio</Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
