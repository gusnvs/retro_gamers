// Site content. Facts come from the @retrogamersbr Instagram bio
// ("Loja e experiência gamer desde 2013 / Curadoria em jogos raros, do Atari ao PS5 /
// Aceitamos seus jogos e consertamos seu videogame"). Items marked `placeholder`
// are layout content waiting for the store's real catalogue.
import type { MVName } from "@/gl/stage";

export const NAV = [
  { href: "/loja", label: "Loja" },
  { href: "/sobre", label: "Sobre" },
  { href: "/contato", label: "Contato" },
  { href: "/retro-smash-racer", label: "Jogar" },
];

export const INSTAGRAM = "https://www.instagram.com/retrogamersbr/";
export const INSTAGRAM_HANDLE = "@retrogamersbr";

// 3D models baked into the motion-vector sprites (Sketchfab, CC BY 4.0: credit required)
export const MODEL_CREDITS = [
  { title: "Playstation 5 Dualsense", author: "AHarmlessPotato", href: "https://sketchfab.com/3d-models/playstation-5-dualsense-878c1f882808477ab81c2fe86d5a3936" },
  { title: "Nintendo Switch", author: "gabrieljuan0322", href: "https://sketchfab.com/3d-models/nintendo-switch-b94e6a6a8c564fee81c2d794da6c5712" },
  { title: "Xbox Controller", author: "umkhero", href: "https://sketchfab.com/3d-models/xbox-controller-32d17951703b4e05abed11a1c65f5909" },
  { title: "GAMEBOY", author: "grimmorf", href: "https://sketchfab.com/3d-models/gameboy-4a1da0cefa904c4eae895338bd6f3334" },
];

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
  /** detail page palette — same primary/secondary/tertiary pairs as the reference CMS */
  colors: { primary: string; secondary: string; tertiary: string };
  headline: string;
  overview: string;
  items: string[];
}

