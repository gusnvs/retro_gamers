import type { Metadata, Viewport } from "next";
import { Archivo, Sacramento } from "next/font/google";
import "./globals.css";
import AppShell from "@/components/AppShell";

// Decagram (reference font, commercial EULA) is replaced by Archivo — closest
// free metric match measured during the audit (see docs/design-system.md).
const archivo = Archivo({
  variable: "--font-base",
  subsets: ["latin"],
  weight: ["500", "600", "800"],
  display: "swap",
});

const sacramento = Sacramento({
  variable: "--font-script",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Retro Gamers",
  description:
    "Retro Gamers: loja e experiência gamer desde 2013. Curadoria em jogos raros, do Atari ao PS5. Aceitamos seus jogos e consertamos seu videogame.",
  openGraph: {
    title: "Retro Gamers",
    description: "Loja e experiência gamer desde 2013. Curadoria em jogos raros, do Atari ao PS5.",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#3da9f4",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={`${archivo.variable} ${sacramento.variable}`}>
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
