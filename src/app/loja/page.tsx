import type { Metadata } from "next";
import { Suspense } from "react";
import Loja from "@/components/loja/Loja";

export const metadata: Metadata = {
  title: "Loja — Retro Gamers",
  description: "Consoles, controles, jogos raros, acessórios e conserto de videogame. Do Atari ao PS5.",
};

export default function LojaPage() {
  return (
    <Suspense>
      <Loja />
    </Suspense>
  );
}
