import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

// 1. PWA Metadata
export const metadata: Metadata = {
  title: "LifeTracker",
  description: "Gamified Personal RPG",
  manifest: "/manifest.json",
  icons: { apple: "/icon-192.png" }, // iOS icon link
};

// 2. Mobile Viewport Rules (No Zooming)
export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}