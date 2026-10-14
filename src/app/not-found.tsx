import Link from "next/link";

export default function NotFound() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "3rem", background: "var(--black)", color: "var(--brand)", textAlign: "center", padding: "0 3rem" }}>
      <p style={{ fontSize: "clamp(8rem, 22vw, 29rem)", lineHeight: 0.8, letterSpacing: "-0.05em" }}>404</p>
      <p style={{ fontSize: "2rem", textTransform: "uppercase", letterSpacing: "-0.05em" }}>Game over: esta página não existe.</p>
      <Link href="/" style={{ border: "2px solid var(--brand)", borderRadius: 20, padding: "1rem 2.4rem", textTransform: "uppercase", fontSize: "1.4rem", letterSpacing: "-0.05em" }}>
        Voltar ao início
      </Link>
    </div>
  );
}
