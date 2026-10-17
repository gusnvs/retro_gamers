import type { Metadata } from "next";
import { Archivo } from "next/font/google";
import RacerClient from "@/components/racer/RacerClient";

// The reference HUD uses Druk Wide (commercial licence): Archivo's width axis at
// 125% is the closest free equivalent (see docs/retro-smash-racer.md).
const wide = Archivo({
  variable: "--font-wide",
  subsets: ["latin"],
  axes: ["wdth"],
  style: ["normal", "italic"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Retro Smash Racer — Retro Gamers",
  description: "Pilote o kart do invader da Retro Gamers, derrube cartuchos, consoles e fichas de fliperama e bata seu recorde.",
};

export default function RetroSmashRacerPage() {
  return (
    <div className={wide.variable}>
      <RacerClient />
    </div>
  );
}
