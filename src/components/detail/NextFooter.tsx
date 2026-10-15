"use client";

import Link from "next/link";
import { useRef } from "react";
import MVObject from "../gl/MVObject";
import { ArrowUpRight } from "../icons";
import { INSTAGRAM, type GridEntry } from "@/data/site";
import { useSceneLink } from "@/lib/useSceneLink";
import { useTrailRegion } from "@/lib/useTrailRegion";
import f from "../PageFooter.module.css";

// Footer of a project page = the next project in its own colours (reference shows
// the next case — e.g. GDK.COM on orange — with its device over the title).
export default function NextFooter({ item }: { item: GridEntry }) {
  const ref = useRef<HTMLElement>(null);
  const href = `/loja/${item.slug}`;
  const onClick = useSceneLink(href, item);
  useTrailRegion(ref, "invert");
  const { primary, secondary } = item.colors;
  return (
    <footer ref={ref} className={f.footer} style={{ background: primary, color: secondary }}>
      <div className={f.link}>
        <MVObject className={f.mv} name={item.device} quality="med" useMask={item.useMask} label={`${item.title} em 3D`} />
        <div className={f.titlewrapper}>
          <a href={href} onClick={onClick} className={f.title} aria-label={`Próximo: ${item.title}`}>
            {item.label}
          </a>
          <span className={f.email}>Próximo</span>
        </div>
      </div>
      <div className={f.bottom}>
        <p className={f.rights}>
          Retro Gamers.
          <br /> Todos os direitos reservados.
        </p>
        <div className={f.links}>
          <a className={f.pill} style={{ background: secondary, color: primary }} href={INSTAGRAM} target="_blank" rel="noreferrer">
            <span>IG.</span>
            <ArrowUpRight className={f.pillIcon} />
          </a>
          <Link className={f.pill} style={{ background: secondary, color: primary }} href="/loja">
            <span>Loja.</span>
            <ArrowUpRight className={f.pillIcon} />
          </Link>
          <Link className={f.pill} style={{ background: secondary, color: primary }} href="/contato">
            <span>Contato.</span>
            <ArrowUpRight className={f.pillIcon} />
          </Link>
        </div>
      </div>
    </footer>
  );
}
