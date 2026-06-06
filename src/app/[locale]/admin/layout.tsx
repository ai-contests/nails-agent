import { setRequestLocale } from 'next-intl/server';

export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div suppressHydrationWarning className="min-h-screen bg-bg-dark text-text-dark-primary font-sans antialiased overflow-hidden">
      {children}
    </div>
  );
}

