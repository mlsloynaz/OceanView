import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/shared/api/api-fetch", () => ({
  getApiBaseUrl: () => "https://api.example.test",
  apiFetch: vi.fn(),
  readResponseBody: vi.fn(),
}));

import { apiFetch, readResponseBody } from "@/shared/api/api-fetch";
import { fetchMarketContext } from "./market-client";

describe("fetchMarketContext", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("GETs /market/context and returns typed payload", async () => {
    vi.mocked(apiFetch).mockResolvedValue({ ok: true, status: 200 } as Response);
    vi.mocked(readResponseBody).mockResolvedValue({
      asOfEt: "2026-08-03T10:00:00-04:00",
      items: [{ key: "SPY", lean: "bullish", label: "Bullish" }],
    });

    const payload = await fetchMarketContext();
    expect(apiFetch).toHaveBeenCalledWith("/market/context", undefined);
    expect(payload.items[0]?.label).toBe("Bullish");
  });
});
