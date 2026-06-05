'use client';

import { useState, useEffect } from "react";
import { Search, Loader2 } from 'lucide-react';
import { CategoryTag } from '@/components/ui/CategoryTag';
import { StyleCard } from '@/components/ui/StyleCard';
import { Pagination } from '@/components/ui/Pagination';

const CATEGORIES = ['All', 'Short', 'Medium', 'Long', 'Nude', 'Pink', 'Purple', 'Red', 'Metallic'];
const ITEMS_PER_PAGE = 8;

interface NailStyle {
  style_id: string;
  image_url: string;
  color_tags: string;
  length_tags: string;
}

export default function GalleryPage() {
  const [activeCategory, setActiveCategory] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [styles, setStyles] = useState<NailStyle[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStyles = async () => {
      try {
        // Fetch real data from the backend API
        const res = await fetch('/api/recommendations/main');
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

      {/* Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-12 min-h-[600px] content-start">
        {loading ? (
          <div className="col-span-full flex justify-center items-center py-20 text-ink-second">
            <Loader2 className="w-8 h-8 animate-spin" />
            <span className="ml-3">Loading styles...</span>
          </div>
        ) : paginatedStyles.length > 0 ? (
          paginatedStyles.map(style => {
            // Handle absolute local paths vs remote URLs
            const imgUrl = style.image_url.startsWith('http') 
              ? style.image_url 
              : `/api/local-image?path=${encodeURIComponent(style.image_url)}`;
              
            // Create a readable title from tags if available, fallback to ID
            let title = style.style_id;
            try {
              const colors = JSON.parse(style.color_tags);
              if (colors.length > 0) title = colors.join(' & ').replace(/\b\w/g, (c: string) => c.toUpperCase());
            } catch (e) {}

            return (
              <StyleCard 
                key={style.style_id}
                title={title} 
                description="AI-curated precision nail art design tailored for your unique style." 
                imageUrl={imgUrl} 
              />
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
    </div>
  );
}
