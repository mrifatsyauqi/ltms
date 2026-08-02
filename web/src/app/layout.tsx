import type { Metadata } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

// Font utama seluruh UI. Dipetakan ke --font-sans (dipakai font-sans &
// font-heading di globals.css), jadi semua teks memakai Inter.
const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

// Monospace tetap dipertahankan untuk kolom No. Waybill (butuh lebar karakter
// seragam agar rapi/mudah dibaca).
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "LTMS - LongTail Monitoring System",
  description: "LongTail Monitoring System - Sistem monitoring & feedback Long Tail",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
