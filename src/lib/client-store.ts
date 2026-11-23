"use client";
/**
 * Browser persistence for convenience: saved analyses, entitlement tokens, imported
 * organisations, and weight preferences. Every access is guarded because storage can be
 * unavailable (private mode, blocked site data).
 */
import type { AnalysisView, Organization } from "./schema";
import type { Weights } from "./scoring";

const PREFIX = "reg:";

function read<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* storage unavailable */
  }
}

export interface SavedSummary {
  id: string;
  name: string;
  industry: string;
  createdAt: string;
}

export const clientStore = {
  saveAnalysis(view: AnalysisView) {
    write(`analysis:${view.id}`, view);
    const list = (read<SavedSummary[]>("saved") ?? []).filter((s) => s.id !== view.id);
    list.unshift({ id: view.id, name: view.profile.displayName, industry: view.profile.industry, createdAt: view.createdAt });
    write("saved", list.slice(0, 20));
  },
  getAnalysis: (id: string) => read<AnalysisView>(`analysis:${id}`),
  listSaved: () => read<SavedSummary[]>("saved") ?? [],
  removeSaved(id: string) {
    write("saved", (read<SavedSummary[]>("saved") ?? []).filter((s) => s.id !== id));
    try {
      window.localStorage.removeItem(`${PREFIX}analysis:${id}`);
    } catch {
      /* ignore */
    }
  },
  setEntitlement: (id: string, token: string) => write(`ent:${id}`, token),
  getEntitlement: (id: string) => read<string>(`ent:${id}`),
  setImportedOrgs: (id: string, orgs: Organization[]) => write(`orgs:${id}`, orgs),
  getImportedOrgs: (id: string) => read<Organization[]>(`orgs:${id}`) ?? [],
  setWeights: (id: string, w: { preset: string; weights: Weights }) => write(`weights:${id}`, w),
  getWeights: (id: string) => read<{ preset: string; weights: Weights }>(`weights:${id}`),
};
