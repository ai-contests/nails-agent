import { Card, CardContent } from './Card';
import { cn } from '@/lib/utils';
import * as React from 'react';

export interface StyleCardProps {
  title: string;
  description: string;
  imageUrl: string;
  matchScore?: string;
  className?: string;
  onTryOnClick?: (e: React.MouseEvent) => void;
}

export function StyleCard({ title, description, imageUrl, matchScore, className, onTryOnClick }: StyleCardProps) {
  return (
    <Card className={cn("group overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-soft-glow cursor-pointer border-c-border bg-white rounded-card flex flex-col", className)}>
      <div className="relative aspect-[3/4] bg-surface-warm w-full overflow-hidden">
        <img src={imageUrl} alt={title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
        
        {/* Match Score Badge (Top Left) */}
        {matchScore && (
          <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm text-ink px-2.5 py-1 rounded-pill text-[10px] font-semibold tracking-wide">
            {matchScore} Match
          </div>
        )}

        {/* Hover Try On Button (Centered) */}
        <div className="absolute inset-0 bg-ink/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
          <div 
            onClick={(e) => {
              if (onTryOnClick) {
                e.preventDefault();
                e.stopPropagation();
                onTryOnClick(e);
              }
            }}
            className="bg-white text-ink font-semibold px-6 py-2.5 rounded-full shadow-lg scale-95 group-hover:scale-100 transition-transform text-xs cursor-pointer hover:bg-surface-warm"
          >
            Try On
          </div>
        </div>
      </div>
      <CardContent className="p-4 pt-3 flex-1 flex flex-col">
        <h3 className="font-bold text-ink text-sm mb-1 truncate">{title}</h3>
        <p className="text-xs text-ink-second line-clamp-2 leading-relaxed">{description}</p>
      </CardContent>
    </Card>
  );
}


