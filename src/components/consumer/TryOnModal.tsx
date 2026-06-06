'use client';

import { useState, useEffect, useRef } from "react";
import { Dialog } from '../ui/Dialog';
import { Button } from '../ui/Button';
import { Loader2, Camera, AlertTriangle, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export interface TryOnModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  styleId: string;
  styleName: string;
  sessionId: string | null;
  handImageId: string | null;
}

export function TryOnModal({ open, onOpenChange, styleId, styleName, sessionId, handImageId }: TryOnModalProps) {
  const [sliderPosition, setSliderPosition] = useState(50);
  const [jobStatus, setJobStatus] = useState<'idle' | 'running' | 'success' | 'failed'>('idle');
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [originalHandImage, setOriginalHandImage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Reset modal state when closed/opened
  useEffect(() => {
    if (!open) {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
      setJobStatus('idle');
      setResultImage(null);
      setErrorMessage(null);
    }
  }, [open]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  const startTryOn = async () => {
    if (!sessionId || !styleId || !handImageId) {
      setErrorMessage('Missing session credentials.');
      setJobStatus('failed');
      return;
    }

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

  // Check if session exists
  const hasSession = !!sessionId && !!handImageId;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <div className="bg-white p-6 max-w-xl mx-auto rounded-card">
        
        {/* Scenario 1: No scan session active */}
        {!hasSession && (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-blush-light rounded-full flex items-center justify-center mx-auto mb-6 text-primary">
              <Camera className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-ink mb-3">Hand Calibration Required</h2>
            <p className="text-ink-second text-sm max-w-sm mx-auto mb-8 leading-relaxed">
              To preview nail styles on your own hand, please perform a brief hand scan using our AI Studio first.
            </p>
            <div className="flex justify-center gap-4">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Link href="/hand">
                <Button variant="default" className="gap-2">
                  Go to AI Studio <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            </div>
          </div>
        )}

        {/* Scenario 2: Session active, show generation trigger / status */}
        {hasSession && (
          <div>
            <h2 className="text-xl font-bold text-ink mb-4 text-center">
              {jobStatus === 'success' ? `Try-On: ${styleName}` : `AI Try-On Calibration`}
            </h2>

            {jobStatus === 'idle' && (
              <div className="text-center py-10">
                <p className="text-sm text-ink-second max-w-sm mx-auto mb-8 leading-relaxed">
                  Ready to calibrate the <strong>{styleName}</strong> design onto your hand profile. This will generate a high-fidelity virtual try-on render.
                </p>
                <div className="flex justify-center gap-4">
                  <Button variant="outline" onClick={() => onOpenChange(false)}>
                    Close
                  </Button>
                  <Button variant="default" onClick={startTryOn} className="px-8 shadow-soft-glow">
                    Start Try-On Render
                  </Button>
                </div>
              </div>
            )}

            {jobStatus === 'running' && (
              <div className="text-center py-12 flex flex-col items-center">
                <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
                <h3 className="text-base font-bold text-ink mb-2">Rendering Virtual Overlay...</h3>
                <p className="text-xs text-ink-second max-w-xs leading-relaxed">
                  Our Diffusion models are aligning the nail plates, skin tones, and lighting. This typically takes 5-10 seconds.
                </p>
              </div>
            )}

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
                  <Button variant="outline" onClick={() => onOpenChange(false)}>
                    Close
                  </Button>
                  <Button variant="default" onClick={startTryOn}>
                    Retry Try-On
                  </Button>
                </div>
              </div>
            )}

            {jobStatus === 'success' && resultImage && originalHandImage && (
              <div>
                {/* Before/After Slider */}
                <div className="relative w-full aspect-[3/4] bg-surface-warm rounded-lg overflow-hidden select-none mb-6 border border-c-border">
                  {/* Before Image (underneath) */}
                  <img 
                    src={originalHandImage} 
                    alt="Original Hand" 
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                  
                  {/* After Image (clipped width) */}
                  <div 
                    className="absolute inset-0 overflow-hidden border-r-2 border-white shadow-[2px_0_10px_rgba(0,0,0,0.1)]"
                    style={{ width: `${sliderPosition}%` }}
                  >
                    <img 
                      src={resultImage} 
                      alt="Try On Result" 
                      className="absolute inset-0 w-full h-full object-cover"
                      style={{ width: '100%', maxWidth: 'none' }}
                    />
                  </div>
                  
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

                <div className="text-center">
                  <Button variant="outline" className="w-48" onClick={() => onOpenChange(false)}>
                    Done
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Dialog>
  );
}
