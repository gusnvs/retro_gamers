import { MODEL_CREDITS } from "@/data/site";

// CC BY 4.0 attribution for the 3D models used in the hero, grid and pages.
export default function ModelCredits({ className }: { className?: string }) {
  return (
    <p className={className}>
      Modelos 3D (
      <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">
        CC BY 4.0
      </a>
      ):{" "}
      {MODEL_CREDITS.map((m, i) => (
        <span key={m.href}>
          <a href={m.href} target="_blank" rel="noreferrer">
            {m.title}
          </a>{" "}
          por {m.author}
          {i < MODEL_CREDITS.length - 1 ? ", " : "."}
        </span>
      ))}
    </p>
  );
}
