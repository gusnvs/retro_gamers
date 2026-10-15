"use client";

import Link from "next/link";
import { useRef } from "react";
import { useTrailRegion } from "@/lib/useTrailRegion";
import MVObject from "./gl/MVObject";
import { ArrowUpRight } from "./icons";
import { INSTAGRAM, INSTAGRAM_HANDLE } from "@/data/site";
import s from "./PageFooter.module.css";

// "Reach out" footer: big title + contact, a 3D object over the title and pill links.
export default function PageFooter({ theme = "dark" }: { theme?: "dark" | "brand" }) {
  const ref = useRef<HTMLElement>(null);
  useTrailRegion(ref, theme === "dark" ? "difference" : "invert");
  return (
    <footer ref={ref} className={`${s.footer} ${theme === "brand" ? s.brand : ""}`}>
      <div className={s.link}>
        <MVObject className={s.mv} name="logo" quality="med" label="Logo Retro Gamers em 3D" />
        <div className={s.titlewrapper}>
          <Link href="/contato" className={s.title}>
            Fale conosco
          </Link>
          <a className={s.email} href={INSTAGRAM} target="_blank" rel="noreferrer">
            {INSTAGRAM_HANDLE}
          </a>
        </div>
      </div>
      <div className={s.bottom}>
        <p className={s.rights}>
          Retro Gamers.
          <br /> Todos os direitos reservados.
        </p>
        <div className={s.links}>
          <a className={s.pill} href={INSTAGRAM} target="_blank" rel="noreferrer">
            <span>IG.</span>
            <ArrowUpRight className={s.pillIcon} />
          </a>
          <Link className={s.pill} href="/loja">
            <span>Loja.</span>
            <ArrowUpRight className={s.pillIcon} />
          </Link>
          <Link className={s.pill} href="/contato">
            <span>Contato.</span>
            <ArrowUpRight className={s.pillIcon} />
          </Link>
        </div>
      </div>
    </footer>
  );
}
