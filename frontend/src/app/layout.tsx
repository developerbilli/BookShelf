import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: "Whimsicalwhiner's Library — Everything I've Read",
  description: "An ethereal, horizontally scrolling shelf of every book I've finished — and a to-read shelf anyone can add to. Recommend me a book.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased selection:bg-[#C86D51] selection:text-white">
        {children}
      </body>
    </html>
  );
}
