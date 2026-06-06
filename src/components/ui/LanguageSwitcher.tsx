'use client';

import { useLocale } from 'next-intl';
import { useRouter, usePathname } from '@/src/i18n/routing';
import { useTransition } from 'react';
import { Globe } from 'lucide-react';

export function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const handleLocaleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nextLocale = e.target.value;
    startTransition(() => {
      router.replace(pathname, { locale: nextLocale });
    });
  };

  return (
    <div className="relative flex items-center gap-1.5 bg-surface-warm border border-c-border px-3 py-1.5 rounded-pill hover:border-c-border-focus transition-colors">
      <Globe className="w-4 h-4 text-ink-second shrink-0" />
      <select
        value={locale}
        onChange={handleLocaleChange}
        disabled={isPending}
        className="bg-transparent text-xs font-semibold text-ink focus:outline-none cursor-pointer pr-1"
      >
        <option value="zh">中文</option>
        <option value="en">English</option>
      </select>
    </div>
  );
}

