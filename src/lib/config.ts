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

  const stripeSecret = env("STRIPE_SECRET_KEY");
  const stripeWebhookSecret = env("STRIPE_WEBHOOK_SECRET");

  return {
    appUrl: env("APP_URL") ?? "http://localhost:3000",
    devMode: env("DEV_MODE") === "true",
    llm: {
      provider,
      anthropicKey,
      anthropicModel: env("ANTHROPIC_MODEL") ?? "claude-opus-5-5",
      openaiKey,
      openaiModel: env("OPENAI_MODEL") ?? "gpt-5",
      effort: (env("LLM_EFFORT") as "low" | "medium" | "high" | undefined) ?? "medium",
    },
    discovery: {
      provider: discoveryProvider,
      googleKey,
      braveKey,
      maxResultsPerQuery: int("DISCOVERY_MAX_RESULTS", 8),
    },
    payments: {
      stripeSecret,
      stripeWebhookSecret,
      enabled: Boolean(stripeSecret && stripeWebhookSecret),
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
    rateLimitPerMinute: int("RATE_LIMIT_PER_MINUTE", 12),
  };
}

export type AppConfig = ReturnType<typeof config>;

/** Public capability flags (safe to send to the browser). */
export function capabilities() {
  const c = config();
  const discoveryReady = c.discovery.provider !== "none";
  return {
    aiProvider: c.llm.provider === "none" ? null : c.llm.provider,
    aiModel: c.llm.provider === "anthropic" ? c.llm.anthropicModel : c.llm.provider === "openai" ? c.llm.openaiModel : null,
    discoveryProvider: discoveryReady ? c.discovery.provider : null,
    paymentsEnabled: c.payments.enabled,
    /** Paid research is only sold when payments AND a working discovery provider are configured. */
    paidReportsAvailable: c.payments.enabled && discoveryReady && Boolean(c.entitlementSecret),
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
