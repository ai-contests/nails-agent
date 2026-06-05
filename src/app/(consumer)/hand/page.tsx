'use client';

import { Camera, CheckCircle2, Lightbulb } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

export default function HandStudioPage() {
  return (
    <div className="max-w-7xl mx-auto px-8 py-12">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-display font-bold text-ink">Hand Profile Studio</h1>
        <div className="bg-blush-light text-primary px-3 py-1 rounded-pill text-[10px] font-bold tracking-widest uppercase">
          AI-Powered Analysis
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: Dropzone */}
        <div className="lg:col-span-2">
          <Card className="aspect-video w-full bg-surface-warm border-2 border-dashed border-c-border flex flex-col items-center justify-center p-8 hover:border-c-border-focus transition-colors shadow-none cursor-pointer">
            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm mb-6 text-ink-second">
              <Camera className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-ink mb-2">Drop hand photo or click to upload</h3>
            <p className="text-ink-second text-sm mb-8 text-center max-w-md">
              Ensure your hand is on a flat, neutral surface for 99.9% accuracy.
            </p>
            <Button variant="default" className="shadow-soft-glow">
              Start Scan
            </Button>
          </Card>
        </div>

        {/* Right: Analysis Parameters */}
        <div className="flex flex-col gap-6">
          <Card className="p-8 border-c-border shadow-sm">
            <h2 className="text-lg font-bold text-ink mb-6">Detected Parameters</h2>
            
            <div className="space-y-6">
              <div className="border-b border-c-border pb-4">
                <div className="text-[10px] font-bold text-ink-light tracking-widest uppercase mb-2">Hand Type</div>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-ink text-lg uppercase tracking-wider">Almond</span>
                  <span className="text-success text-xs font-mono">94.2% Match</span>
                </div>
              </div>

              <div className="border-b border-c-border pb-4">
                <div className="text-[10px] font-bold text-ink-light tracking-widest uppercase mb-2">Skin Tone</div>
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-[#E6D2C4] shadow-inner" />
                  <div>
                    <div className="font-mono text-ink text-sm uppercase">#E6D2C4</div>
                    <div className="text-xs text-ink-second font-mono mt-1">Warm Ivory</div>
                  </div>
                </div>
              </div>

              <div className="pb-4">
                <div className="text-[10px] font-bold text-ink-light tracking-widest uppercase mb-2">Metric Status</div>
                <div className="flex items-center gap-2 text-ink">
                  <CheckCircle2 className="w-5 h-5 text-success" />
                  <span className="font-mono text-sm">Verified Profile</span>
                </div>
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-c-border text-center">
              <Button variant="default" className="w-full mb-3 shadow-soft-glow py-6">
                Apply Hand Profile & Search →
              </Button>
              <p className="text-[10px] text-ink-second">This profile will be used to calibrate all AR Try-ons.</p>
            </div>
          </Card>

          <Card className="p-6 bg-surface-warm border-none shadow-none flex gap-4 items-start">
            <Lightbulb className="w-6 h-6 text-primary shrink-0" />
            <div>
              <h4 className="font-bold text-ink text-sm mb-1">Pro Tip</h4>
              <p className="text-xs text-ink-second leading-relaxed">
                Keep your fingers slightly spread for the most accurate detection of your nail bed width.
              </p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
