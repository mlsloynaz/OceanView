/** Desktop ENTER/EXIT alerts when the OceanView tab is hidden. */

import { formatEarningPctLabel, formatTopRatedLine } from "./alarm-enter-pool";

export type DesktopAlarmKind = "enter" | "exit";

export type DesktopAlarmPoolRow = {
  symbol: string;
  earningPct: number | null;
  isTop: boolean;
  ruleLabel: string;
  sideLabel: string;
};

export type DesktopAlarmPayload = {
  kind: DesktopAlarmKind;
  symbol: string;
  title: string;
  body: string;
  tag: string;
  /** Market-alarm watch id. Present when this window can confirm or dismiss. */
  watchId?: string;
  /** Non-top ENTER — who ranked highest in the same pool flush. */
  topRatedSymbol?: string;
  topRatedEarningPct?: number | null;
  /** Multi-ENTER list (top first) when several signals share one overlay. */
  poolEntries?: DesktopAlarmPoolRow[];
};

export type DesktopAlarmAction = "confirm" | "dismiss";

type DesktopAlarmActionHandler = (
  action: DesktopAlarmAction,
  payload: DesktopAlarmPayload,
) => void;

let pipWindow: Window | null = null;
let lastNotification: Notification | null = null;
let titleFlashTimer: number | null = null;
let titleBeforeFlash: string | null = null;

export function desktopNotifyPermission(): NotificationPermission | "unsupported" {
  if (typeof Notification === "undefined") return "unsupported";
  return Notification.permission;
}

export function notificationOptionsForAlarm(
  payload: DesktopAlarmPayload,
): NotificationOptions {
  const opts: NotificationOptions & { renotify?: boolean } = {
    body: payload.body,
    tag: payload.tag,
    requireInteraction: true,
    silent: true,
    renotify: true,
  };
  return opts;
}

export function overlayHtmlForAlarm(payload: DesktopAlarmPayload | null): string {
  if (!payload) {
    return `
      <div class="wrap idle" data-action="show">
        <p class="kicker">OceanView alarms</p>
        <h1>Watching</h1>
        <p class="sub">This window stays on top. ENTER / EXIT will fill it when a rule hits.</p>
        <p class="hint">Click to bring OceanView to the front</p>
      </div>
    `;
  }
  const tone = payload.kind === "enter" ? "enter" : "exit";
  const action = payload.kind === "enter" ? "ENTER" : "EXIT";
  const multi = payload.kind === "enter" && (payload.poolEntries?.length ?? 0) > 1;
  const confirmLabel =
    payload.kind === "enter"
      ? multi
        ? "Entered all — watch for exit"
        : "Entered — watch for exit"
      : "Exited — arm again";
  const showTopRef =
    payload.kind === "enter" &&
    !multi &&
    !!payload.topRatedSymbol &&
    payload.topRatedSymbol.trim().toUpperCase() !== payload.symbol.trim().toUpperCase();
  const topLine = showTopRef
    ? `<p class="top-ref">${escapeHtml(
        formatTopRatedLine(payload.topRatedSymbol!, payload.topRatedEarningPct),
      )}</p>`
    : "";
  const poolList = multi
    ? `<ul class="pool">${payload.poolEntries!
        .map((row) => {
          const label = row.isTop
            ? formatTopRatedLine(row.symbol, row.earningPct)
            : `${row.symbol} · ${formatEarningPctLabel(row.earningPct)}`;
          return `<li class="${row.isTop ? "top" : "other"}"><span class="sym">${escapeHtml(
            label,
          )}</span><span class="meta">${escapeHtml(`${row.ruleLabel} · ${row.sideLabel}`)}</span></li>`;
        })
        .join("")}</ul>`
    : "";
  const heading = multi
    ? `<h1>${payload.poolEntries!.length} ENTERs</h1>`
    : `<h1>${escapeHtml(payload.symbol)}</h1>`;
  const actions = payload.watchId
    ? `
      <div class="actions">
        <button type="button" data-action="confirm">${escapeHtml(confirmLabel)}</button>
        <button type="button" data-action="dismiss">Dismiss</button>
      </div>
      <p class="hint">Stops the bell here. You can stay on this window.</p>
    `
    : `<p class="hint">Click to bring OceanView to the front</p>`;
  return `
    <div class="wrap ${tone}" data-action="show">
      <p class="kicker">${action} now</p>
      ${topLine}
      ${heading}
      ${poolList}
      <p class="sub">${escapeHtml(payload.body)}</p>
      ${actions}
    </div>
  `;
}

