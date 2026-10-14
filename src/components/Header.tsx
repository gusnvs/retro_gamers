"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import s from "./Header.module.css";
import { ArrowLeft, ArrowUpRight, InvaderIcon, OvalEmblem } from "./icons";
import { NAV } from "@/data/site";

export default function Header() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isHome = pathname === "/";

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <nav className={`${s.header} ${s.difference} ${open ? s.open : ""}`} aria-label="Principal">
        <div className={s.inner}>
          <div className={s.logo}>
            {isHome ? (
              <Link href="/" aria-label="Retro Gamers — início">
                <InvaderIcon />
              </Link>
            ) : (
              <Link href="/" className={s.back} aria-label="Voltar para o início">
                <ArrowLeft />
              </Link>
            )}
          </div>
          <div className={s.icon}>
            <Link href="/" aria-label="Retro Gamers">
              <OvalEmblem />
            </Link>
          </div>
          <div className={s.links}>
            {NAV.map((n) => (
              <div key={n.href} className={`${s.button} ${pathname.startsWith(n.href) ? s.active : ""}`}>
                <Link href={n.href} aria-current={pathname.startsWith(n.href) ? "page" : undefined}>
                  {n.label}
                </Link>
              </div>
            ))}
          </div>
          <button
            type="button"
            className={`${s.menu} ${open ? s.open : ""}`}
            aria-label={open ? "Fechar menu" : "Abrir menu"}
            aria-expanded={open}
            aria-controls="mobile-menu"
            onClick={() => setOpen((o) => !o)}
          >
            <span className={s.menuCircle} />
            <span className={s.menuLines}>
              <span className={s.menuLine} />
              <span className={s.menuLine} />
            </span>
          </button>
        </div>
      </nav>
      <div id="mobile-menu" className={`${s.overlay} ${open ? s.open : ""}`} aria-hidden={!open}>
        <div className={s.overlayInner} />
        <div className={s.overlayLinks}>
          {[{ href: "/", label: "Início" }, ...NAV].map((n) => (
            <Link key={n.href} href={n.href} className={s.overlayLink} tabIndex={open ? 0 : -1}>
              {n.label}
              <ArrowUpRight />
            </Link>
          ))}
        </div>
        <div className={s.overlayFooter}>
          <span>Retro Gamers.</span>
          <a href="https://www.instagram.com/retrogamersbr/" target="_blank" rel="noreferrer" tabIndex={open ? 0 : -1}>
            Instagram
          </a>
        </div>
      </div>
    </>
  );
}
