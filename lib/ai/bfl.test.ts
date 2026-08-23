import { afterEach, describe, expect, it, vi } from "vitest";
import { BFL_GENERATION_ENDPOINT, BFL_GENERATION_TIMEOUT_MS, BflImageError, generateImage } from "./bfl";

const originalKey = process.env.BFL_API_KEY;
afterEach(() => { vi.unstubAllGlobals(); if (originalKey === undefined) delete process.env.BFL_API_KEY; else process.env.BFL_API_KEY = originalKey; });

describe("BFL image provider", () => {
  it("submits once with server authentication and polls the returned URL until Ready", async () => {
    process.env.BFL_API_KEY = "secret-test-key";
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "request-1", polling_url: "https://poll.example/exact" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: "Pending" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: "Ready", result: { sample: "https://delivery.example/image.webp" } }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(generateImage({ prompt: "A red robot", width: 1024, height: 1024 }, { sleep: async () => {} }))
      .resolves.toEqual({ temporaryUrl: "https://delivery.example/image.webp", requestId: "request-1" });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls.filter(([url, init]) => url === BFL_GENERATION_ENDPOINT && init?.method === "POST")).toHaveLength(1);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ headers: { "Content-Type": "application/json", "x-key": "secret-test-key" } });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ prompt: "A red robot", width: 1024, height: 1024, output_format: "webp", safety_tolerance: 2 });
    expect(fetchMock.mock.calls[1][0]).toBe("https://poll.example/exact");
  });

  it("sends only explicitly supplied current-request images as BFL references", async () => {
    process.env.BFL_API_KEY = "test";
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "id", polling_url: "https://poll.example/x" })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: "Ready", result: { sample: "https://delivery.example/image.webp" } })));
    vi.stubGlobal("fetch", fetchMock);
    await generateImage({ prompt: "make it night", width: 1024, height: 1024, inputImages: ["current-base64"] }, { sleep: async () => {} });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
      prompt: "make it night", input_image: "current-base64",
    });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).not.toHaveProperty("input_image_2");
  });

  it.each([["Error"], ["Failed"]])("treats %s as terminal without another POST", async (status) => {
    process.env.BFL_API_KEY = "test";
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ id: "id", polling_url: "https://poll.example/x" })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ status })));
    vi.stubGlobal("fetch", fetchMock);
    await expect(generateImage({ prompt: "x", width: 1, height: 1 }, { sleep: async () => {} })).rejects.toBeInstanceOf(BflImageError);
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(1);
  });

  it.each([[402, "insufficient credits"], [429, "temporarily unavailable"]])("maps HTTP %i safely", async (status, message) => {
    process.env.BFL_API_KEY = "test"; vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status })));
    await expect(generateImage({ prompt: "x", width: 1, height: 1 })).rejects.toThrow(message);
  });

  it("rejects malformed responses and missing configuration", async () => {
    process.env.BFL_API_KEY = "test"; vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}")));
    await expect(generateImage({ prompt: "x", width: 1, height: 1 })).rejects.toThrow("could not be confirmed");
    delete process.env.BFL_API_KEY;
    await expect(generateImage({ prompt: "x", width: 1, height: 1 })).rejects.toThrow("not configured");
  });

  it("stops at the finite timeout", async () => {
    process.env.BFL_API_KEY = "test"; let time = 0;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ id: "id", polling_url: "https://poll.example/x" }))));
    await expect(generateImage({ prompt: "x", width: 1, height: 1 }, { now: () => time, sleep: async () => { time = BFL_GENERATION_TIMEOUT_MS; } })).rejects.toThrow("timed out");
  });

  it("recovers from transient polling failures without resubmitting the paid POST", async () => {
    process.env.BFL_API_KEY = "test";
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "id", polling_url: "https://poll.example/exact" })))
      .mockResolvedValueOnce(new Response("", { status: 503 }))
      .mockResolvedValueOnce(new Response("", { status: 502 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: "Pending" })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: "Ready", result: { sample: "https://delivery.example/image.webp" } })));
    vi.stubGlobal("fetch", fetchMock);
    await expect(generateImage({ prompt: "x", width: 1024, height: 1024 }, { sleep: async () => {} }))
      .resolves.toMatchObject({ temporaryUrl: "https://delivery.example/image.webp" });
    expect(fetchMock.mock.calls.filter(([url, init]) => url === BFL_GENERATION_ENDPOINT && init?.method === "POST")).toHaveLength(1);
    expect(fetchMock.mock.calls.slice(1).every(([url]) => url === "https://poll.example/exact")).toBe(true);
  });
});
