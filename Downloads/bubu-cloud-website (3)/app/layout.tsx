import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Orbitron, Quicksand } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "./components/theme-provider";
import { LayoutWrapper } from "./components/layout-wrapper";
import { LanguageProvider } from "./contexts/LanguageContext";
import CookieConsent from "./components/CookieConsent";
import ChristmasSnowfall from "./components/ChristmasSnowfall";
import { Analytics } from "@vercel/analytics/next"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
  preload: true,
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
  preload: false,
});

const orbitron = Orbitron({
  variable: "--font-orbitron",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  display: "swap",
  preload: true,
});

const quicksand = Quicksand({
  variable: "--font-quicksand",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
  preload: false,
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  colorScheme: "dark",
  themeColor: "#020617",
}

export const metadata: Metadata = {
  title: {
    default: "Bubu Cloud — Fast, Secure & Reliable Hosting",
    template: "%s | Bubu Cloud"
  },
  description: "Bubu Cloud provides fast, secure and reliable Minecraft, web and application hosting.",
  keywords: [
    "Bubu Cloud",
    "cloud hosting",
    "minecraft hosting",
    "web hosting",
    "bot hosting",
    "discord bot hosting",
    "NVMe hosting",
    "DDoS protection",
    "low latency hosting",
    "24/7 support",
    "game server hosting"
  ],
  authors: [{ name: "Bubu Cloud" }],
  creator: "Bubu Cloud",
  publisher: "Bubu Cloud",
  category: "Cloud Hosting & Server Solutions",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://bubucloud.com",
    siteName: "Bubu Cloud",
    title: "Bubu Cloud — Fast, Secure & Reliable Hosting",
    description: "Fast, secure and reliable hosting built for gamers, developers and growing projects. Minecraft, web and bot hosting powered by NVMe infrastructure.",
    images: [
      {
        url: "https://bubucloud.com/meta/Banner.png",
        width: 1200,
        height: 630,
        alt: "Bubu Cloud — Fast, Secure & Reliable Hosting",
        type: "image/png"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: "Bubu Cloud — Fast, Secure & Reliable Hosting",
    description: "Fast, secure and reliable hosting built for gamers, developers and growing projects.",
    images: ["https://bubucloud.com/meta/Banner.png"]
  },
  robots: {
    index: true,
    follow: true,
    noarchive: false,
    nosnippet: false,
    noimageindex: false,
    nocache: false,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },

  applicationName: "Bubu Cloud",
  referrer: "origin-when-cross-origin",

  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/meta/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/meta/favicon-192.png", sizes: "192x192", type: "image/png" }
    ],
    apple: [
      { url: "/meta/apple-touch-icon.png", sizes: "180x180", type: "image/png" }
    ],
    shortcut: "/meta/favicon-32.png"
  },

  alternates: {
    canonical: "https://bubucloud.com"
  },
  other: {
    "msapplication-TileColor": "#020617",
    "msapplication-config": "/browserconfig.xml",
    "terms-of-service": "https://bubucloud.com/terms-of-services",
    "privacy-policy": "https://bubucloud.com/privacy-policy"
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="format-detection" content="telephone=no" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Bubu Cloud" />
        <meta name="crawl-delay" content="10" />
        <meta name="revisit-after" content="7 days" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              "name": "Bubu Cloud",
              "url": "https://bubucloud.com",
              "logo": "https://bubucloud.com/meta/Logo.png",
              "description": "Fast, secure and reliable Minecraft, web and application hosting.",
              "serviceType": ["Minecraft Hosting", "Web Hosting", "Bot Hosting", "Cloud Infrastructure"],
              "areaServed": "Worldwide",
              "hasOfferCatalog": {
                "@type": "OfferCatalog",
                "name": "Bubu Cloud Hosting Plans",
                "itemListElement": [
                  {
                    "@type": "Offer",
                    "itemOffered": {
                      "@type": "Service",
                      "name": "Minecraft Hosting",
                      "description": "High-performance Minecraft server hosting with NVMe storage and DDoS protection"
                    }
                  },
                  {
                    "@type": "Offer",
                    "itemOffered": {
                      "@type": "Service",
                      "name": "Web Hosting",
                      "description": "NVMe-backed web hosting with free SSL and daily backups"
                    }
                  },
                  {
                    "@type": "Offer",
                    "itemOffered": {
                      "@type": "Service",
                      "name": "Bot Hosting",
                      "description": "Discord bot, Telegram bot, Node.js and Python application hosting"
                    }
                  }
                ]
              },
              "sameAs": [],
              "contactPoint": {
                "@type": "ContactPoint",
                "contactType": "customer service",
                "availableLanguage": "English",
                "serviceType": "Technical Support"
              },
              "termsOfService": "https://bubucloud.com/terms-of-services",
              "privacyPolicy": "https://bubucloud.com/privacy-policy"
            })
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${orbitron.variable} ${quicksand.variable} antialiased min-h-screen bg-[#020617] text-slate-100 transition-colors duration-300`}
        suppressHydrationWarning
      >
        <ThemeProvider attribute="class" defaultTheme="dark" forcedTheme="dark" disableTransitionOnChange>
          <LanguageProvider>
            <ChristmasSnowfall />
            <LayoutWrapper>
              {children}
              <Analytics />
            </LayoutWrapper>
            <CookieConsent />
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
