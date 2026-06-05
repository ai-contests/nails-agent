import type { Metadata } from 'next';
import { Plus_Jakarta_Sans, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-plus-jakarta',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
});

export const metadata: Metadata = {
  title: 'Nails-Agent',
  description: 'AI Nail Try-on & Intelligent Operations',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning className={`${plusJakartaSans.variable} ${jetbrainsMono.variable} font-sans antialiased`}>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // Aggressive cleanup of YouTube adblocker extension injected DOM nodes before React hydrates
              const ytExt = document.getElementById('yt-ext-info-bar');
              if (ytExt) ytExt.remove();
              const ytHidden = document.querySelector('.yt-ext-hidden');
              if (ytHidden) ytHidden.remove();
            `,
          }}
        />
        {children}
      </body>
    </html>
  );
}
