import type { Metadata } from "next";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    googleBot: { index: false, follow: false },
  },
  manifest: "/pwa/motorista.webmanifest",
  icons: {
    icon: [{ url: "/pwa/motorista-icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/pwa/motorista-apple.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    title: "Motorista",
    statusBarStyle: "default",
  },
};

export default function MotoristaLayout({ children }: LayoutProps<"/motorista">) {
  return children;
}
