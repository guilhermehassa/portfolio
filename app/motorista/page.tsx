import type { Metadata, Viewport } from "next";
import MotoristaApp from "@/components/motorista/motorista-app";

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#eef3fb" },
    { media: "(prefers-color-scheme: dark)", color: "#081225" },
  ],
};

export const metadata: Metadata = {
  title: "Motorista | Controle financeiro",
  description: "Controle pessoal de jornadas, ganhos, gastos e metas.",
  robots: {
    index: false,
    follow: false,
    googleBot: { index: false, follow: false },
  },
  alternates: { canonical: "/motorista" },
  openGraph: {
    title: "Motorista | Controle financeiro",
    description: "Controle pessoal de jornadas, ganhos, gastos e metas.",
    url: "/motorista",
    type: "website",
    images: [],
  },
  twitter: {
    card: "summary",
    title: "Motorista | Controle financeiro",
    description: "Controle pessoal de jornadas, ganhos, gastos e metas.",
  },
};

export default function MotoristaPage() {
  return <MotoristaApp />;
}
