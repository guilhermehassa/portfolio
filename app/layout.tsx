import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Barlow, Barlow_Condensed } from "next/font/google";
import { LanguageProvider } from "@/components/language-provider";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

const barlow = Barlow({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-barlow",
  display: "swap",
});

const barlowCondensed = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-barlow-condensed",
  display: "swap",
});

const SITE_URL = "https://hassa.dev.br";
const TITLE = "Guilherme Hassã - Desenvolvedor Web";
const DESCRIPTION =
  "Landing page profissional de Guilherme Hassã, desenvolvedor web com foco em performance, experiência e resultado.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  authors: [{ name: "Guilherme Hassa" }],
  // Next normalizes the trailing slash off canonical/og:url regardless of
  // whether this is relative or an absolute `${SITE_URL}/` — a bare "/"
  // is the simpler form for an identical resolved result.
  alternates: { canonical: "/" },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    url: "/",
    siteName: TITLE,
    title: TITLE,
    description: DESCRIPTION,
    images: [{ url: "/perfil.png", alt: "Foto profissional de Guilherme Hassã" }],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/perfil.png"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0b1220",
};

const JSON_LD = {
  "@context": "https://schema.org",
  "@type": "Person",
  name: "Guilherme Hassã",
  jobTitle: "Desenvolvedor Web",
  url: `${SITE_URL}/`,
  image: `${SITE_URL}/perfil.png`,
  email: "mailto:contato@hassa.dev.br",
  sameAs: ["https://linkedin.com/in/guilhermehassa", "https://github.com/guilhermehassa"],
  worksFor: {
    "@type": "Organization",
    name: "Atendimento independente",
  },
  knowsAbout: ["Desenvolvimento web", "WordPress", "Next.js", "PHP", "SEO técnico"],
};

// Runs before hydration: marks <html> as JS-capable (gates the scroll-reveal
// CSS) and applies the persisted/preferred color theme immediately, so
// there's no flash of the wrong theme on load.
const INIT_SCRIPT = `(function () {
  document.documentElement.classList.add("js");
  try {
    var stored = localStorage.getItem("portfolio.theme");
    var theme = stored === "light" || stored === "dark"
      ? stored
      : (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    }
  } catch (e) {}
})();`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`scroll-smooth ${barlow.variable} ${barlowCondensed.variable}`}
      suppressHydrationWarning
    >
      <body className="font-body">
        <Script id="app-init" strategy="beforeInteractive">
          {INIT_SCRIPT}
        </Script>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD).replace(/</g, "\\u003c") }}
        />
        <LanguageProvider>
          <ThemeProvider>{children}</ThemeProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
