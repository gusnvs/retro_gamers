"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { onLoaded } from "@/lib/appState";
import s from "./CookieBanner.module.css";

const KEY = "rg-cookie-consent";

// Consent banner (same placement/style as the reference). No analytics is wired in
// this build: the choice is only stored locally so the banner doesn't come back.
export default function CookieBanner() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(KEY);
    } catch {}
    if (stored) return;
    setVisible(true);
    return onLoaded(() => {
      if (ref.current) gsap.fromTo(ref.current, { yPercent: 100, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.8, delay: 1.2, ease: "power3.out" });
    });
  }, []);

  const choose = (value: "accepted" | "rejected") => {
    try {
      localStorage.setItem(KEY, value);
    } catch {}
    if (ref.current) gsap.to(ref.current, { yPercent: 100, opacity: 0, duration: 0.5, ease: "power2.in", onComplete: () => setVisible(false) });
    else setVisible(false);
  };

  if (!visible) return null;
  return (
    <div ref={ref} className={s.banner} role="dialog" aria-label="Aviso de cookies">
      <p>
        Usamos cookies para melhorar sua experiência de navegação e analisar nosso tráfego. Ao clicar em &quot;Aceitar&quot;,
        você concorda com o uso de cookies.
      </p>
      <div className={s.buttons}>
        <button type="button" onClick={() => choose("accepted")}>
          Aceitar
        </button>
        <button type="button" onClick={() => choose("rejected")}>
          Recusar
        </button>
      </div>
    </div>
  );
}
