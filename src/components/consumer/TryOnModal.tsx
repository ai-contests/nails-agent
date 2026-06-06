'use client';

import { useState, useEffect, useRef } from 'react';
import { Dialog } from '../ui/Dialog';
import { Button } from '../ui/Button';
import { Loader2, Camera, AlertTriangle, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export interface TryOnModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  styleId: string;
  styleName: string;
  styleImageUrl: string;
  sessionId: string | null;
  handImageId: string | null;
}

function getDemoHandModel(styleId: string): string {
  const mapping: Record<string, string> = {
    'palm_down_top_fair': 'hand_palm_down_top_fair_offwhite.png',
    'palm_down_top_medium': 'hand_palm_down_top_medium_softblue.png',
    'palm_down_top_deep': 'hand_palm_down_top_deep_offwhite.png',
    'fist_thumb_up_fair': 'hand_fist_thumb_up_fair_softblue.png',
    'fist_thumb_up_medium': 'hand_fist_thumb_up_medium_offwhite.png',
    'fist_thumb_up_deep': 'hand_fist_thumb_up_deep_softblue.png',
    'two_hands_clasped_fair': 'hand_two_hands_clasped_fair_softbeige.png',
    'two_hands_clasped_deep': 'hand_two_hands_clasped_deep_softpink.png',
    'reaching_down_fair': 'hand_reaching_down_fair_softbeige.png',
    'reaching_down_medium': 'hand_reaching_down_medium_softpink.png',
    'reaching_down_deep': 'hand_reaching_down_deep_softblue.png',
    'fingers_cupped_fair': 'hand_fingers_cupped_fair_offwhite.png',
    'fingers_cupped_medium': 'hand_fingers_cupped_medium_softbeige.png',
    'fingers_cupped_deep': 'hand_fingers_cupped_deep_softpink.png',
  };

  const idNum = parseInt(styleId.replace(/[^\d]/g, '')) || 0;
  const tags = Object.keys(mapping);
  const tag = tags[idNum % tags.length] || 'palm_down_top_fair';
  const handName = mapping[tag] || 'hand_palm_down_top_fair_offwhite.png';
  return `/data/hand_models/pool/${handName}`;
}

