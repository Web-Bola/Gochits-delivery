import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = { title: "ZYRO ადმინ პანელი" };

export default function Root({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ka">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+Georgian:wght@400;600;800&display=swap" />
      </head>
      <body>{children}</body>
    </html>
  );
}
