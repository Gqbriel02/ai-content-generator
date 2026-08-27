import { describe, expect, it } from "vitest";
import { readResponseJson } from "./client-response";

describe("readResponseJson", () => {
  it("returns null instead of leaking JSON parser errors for empty or malformed responses", async () => {
    await expect(readResponseJson(new Response(null, { status: 500 }))).resolves.toBeNull();
    await expect(readResponseJson(new Response("not json", { status: 500 }))).resolves.toBeNull();
  });

  it("preserves valid API JSON", async () => {
    await expect(readResponseJson(Response.json({ error: { message: "Controlled" } }, { status: 500 })))
      .resolves.toEqual({ error: { message: "Controlled" } });
  });
});
