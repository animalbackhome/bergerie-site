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

// CONFIGURATION SEO POUR SE DÉMARQUER
export const metadata: Metadata = {
  // On dit à Google où est le site principal
  metadataBase: new URL('https://superbe-bergerie-foret-piscine-lac.com'),
  
  // TON TITRE EXACT + Emojis pour attirer l'oeil
  title: "✅ Site Officiel entre particuliers sans commissions | Bergerie Piscine & Lac",
  
  // DESCRIPTION VENDEUSE + Emojis
  description: "🚫 Zéro frais de plateforme. Réservez en direct au meilleur prix. 🌿 Superbe bergerie 215m² isolée en forêt, 💦 piscine privée au sel, accès direct lac et cascades. Calme absolu.",
  
  // Configuration de l'image qui apparaîtra sur Google et Facebook
  openGraph: {
    title: "✅ Site Officiel : Bergerie sans commissions (Piscine & Lac)",
    description: "Économisez en réservant en direct. Villa de rêve isolée en Provence Verte.",
    url: 'https://superbe-bergerie-foret-piscine-lac.com',
    siteName: 'Bergerie Carcès Direct Propriétaire',
    locale: 'fr_FR',
    type: 'website',
    images: [
      {
        // --- REMPLACE CE NOM PAR CELUI DE TA MEILLEURE PHOTO DANS LE DOSSIER PUBLIC ---
        url: '/nom-de-ta-meilleure-photo.jpg', 
        width: 1200, // Laisse ces dimensions, c'est le standard Google
        height: 630,
        alt: 'Vue sublime de la bergerie en pierre avec piscine privée et forêt',
      },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}