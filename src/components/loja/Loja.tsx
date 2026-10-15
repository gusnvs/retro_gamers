"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef } from "react";
import gsap from "gsap";
import { useTrailRegion } from "@/lib/useTrailRegion";
import GridItem from "../home/GridItem";
import PageFooter from "../PageFooter";
import { GRID, type Category } from "@/data/site";
import g from "../home/Grid.module.css";
import s from "./Loja.module.css";

const FILTERS: { id: "todos" | Category; label: string }[] = [
  { id: "todos", label: "Todos" },
  { id: "playstation", label: "PlayStation" },
  { id: "nintendo", label: "Nintendo" },
  { id: "xbox", label: "Xbox" },
  { id: "retro", label: "Retrô" },
  { id: "acessorios", label: "Acessórios" },
  { id: "servicos", label: "Serviços" },
];

// "All works" page of the reference, as the store catalogue (by category).
export default function Loja() {
  const params = useSearchParams();
  const router = useRouter();
  const active = (params.get("categoria") as Category | null) ?? "todos";
  const items = useMemo(() => (active === "todos" ? GRID : GRID.filter((i) => i.category === active)), [active]);
  const list = useRef<HTMLDivElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const page = useRef<HTMLDivElement>(null);
  useTrailRegion(page, "difference");

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from("[data-line]", { yPercent: 105, duration: 1.1, ease: "power3.out", stagger: 0.08, delay: 0.1 });
      gsap.from("[data-filters]", { autoAlpha: 0, duration: 0.8, delay: 0.5 });
    }, title.current!.parentElement!);
    return () => ctx.revert();
  }, []);

  useEffect(() => {
    if (!list.current) return;
    gsap.fromTo(list.current.children, { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, duration: 0.6, stagger: 0.05, ease: "power3.out" });
  }, [active]);

  const select = (id: string) => {
    const url = id === "todos" ? "/loja" : `/loja?categoria=${id}`;
    router.replace(url, { scroll: false });
  };

  return (
    <div ref={page} className={s.page}>
      <div className={s.header}>
        <h1 ref={title} className={s.lines}>
          <span className={s.l1}>
            <span data-line>Nossa</span>
          </span>
          <span className={s.l2}>
            <span data-line>Loja</span>
          </span>
        </h1>
        <div className={s.filters} data-filters role="tablist" aria-label="Categorias">
          <div className={s.filtersInner}>
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                role="tab"
                aria-selected={active === f.id}
                className={`${s.filter} ${active === f.id ? s.active : ""}`}
                onClick={() => select(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className={s.team}>
        <div ref={list} className={g.grid} role="tabpanel">
          {items.map((item) => (
            <div key={item.slug} className={g.cell}>
              <GridItem item={item} href={`/loja/${item.slug}`} variant="list" />
            </div>
          ))}
        </div>
        {items.length === 0 && <p className={s.empty}>Nenhum item nesta categoria.</p>}
        <p className={s.note}>Catálogo completo e disponibilidade: fale com a loja.</p>
      </div>
      <PageFooter theme="brand" />
    </div>
  );
}
