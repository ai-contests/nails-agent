import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Nails Agent',
  description: '美甲 AI 运营 Agent 系统',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh">
      <body>{children}</body>
    </html>
  );
}
