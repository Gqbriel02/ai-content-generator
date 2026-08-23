import { z } from "zod";

export const BFL_GENERATION_ENDPOINT = "https://api.bfl.ai/v1/flux-2-klein-4b";
export const BFL_POLL_INTERVAL_MS = 500;
export const BFL_GENERATION_TIMEOUT_MS = 120_000;
export const BFL_MAX_CONSECUTIVE_POLL_FAILURES = 4;
const TRANSIENT_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);
const submitSchema = z.object({ id: z.string().min(1), polling_url: z.string().url() }).passthrough();
const pollSchema = z.object({ status: z.string(), result: z.object({ sample: z.string().url() }).passthrough().nullish() }).passthrough();

export type BflErrorCode = "BFL_CONFIGURATION_ERROR" | "BFL_SUBMISSION_ERROR" | "BFL_SUBMISSION_UNCERTAIN" |
  "BFL_POLLING_ERROR" | "BFL_TERMINAL_ERROR" | "BFL_TIMEOUT" | "BFL_RESPONSE_ERROR";

export class BflImageError extends Error {
  constructor(message: string, public readonly status: number, public readonly code: BflErrorCode,
    public readonly providerSucceeded = false) { super(message); }
}

type Runtime = { now: () => number; sleep: (ms: number) => Promise<void>; imageRequestId?: string };
function log(id: string | undefined, stage: string, detail: string) {
  console.info(`[image-generation] imageRequestId=${id ?? "unknown"} stage=${stage} ${detail}`);
}
async function safeProviderDetails(response: Response) {
  const data = await response.clone().json().catch(() => null) as { code?: unknown; message?: unknown; detail?: unknown } | null;
  return { code: typeof data?.code === "string" ? data.code.slice(0, 80) : undefined,
    message: typeof data?.message === "string" ? data.message.slice(0, 300) : typeof data?.detail === "string" ? data.detail.slice(0, 300) : undefined };
}
function retryDelay(response: Response | null, attempt: number) {
  const value = response?.headers.get("retry-after"); const seconds = value ? Number(value) : NaN;
  return Number.isFinite(seconds) ? Math.min(seconds * 1000, 5000) : Math.min(500 * 2 ** attempt, 4000);
}

export async function submitImageGeneration(input: { prompt: string; width: number; height: number; inputImages?: string[] }, apiKey: string, imageRequestId?: string) {
  log(imageRequestId, "bfl-submit", "started"); let response: Response;
  try { response = await fetch(BFL_GENERATION_ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json", "x-key": apiKey },
    body: JSON.stringify({ prompt: input.prompt, width: input.width, height: input.height,
      ...Object.fromEntries((input.inputImages ?? []).map((image, index) => [index ? `input_image_${index + 1}` : "input_image", image])),
      output_format: "webp", safety_tolerance: 2 }) }); }
  catch (error) { log(imageRequestId, "bfl-submit", `failed code=BFL_SUBMISSION_UNCERTAIN error=${error instanceof Error ? error.name : "unknown"}`);
    throw new BflImageError("The image request could not be confirmed. Please check before trying again.", 502, "BFL_SUBMISSION_UNCERTAIN"); }
  if (!response.ok) {
    const details = await safeProviderDetails(response); log(imageRequestId, "bfl-submit", `failed status=${response.status} providerCode=${details.code ?? "unknown"} providerMessage=${details.message ?? "unavailable"}`);
    if (response.status === 401 || response.status === 403) throw new BflImageError("Image generation is not configured correctly.", 503, "BFL_CONFIGURATION_ERROR");
    if (response.status === 402) throw new BflImageError("Image generation is currently unavailable because the image service has insufficient credits.", 503, "BFL_SUBMISSION_ERROR");
    if (response.status === 422) throw new BflImageError("The image request was rejected. Please revise the prompt.", 400, "BFL_SUBMISSION_ERROR");
    if (response.status === 429) throw new BflImageError("The image service is temporarily unavailable.", 503, "BFL_SUBMISSION_ERROR");
    throw new BflImageError("The image service is temporarily unavailable.", response.status >= 500 ? 503 : 502, "BFL_SUBMISSION_ERROR");
  }
  const parsed = submitSchema.safeParse(await response.json().catch(() => null));
  if (!parsed.success) throw new BflImageError("The image request was accepted upstream, but its job identifier could not be confirmed. Please check before trying again.", 502, "BFL_SUBMISSION_UNCERTAIN");
  log(imageRequestId, "bfl-submit", `success requestId=${parsed.data.id}`); return { requestId: parsed.data.id, pollingUrl: parsed.data.polling_url };
}

