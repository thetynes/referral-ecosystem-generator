/**
 * Centralised, server-only configuration. Every integration is optional: when its
 * credentials are missing, the related feature is reported as "not configured" rather
 * than simulated.
 */
function env(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() !== "" ? v.trim() : undefined;
}

function int(name: string, fallback: number): number {
  const v = Number(env(name));
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : fallback;
}

function num(name: string, fallback: number): number {
  const v = Number(env(name));
  return Number.isFinite(v) && v >= 0 ? v : fallback;
}

/** Default list prices (USD per million tokens) — verify against the provider's pricing page and override via env. */
const DEFAULT_PRICES: Record<string, { input: number; output: number }> = {
  anthropic: { input: 4, output: 20 }, // claude-opus-5-5
  openai: { input: 5, output: 30 }, // gpt-5.5
};

export function config() {
  const anthropicKey = env("ANTHROPIC_API_KEY");
  const openaiKey = env("OPENAI_API_KEY");
  const requested = env("LLM_PROVIDER");
  const provider: "anthropic" | "openai" | "none" =
    requested === "none"
      ? "none"
      : requested === "openai" || (!requested && !anthropicKey && openaiKey)
        ? "openai"
        : anthropicKey || requested === "anthropic"
          ? "anthropic"
          : "none";

  const googleKey = env("GOOGLE_PLACES_API_KEY");
  const braveKey = env("BRAVE_SEARCH_API_KEY");
  const discoveryRequested = env("DISCOVERY_PROVIDER");
  const discoveryProvider: "google_places" | "brave" | "none" =
    discoveryRequested === "none"
      ? "none"
      : discoveryRequested === "brave" || (!discoveryRequested && !googleKey && braveKey)
        ? braveKey ? "brave" : "none"
        : googleKey
          ? "google_places"
          : "none";

  const rawStripeSecret = env("STRIPE_SECRET_KEY");
  const stripeIsLive = Boolean(rawStripeSecret && /^(sk|rk)_live_/.test(rawStripeSecret));
  // Live keys are refused unless explicitly allowed, so a beta cannot take real payments by accident.
  const stripeSecret = stripeIsLive && env("STRIPE_ALLOW_LIVE") !== "true" ? undefined : rawStripeSecret;
  const stripeWebhookSecret = env("STRIPE_WEBHOOK_SECRET");

  return {
    appUrl:
      env("APP_URL") ??
      (env("VERCEL_BRANCH_URL") ? `https://${env("VERCEL_BRANCH_URL")}` : env("VERCEL_URL") ? `https://${env("VERCEL_URL")}` : "http://localhost:3000"),
    /** development | preview | production (Vercel sets VERCEL_ENV automatically). */
    appEnv: (env("APP_ENV") ?? env("VERCEL_ENV") ?? (process.env.NODE_ENV === "production" ? "production" : "development")) as
      | "development"
      | "preview"
      | "production",
    devMode: env("DEV_MODE") === "true",
    llm: {
      provider,
      anthropicKey,
      anthropicModel: env("ANTHROPIC_MODEL") ?? "claude-opus-5-5",
      openaiKey,
      openaiModel: env("OPENAI_MODEL") ?? "gpt-5.5",
      effort: (env("LLM_EFFORT") as "low" | "medium" | "high" | undefined) ?? "medium",
      anthropicBaseUrl: env("ANTHROPIC_API_BASE_URL") ?? "https://api.anthropic.com",
      openaiBaseUrl: env("OPENAI_API_BASE_URL") ?? "https://api.openai.com/v1",
      /** Who may trigger AI analysis: invited testers only (default), everyone, or nobody. */
      access: (env("AI_ACCESS") as "testers" | "all" | "none" | undefined) ?? "none",
      maxOutputTokens: int("AI_MAX_OUTPUT_TOKENS", 12000),
      batchSize: int("AI_BATCH_SIZE", 4),
      dailyBudgetUsd: num("AI_DAILY_BUDGET_USD", 5),
      monthlyBudgetUsd: num("AI_MONTHLY_BUDGET_USD", 40),
      perTesterDailyRuns: int("AI_PER_TESTER_DAILY_RUNS", 5),
      estimatedRunCostUsd: num("AI_ESTIMATED_RUN_COST_USD", 0.75),
      fallback: (env("AI_FALLBACK") as "knowledge_base" | "error" | undefined) ?? "knowledge_base",
      priceInputPerMTok: num("AI_PRICE_INPUT_PER_MTOK", DEFAULT_PRICES[provider]?.input ?? 5),
      priceOutputPerMTok: num("AI_PRICE_OUTPUT_PER_MTOK", DEFAULT_PRICES[provider]?.output ?? 30),
    },
    discovery: {
      /** Paid company research stays off until data licensing is resolved (docs/internal/data-licensing.md). */
      researchEnabled: env("COMPANY_RESEARCH_ENABLED") === "true",
      provider: discoveryProvider,
      googleKey,
      braveKey,
      maxResultsPerQuery: int("DISCOVERY_MAX_RESULTS", 8),
      /** How long discovery results are kept (days). */
      retentionDays: int("DISCOVERY_RETENTION_DAYS", 30),
      /** Whether Google Maps listing content may appear in CSV downloads. See docs/internal/discovery-providers.md. */
      googleInExports: env("GOOGLE_PLACES_IN_EXPORTS") === "true",
    },
    payments: {
      stripeSecret,
      stripeWebhookSecret,
      enabled: Boolean(stripeSecret && stripeWebhookSecret),
      mode: stripeSecret ? (stripeIsLive ? ("live" as const) : ("test" as const)) : null,
      liveKeyBlocked: stripeIsLive && !stripeSecret,
      currency: (env("PRICE_CURRENCY") ?? "usd").toLowerCase(),
      basicCents: int("PRICE_BASIC_CENTS", 14900),
      comprehensiveCents: int("PRICE_COMPREHENSIVE_CENTS", 29900),
    },
    entitlementSecret: env("ENTITLEMENT_SECRET") ?? (env("DEV_MODE") === "true" ? "dev-only-insecure-secret" : undefined),
    store: {
      driver: (env("STORE_DRIVER") as "memory" | "file" | "postgres" | undefined) ?? (env("DATABASE_URL") ? "postgres" : "file"),
      dataDir: env("DATA_DIR") ?? ".data",
      databaseUrl: env("DATABASE_URL"),
    },
    freeCategoryLimit: int("FREE_CATEGORY_LIMIT", 5),
    contactEmail: env("CONTACT_EMAIL") ?? null,
    beta: {
      enabled: env("BETA_MODE") === "true",
      invites: (env("BETA_INVITES") ?? "")
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean)
        .map((p) => {
          const i = p.indexOf(":");
          return i > 0 ? { label: p.slice(0, i).trim(), code: p.slice(i + 1).trim() } : { label: p, code: p };
        })
        .filter((x) => x.label && x.code.length >= 6),
      adminKey: env("ADMIN_KEY") ?? null,
    },
    rateLimitPerMinute: int("RATE_LIMIT_PER_MINUTE", 12),
  };
}

