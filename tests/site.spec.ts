import { expect, test, type Page } from "@playwright/test";

const PAGES = ["/", "/loja", "/sobre", "/contato"];

function trackErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("response", (r) => {
    if (r.status() >= 400 && !r.url().includes("favicon")) errors.push(`${r.status()} ${r.url()}`);
  });
  return errors;
}

async function ready(page: Page) {
  // preloader removes itself once the intro starts
  await expect(page.getByRole("status", { name: "Carregando" })).toHaveCount(0, { timeout: 20_000 });
}

for (const path of PAGES) {
  test(`loads ${path} without errors`, async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto(path);
    await ready(page);
    await page.waitForTimeout(1500);
    await expect(page.locator("#gl-stage")).toHaveCount(1);
    expect(errors).toEqual([]);
  });
}

test("home: hero, reel, grid and footer render", async ({ page }) => {
  await page.goto("/");
  await ready(page);
  await expect(page.getByRole("heading", { level: 1, name: "Retro Gamers" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Reel Retro Gamers" }).locator("canvas")).toHaveCount(2);
  await expect(page.locator("a[href^='/loja?categoria=']")).toHaveCount(9);
  await expect(page.getByRole("link", { name: "Fale conosco" })).toBeVisible();
  // WebGL actually draws something over the hero slide
  const painted = await page.evaluate(() => {
    const c = document.getElementById("gl-stage") as HTMLCanvasElement;
    return c.width > 0 && c.height > 0;
  });
  expect(painted).toBe(true);
});

test("desktop navigation and active state", async ({ page }) => {
  await page.goto("/");
  await ready(page);
  for (const [label, path] of [["Loja", "/loja"], ["Sobre", "/sobre"], ["Contato", "/contato"]] as const) {
    await page.getByRole("navigation", { name: "Principal" }).getByRole("link", { name: label, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${path}$`));
    await expect(page.getByRole("navigation", { name: "Principal" }).getByRole("link", { name: label, exact: true })).toHaveAttribute("aria-current", "page");
  }
  await page.getByRole("link", { name: "Voltar para o início" }).click();
  await expect(page).toHaveURL(/\/$/);
});

test("mobile menu opens, navigates and closes", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await ready(page);
  const btn = page.getByRole("button", { name: "Abrir menu" });
  await expect(btn).toBeVisible();
  await btn.click();
  await expect(page.getByRole("button", { name: "Fechar menu" })).toHaveAttribute("aria-expanded", "true");
  await page.locator("#mobile-menu").getByRole("link", { name: "Sobre" }).click();
  await expect(page).toHaveURL(/\/sobre$/);
  await expect(page.getByRole("button", { name: "Abrir menu" })).toHaveAttribute("aria-expanded", "false");
});

test("cookie banner: reject hides and persists", async ({ page }) => {
  await page.goto("/");
  await ready(page);
  const banner = page.getByRole("dialog", { name: "Aviso de cookies" });
  await expect(banner).toBeVisible();
  await banner.getByRole("button", { name: "Recusar" }).click();
  await expect(banner).toHaveCount(0);
  await page.reload();
  await ready(page);
  await page.waitForTimeout(2500);
  await expect(page.getByRole("dialog", { name: "Aviso de cookies" })).toHaveCount(0);
});

test("loja filters update URL and items", async ({ page }) => {
  await page.goto("/loja");
  await ready(page);
  await expect(page.getByRole("tabpanel").locator("a")).toHaveCount(9);
  await page.getByRole("tab", { name: "Retrô" }).click();
  await expect(page).toHaveURL(/categoria=retro/);
  await expect(page.getByRole("tab", { name: "Retrô" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tabpanel").locator("a")).toHaveCount(3);
  await page.getByRole("tab", { name: "Todos" }).click();
  await expect(page.getByRole("tabpanel").locator("a")).toHaveCount(9);
});

test("home grid card links to filtered loja", async ({ page }) => {
  await page.goto("/");
  await ready(page);
  await page.locator("a[href='/loja?categoria=xbox']").click();
  await expect(page).toHaveURL(/categoria=xbox/);
  await expect(page.getByRole("tabpanel").locator("a")).toHaveCount(1);
});

test("contato form validates and shows demo success", async ({ page }) => {
  await page.goto("/contato?assunto=Xbox");
  await ready(page);
  await expect(page.getByPlaceholder("Assunto")).toHaveValue("Xbox");
  await page.getByRole("button", { name: /Enviar/ }).click();
  await expect(page.getByText("Verifique os campos destacados.")).toBeVisible();
  await expect(page.getByPlaceholder("Nome *")).toHaveAttribute("aria-invalid", "true");
  await page.getByPlaceholder("Nome *").fill("Jogador Teste");
  await page.getByPlaceholder("E-mail *").fill("email-invalido");
  await page.getByPlaceholder("Mensagem *").fill("Quero trocar meus jogos.");
  await page.getByRole("button", { name: /Enviar/ }).click();
  await expect(page.locator("#e-email")).toHaveText("E-mail inválido");
  await page.getByPlaceholder("E-mail *").fill("jogador@example.com");
  await page.getByRole("button", { name: /Enviar/ }).click();
  await expect(page.getByRole("status").filter({ hasText: "Mensagem validada" })).toBeVisible();
  await expect(page.getByText("nenhum dado foi enviado")).toBeVisible();
});

for (const vp of [{ w: 1920, h: 1080 }, { w: 1366, h: 768 }, { w: 768, h: 1024 }, { w: 390, h: 844 }, { w: 375, h: 812 }]) {
  test(`no horizontal overflow at ${vp.w}x${vp.h}`, async ({ page }) => {
    await page.setViewportSize({ width: vp.w, height: vp.h });
    for (const path of PAGES) {
      await page.goto(path);
      await ready(page);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${path} overflow`).toBeLessThanOrEqual(0);
    }
  });
}

test("404 page", async ({ page }) => {
  const res = await page.goto("/nao-existe");
  expect(res?.status()).toBe(404);
  await expect(page.getByText("Game over")).toBeVisible();
});
