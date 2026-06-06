'use client';

import { useState, useEffect } from 'react';
import { Heart, Search, Loader2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { StyleCard } from '@/components/ui/StyleCard';
import { TryOnModal } from '@/components/consumer/TryOnModal';
import Link from 'next/link';

interface StyleDetailProps {
  params: Promise<{ id: string }>;
}

interface NailStyle {
  style_id: string;
  image_url: string;
  color_tags: string;
  length_tags: string;
  is_available_for_tryon: boolean;
}

interface VisualFeature {
  primary_color_name: string;
  primary_color_family: string;
  primary_color_rgb: string;
  secondary_color_name: string | null;
  secondary_color_family: string | null;
  secondary_color_rgb: string | null;
  length_tag: string;
}

export default function StyleDetailPage({ params }: StyleDetailProps) {
  const [styleId, setStyleId] = useState<string | null>(null);
  const [style, setStyle] = useState<NailStyle | null>(null);
  const [features, setFeatures] = useState<VisualFeature | null>(null);
  const [isFavorited, setIsFavorited] = useState(false);
  const [similarStyles, setSimilarStyles] = useState<NailStyle[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [handImageId, setHandImageId] = useState<string | null>(null);
  const [handProfile, setHandProfile] = useState<{ handShape: string; skinTone: string } | null>(null);

  // 1. Resolve params Promise
  useEffect(() => {
    Promise.resolve(params).then((resolved) => {
      setStyleId(resolved.id);
    });
  }, [params]);

  // 2. Load session info from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedSession = localStorage.getItem('nails_session_id');
      const savedImage = localStorage.getItem('nails_hand_image_id');
      const savedProfile = localStorage.getItem('nails_hand_profile');
      
      setSessionId(savedSession);
      setHandImageId(savedImage);
      if (savedProfile) {
        try {
          setHandProfile(JSON.parse(savedProfile));
        } catch (e) {
          console.error(e);
        }
      }
    }
  }, []);

  // 3. Fetch style details and similar recommendations
  useEffect(() => {
    if (!styleId) return;

    const fetchDetails = async () => {
      try {
        setLoading(true);
        // Load details (include sessionId to trigger view/click events)
        const detailUrl = sessionId 
          ? `/api/styles/${styleId}?sessionId=${encodeURIComponent(sessionId)}` 
          : `/api/styles/${styleId}`;
        const res = await fetch(detailUrl);
        const data = await res.json();

        if (data.style) {
          setStyle(data.style);
          setFeatures(data.features);
          setIsFavorited(data.isFavorited || false);
        }

        // Load similar hand recommendations or global fallback
        const recUrl = sessionId 
          ? `/api/similar-hand-recommendations?sessionId=${encodeURIComponent(sessionId)}` 
          : `/api/recommendations/main`;
        const recRes = await fetch(recUrl);
        const recData = await recRes.json();
        
        if (recData.items) {
          // Flatten items
          const items = recData.items
            .map((i: any) => i.style || i)
            .filter((item: any) => item.style_id !== styleId);
          setSimilarStyles(items.slice(0, 4));
        }
      } catch (err) {
        console.error('Error fetching style details:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDetails();
  }, [styleId, sessionId]);

  const handleFavoriteToggle = async () => {
    if (!styleId || !sessionId) return;
    try {
      const res = await fetch('/api/favorites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, styleId, isActive: !isFavorited }),
      });
      const data = await res.json();
      if (data.success) {
        setIsFavorited(!isFavorited);
      }
    } catch (e) {
      console.error('Favorite toggle error:', e);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-ink-second">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="ml-3 font-medium">Loading style details...</span>
      </div>
    );
  }

  if (!style) {
    return (
      <div className="max-w-7xl mx-auto px-8 py-24 text-center">
        <h2 className="text-xl font-bold text-ink mb-4">Style Not Found</h2>
        <p className="text-ink-second mb-8">The requested nail style could not be located in our catalog.</p>
        <Link href="/gallery">
          <Button variant="default">Return to Catalog</Button>
        </Link>
      </div>
    );
  }

  // Handle image path proxying if needed
  const resolvedImgUrl = style.image_url.startsWith('http') || style.image_url.startsWith('/')
    ? style.image_url
    : `/api/local-image?path=${encodeURIComponent(style.image_url)}`;

  // Formatting title
  let title = style.style_id;
  let colorFamily = 'Rose Quartz | Lilac';
  try {
    const colors = JSON.parse(style.color_tags);
    if (colors.length > 0) {
      title = colors.join(' & ').replace(/\b\w/g, (c: string) => c.toUpperCase());
      colorFamily = colors.join(' | ').replace(/\b\w/g, (c: string) => c.toUpperCase());
    }
  } catch (e) {}

  let lengthTag = 'Medium';
  try {
    const lengths = JSON.parse(style.length_tags);
    if (lengths.length > 0) {
      lengthTag = lengths[0].replace(/\b\w/g, (c: string) => c.toUpperCase());
    }
  } catch (e) {}

  // Parse color shades
  const parseRgb = (rgbStr?: string | null): [number, number, number] | null => {
    if (!rgbStr) return null;
    try {
      return JSON.parse(rgbStr) as [number, number, number];
    } catch (e) {
      return null;
    }
  };

  const rgbToHex = (rgb: [number, number, number]) => {
    const r = rgb[0].toString(16).padStart(2, '0');
    const g = rgb[1].toString(16).padStart(2, '0');
    const b = rgb[2].toString(16).padStart(2, '0');
    return `#${r}${g}${b}`.toUpperCase();
  };

  const primaryRgb = features ? parseRgb(features.primary_color_rgb) : null;
  const secondaryRgb = features ? parseRgb(features.secondary_color_rgb) : null;

  // Simulate dynamic match score based on user's hand shape matching style length
  let matchScore = '95%';
  if (handProfile && features) {
    const shape = handProfile.handShape;
    const len = features.length_tag;
    if (shape === 'slender_long' && (len === 'long' || len === 'medium')) {
      matchScore = '98%';
    } else if (shape === 'short_wide' && len === 'short') {
      matchScore = '97%';
    } else if (shape === 'unknown') {
      matchScore = '90%';
    } else {
      matchScore = '88%';
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-8 py-12">
      <div className="mb-8">
        <Link href="/gallery" className="inline-flex items-center text-xs font-semibold text-ink-second hover:text-primary transition-colors gap-1.5">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Catalog
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 mb-24">
        {/* Left: Large Image */}
        <div className="relative aspect-[3/4] rounded-[24px] overflow-hidden bg-surface-warm shadow-xl">
          <img src={resolvedImgUrl} alt={title} className="w-full h-full object-cover" />
          <div className="absolute bottom-6 left-6 bg-white/90 backdrop-blur-sm px-4 py-2 rounded-pill text-xs font-semibold text-ink shadow-md">
            COLOR FAMILY: <span className="font-normal text-ink-second">{colorFamily}</span>
          </div>
        </div>

        {/* Right: Info & Actions */}
        <div className="flex flex-col justify-center">
          <div className="flex gap-2 mb-4">
            <span className="bg-blush-light text-primary px-3 py-1 text-[10px] rounded-pill font-semibold">
              {colorFamily.split(' | ')[0] || 'Soft Glam'}
            </span>
            <span className="bg-blush-light text-primary px-3 py-1 text-[10px] rounded-pill font-semibold">
              {lengthTag} Length
            </span>
          </div>
          
          <h1 className="text-display font-bold text-ink mb-4">{title}</h1>
          <p className="text-ink-second leading-relaxed mb-8">
            An AI-curated {lengthTag.toLowerCase()}-length design highlighting a gorgeous {colorFamily.toLowerCase()} palette. 
            Tailored to coordinate beautifully with your skin tone and finger geometry, this design delivers a premium, hand-painted aesthetic calibrated for perfect AR try-on accuracy.
          </p>

          {/* Shades */}
          {(primaryRgb || secondaryRgb) && (
            <div className="mb-8">
              <h4 className="text-[10px] font-bold text-ink-light tracking-widest uppercase mb-3">Recommended Shades</h4>
              <div className="flex gap-4">
                {primaryRgb && (
                  <div className="flex flex-col items-center gap-1">
                    <div 
                      className="w-10 h-10 rounded-full shadow-sm border border-c-border" 
                      style={{ backgroundColor: rgbToHex(primaryRgb) }}
                    />
                    <span className="text-[10px] font-mono text-ink-second">{rgbToHex(primaryRgb)}</span>
                  </div>
                )}
                {secondaryRgb && (
                  <div className="flex flex-col items-center gap-1">
                    <div 
                      className="w-10 h-10 rounded-full shadow-sm border border-c-border" 
                      style={{ backgroundColor: rgbToHex(secondaryRgb) }}
                    />
                    <span className="text-[10px] font-mono text-ink-second">{rgbToHex(secondaryRgb)}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-4 mb-8">
            <Button 
              variant="default" 
              className="flex-1 py-6 text-base shadow-soft-glow" 
              onClick={() => setModalOpen(true)}
            >
              <Search className="w-5 h-5 mr-2" /> Try On Now
            </Button>
            <Button 
              variant={isFavorited ? 'default' : 'outline'} 
              size="icon" 
              className={`w-14 h-14 shrink-0 rounded-xl transition-all ${isFavorited ? 'bg-primary text-white border-primary' : ''}`}
              onClick={handleFavoriteToggle}
              disabled={!sessionId}
              title={!sessionId ? 'Scan your hand first to enable favorites' : 'Add to favorites'}
            >
              <Heart className={`w-5 h-5 ${isFavorited ? 'fill-current' : ''}`} />
            </Button>
          </div>

          {/* Metrics */}
          <div className="bg-surface-warm rounded-xl p-6 flex items-center justify-between border border-c-border">
            <div>
              <div className="text-[10px] font-bold text-ink-light tracking-widest uppercase mb-1">Calibration</div>
              <div className="font-semibold text-ink">{handProfile ? 'Hand Profile Active' : 'Default Alignment'}</div>
            </div>
            <div className="text-right">
              <div className="text-[10px] font-bold text-ink-light tracking-widest uppercase mb-1">Match Score</div>
              <div className="font-semibold text-success">{matchScore} Match</div>
            </div>
          </div>
        </div>
      </div>

      {/* Similar Styles */}
      {similarStyles.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-ink">
              {handProfile ? 'Users with similar hands chose these' : 'Trending Nail Designs'}
            </h2>
            <Link href="/gallery" className="text-sm font-semibold text-ink hover:text-primary transition-colors">
              View All →
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {similarStyles.map(sim => {
              const simImgUrl = sim.image_url.startsWith('http') || sim.image_url.startsWith('/')
                ? sim.image_url
                : `/api/local-image?path=${encodeURIComponent(sim.image_url)}`;
                
              let simTitle = sim.style_id;
              try {
                const colors = JSON.parse(sim.color_tags);
                if (colors.length > 0) simTitle = colors.join(' & ').replace(/\b\w/g, (c: string) => c.toUpperCase());
              } catch (e) {}

              // Calculate match score
              let simMatch = '92%';
              if (handProfile && sim.length_tags) {
                try {
                  const lens = JSON.parse(sim.length_tags);
                  const isLong = lens.includes('long') || lens.includes('medium');
                  if (handProfile.handShape === 'slender_long' && isLong) simMatch = '96%';
                  else if (handProfile.handShape === 'short_wide' && lens.includes('short')) simMatch = '95%';
                } catch (e) {}
              }

              return (
                <Link href={`/styles/${sim.style_id}`} key={sim.style_id} className="block no-underline">
                  <StyleCard 
                    title={simTitle} 
                    description="AI-curated coordinate design." 
                    imageUrl={simImgUrl} 
                    matchScore={simMatch}
                  />
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Try On Modal */}
      <TryOnModal 
        open={modalOpen} 
        onOpenChange={setModalOpen} 
        styleId={style.style_id}
        styleName={title} 
        sessionId={sessionId}
        handImageId={handImageId}
      />
    </div>
  );
}