export type AppConfig = ReturnType<typeof config>;

/** Public capability flags (safe to send to the browser). */
export function capabilities() {
  const c = config();
  const researchReady = c.discovery.researchEnabled && c.discovery.provider !== "none";
  return {
    aiProvider: c.llm.provider === "none" ? null : c.llm.provider,
    aiModel: c.llm.provider === "anthropic" ? c.llm.anthropicModel : c.llm.provider === "openai" ? c.llm.openaiModel : null,
    discoveryProvider: researchReady ? c.discovery.provider : null,
    /** Company research is a separate, licence-gated feature; paid reports never promise it unless enabled. */
    researchAvailable: researchReady,
    listingExportsAllowed: c.discovery.googleInExports,
    paymentsEnabled: c.payments.enabled,
    paymentsMode: c.payments.enabled ? c.payments.mode : null,
    paidReportsAvailable: c.payments.enabled && Boolean(c.entitlementSecret),
    appEnv: c.appEnv,
    betaMode: c.beta.enabled,
    devMode: c.devMode,
    prices: {
      currency: c.payments.currency,
      basic: c.payments.basicCents,
      comprehensive: c.payments.comprehensiveCents,
    },
    contactEmail: c.contactEmail,
    freeCategoryLimit: c.freeCategoryLimit,
  };
}
export type Capabilities = ReturnType<typeof capabilities>;
