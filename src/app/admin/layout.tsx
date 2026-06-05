export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div suppressHydrationWarning className="min-h-screen bg-bg-dark text-text-dark-primary font-sans antialiased overflow-hidden">
      {children}
    </div>
  );
}
