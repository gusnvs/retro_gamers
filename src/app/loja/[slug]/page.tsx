import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Detail from "@/components/detail/Detail";
import { GRID } from "@/data/site";

export function generateStaticParams() {
  return GRID.map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const item = GRID.find((g) => g.slug === slug);
  return item ? { title: `${item.title} — Retro Gamers`, description: item.headline } : {};
}

export default async function DetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const index = GRID.findIndex((g) => g.slug === slug);
  if (index < 0) notFound();
  return <Detail item={GRID[index]} next={GRID[(index + 1) % GRID.length]} index={index} />;
}
