import { describe, expect, it } from "vitest";

import { authProviderIds, getAuthProviderLabel } from "../src/index.js";

describe("getAuthProviderLabel", () => {
  it("labels every supported provider", () => {
    expect(authProviderIds.map(getAuthProviderLabel)).toEqual([
      "GitHub",
      "Google",
      "Microsoft",
    ]);
  });
});