export function TryOnModal({
  open,
  onOpenChange,
  styleId,
  styleName,
  styleImageUrl,
  sessionId,
  handImageId,
}: TryOnModalProps) {
  const [sliderPosition, setSliderPosition] = useState(50);
  const [jobStatus, setJobStatus] = useState<'idle' | 'running' | 'success' | 'failed'>('idle');
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [originalHandImage, setOriginalHandImage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [tryOnMode, setTryOnMode] = useState<'demo' | 'custom' | null>(null);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const getHandModelFromImageUrl = (url: string): string => {
    const mapping: Record<string, string> = {
      'palm_down_top_fair': 'hand_palm_down_top_fair_offwhite.png',
      'palm_down_top_medium': 'hand_palm_down_top_medium_softblue.png',
      'palm_down_top_deep': 'hand_palm_down_top_deep_offwhite.png',
      'fist_thumb_up_fair': 'hand_fist_thumb_up_fair_softblue.png',
      'fist_thumb_up_medium': 'hand_fist_thumb_up_medium_offwhite.png',
      'fist_thumb_up_deep': 'hand_fist_thumb_up_deep_softblue.png',
      'two_hands_clasped_fair': 'hand_two_hands_clasped_fair_softbeige.png',
      'two_hands_clasped_deep': 'hand_two_hands_clasped_deep_softpink.png',
      'reaching_down_fair': 'hand_reaching_down_fair_softbeige.png',
      'reaching_down_medium': 'hand_reaching_down_medium_softpink.png',
      'reaching_down_deep': 'hand_reaching_down_deep_softblue.png',
      'fingers_cupped_fair': 'hand_fingers_cupped_fair_offwhite.png',
      'fingers_cupped_medium': 'hand_fingers_cupped_medium_softbeige.png',
      'fingers_cupped_deep': 'hand_fingers_cupped_deep_softpink.png',
    };

    const filename = url.split('/').pop() || '';
    const match = filename.match(/canon_\d+_(.+)\.png/);
    const handTag = (match && match[1]) ? match[1] : '';
    const handName = mapping[handTag];
    if (handName) {
      return `/data/hand_models/pool/${handName}`;
    }
    return getDemoHandModel(styleId);
  };

  // Reset modal state when closed/opened
  useEffect(() => {
    if (!open) {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
      setJobStatus('idle');
      setResultImage(null);
      setErrorMessage(null);
      setTryOnMode(null);
    }
  }, [open]);

  // Fetch recommendations when opened
  useEffect(() => {
    if (open) {
      const fetchRecs = async () => {
        try {
          const url = sessionId 
            ? `/api/similar-hand-recommendations?sessionId=${encodeURIComponent(sessionId)}`
            : `/api/recommendations/main`;
          const res = await fetch(url);
          const data = await res.json();
          if (data.items) {
            const items = data.items
              .map((i: any) => i.style || i)
              .filter((i: any) => i.style_id !== styleId)
              .slice(0, 3);
            setRecommendations(items);
          }
        } catch (e) {
          console.error(e);
        }
      };
      fetchRecs();
    }
  }, [open, styleId, sessionId]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  const startCustomTryOn = async () => {
    if (!sessionId || !styleId || !handImageId) {
      setErrorMessage('Missing session credentials.');
      setJobStatus('failed');
      return;
    }

    setTryOnMode('custom');
    setJobStatus('running');
    setErrorMessage(null);

    try {
      const res = await fetch('/api/tryon-jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, styleId, handImageId }),
      });

      if (!res.ok) {
        throw new Error(`Failed to submit tryon job: Status ${res.status}`);
      }

      const data = await res.json();
      if (data.error) {
        throw new Error(data.error);
      }

      const jobId = data.tryonJobId;
      pollJobStatus(jobId);
    } catch (err) {
      console.error(err);
      setErrorMessage((err as Error).message || 'Failed to trigger try-on.');
      setJobStatus('failed');
    }
  };

  const startDemoTryOn = async () => {
    setTryOnMode('demo');
    setJobStatus('running');
    
    setTimeout(async () => {
      try {
        const res = await fetch(`/api/styles/${styleId}`);
        const data = await res.json();
        
        if (data.style && data.style.image_url) {
          const tryOnImg = data.style.image_url.startsWith('http') || data.style.image_url.startsWith('/')
            ? data.style.image_url
            : `/api/local-image?path=${encodeURIComponent(data.style.image_url)}`;
          
          setResultImage(tryOnImg);
          setOriginalHandImage(getHandModelFromImageUrl(styleImageUrl));
          setJobStatus('success');
        } else {
          throw new Error('Nail style details not found.');
        }
      } catch (err) {
        setErrorMessage('Failed to load demo try-on assets.');
        setJobStatus('failed');
      }
    }, 1200);
  };

  const pollJobStatus = (jobId: string) => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);

    pollIntervalRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/tryon-jobs/${jobId}`);
        if (!res.ok) return;

        const data = await res.json();
        
        if (data.status === 'success') {
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          setResultImage(data.resultImageUrl);
          setOriginalHandImage(data.inputHandImageUrl);
          setJobStatus('success');
        } else if (data.status === 'failed') {
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          setErrorMessage(data.errorMessage || 'AI generation failed.');
          setJobStatus('failed');
        }
      } catch (err) {
        console.error('Error polling try-on status:', err);
      }
    }, 2000);
  };

  const hasSession = !!sessionId && !!handImageId;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <div className="bg-white p-6 max-w-xl mx-auto rounded-card">
        
        {/* Scenario 1: Setup options / Choice Screen */}
        {jobStatus === 'idle' && (
          <div>
            <h2 className="text-xl font-bold text-ink mb-2 text-center">AI Try-On Studio</h2>
            <p className="text-ink-second text-xs text-center mb-6">Select how you want to preview the <strong>{styleName}</strong> design</p>
            
            <div className="space-y-4 mb-6">
              {/* Option 1: Instant Demo Mode */}
              <button 
                onClick={startDemoTryOn}
                className="w-full text-left p-4 border border-c-border hover:border-primary/50 hover:bg-surface-warm rounded-xl transition-all flex items-center justify-between group"
              >
                <div>
                  <h3 className="font-semibold text-sm text-ink group-hover:text-primary transition-colors">Instant Demo Preview</h3>
                  <p className="text-xs text-ink-second mt-1 leading-relaxed">Preview this nail style instantly on a matching hand model. No upload required.</p>
                </div>
                <ArrowRight className="w-5 h-5 text-ink-light group-hover:text-primary group-hover:translate-x-1 transition-all" />
              </button>

              {/* Option 2: Custom Generative AI Try-on */}
              {hasSession ? (
                <button 
                  onClick={startCustomTryOn}
                  className="w-full text-left p-4 border border-c-border hover:border-primary/50 hover:bg-surface-warm rounded-xl transition-all flex items-center justify-between group"
                >
                  <div>
                    <h3 className="font-semibold text-sm text-ink group-hover:text-primary transition-colors">Custom AI Try-On (Hand Profile Active)</h3>
                    <p className="text-xs text-ink-second mt-1 leading-relaxed">Generate a photorealistic try-on overlay mapped to your custom hand scan.</p>
                  </div>
                  <ArrowRight className="w-5 h-5 text-ink-light group-hover:text-primary group-hover:translate-x-1 transition-all" />
                </button>
              ) : (
                <div className="p-4 border border-dashed border-c-border rounded-xl bg-surface-warm/50 flex flex-col md:flex-row items-center justify-between gap-4">
                  <div>
                    <h3 className="font-semibold text-sm text-ink-second">Personalized Try-On</h3>
                    <p className="text-xs text-ink-light mt-1 leading-relaxed">Upload your hand photo to see custom styles mapped to your skin tone and nail shape.</p>
                  </div>
                  <Link href={`/hand?fromStyleId=${styleId}`} onClick={() => onOpenChange(false)} className="shrink-0">
                    <Button variant="outline" size="sm" className="gap-1 bg-white text-xs">
                      <Camera className="w-3.5 h-3.5" /> Scan Hand
                    </Button>
                  </Link>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 border-t border-c-border pt-4">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Scenario 2: Job Running */}
        {jobStatus === 'running' && (
          <div className="text-center py-12 flex flex-col items-center">
            <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
            <h3 className="text-base font-bold text-ink mb-2">
              {tryOnMode === 'demo' ? 'Loading Hand Model Calibration...' : 'Rendering Virtual Overlay...'}
            </h3>
            <p className="text-xs text-ink-second max-w-xs leading-relaxed">
              {tryOnMode === 'demo' 
                ? 'Aligning nail designs on the pre-calibrated hand model.' 
                : 'Our Diffusion models are aligning the nail plates, skin tones, and lighting. This typically takes 5-10 seconds.'
              }
            </p>
          </div>
        )}

        {/* Scenario 3: Job Failed */}
        {jobStatus === 'failed' && (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-error/10 rounded-full flex items-center justify-center mx-auto mb-4 text-error">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-ink mb-2">Generation Failed</h3>
            <p className="text-xs text-error mb-8 font-mono bg-error/5 p-3 rounded border border-error/10 max-w-md mx-auto">
              {errorMessage || 'Unknown ComfyCloud runtime error.'}
            </p>
            <div className="flex justify-center gap-4">
              <Button variant="outline" onClick={() => setJobStatus('idle')}>
                Back
              </Button>
              <Button variant="default" onClick={tryOnMode === 'demo' ? startDemoTryOn : startCustomTryOn}>
                Retry
              </Button>
            </div>
          </div>
        )}

        {/* Scenario 4: Job Success (Show Slider) */}
        {jobStatus === 'success' && resultImage && originalHandImage && (
          <div>
            <h2 className="text-xl font-bold text-ink mb-4 text-center">
              {tryOnMode === 'demo' ? `Preview: ${styleName}` : `AI Try-On Result`}
            </h2>

            {/* Before/After Slider */}
            <div className="relative w-full aspect-[3/4] bg-surface-warm rounded-lg overflow-hidden select-none mb-6 border border-c-border">
              {/* Before Image (underneath) */}
              <img 
                src={originalHandImage} 
                alt="Original Hand" 
                className="absolute inset-0 w-full h-full object-cover"
              />
              
              {/* After Image (Clipped using clipPath) */}
              <div 
                className="absolute inset-0"
                style={{ clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` }}
              >
                <img 
                  src={resultImage} 
                  alt="Try On Result" 
                  className="absolute inset-0 w-full h-full object-cover"
                />
              </div>

              {/* Slider Line */}
              <div 
                className="absolute inset-y-0 w-0.5 bg-white shadow-[0_0_10px_rgba(0,0,0,0.3)] z-20 pointer-events-none"
                style={{ left: `${sliderPosition}%` }}
              />
              
              <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-sm text-white text-[10px] px-2 py-1 rounded">BEFORE</div>
              <div className="absolute bottom-4 right-4 bg-black/60 backdrop-blur-sm text-white text-[10px] px-2 py-1 rounded">AFTER</div>
              
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

            {/* Recommended Styles */}
            {recommendations.length > 0 && (
              <div className="mb-6">
                <h4 className="text-[10px] font-bold text-ink-light tracking-widest uppercase mb-3 text-left">Recommended Styles</h4>
                <div className="grid grid-cols-3 gap-3">
                  {recommendations.map((rec) => {
                    const recImg = rec.image_url.startsWith('http') || rec.image_url.startsWith('/')
                      ? rec.image_url
                      : `/api/local-image?path=${encodeURIComponent(rec.image_url)}`;
                    
                    let recName = rec.style_id;
                    try {
                      const colors = JSON.parse(rec.color_tags);
                      if (colors.length > 0) recName = colors[0].replace(/\b\w/g, (c: string) => c.toUpperCase());
                    } catch (e) {}

                    return (
                      <Link 
                        href={`/styles/${rec.style_id}?autoTryOn=true`} 
                        key={rec.style_id}
                        onClick={() => onOpenChange(false)}
                        className="group border border-c-border hover:border-primary/50 rounded-lg p-1.5 flex flex-col items-center bg-surface-warm/30 hover:bg-white transition-all"
                      >
                        <div className="aspect-[3/4] w-full rounded overflow-hidden mb-1.5 bg-surface-warm">
                          <img src={recImg} alt={recName} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                        </div>
                        <span className="text-[10px] font-semibold text-ink truncate w-full text-center">{recName}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex justify-between items-center gap-4">
              <Button variant="outline" className="flex-1" onClick={() => setJobStatus('idle')}>
                Try Another Method
              </Button>
              <Button variant="default" className="flex-1" onClick={() => onOpenChange(false)}>
                Done
              </Button>
            </div>
          </div>
        )}
      </div>
    </Dialog>
  );
}
