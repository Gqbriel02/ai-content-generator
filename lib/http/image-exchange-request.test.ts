import { describe, expect, it } from "vitest";
import { parseImageExchangeRequest } from "./image-exchange-request";

function png(name = "source.png") {
  return new File([Uint8Array.from([137,80,78,71,13,10,26,10])], name, { type: "image/png" });
}

describe("parseImageExchangeRequest", () => {
  it("keeps prompt-only image generation compatible with JSON requests", async () => {
    const request = new Request("http://local", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "A flying cat", aspectRatio: "1:1" }) });
    await expect(parseImageExchangeRequest(request, false)).resolves.toMatchObject({
      content: "A flying cat", aspectRatio: "1:1", files: [],
    });
  });

  it("accepts only images explicitly attached to this image request", async () => {
    const form = new FormData();
    form.set("content", "another color"); form.set("aspectRatio", "16:9"); form.append("files", png());
    const parsed = await parseImageExchangeRequest(new Request("http://local", { method: "POST", body: form }), false);
    expect(parsed.files).toHaveLength(1);
    expect(parsed.files[0]).toMatchObject({ originalName: "source.png", mimeType: "image/png" });
  });

  it("rejects more references than FLUX.2 Klein supports", async () => {
    const form = new FormData(); form.set("content", "combine"); form.set("aspectRatio", "1:1");
    for (let index = 0; index < 5; index++) form.append("files", png(`${index}.png`));
    await expect(parseImageExchangeRequest(new Request("http://local", { method: "POST", body: form }), false)).rejects.toThrow("INVALID_REQUEST");
  });

  it("parses authoritative IDs without browser image bytes", async () => {
    const form = new FormData(); form.set("content", "make it greener"); form.set("aspectRatio", "1:1");
    form.append("referenceAttachmentIds", "00000000-0000-4000-8000-000000000011");
    const parsed = await parseImageExchangeRequest(new Request("http://local", { method: "POST", body: form }), false);
    expect(parsed.files).toEqual([]);
    expect(parsed.referenceAttachmentIds).toEqual(["00000000-0000-4000-8000-000000000011"]);
  });

  it("enforces four references across local and existing sources", async () => {
    const form = new FormData(); form.set("content", "combine"); form.set("aspectRatio", "1:1");
    form.append("files", png()); form.append("files", png("second.png")); form.append("files", png("third.png"));
    form.append("referenceAttachmentIds", "00000000-0000-4000-8000-000000000011");
    form.append("referenceAttachmentIds", "00000000-0000-4000-8000-000000000012");
    await expect(parseImageExchangeRequest(new Request("http://local", { method: "POST", body: form }), false)).rejects.toThrow("INVALID_REQUEST");
  });
});
