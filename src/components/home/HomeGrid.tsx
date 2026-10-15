import SplitLines from "../SplitLines";
import GridItem from "./GridItem";
import { GRID } from "@/data/site";
import s from "./HomeGrid.module.css";
import g from "./Grid.module.css";

const TITLE =
  "Retro Gamers é loja e experiência gamer desde 2013, com curadoria em jogos raros, do Atari ao PS5, e conserto de videogame.";

export default function HomeGrid() {
  return (
    <section className={s.section} aria-labelledby="quem-somos">
      <div className={s.copyblock}>
        <div className={s.titlewrapper}>
          <p id="quem-somos" className={s.subtitle}>
            Quem somos
          </p>
          <SplitLines as="h2" className={s.title} text={TITLE} firstLineRight firstLineWords={5} />
        </div>
      </div>
      <div className={g.grid}>
        {GRID.map((item) => (
          <div key={item.slug} className={g.cell}>
            <GridItem item={item} href={`/loja/${item.slug}`} />
          </div>
        ))}
      </div>
    </section>
  );
}
