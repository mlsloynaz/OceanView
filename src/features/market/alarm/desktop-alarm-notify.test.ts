import { describe, expect, it } from "vitest";
import {
  notificationOptionsForAlarm,
  overlayHtmlForAlarm,
} from "./desktop-alarm-notify";

describe("desktop alarm notify", () => {
  it("keeps the Windows toast until the user clicks it", () => {
    const opts = notificationOptionsForAlarm({
      kind: "enter",
      symbol: "TSLA",
      title: "Enter: TSLA",
      body: "Breakout · CALL — enter now",
      tag: "ov-market-alarm-enter-1",
    });
    expect(opts.requireInteraction).toBe(true);
    expect((opts as NotificationOptions & { renotify?: boolean }).renotify).toBe(true);
    expect(opts.body).toContain("Breakout");
  });

  it("renders ENTER overlay copy for the always-on-top window", () => {
    const html = overlayHtmlForAlarm({
      kind: "enter",
      symbol: "MSFT",
      title: "Enter: MSFT",
      body: "Confirmation 1h · CALL — enter now",
      tag: "x",
    });
    expect(html).toContain("ENTER now");
    expect(html).toContain("MSFT");
    expect(html).toContain("Confirmation 1h");
    expect(html).not.toContain("data-action=\"confirm\"");
  });

  it("puts confirm and dismiss on the always-on-top window when a watch id is set", () => {
    const html = overlayHtmlForAlarm({
      kind: "exit",
      symbol: "NVDA",
      title: "Exit: NVDA",
      body: "15m trend change · PUT — exit now",
      tag: "x",
      watchId: "watch-1",
    });
    expect(html).toContain("Exited — arm again");
    expect(html).toContain("data-action=\"confirm\"");
    expect(html).toContain("data-action=\"dismiss\"");
  });

  it("shows a bold TOP line on non-top ENTER overlays", () => {
    const html = overlayHtmlForAlarm({
      kind: "enter",
      symbol: "AAPL",
      title: "Enter: AAPL",
      body: "5m trend change · CALL — enter now",
      tag: "x",
      watchId: "watch-2",
      topRatedSymbol: "MSFT",
      topRatedEarningPct: 41,
    });
    expect(html).toContain("class=\"top-ref\"");
    expect(html).toContain("TOP: MSFT · 41%");
    expect(html).toContain("AAPL");
  });

  it("does not self-ref TOP on the top-rated ticker", () => {
    const html = overlayHtmlForAlarm({
      kind: "enter",
      symbol: "MSFT",
      title: "Enter: MSFT",
      body: "5m trend change · CALL — enter now",
      tag: "x",
      topRatedSymbol: "MSFT",
      topRatedEarningPct: 41,
    });
    expect(html).not.toContain("class=\"top-ref\"");
    expect(html).not.toContain("TOP: MSFT");
  });

  it("lists pooled ENTERs and highlights the top row", () => {
    const html = overlayHtmlForAlarm({
      kind: "enter",
      symbol: "MSFT",
      title: "Enter: 2 signals",
      body: "TOP: MSFT · 41% · AAPL · 22%",
      tag: "x",
      watchId: "b",
      poolEntries: [
        {
          symbol: "MSFT",
          earningPct: 41,
          isTop: true,
          ruleLabel: "5m trend change",
          sideLabel: "alcista",
        },
        {
          symbol: "AAPL",
          earningPct: 22,
          isTop: false,
          ruleLabel: "5m trend change",
          sideLabel: "alcista",
        },
      ],
    });
    expect(html).toContain("2 ENTERs");
    expect(html).toContain("class=\"top\"");
    expect(html).toContain("TOP: MSFT · 41%");
    expect(html).toContain("AAPL · 22%");
    expect(html).toContain("Entered all — watch for exit");
  });

  it("renders a waiting overlay when no signal is active", () => {
    const html = overlayHtmlForAlarm(null);
    expect(html).toContain("Watching");
    expect(html).toContain("on top");
  });
});
