// Site content. Facts come from the @retrogamersbr Instagram bio
// ("Loja e experiência gamer desde 2013 / Curadoria em jogos raros, do Atari ao PS5 /
// Aceitamos seus jogos e consertamos seu videogame"). Items marked `placeholder`
// are layout content waiting for the store's real catalogue.
import type { MVName } from "@/gl/stage";

export const NAV = [
  { href: "/loja", label: "Loja" },
  { href: "/sobre", label: "Sobre" },
  { href: "/contato", label: "Contato" },
];

export const INSTAGRAM = "https://www.instagram.com/retrogamersbr/";
export const INSTAGRAM_HANDLE = "@retrogamersbr";

export const HERO_DEVICES: { name: MVName; useMask: boolean }[] = [
  { name: "playstation", useMask: true },
  { name: "switch", useMask: true },
  { name: "xbox", useMask: false },
  { name: "logo", useMask: false },
];

export type Category = "playstation" | "nintendo" | "xbox" | "retro" | "acessorios" | "servicos";

export interface GridEntry {
  slug: string;
  title: string; // marquee text
  label: string; // bottom-left label
  anno: string; // superscript annotation
  color: string; // hover colour (reference uses per-project colours)
  device: MVName;
  useMask: boolean;
  category: Category;
  badge: string; // short bottom-right badge (replaces client logo)
  description: string;
  placeholder?: boolean;
}

export const GRID: GridEntry[] = [
  { slug: "playstation", title: "PlayStation", label: "PlayStation", anno: "PS1–PS5", color: "#ff5b49", device: "playstation", useMask: true, category: "playstation", badge: "PS", description: "Consoles, controles e jogos PlayStation.", placeholder: true },
  { slug: "nintendo-switch", title: "Nintendo Switch", label: "Nintendo", anno: "Switch", color: "#b7ff95", device: "switch", useMask: true, category: "nintendo", badge: "NS", description: "Consoles, controles e jogos Nintendo.", placeholder: true },
  { slug: "xbox", title: "Xbox", label: "Xbox", anno: "360–Series", color: "#ff6600", device: "xbox", useMask: false, category: "xbox", badge: "XB", description: "Consoles, controles e jogos Xbox.", placeholder: true },
  { slug: "portateis", title: "Portáteis", label: "Portáteis", anno: "Retrô", color: "#101010", device: "handheld", useMask: true, category: "retro", badge: "GB", description: "Portáteis clássicos.", placeholder: true },
  { slug: "jogos-raros", title: "Jogos raros", label: "Curadoria", anno: "Raros", color: "#d4b4ed", device: "cartridge", useMask: true, category: "retro", badge: "RR", description: "Curadoria em jogos raros, do Atari ao PS5." },
  { slug: "atari", title: "Atari", label: "Atari", anno: "Clássicos", color: "#fb7a01", device: "joystick", useMask: false, category: "retro", badge: "AT", description: "Do Atari ao PS5.", placeholder: true },
  { slug: "conserto", title: "Conserto de videogame", label: "Assistência", anno: "Conserto", color: "#5793d0", device: "crt", useMask: true, category: "servicos", badge: "FX", description: "Consertamos seu videogame." },
  { slug: "acessorios", title: "Acessórios", label: "Acessórios", anno: "Gamer", color: "#a6e1f5", device: "headset", useMask: false, category: "acessorios", badge: "AC", description: "Acessórios gamer.", placeholder: true },
  { slug: "troca", title: "Aceitamos seus jogos", label: "Troca", anno: "Seus jogos", color: "#efefef", device: "logo", useMask: false, category: "servicos", badge: "TR", description: "Aceitamos seus jogos." },
];
