/** Desktop ENTER/EXIT alerts when the OceanView tab is hidden. */

export type DesktopAlarmKind = "enter" | "exit";

export type DesktopAlarmPayload = {
  kind: DesktopAlarmKind;
  symbol: string;
  title: string;
  body: string;
  tag: string;
};

type DocumentPictureInPicture = {
  requestWindow: (opts?: { width?: number; height?: number }) => Promise<Window>;
};

const PIP_WIDTH = 400;
const PIP_HEIGHT = 240;

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
      <div class="wrap idle">
        <p class="kicker">OceanView alarms</p>
        <h1>Watching</h1>
        <p class="sub">This window stays on top. ENTER / EXIT will fill it when a rule hits.</p>
      </div>
    `;
  }
  const tone = payload.kind === "enter" ? "enter" : "exit";
  const action = payload.kind === "enter" ? "ENTER" : "EXIT";
  return `
    <div class="wrap ${tone}">
      <p class="kicker">${action} now</p>
      <h1>${escapeHtml(payload.symbol)}</h1>
      <p class="sub">${escapeHtml(payload.body)}</p>
      <p class="hint">Click to show OceanView</p>
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
      cursor: pointer;
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
    .kicker {
      margin: 0;
      font-size: 12px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #9ec5cf;
    }
    .wrap.enter .kicker { color: #7ff0e4; }
    .wrap.exit .kicker { color: #ffd27a; }
    h1 { margin: 0; font-size: 34px; line-height: 1.1; }
    .sub { margin: 0; font-size: 14px; color: #d5e4e8; }
    .hint { margin: 8px 0 0; font-size: 11px; color: #8aa8b0; }
  `;
}

/** Call from a click (Enable notify / Start). Opens the always-on-top overlay. */
export function armDesktopAlarmAlerts(): void {
  void ensureAlarmOverlayWindow();
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

function getDocumentPiP(): DocumentPictureInPicture | null {
  if (typeof window === "undefined") return null;
  const api = (window as unknown as { documentPictureInPicture?: DocumentPictureInPicture })
    .documentPictureInPicture;
  return api && typeof api.requestWindow === "function" ? api : null;
}

async function ensureAlarmOverlayWindow(): Promise<void> {
  if (pipWindow && !pipWindow.closed) return;
  const api = getDocumentPiP();
  if (!api) return;
  try {
    pipWindow = await api.requestWindow({ width: PIP_WIDTH, height: PIP_HEIGHT });
  } catch {
    pipWindow = null;
    return;
  }
  pipWindow.addEventListener("pagehide", () => {
    pipWindow = null;
  });
  pipWindow.document.addEventListener("click", () => {
    try {
      window.focus();
    } catch {
      /* ignore */
    }
  });
  renderOverlay(null);
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