export async function pollImageGeneration(job: { requestId: string; pollingUrl: string }, apiKey: string, startedAt: number, runtime: Runtime) {
  let failures = 0;
  while (runtime.now() - startedAt < BFL_GENERATION_TIMEOUT_MS) {
    await runtime.sleep(failures ? Math.min(BFL_POLL_INTERVAL_MS * 2 ** failures, 4000) : BFL_POLL_INTERVAL_MS);
    if (runtime.now() - startedAt >= BFL_GENERATION_TIMEOUT_MS) break;
    let response: Response | null = null;
    try { response = await fetch(job.pollingUrl, { headers: { "x-key": apiKey } }); }
    catch { failures++; log(runtime.imageRequestId, "bfl-poll", `transient-failure network=true attempt=${failures}`);
      if (failures >= BFL_MAX_CONSECUTIVE_POLL_FAILURES) throw new BflImageError("The existing image job could not be checked. Do not submit it again yet.", 502, "BFL_POLLING_ERROR"); continue; }
    if (!response.ok) {
      if (TRANSIENT_STATUS.has(response.status)) { failures++; const details = await safeProviderDetails(response); log(runtime.imageRequestId, "bfl-poll", `transient-failure status=${response.status} attempt=${failures} providerCode=${details.code ?? "unknown"}`);
        if (failures >= BFL_MAX_CONSECUTIVE_POLL_FAILURES) throw new BflImageError("The existing image job could not be checked. Do not submit it again yet.", 502, "BFL_POLLING_ERROR");
        await runtime.sleep(retryDelay(response, failures - 1)); continue; }
      throw new BflImageError("The existing image job could not be checked.", 502, "BFL_POLLING_ERROR");
    }
    failures = 0; const parsed = pollSchema.safeParse(await response.json().catch(() => null));
    if (!parsed.success) throw new BflImageError("The existing image job returned an invalid polling response. Do not submit it again yet.", 502, "BFL_POLLING_ERROR");
    log(runtime.imageRequestId, "bfl-poll", `status=${parsed.data.status}`);
    if (parsed.data.status === "Ready") {
      if (!parsed.data.result?.sample) throw new BflImageError("The image was generated, but its delivery URL was missing.", 502, "BFL_POLLING_ERROR", true);
      return parsed.data.result.sample;
    }
    if (["Error", "Failed"].includes(parsed.data.status)) throw new BflImageError("Image generation failed.", 502, "BFL_TERMINAL_ERROR");
  }
  throw new BflImageError("The existing image job timed out. Do not submit it again yet.", 504, "BFL_TIMEOUT");
}

export async function generateImage(input: { prompt: string; width: number; height: number; inputImages?: string[] }, options: {
  now?: () => number; sleep?: (ms: number) => Promise<void>; imageRequestId?: string;
} = {}) {
  const apiKey = process.env.BFL_API_KEY;
  if (!apiKey) throw new BflImageError("Image generation is not configured on this server.", 503, "BFL_CONFIGURATION_ERROR");
  const runtime = { now: options.now ?? Date.now, sleep: options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))), imageRequestId: options.imageRequestId };
  const startedAt = runtime.now(); const job = await submitImageGeneration(input, apiKey, options.imageRequestId);
  const temporaryUrl = await pollImageGeneration(job, apiKey, startedAt, runtime);
  return { temporaryUrl, requestId: job.requestId };
}