export const GRID: GridEntry[] = [
  { slug: "playstation", title: "PlayStation", label: "PlayStation", anno: "PS1–PS5", color: "#ff5b49", device: "playstation", useMask: true, category: "playstation", badge: "PS", description: "Consoles, controles e jogos PlayStation.", placeholder: true , colors: { primary: "#ff5b49", secondary: "#000000", tertiary: "#ffffff" }, headline: "Do clássico ao PS5: consoles, controles e jogos PlayStation na curadoria da Retro Gamers.", overview: "Consoles, controles e jogos PlayStation, do primeiro console ao PS5. Também aceitamos seus jogos e consertamos seu videogame. Disponibilidade e preços são combinados direto com a loja.", items: ["Consoles", "Controles", "Jogos", "Acessórios"] },
  { slug: "nintendo-switch", title: "Nintendo Switch", label: "Nintendo", anno: "Switch", color: "#b7ff95", device: "switch", useMask: true, category: "nintendo", badge: "NS", description: "Consoles, controles e jogos Nintendo.", placeholder: true , colors: { primary: "#b7ff95", secondary: "#5259ff", tertiary: "#000000" }, headline: "Switch, Joy-Con e os jogos que a gente ama, com a curadoria da Retro Gamers.", overview: "Consoles, controles e jogos Nintendo. Também aceitamos seus jogos e consertamos seu videogame. Disponibilidade e preços são combinados direto com a loja.", items: ["Consoles", "Joy-Con", "Jogos", "Acessórios"] },
  { slug: "xbox", title: "Xbox", label: "Xbox", anno: "360–Series", color: "#ff6600", device: "xbox", useMask: false, category: "xbox", badge: "XB", description: "Consoles, controles e jogos Xbox.", placeholder: true , colors: { primary: "#ff6600", secondary: "#000000", tertiary: "#ffffff" }, headline: "Controles, consoles e jogos Xbox para quem joga sério, do clássico ao Series.", overview: "Consoles, controles e jogos Xbox. Também aceitamos seus jogos e consertamos seu videogame. Disponibilidade e preços são combinados direto com a loja.", items: ["Consoles", "Controles", "Jogos", "Acessórios"] },
  { slug: "portateis", title: "Portáteis", label: "Portáteis", anno: "Retrô", color: "#101010", device: "handheld", useMask: true, category: "retro", badge: "GB", description: "Portáteis clássicos.", placeholder: true , colors: { primary: "#101010", secondary: "#3da9f4", tertiary: "#ffffff" }, headline: "Portáteis clássicos: o videogame que cabia no bolso continua aqui.", overview: "Portáteis retrô e seus jogos, com a curadoria da Retro Gamers. Disponibilidade e preços são combinados direto com a loja.", items: ["Portáteis", "Cartuchos", "Acessórios"] },
  { slug: "jogos-raros", title: "Jogos raros", label: "Curadoria", anno: "Raros", color: "#d4b4ed", device: "cartridge", useMask: true, category: "retro", badge: "RR", description: "Curadoria em jogos raros, do Atari ao PS5." , colors: { primary: "#d4b4ed", secondary: "#8a43ff", tertiary: "#70547a" }, headline: "Curadoria em jogos raros, do Atari ao PS5. Aquele jogo que você procura há anos.", overview: "Curadoria em jogos raros, do Atari ao PS5 — o centro do que a Retro Gamers faz desde 2013. Disponibilidade e preços são combinados direto com a loja.", items: ["Jogos raros", "Colecionáveis", "Do Atari ao PS5"] },
  { slug: "atari", title: "Atari", label: "Atari", anno: "Clássicos", color: "#fb7a01", device: "joystick", useMask: false, category: "retro", badge: "AT", description: "Do Atari ao PS5.", placeholder: true , colors: { primary: "#fb7a01", secondary: "#1c53c8", tertiary: "#ffffff" }, headline: "Do Atari ao PS5: a história dos videogames começa no joystick de um botão só.", overview: "Joysticks, consoles e cartuchos para quem começou lá atrás — ou quer começar agora. Disponibilidade e preços são combinados direto com a loja.", items: ["Consoles", "Joysticks", "Cartuchos"] },
  { slug: "conserto", title: "Conserto de videogame", label: "Assistência", anno: "Conserto", color: "#5793d0", device: "crt", useMask: true, category: "servicos", badge: "FX", description: "Consertamos seu videogame." , colors: { primary: "#5793d0", secondary: "#283350", tertiary: "#ffffff" }, headline: "Consertamos seu videogame. Traga o seu console de volta para o jogo.", overview: "A Retro Gamers conserta videogames. Para orçamento e prazo, fale com a loja e descreva o defeito do seu aparelho.", items: ["Conserto", "Orçamento com a loja"] },
  { slug: "acessorios", title: "Acessórios", label: "Acessórios", anno: "Gamer", color: "#a6e1f5", device: "headset", useMask: false, category: "acessorios", badge: "AC", description: "Acessórios gamer.", placeholder: true , colors: { primary: "#a6e1f5", secondary: "#0e67fa", tertiary: "#e38dc5" }, headline: "Headsets, controles extras e tudo o que deixa a jogatina completa.", overview: "Acessórios para o seu setup gamer. Disponibilidade e preços são combinados direto com a loja.", items: ["Headsets", "Controles", "Cabos e cases"] },
  { slug: "troca", title: "Aceitamos seus jogos", label: "Troca", anno: "Seus jogos", color: "#efefef", device: "logo", useMask: false, category: "servicos", badge: "TR", description: "Aceitamos seus jogos." , colors: { primary: "#efefef", secondary: "#0e67fa", tertiary: "#f8af0a" }, headline: "Aceitamos seus jogos. Aquele jogo zerado pode virar o próximo da sua coleção.", overview: "A Retro Gamers aceita seus jogos. Traga sua lista e combine a avaliação direto com a loja.", items: ["Jogos", "Avaliação com a loja"] },
];
