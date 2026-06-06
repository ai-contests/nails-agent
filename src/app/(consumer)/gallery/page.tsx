'use client';

import { useState, useEffect } from "react";
import { Search, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CategoryTag } from '@/components/ui/CategoryTag';
import { StyleCard } from '@/components/ui/StyleCard';
import { Pagination } from '@/components/ui/Pagination';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';

const CATEGORIES = ['All', 'Short', 'Medium', 'Long', 'Nude', 'Pink', 'Purple', 'Red', 'Metallic'];
const ITEMS_PER_PAGE = 8;

interface NailStyle {
  style_id: string;
  image_url: string;
  color_tags: string;
  length_tags: string;
}

export default function GalleryPage() {
  const router = useRouter();
  const [activeCategory, setActiveCategory] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [styles, setStyles] = useState<NailStyle[]>([]);
  const [loading, setLoading] = useState(true);
  const [handProfile, setHandProfile] = useState<{ handShape: string; skinTone: string } | null>(null);
  const [similarOpen, setSimilarOpen] = useState(false);
  const [similarStyles, setSimilarStyles] = useState<NailStyle[]>([]);
  const [similarLoading, setSimilarLoading] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedProfile = localStorage.getItem('nails_hand_profile');
      if (savedProfile) {
        try {
          setHandProfile(JSON.parse(savedProfile));
        } catch (e) {
          console.error(e);
        }
      }
    }
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const showSimilar = params.get('showSimilar');
      const savedSession = localStorage.getItem('nails_session_id');
      
      if (showSimilar === 'true' && savedSession) {
        setSimilarOpen(true);
        fetchSimilarStyles(savedSession);
      }
    }
  }, []);

  const fetchSimilarStyles = async (sid: string) => {
    try {
      setSimilarLoading(true);
      const res = await fetch(`/api/similar-hand-recommendations?sessionId=${encodeURIComponent(sid)}`);
      const data = await res.json();
      if (data.items) {
        setSimilarStyles(data.items.map((i: any) => i.style || i));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSimilarLoading(false);
    }
  };

  useEffect(() => {
    const fetchStyles = async () => {
      try {
        // Retrieve sessionId from URL or localStorage
        let sessionId = '';
        if (typeof window !== 'undefined') {
          sessionId = new URLSearchParams(window.location.search).get('sessionId') || '';
          if (!sessionId) {
            sessionId = localStorage.getItem('nails_session_id') || '';
          }
        }

        const url = sessionId 
          ? `/api/recommendations/main?sessionId=${encodeURIComponent(sessionId)}` 
          : '/api/recommendations/main';

        // Fetch real data from the backend API
        const res = await fetch(url);
        const data = await res.json();
        
        // Extract styles from the API response
        if (data.items) {
          const fetchedStyles = data.items.map((item: any) => item.style || item);
          setStyles(fetchedStyles);
        }
      } catch (error) {
        console.error('Failed to fetch styles:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchStyles();
  }, []);

  // Filter styles
  const filteredStyles = styles.filter(style => {
    if (searchQuery && !style.style_id.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    
    // Simple category matching
    if (activeCategory !== 'All') {
      const tags = `${style.color_tags} ${style.length_tags}`.toLowerCase();
      if (!tags.includes(activeCategory.toLowerCase())) {
        return false;
      }
    }
    
    return true;
  });

  const totalPages = Math.ceil(filteredStyles.length / ITEMS_PER_PAGE);
  const paginatedStyles = filteredStyles.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  return (
    <div className="max-w-7xl mx-auto px-8 py-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
        <div className="max-w-xl">
          <h1 className="text-h1 font-bold text-ink mb-2">Nail Art Catalog</h1>
          <p className="text-ink-second text-sm leading-relaxed">
            Discover thousands of AI-curated nail designs tailored to your unique preferences. 
            Use our real-time AR try-on to see them on your hands instantly.
          </p>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-10">
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map(cat => (
            <CategoryTag 
              key={cat} 
              active={activeCategory === cat}
              onClick={() => {
                setActiveCategory(cat);
                setCurrentPage(1); // Reset to page 1 on filter
              }}
            >
              {cat}
            </CategoryTag>
          ))}
        </div>
        <div className="relative w-full md:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-light" />
          <input 
            type="text" 
            placeholder="Search colors, styles..." 
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1); // Reset to page 1 on search
            }}
            className="w-full pl-9 pr-4 py-2 bg-surface-warm rounded-pill text-sm focus:outline-none border border-transparent focus:border-c-border-focus"
          />
        </div>
      </div>

      {handProfile && ( 
        <div className="mb-8 p-4 bg-blush-light border border-primary/20 rounded-xl flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse" />
            <div className="text-sm">
              <span className="font-semibold text-ink">Hand Profile Active:</span>{' '}
              <span className="text-ink-second capitalize">{handProfile.handShape.replace('_', ' ')}</span>{' '}
              <span className="text-ink-light font-mono text-xs">({handProfile.skinTone.replace('_', ' ')})</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-ink-second">Click any style card's <strong>Try On</strong> button to overlay this profile.</span>
            <Link href="/hand">
              <Button variant="outline" size="sm" className="bg-white text-xs py-1 px-3">Recalibrate</Button>
            </Link>
          </div>
        </div>
      )}

      {/* Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-12 min-h-[600px] content-start">
        {loading ? (
          <div className="col-span-full flex justify-center items-center py-20 text-ink-second">
            <Loader2 className="w-8 h-8 animate-spin" />
            <span className="ml-3">Loading styles...</span>
          </div>
        ) : paginatedStyles.length > 0 ? (
          paginatedStyles.map(style => {
            // Handle relative paths starting with / (e.g. /data/...), remote URLs, or legacy absolute local paths
            const imgUrl = style.image_url.startsWith('http') || style.image_url.startsWith('/')
              ? style.image_url 
              : `/api/local-image?path=${encodeURIComponent(style.image_url)}`;
              
            // Create a readable title from tags if available, fallback to ID
            let title = style.style_id;
            try {
              const colors = JSON.parse(style.color_tags);
              if (colors.length > 0) title = colors.join(' & ').replace(/\b\w/g, (c: string) => c.toUpperCase());
            } catch (e) {}

            return (
              <Link href={`/styles/${style.style_id}`} key={style.style_id} className="block no-underline">
                <StyleCard 
                  title={title} 
                  description="AI-curated precision nail art design tailored for your unique style." 
                  imageUrl={imgUrl} 
                  onTryOnClick={() => router.push(`/styles/${style.style_id}?autoTryOn=true`)}
                />
              </Link>
            );
          })
        ) : (
          <div className="col-span-full text-center py-20 text-ink-second">
            No styles found matching your criteria.
          </div>
        )}
      </div>

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="flex justify-center mt-8">
          <Pagination 
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={(page) => {
              setCurrentPage(page);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        </div>
      )}

      {/* Similar Hand Recommendations Dialog */}
      <Dialog open={similarOpen} onOpenChange={setSimilarOpen}>
        <div className="bg-white p-8 max-w-4xl w-full mx-auto max-h-[85vh] overflow-y-auto custom-scrollbar rounded-card">
          <div className="text-center mb-6">
            <h2 className="text-xl font-bold text-ink mb-2">与您手型相似的用户正在选择这些美甲</h2>
            {handProfile && (
              <p className="text-xs text-ink-second">
                已匹配您的手型：<span className="font-semibold text-primary capitalize">{handProfile.handShape.replace('_', ' ')}</span>
                {' '}• 肤色：<span className="font-semibold text-primary capitalize">{handProfile.skinTone.replace('_', ' ')}</span>
              </p>
            )}
          </div>

          {similarLoading ? (
            <div className="flex justify-center items-center py-20 text-ink-second">
              <Loader2 className="w-8 h-8 animate-spin" />
              <span className="ml-3">正在匹配相似手型推荐...</span>
            </div>
          ) : similarStyles.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-6 mb-6">
              {similarStyles.map(style => {
                const imgUrl = style.image_url.startsWith('http') || style.image_url.startsWith('/')
                  ? style.image_url
                  : `/api/local-image?path=${encodeURIComponent(style.image_url)}`;

                let title = style.style_id;
                try {
                  const colors = JSON.parse(style.color_tags);
                  if (colors.length > 0) title = colors.join(' & ').replace(/\b\w/g, (c: string) => c.toUpperCase());
                } catch (e) {}

                return (
                  <div 
                    key={style.style_id} 
                    className="relative cursor-pointer"
                    onClick={() => {
                      setSimilarOpen(false);
                      router.push(`/styles/${style.style_id}`);
                    }}
                  >
                    <StyleCard 
                      title={title}
                      description="AI-curated coordinate design."
                      imageUrl={imgUrl}
                      onTryOnClick={() => {
                        setSimilarOpen(false);
                        router.push(`/styles/${style.style_id}?autoTryOn=true`);
                      }}
                    />
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-20 text-ink-second text-sm">
              暂无相似手型推荐数据。
            </div>
          )}

          <div className="flex justify-end border-t border-c-border pt-4">
            <Button variant="outline" onClick={() => setSimilarOpen(false)}>
              关闭
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
