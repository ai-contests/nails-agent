'use client';

import { useState, useEffect, useRef } from 'react';
import { Camera, CheckCircle2, Lightbulb, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useRouter } from '@/src/i18n/routing';
import { useTranslations } from 'next-intl';

interface HandProfile {
  sessionId: string;
  handImageId: string;
  imageUrl: string;
  handShape: string;
  skinTone: string;
  skinRgb?: [number, number, number];
}

export default function HandStudioPage() {
  const router = useRouter();
  const t = useTranslations('hand');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [progress, setProgress] = useState(0);
  const [profile, setProfile] = useState<HandProfile | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fromStyleId, setFromStyleId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setFromStyleId(new URLSearchParams(window.location.search).get('fromStyleId'));
    }

    const savedSession = localStorage.getItem('nails_session_id');
    const savedImage = localStorage.getItem('nails_hand_image_id');
    const savedProfile = localStorage.getItem('nails_hand_profile');

    if (savedSession && savedImage && savedProfile) {
      try {
        const parsed = JSON.parse(savedProfile);
        setProfile({
          sessionId: savedSession,
          handImageId: savedImage,
          imageUrl: parsed.imageUrl || '',
          handShape: parsed.handShape || 'unknown',
          skinTone: parsed.skinTone || 'unknown',
          skinRgb: parsed.skinRgb,
        });
        setStatus('success');
      } catch (e) {
        console.error('Failed to parse saved hand profile:', e);
      }
    }
  }, []);

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0]!;
    await uploadHandFile(file);
  };

  const uploadHandFile = async (file: File) => {
    setStatus('uploading');
    setProgress(0);
    setErrorMessage(null);

    const progressInterval = setInterval(() => {
      setProgress(p => p >= 90 ? p : p + (Math.random() * 10 + 2));
    }, 500);

    const formData = new FormData();
    formData.append('file', file);
    
    let clientId = localStorage.getItem('nails_client_id');
    if (!clientId) {
      clientId = 'client_' + Math.random().toString(36).substring(2, 15);
      localStorage.setItem('nails_client_id', clientId);
    }
    formData.append('clientId', clientId);

    try {
      const res = await fetch('/api/hand-images', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        throw new Error(`Upload failed with status ${res.status}`);
      }

      const data = await res.json();
      if (data.error) {
        throw new Error(data.error);
      }

      const newProfile: HandProfile = {
        sessionId: data.sessionId,
        handImageId: data.handImageId,
        imageUrl: data.imageUrl,
        handShape: data.handShape,
        skinTone: data.skinTone,
        skinRgb: data.skinRgb,
      };

      setProfile(newProfile);
      
      localStorage.setItem('nails_session_id', data.sessionId);
      localStorage.setItem('nails_hand_image_id', data.handImageId);
      localStorage.setItem('nails_hand_profile', JSON.stringify({
        imageUrl: data.imageUrl,
        handShape: data.handShape,
        skinTone: data.skinTone,
        skinRgb: data.skinRgb,
      }));

      setProgress(100);
      setTimeout(() => {
        setStatus('success');
      }, 400);
    } catch (err) {
      console.error(err);
      setErrorMessage((err as Error).message || 'Failed to scan hand image.');
      setStatus('error');
    } finally {
      clearInterval(progressInterval);
    }
  };

  const handleApplyProfile = () => {
    if (profile) {
      if (fromStyleId) {
        router.push(`/styles/${fromStyleId}?autoTryOn=true`);
      } else {
        router.push(`/gallery?sessionId=${profile.sessionId}&showSimilar=true`);
      }
    }
  };

  const formatShape = (shape: string) => {
    if (status === 'uploading') return t('statusScanning');
    if (!shape) return t('shapes.unknown');
    return t(`shapes.${shape}`);
  };

  const formatSkinTone = (tone: string) => {
    if (status === 'uploading') return t('statusScanning');
    if (!tone) return t('skins.unknown');
    return t(`skins.${tone}`);
  };

  const rgbToHex = (rgb?: [number, number, number]) => {
    if (!rgb) return '#E6D2C4';
    const r = rgb[0].toString(16).padStart(2, '0');
    const g = rgb[1].toString(16).padStart(2, '0');
    const b = rgb[2].toString(16).padStart(2, '0');
    return `#${r}${g}${b}`.toUpperCase();
  };

  return (
    <div className="max-w-7xl mx-auto px-8 py-12">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-display font-bold text-ink">{t('title')}</h1>
        <div className="bg-blush-light text-primary px-3 py-1 rounded-pill text-[10px] font-bold tracking-widest uppercase">
          {t('titleSub')}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: Dropzone / Image Display */}
        <div className="lg:col-span-2">
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            accept="image/*" 
            className="hidden" 
          />

          {status === 'idle' || status === 'error' ? (
            <Card 
              onClick={triggerFileInput}
              className="aspect-video w-full bg-surface-warm border-2 border-dashed border-c-border flex flex-col items-center justify-center p-8 hover:border-c-border-focus transition-colors shadow-none cursor-pointer"
            >
              <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm mb-6 text-ink-second">
                <Camera className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-ink mb-2">{t('dropzoneTitle')}</h3>
              <p className="text-ink-second text-sm mb-8 text-center max-w-md">
                {t('dropzoneTips')}
              </p>
              {errorMessage && (
                <p className="text-error text-xs mb-4 font-mono">{errorMessage}</p>
              )}
              <Button 
                variant="default" 
                className="shadow-soft-glow"
                onClick={(e) => {
                  e.stopPropagation();
                  triggerFileInput();
                }}
              >
                {t('dropzoneTitle').split(' ').slice(-2).join(' ')}
              </Button>
            </Card>
          ) : status === 'uploading' ? (
            <Card className="aspect-video w-full bg-surface-warm border border-c-border flex flex-col items-center justify-center p-8 shadow-none">
              <Loader2 className="w-10 h-10 text-primary animate-spin mb-6" />
              <div className="w-full max-w-xs mb-3 bg-c-border/50 rounded-full h-1.5 overflow-hidden">
                <div 
                  className="bg-primary h-full transition-all duration-300 ease-out rounded-full" 
                  style={{ width: `${Math.min(100, Math.max(0, progress))}%` }} 
                />
              </div>
              <h3 className="text-lg font-bold text-ink mb-1">{t('statusScanning')}</h3>
              <p className="text-ink-second text-xs text-center">{t('statusScanningSub')}</p>
              <p className="text-primary font-mono text-[10px] mt-2">{Math.round(progress)}%</p>
            </Card>
          ) : (
            <Card className="aspect-video w-full bg-surface-warm border border-c-border overflow-hidden relative shadow-none flex items-center justify-center">
              <img 
                src={profile?.imageUrl} 
                alt="Uploaded Hand" 
                className="max-w-full max-h-full object-contain" 
              />
              <button 
                onClick={triggerFileInput} 
                className="absolute bottom-4 right-4 bg-white/95 hover:bg-white text-ink text-xs font-semibold px-4 py-2 rounded-full shadow-md transition-colors"
              >
                {t('statusReupload')}
              </button>
            </Card>
          )}
        </div>

        {/* Right: Analysis Parameters */}
        <div className="flex flex-col gap-6">
          <Card className="p-8 border-c-border shadow-sm bg-white">
            <h2 className="text-lg font-bold text-ink mb-6">{t('detectedTitle')}</h2>
            
            <div className="space-y-6">
              <div className="border-b border-c-border pb-4">
                <div className="text-[10px] font-bold text-ink-light tracking-widest uppercase mb-2">{t('detectedShape')}</div>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-ink text-lg uppercase tracking-wider">
                    {profile ? formatShape(profile.handShape) : t('detectedShape')}
                  </span>
                  {profile && profile.handShape !== 'unknown' && (
                    <span className="text-success text-xs font-mono">{t('calibrated').split(' ')[0]}</span>
                  )}
                </div>
              </div>

              <div className="border-b border-c-border pb-4">
                <div className="text-[10px] font-bold text-ink-light tracking-widest uppercase mb-2">{t('detectedSkin')}</div>
                <div className="flex items-center gap-4">
                  <div 
                    className="w-10 h-10 rounded-lg shadow-inner" 
                    style={{ backgroundColor: profile ? rgbToHex(profile.skinRgb) : '#E6D2C4' }}
                  />
                  <div>
                    <div className="font-mono text-ink text-sm uppercase">
                      {profile ? rgbToHex(profile.skinRgb) : '#E6D2C4'}
                    </div>
                    <div className="text-xs text-ink-second font-mono mt-1">
                      {profile ? formatSkinTone(profile.skinTone) : t('skins.unknown')}
                    </div>
                  </div>
                </div>
              </div>

              <div className="pb-4">
                <div className="text-[10px] font-bold text-ink-light tracking-widest uppercase mb-2">{t('metricStatus')}</div>
                <div className="flex items-center gap-2 text-ink">
                  {profile ? (
                    <>
                      <CheckCircle2 className="w-5 h-5 text-success" />
                      <span className="font-mono text-sm">{t('calibrated')}</span>
                    </>
                  ) : (
                    <span className="text-xs text-ink-second font-mono">{t('uncalibrated')}</span>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-c-border text-center">
              <Button 
                variant="default" 
                className="w-full mb-3 shadow-soft-glow py-6"
                disabled={!profile}
                onClick={handleApplyProfile}
              >
                {fromStyleId ? t('applyBack') : t('applySearch')}
              </Button>
              <p className="text-[10px] text-ink-second">{t('applyTips')}</p>
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

