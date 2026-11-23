import { describe, expect, it } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { newDb } from "pg-mem";
import { FileStore, MemoryStore, PostgresStore, type KVStore } from "@/lib/store";

async function exercise(store: KVStore) {
  expect(await store.get("analyses", "missing")).toBeNull();
  await store.set("analyses", "a", { n: 1 });
  expect(await store.get("analyses", "a")).toEqual({ n: 1 });
  await store.set("analyses", "a", { n: 2 });
  expect(await store.get("analyses", "a")).toEqual({ n: 2 });
  await store.set("ai_cache", "a", { other: true });
  expect(await store.get("analyses", "a")).toEqual({ n: 2 });
  await store.set("checkout", "expired", { x: 1 }, -1);
  expect(await store.get("checkout", "expired")).toBeNull();
}

describe("stores", () => {
  it("memory", async () => exercise(new MemoryStore()));
  it("file", async () => exercise(new FileStore(mkdtempSync(path.join(tmpdir(), "reg-")))));
  it("postgres (pg-mem)", async () => {
    const { Pool } = newDb().adapters.createPg();
    await exercise(new PostgresStore(new Pool()));
  });
});
