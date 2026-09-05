import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Legal Metrology Compliance Assistant | SIH PS 26034',
  description: 'Official Legal Metrology (Packaged Commodities) Rules 2011 Compliance Enforcement Tool',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