export function overlayStyles(): string {
  return `
    :root { color-scheme: dark; }
    * { box-sizing: border-box; }
    html, body { margin: 0; height: 100%; }
    body {
      font-family: "Segoe UI", system-ui, sans-serif;
      background: #06141c;
      color: #e8f1f4;
    }
    .wrap {
      height: 100%;
      padding: 16px 18px;
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 6px;
      border: 3px solid #2a6f82;
    }
    .wrap.enter { border-color: #2ec4b6; background: #06302c; }
    .wrap.exit { border-color: #f0a202; background: #3a2208; }
    .wrap[data-action="show"] { cursor: pointer; }
    .kicker {
      margin: 0;
      font-size: 12px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #9ec5cf;
    }
    .wrap.enter .kicker { color: #7ff0e4; }
    .wrap.exit .kicker { color: #ffd27a; }
    .top-ref {
      margin: 0;
      font-size: 20px;
      font-weight: 750;
      line-height: 1.2;
      color: #7ff0e4;
    }
    h1 { margin: 0; font-size: 34px; line-height: 1.1; }
    .pool {
      list-style: none;
      margin: 4px 0 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .pool li {
      margin: 0;
      padding: 6px 8px;
      border-radius: 6px;
      border: 1px solid #2a6f82;
      background: #0a2430;
    }
    .pool li.top {
      border-color: #2ec4b6;
      background: #0a3d38;
    }
    .pool .sym {
      display: block;
      font-size: 16px;
      font-weight: 650;
      color: #e8f1f4;
    }
    .pool li.top .sym {
      font-size: 20px;
      font-weight: 750;
      color: #7ff0e4;
    }
    .pool .meta {
      display: block;
      margin-top: 2px;
      font-size: 11px;
      color: #9ec5cf;
    }
    .sub { margin: 0; font-size: 14px; color: #d5e4e8; }
    .hint { margin: 8px 0 0; font-size: 11px; color: #8aa8b0; }
    .actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
    button {
      border: 0;
      border-radius: 6px;
      padding: 8px 12px;
      font: inherit;
      font-size: 13px;
      font-weight: 650;
      cursor: pointer;
    }
    .wrap.enter button[data-action="confirm"] { background: #2ec4b6; color: #04221f; }
    .wrap.exit button[data-action="confirm"] { background: #f0a202; color: #2a1800; }
    button[data-action="dismiss"] {
      background: transparent;
      color: #d5e4e8;
      border: 1px solid #6d8b94;
    }
  `;
}

/** Call from a click (Enable notify / Start). Chrome notification only — no Watching window. */
export function armDesktopAlarmAlerts(): void {
  closeAlarmOverlayWindow();
  void requestDesktopNotifyPermission();
}

export async function requestDesktopNotifyPermission(): Promise<
  NotificationPermission | "unsupported"
> {
  if (typeof Notification === "undefined") return "unsupported";
  if (Notification.permission === "granted" || Notification.permission === "denied") {
    return Notification.permission;
  }
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

/** Kept so callers can register. Alerts are the Chrome notification, not a second window. */
export function setDesktopAlarmActionHandler(_handler: DesktopAlarmActionHandler | null): void {
  /* no Watching window */
}

export function showDesktopAlarmAlert(payload: DesktopAlarmPayload): void {
  showStickyNotification(payload);
  renderOverlay(payload);
  startTitleFlash(payload.title);
}

export function clearDesktopAlarmAlert(): void {
  stopTitleFlash();
  try {
    lastNotification?.close();
  } catch {
    /* ignore */
  }
  lastNotification = null;
  renderOverlay(null);
}

function showStickyNotification(payload: DesktopAlarmPayload): void {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") {
    return;
  }
  try {
    lastNotification?.close();
  } catch {
    /* ignore */
  }
  try {
    const note = new Notification(payload.title, notificationOptionsForAlarm(payload));
    note.onclick = () => {
      try {
        window.focus();
      } catch {
        /* ignore */
      }
      note.close();
    };
    lastNotification = note;
  } catch {
    /* ignore */
  }
}

function closeAlarmOverlayWindow(): void {
  const pip = pipWindow;
  pipWindow = null;
  if (!pip || pip.closed) return;
  try {
    pip.close();
  } catch {
    /* ignore */
  }
}

function renderOverlay(payload: DesktopAlarmPayload | null): void {
  if (!pipWindow || pipWindow.closed) {
    pipWindow = null;
    return;
  }
  const doc = pipWindow.document;
  doc.title = payload ? payload.title : "OceanView alarms";
  doc.head.innerHTML = `<style>${overlayStyles()}</style>`;
  doc.body.innerHTML = overlayHtmlForAlarm(payload);
}

function startTitleFlash(title: string): void {
  stopTitleFlash();
  if (typeof document === "undefined") return;
  titleBeforeFlash = document.title;
  let tick = 0;
  const apply = () => {
    document.title = tick % 2 === 0 ? title : titleBeforeFlash || "OceanView";
    tick += 1;
  };
  apply();
  titleFlashTimer = window.setInterval(apply, 900);
}

function stopTitleFlash(): void {
  if (titleFlashTimer != null) {
    window.clearInterval(titleFlashTimer);
    titleFlashTimer = null;
  }
  if (titleBeforeFlash != null && typeof document !== "undefined") {
    document.title = titleBeforeFlash;
  }
  titleBeforeFlash = null;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
