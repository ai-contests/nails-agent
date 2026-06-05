'use client';

import { useState } from "react";
import { Dialog } from '../ui/Dialog';
import { Button } from '../ui/Button';

export interface TryOnModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  styleName: string;
}

export function TryOnModal({ open, onOpenChange, styleName }: TryOnModalProps) {
  const [sliderPosition, setSliderPosition] = useState(50);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <div className="bg-white p-6">
        <h2 className="text-xl font-bold text-ink mb-4 text-center">Matching {styleName} for Your Hand</h2>
        
        {/* Before/After Slider Placeholder */}
        <div className="relative w-full aspect-video bg-surface-warm rounded-lg overflow-hidden select-none mb-6">
          <div className="absolute inset-0 bg-gray-200" />
          <div 
            className="absolute inset-0 bg-gray-300 border-r-2 border-white"
            style={{ width: `${sliderPosition}%` }}
          />
          <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-sm text-white text-[10px] px-2 py-1 rounded">BEFORE</div>
          <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-sm text-white text-[10px] px-2 py-1 rounded">AFTER</div>
          
          <input 
            type="range" 
            min="0" max="100" 
            value={sliderPosition} 
            onChange={(e) => setSliderPosition(Number(e.target.value))}
            className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize z-10"
          />
          <div 
            className="absolute top-1/2 -translate-y-1/2 w-6 h-6 bg-white rounded-full shadow-lg flex items-center justify-center pointer-events-none"
            style={{ left: `calc(${sliderPosition}% - 12px)` }}
          >
            <div className="flex gap-0.5">
              <div className="w-0.5 h-2 bg-gray-400 rounded-full" />
              <div className="w-0.5 h-2 bg-gray-400 rounded-full" />
            </div>
          </div>
        </div>

        <h3 className="text-sm font-semibold text-ink mb-3">Recommended Styles</h3>
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="aspect-square bg-surface-warm rounded-md" />
          <div className="aspect-square bg-surface-warm rounded-md" />
          <div className="aspect-square bg-surface-warm rounded-md" />
        </div>

        <div className="text-center">
          <Button variant="default" className="w-64 shadow-soft-glow">
            Explore All Matches →
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
