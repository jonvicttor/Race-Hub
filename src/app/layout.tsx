import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Atualizando o nome do seu projeto nos motores de busca
export const metadata: Metadata = {
  title: "Race Hub | Squad Dashboard",
  description: "Gerencie suas corridas e treinos com o Squad",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-br" className="h-full">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground min-h-full`}
      >
        {/* O children aqui é onde o Next injeta as suas páginas (Home, Login, etc.) */}
        {children}
      </body>
    </html>
  );
}