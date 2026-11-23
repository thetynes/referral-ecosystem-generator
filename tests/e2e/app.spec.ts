import { test, expect } from "@playwright/test";
import fs from "node:fs";

test("landing page shows the headline, CTA and labelled illustrative map", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Discover who could be sending you customers" })).toBeVisible();
  await expect(page.getByTestId("hero-cta")).toHaveText(/Generate My Referral Ecosystem/);
  await expect(page.getByText(/Illustrative example: a hypothetical excavation contractor/)).toBeVisible();
  await expect(page.locator(".react-flow__node").first()).toBeVisible();
});

test("generate → explore → export → unlock (dev) → report", async ({ page, isMobile }) => {
  await page.goto("/generate");
  await page.getByRole("button", { name: /Excavation contractor · Sarnia/ }).click();
  await page.getByTestId("generate-submit").click();
  await page.waitForURL(/\/ecosystem\/[0-9a-f-]{36}/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Example Excavating");
  await expect(page.getByText(/Curated profile: Excavation & site construction/)).toBeVisible();

  if (!isMobile) {
    // map: click a partner node → detail panel
    await page.locator('[data-testid^="node-"]').first().click();
    await expect(page.getByTestId("detail-panel")).toBeVisible();
    await expect(page.getByTestId("detail-panel").getByText("Trigger events")).toBeVisible();
    await expect(page.getByTestId("detail-panel").getByText("Priority breakdown")).toBeVisible();
    await page.getByRole("button", { name: /Back to overview/ }).click();

    // collapse a group
    const before = await page.locator('[data-testid^="node-"]').count();
    await page.getByRole("button", { name: /^Collapse / }).first().click();
    await expect.poll(() => page.locator('[data-testid^="node-"]').count()).toBeLessThan(before);

    // image export
    const png = page.waitForEvent("download");
    await page.getByTestId("export-png").click();
    expect((await png).suggestedFilename()).toMatch(/\.png$/);
  }

  // list view
  await page.getByRole("tab", { name: /Opportunities/ }).click();
  const rows = isMobile ? page.locator("ul li button").filter({ hasText: /High|Medium|Low/ }) : page.locator('[data-testid^="row-"]');
  await expect(rows).toHaveCount(5);
  await rows.first().click();
  await expect(page.getByText("Suggested partnership approach").first()).toBeVisible();
  if (isMobile) await page.keyboard.press("Escape");
  else await page.getByRole("button", { name: /Back to overview/ }).click();

  // triggers
  await page.getByRole("tab", { name: /Triggers/ }).click();
  await expect(page.getByText("Best moment to refer")).toBeVisible();

  // CSV export
  const dl = page.waitForEvent("download");
  await page.getByTestId("export-csv").click();
  const file = await dl;
  const csv = fs.readFileSync(await file.path(), "utf8");
  expect(csv.split("\n")[0]).toContain("partner_category");

  // Dev unlock reveals all categories
  await page.locator("[data-testid=dev-unlock-comprehensive]:visible").first().click();
  await expect(page.getByText("Comprehensive report (dev unlock)")).toBeVisible();
  await page.getByRole("tab", { name: /Opportunities/ }).click();
  await expect(rows).toHaveCount(14);

  // Organisations tab: discovery honestly reports missing configuration; CSV import works
  await page.getByRole("tab", { name: /Organisations/ }).click();
  await expect(page.getByText(/Requires configuration/)).toBeVisible();
  await page.getByTestId("csv-input").setInputFiles({
    name: "list.csv",
    mimeType: "text/csv",
    buffer: Buffer.from('name,website,partner_category\n"Builder One",builderone.example,"Custom & infill home builders"\n'),
  });
  await expect(page.getByText(/Imported 1 organisation/)).toBeVisible();
  await expect(page.getByText("Builder One")).toBeVisible();

  // report
  await page.getByTestId("open-report").click();
  await expect(page.getByRole("heading", { name: "Partnership Opportunity Report" })).toBeVisible();
  await expect(page.getByText("Initial action plan: top 10 opportunities to investigate")).toBeVisible();
  await expect(page.getByText("Builder One")).toBeVisible();
  await expect(page.getByText(/Imported from your CSV/).first()).toBeVisible();
});

test("immigration and app-agency examples produce different ecosystems", async ({ request }) => {
  const mk = async (industry: string, area: string) => {
    const r = await request.post("/api/analyze", { data: { input: { businessName: "X", industry, serviceArea: area, idealCustomer: "Various clients" } } });
    expect(r.ok()).toBeTruthy();
    return (await r.json()).engine.archetypeId as string;
  };
  expect(await mk("Immigration law firm", "Toronto, Ontario")).toBe("immigration-law");
  expect(await mk("Mobile app development agency", "Fort Lauderdale, Florida")).toBe("software-agency");
});

test("unknown industry is handled gracefully", async ({ page }) => {
  await page.goto("/generate");
  await page.getByLabel("Business name").fill("Bee Co");
  await page.getByLabel("Primary industry or service").fill("Artisanal beekeeping supplies");
  await page.getByLabel("Geographic market or service area").fill("Portland, Oregon");
  await page.getByLabel("Ideal customer or customer type").fill("Hobby beekeepers");
  await page.getByTestId("generate-submit").click();
  await page.waitForURL(/\/ecosystem\//);
  await expect(page.getByText(/did not closely match a curated industry profile/)).toBeVisible();
  await expect(page.getByLabel("Switch industry profile")).toBeVisible();
});

test("intake validation shows field errors", async ({ page }) => {
  await page.goto("/generate");
  await page.getByTestId("generate-submit").click();
  await expect(page.getByText("Describe your primary industry or service.")).toBeVisible();
  await expect(page.getByText("Enter a business name or website URL.")).toBeVisible();
});

test("demo ecosystem is labelled and fully visible", async ({ page }) => {
  await page.goto("/ecosystem/demo");
  await expect(page.getByText("Illustrative example: not live research")).toBeVisible();
  await expect(page.getByTestId("upgrade-card")).toHaveCount(0);
});
