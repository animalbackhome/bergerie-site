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

export const metadata: Metadata = {
  metadataBase: new URL('https://superbe-bergerie-foret-piscine-lac.com'),
  
  // TA VALIDATION GOOGLE (C'est la ligne magique)
  verification: {
    google: 'Eu_G0T3L0kvNtJcJg7bxU8GoHaxVdqIBtQpB35vpGvo',
  },

  title: "✅ Site Officiel entre particuliers sans commissions | Bergerie Piscine & Lac",
  description: "🚫 Zéro frais de plateforme. Réservez en direct au meilleur prix. 🌿 Superbe bergerie 215m² isolée en forêt, 💦 piscine privée au sel, accès direct lac et cascades. Calme absolu.",
  
  openGraph: {
    title: "✅ Site Officiel : Bergerie sans commissions (Piscine & Lac)",
    description: "Économisez en réservant en direct. Villa de rêve isolée en Provence Verte.",
    url: 'https://superbe-bergerie-foret-piscine-lac.com',
    siteName: 'Bergerie Carcès Direct Propriétaire',
    locale: 'fr_FR',
    type: 'website',
    images: [
      {
        url: '/nom-de-ta-meilleure-photo.jpg', // VERIFIE QUE C'EST LE BON NOM ICI
        width: 1200,
        height: 630,
        alt: 'Vue sublime de la bergerie en pierre avec piscine privée et forêt',
      },
    ],
  },
};

// DONNÉES STRUCTURÉES (INVISIBLE)
const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'VacationRental',
  name: 'Superbe Bergerie Forêt Piscine Lac',
  description: 'Bergerie provençale en pleine nature à Carcès avec piscine privée et accès lac.',
  url: 'https://superbe-bergerie-foret-piscine-lac.com',
  address: {
    '@type': 'PostalAddress',
    addressLocality: 'Carcès',
    addressRegion: 'Var',
    postalCode: '83570',
    addressCountry: 'FR'
  },
  geo: {
    '@type': 'GeoCoordinates',
    latitude: 43.476, 
    longitude: 6.182
  },
  amenityFeature: [
    { '@type': 'LocationFeatureSpecification', name: 'Piscine Privée', value: true },
    { '@type': 'LocationFeatureSpecification', name: 'Accès Lac', value: true },
    { '@type': 'LocationFeatureSpecification', name: 'Forêt', value: true },
    { '@type': 'LocationFeatureSpecification', name: 'Climatisation', value: true }
  ]
}

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
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        {children}
      </body>
    </html>
  );
}