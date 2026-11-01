import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'CineMate AI',
  description: 'AI-powered movie booking assistant',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
