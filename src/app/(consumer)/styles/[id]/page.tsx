'use client';

import { useState } from "react";
import { Heart, Search } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { StyleCard } from '@/components/ui/StyleCard';
import { TryOnModal } from '@/components/consumer/TryOnModal';

export default function StyleDetailPage() {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div className="max-w-7xl mx-auto px-8 py-12">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 mb-24">
        {/* Left: Large Image */}
        <div className="relative aspect-[3/4] rounded-[24px] overflow-hidden bg-surface-warm shadow-xl">
          <img src="https://images.unsplash.com/photo-1519014816548-bf5fe059e98b" alt="Style Detail" className="w-full h-full object-cover" />
          <button className="absolute top-6 right-6 w-10 h-10 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-md hover:bg-white transition-colors">
            <Search className="w-5 h-5 text-ink" />
          </button>
          <div className="absolute bottom-6 left-6 bg-white/90 backdrop-blur-sm px-4 py-2 rounded-pill text-xs font-semibold text-ink shadow-md">
            COLOR FAMILY: <span className="font-normal text-ink-second">Dusty Rose | Lilac</span>
          </div>
        </div>

        {/* Right: Info & Actions */}
        <div className="flex flex-col justify-center">
          <div className="flex gap-2 mb-4">
            <span className="bg-blush-light text-primary px-3 py-1 text-[10px] rounded-pill font-semibold">Soft Glam</span>
            <span className="bg-blush-light text-primary px-3 py-1 text-[10px] rounded-pill font-semibold">45 Min</span>
          </div>
          
          <h1 className="text-display font-bold text-ink mb-4">Rose Quartz Shimmer</h1>
          <p className="text-ink-second leading-relaxed mb-8">
            Inspired by the ethereal glow of raw rose quartz, this style blends translucent lilac bases with a crushed-mineral shimmer finish. Designed for those who seek an understated yet premium aesthetic, it offers a digital spa feeling for your hands that transitions perfectly from professional day-looks to soft evening elegance.
          </p>

          {/* Shades */}
          <div className="mb-8">
            <h4 className="text-[10px] font-bold text-ink-light tracking-widest uppercase mb-3">Recommended Shades</h4>
            <div className="flex gap-4">
              <div className="flex flex-col items-center gap-1">
                <div className="w-10 h-10 rounded-full bg-[#E3B4B7] shadow-sm border border-c-border" />
                <span className="text-[10px] font-mono text-ink-second">#E3B4B7</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <div className="w-10 h-10 rounded-full bg-[#E8C8C3] shadow-sm border border-c-border" />
                <span className="text-[10px] font-mono text-ink-second">#E8C8C3</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <div className="w-10 h-10 rounded-full bg-[#EAABAA] shadow-sm border border-c-border" />
                <span className="text-[10px] font-mono text-ink-second">#EAABAA</span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-4 mb-8">
            <Button variant="default" className="flex-1 py-6 text-base shadow-soft-glow" onClick={() => setModalOpen(true)}>
              <Search className="w-5 h-5 mr-2" /> Try On Now
            </Button>
            <Button variant="outline" size="icon" className="w-14 h-14 shrink-0 rounded-xl">
              <Heart className="w-5 h-5" />
            </Button>
          </div>

          {/* Metrics */}
          <div className="bg-surface-warm rounded-xl p-6 flex items-center justify-between border border-c-border">
            <div>
              <div className="text-[10px] font-bold text-ink-light tracking-widest uppercase mb-1">Difficulty</div>
              <div className="font-semibold text-ink">Beginner Friendly</div>
            </div>
            <div className="text-right">
              <div className="text-[10px] font-bold text-ink-light tracking-widest uppercase mb-1">Match Score</div>
              <div className="font-semibold text-success">98% Match</div>
            </div>
          </div>
        </div>
      </div>

      {/* Similar Styles */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-ink">Users with similar hands chose these</h2>
          <a href="/gallery" className="text-sm font-semibold text-ink hover:text-primary">View All →</a>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <StyleCard title="Pearl Essence" description="LUSTRE: HIGH | OPACITY: 2/5" imageUrl="https://images.unsplash.com/photo-1519014816548-bf5fe059e98b" matchScore="94%" />
          <StyleCard title="Blush Gradient" description="TYPE: OMBRE | FINISH: SATIN" imageUrl="https://images.unsplash.com/photo-1519014816548-bf5fe059e98b" matchScore="89%" />
          <StyleCard title="Milky Sheer" description="BASE: NEUTRAL | SHEEN: SOFT" imageUrl="https://images.unsplash.com/photo-1519014816548-bf5fe059e98b" matchScore="92%" />
          <StyleCard title="Micro French" description="STYLE: CLASSIC | DETAIL: MICRO" imageUrl="https://images.unsplash.com/photo-1519014816548-bf5fe059e98b" matchScore="85%" />
        </div>
      </div>

      <TryOnModal 
        open={modalOpen} 
        onOpenChange={setModalOpen} 
        styleName="Rose Quartz Shimmer" 
      />
    </div>
  );
}
