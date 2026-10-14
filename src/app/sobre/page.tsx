import type { Metadata } from "next";
import Sobre from "@/components/sobre/Sobre";

export const metadata: Metadata = {
  title: "Sobre — Retro Gamers",
  description: "Loja e experiência gamer desde 2013. Curadoria em jogos raros, do Atari ao PS5.",
};

export default function SobrePage() {
  return <Sobre />;
}
