"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import MVObject from "../gl/MVObject";
import { ArrowUpRight } from "../icons";
import { INSTAGRAM, INSTAGRAM_HANDLE } from "@/data/site";
import s from "./Contato.module.css";

type Status = "idle" | "error" | "loading" | "success";
const REQUIRED = ["nome", "email", "mensagem"] as const;

// Contact page. There is no backend for the store yet: the form validates and
// simulates a submission locally — nothing is sent anywhere (see docs).
export default function Contato() {
  const params = useSearchParams();
  const [status, setStatus] = useState<Status>("idle");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [news, setNews] = useState<Status>("idle");
  const root = useRef<HTMLDivElement>(null);
  const assunto = params.get("assunto") ?? "";

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from("[data-reveal]", { y: 40, autoAlpha: 0, duration: 0.9, stagger: 0.07, ease: "power3.out", delay: 0.1 });
    }, root.current!);
    return () => ctx.revert();
  }, []);

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const next: Record<string, string> = {};
    for (const k of REQUIRED) if (!String(data.get(k) ?? "").trim()) next[k] = "Campo obrigatório";
    const email = String(data.get("email") ?? "");
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) next.email = "E-mail inválido";
    setErrors(next);
    if (Object.keys(next).length) {
      setStatus("error");
      return;
    }
    setStatus("loading");
    setTimeout(() => setStatus("success"), 900);
  };

  const onNews = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const v = String(new FormData(e.currentTarget).get("newsletter") ?? "");
    setNews(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? "success" : "error");
  };

  return (
    <div ref={root} className={s.page}>
      <div className={s.vertical} aria-hidden="true">
        <div className={s.verticalInner} data-scene-marquee="y">
          <span>Fale com a gente</span>
          <span>Fale com a gente</span>
        </div>
      </div>
      <MVObject className={s.mv} name="logo" quality="high" trigger="loaded" label="Logo Retro Gamers em 3D" />

      <div className={s.content}>
        <div className={s.pill} data-reveal aria-hidden="true">
          <div className={s.pillInner} data-scene-marquee="x">
            {Array.from({ length: 8 }).map((_, i) => (
              <span key={i}>{i % 2 ? "Consertamos seu videogame" : "Aceitamos seus jogos"}</span>
            ))}
          </div>
        </div>

        <h1 className={s.title} data-reveal>
          Quer vender ou trocar seus jogos?
          <br />
          Seu videogame precisa de conserto?
          <br />
          Procurando aquele jogo raro?
          <br />
          Chama a Retro Gamers.
        </h1>

        {status === "success" ? (
          <div className={s.success} role="status" data-reveal>
            <p>Mensagem validada.</p>
            <p className={s.demo}>
              Formulário de demonstração: nenhum dado foi enviado. Enquanto o canal oficial não é conectado, fale com a loja
              pelo Instagram{" "}
              <a href={INSTAGRAM} target="_blank" rel="noreferrer">
                {INSTAGRAM_HANDLE}
              </a>
              .
            </p>
            <button type="button" className={s.send} onClick={() => setStatus("idle")}>
              Nova mensagem <ArrowUpRight />
            </button>
          </div>
        ) : (
          <form className={s.form} onSubmit={onSubmit} noValidate data-reveal>
            <Field name="nome" label="Nome *" error={errors.nome} half autoComplete="name" />
            <Field name="email" label="E-mail *" error={errors.email} half type="email" autoComplete="email" />
            <Field name="assunto" label="Assunto" defaultValue={assunto} />
            <Field name="mensagem" label="Mensagem *" error={errors.mensagem} />
            <div className={s.btns}>
              <button type="submit" className={s.send} disabled={status === "loading"}>
                {status === "loading" ? "Enviando…" : "Enviar"} <ArrowUpRight />
              </button>
              {status === "error" && (
                <p className={s.formError} role="alert">
                  Verifique os campos destacados.
                </p>
              )}
            </div>
          </form>
        )}
      </div>

      <div className={s.footer}>
        <p className={s.rights}>
          Retro Gamers.
          <br /> Todos os direitos reservados.
        </p>
        <form className={s.newsletter} onSubmit={onNews} noValidate>
          <label className="sr-only" htmlFor="newsletter">
            E-mail para novidades
          </label>
          <input id="newsletter" name="newsletter" type="email" placeholder={news === "success" ? "Inscrição validada (demo)" : "Receba as novidades por e-mail"} aria-invalid={news === "error"} onChange={() => news !== "idle" && setNews("idle")} />
          <button type="submit" aria-label="Inscrever">
            <ArrowUpRight />
          </button>
          {news === "error" && <span className={s.newsError}>E-mail inválido</span>}
        </form>
        <div className={s.links}>
          <a className={s.social} href={INSTAGRAM} target="_blank" rel="noreferrer">
            IG. <ArrowUpRight />
          </a>
        </div>
      </div>
    </div>
  );
}

function Field({ name, label, error, half, type = "text", defaultValue, autoComplete }: { name: string; label: string; error?: string; half?: boolean; type?: string; defaultValue?: string; autoComplete?: string }) {
  return (
    <div className={`${s.input} ${half ? s.half : ""} ${error ? s.invalid : ""}`}>
      <label htmlFor={`f-${name}`} className="sr-only">
        {label}
      </label>
      <input id={`f-${name}`} name={name} type={type} placeholder={label} defaultValue={defaultValue} autoComplete={autoComplete} aria-invalid={!!error} aria-describedby={error ? `e-${name}` : undefined} />
      <span className={s.border} />
      {error && (
        <span id={`e-${name}`} className={s.error}>
          {error}
        </span>
      )}
    </div>
  );
}
