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
  });

  it("renders a waiting overlay when no signal is active", () => {
    const html = overlayHtmlForAlarm(null);
    expect(html).toContain("Watching");
    expect(html).toContain("on top");
  });
});
