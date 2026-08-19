import { describe, expect, it } from "vitest";
import { buildChatMediaPath } from "./chat-media";

const profileId = "8e9047ca-6105-40b5-aa1d-000000000001";
const chatId = "11d2b934-69a3-40b6-a23a-000000000002";
const objectId = "d22583f1-20e4-4312-91aa-000000000003";

describe("buildChatMediaPath", () => {
  it.each(["uploaded", "generated"] as const)("builds the %s layout", (kind) => {
    expect(buildChatMediaPath({ profileId, chatId, kind, extension: ".WEBP", objectId }))
      .toBe(`${profileId}/${chatId}/${kind}/${objectId}.webp`);
  });
  it("rejects path injection and never adds a drafts prefix", () => {
    expect(() => buildChatMediaPath({ profileId, chatId, kind: "uploaded", extension: "../png", objectId })).toThrow();
    expect(buildChatMediaPath({ profileId, chatId, kind: "uploaded", extension: "png", objectId })).not.toContain("drafts/");
  });
});
