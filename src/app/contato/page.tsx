import type { Metadata } from "next";
import { Suspense } from "react";
import Contato from "@/components/contato/Contato";

export const metadata: Metadata = {
  title: "Contato — Retro Gamers",
  description: "Venda ou troca de jogos, conserto de videogame e jogos raros. Fale com a Retro Gamers.",
};

export default function ContatoPage() {
  return (
    <Suspense>
      <Contato />
    </Suspense>
  );
}
