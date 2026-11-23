import type { MetadataRoute } from "next";
import { config } from "@/lib/config";

export default function robots(): MetadataRoute.Robots {
  const c = config();
  // Private beta and preview deployments must never be indexed.
  if (c.beta.enabled || c.appEnv !== "production") return { rules: [{ userAgent: "*", disallow: "/" }] };
  return { rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/ecosystem/", "/report/", "/beta/"] }] };
}
