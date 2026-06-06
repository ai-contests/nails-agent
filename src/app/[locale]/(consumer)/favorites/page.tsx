'use client';

import { useState, useEffect } from 'react';
import { Loader2, Heart, ArrowRight } from 'lucide-react';
import { StyleCard } from '@/components/ui/StyleCard';
import { Button } from '@/components/ui/Button';
import { useTranslations } from 'next-intl';
import { Link, useRouter } from '@/src/i18n/routing';
import { resolveImageUrl } from '@/src/lib/utils';

interface NailStyle {
  style_id: string;
  image_url: string;
  color_tags: string;
  length_tags: string;
}

export default function FavoritesPage() {
  const router = useRouter();
  const t = useTranslations('favorites');
  const tCategory = useTranslations('gallery.categories');
  const [favorites, setFavorites] = useState<NailStyle[]>([]);
  const [loading, setLoading] = useState(true);
  const [sessionId, setSessionId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedSession = localStorage.getItem('nails_session_id');
      setSessionId(savedSession);
    }
  }, []);

  useEffect(() => {
    const fetchFavorites = async () => {
      if (!sessionId) {
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(`/api/favorites?sessionId=${encodeURIComponent(sessionId)}`);
        if (!res.ok) throw new Error('Failed to fetch favorites');
        
        const data = await res.json();
        if (data.items) {
          setFavorites(data.items);
        }
      } catch (e) {
        console.error('Error fetching favorites:', e);
      } finally {
        setLoading(false);
      }
    };

    fetchFavorites();
  }, [sessionId]);

  return (
    <div className="max-w-7xl mx-auto px-8 py-12">
      <div className="max-w-xl mb-10">
        <h1 className="text-h1 font-bold text-ink mb-2">{t('title')}</h1>
        <p className="text-ink-second text-sm leading-relaxed">
          {t('desc')}
        </p>
      </div>

      {loading ? (
        <div className="min-h-[40vh] flex items-center justify-center text-ink-second">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <span className="ml-3 font-medium">{t('loading')}</span>
        </div>
      ) : favorites.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 min-h-[40vh] content-start">
          {favorites.map(style => {
            const imgUrl = resolveImageUrl(style.image_url);

            let title = style.style_id;
            try {
              const colors = JSON.parse(style.color_tags);
              if (colors.length > 0) {
                const getTranslatedColor = (c: string) => {
                  const key = c.toLowerCase().trim();
                  const val = tCategory(key as any);
                  return val === key ? c : val;
                };
                title = colors.map((c: string) => getTranslatedColor(c)).join(' & ');
              }
            } catch (e) {}

            return (
              <Link href={`/styles/${style.style_id}`} key={style.style_id} className="block no-underline">
                <StyleCard 
                  title={title}
                  description={t('cardDesc')}
                  imageUrl={imgUrl}
                  onTryOnClick={() => router.push(`/styles/${style.style_id}?autoTryOn=true`)}
                />
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="min-h-[45vh] border border-dashed border-c-border rounded-card bg-surface-warm/30 flex flex-col items-center justify-center p-8 text-center">
          <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm mb-6 text-ink-light">
            <Heart className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-ink mb-2">{t('emptyTitle')}</h3>
          <p className="text-ink-second text-sm mb-8 max-w-md">
            {t('emptyDesc')}
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <Link href="/gallery">
              <Button variant="outline" className="w-48 bg-white">
                {t('browseCatalog')}
              </Button>
            </Link>
            <Link href="/hand">
              <Button variant="default" className="w-48 gap-1 shadow-soft-glow">
                {t('goToStudio')} <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
