import type { Metadata } from 'next';
import './globals.css';
import { SiteHeader } from '@/components/site-header';

export const metadata: Metadata = {
  title: 'CineMate — Find your next favorite',
  description: 'Find a film, pick your seats, and make a night of it with CineMate.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background text-foreground antialiased"><SiteHeader />{children}</body>
    </html>
  );
}
