import type { Metadata, Viewport } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { svSE } from "@clerk/localizations";
import { Providers } from "@/components/providers";
import "./globals.css";

// Stoppar iOS Safaris auto-zoom vid fältfokus (sidan fastnade inzoomad och
// såg "oresponsiv" ut). Manuell nyp-zoom fungerar fortfarande — Safari
// ignorerar maximumScale för användargester sedan iOS 10.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  title: "Affärskoll",
  description: "Konsulthantering, tidsrapportering och ekonomisk planering",
  icons: {
    icon: [
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  manifest: "/site.webmanifest",
  openGraph: {
    title: "Affärskoll",
    description: "Konsulthantering, tidsrapportering och ekonomisk planering",
    url: appUrl,
    siteName: "Affärskoll",
    images: [
      {
        url: `${appUrl}/og-image.png`,
        width: 1024,
        height: 1024,
        alt: "Affärskoll",
      },
    ],
    locale: "sv_SE",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Affärskoll",
    description: "Konsulthantering, tidsrapportering och ekonomisk planering",
    images: [`${appUrl}/og-image.png`],
  },
};

const hasClerkKey =
  !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
  !process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY.includes("YOUR_KEY");

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const content = (
    <html lang="sv" suppressHydrationWarning>
      <head>
        <meta
          name="theme-color"
          media="(prefers-color-scheme: light)"
          content="#f0ead8"
        />
        <meta
          name="theme-color"
          media="(prefers-color-scheme: dark)"
          content="#0a0a09"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );

  if (!hasClerkKey) {
    return content;
  }

  return <ClerkProvider localization={svSE}>{content}</ClerkProvider>;
}
