import { afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  SEMIFINAL_MONITOR_QUEUE_CLEARED_KEY,
  SEMIFINAL_RESULT_CHANGED_AT_KEY,
  SEMIFINAL_RESULT_CHANGED_EVENT,
  clearSemifinalMonitorQueueCleared,
  isSemifinalMonitorQueueCleared,
  markSemifinalMonitorQueueCleared,
  notifySemifinalResultChanged,
} from "./semifinal-result-events";

class MemoryStorage {
  private data = new Map<string, string>();
  getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.data.set(key, String(value));
  }
  removeItem(key: string) {
    this.data.delete(key);
  }
}

const session = new MemoryStorage();
const local = new MemoryStorage();
const listeners = new Map<string, Set<() => void>>();

beforeAll(() => {
  Object.defineProperty(globalThis, "sessionStorage", { value: session, configurable: true });
  Object.defineProperty(globalThis, "localStorage", { value: local, configurable: true });
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      addEventListener(type: string, fn: () => void) {
        const set = listeners.get(type) ?? new Set();
        set.add(fn);
        listeners.set(type, set);
      },
      removeEventListener(type: string, fn: () => void) {
        listeners.get(type)?.delete(fn);
      },
      dispatchEvent(event: { type: string }) {
        for (const fn of listeners.get(event.type) ?? []) fn();
        return true;
      },
    },
  });
});

afterEach(() => {
  session.removeItem(SEMIFINAL_MONITOR_QUEUE_CLEARED_KEY);
  local.removeItem(SEMIFINAL_RESULT_CHANGED_AT_KEY);
  listeners.clear();
});

describe("semifinal monitor queue cleared flag", () => {
  it("starts uncleared", () => {
    expect(isSemifinalMonitorQueueCleared()).toBe(false);
  });

  it("persists clear in sessionStorage", () => {
    markSemifinalMonitorQueueCleared();
    expect(isSemifinalMonitorQueueCleared()).toBe(true);
    expect(session.getItem(SEMIFINAL_MONITOR_QUEUE_CLEARED_KEY)).toBe("1");
  });

  it("drops the flag on explicit clear", () => {
    markSemifinalMonitorQueueCleared();
    clearSemifinalMonitorQueueCleared();
    expect(isSemifinalMonitorQueueCleared()).toBe(false);
  });

  it("drops the cleared flag when a SemiFinal run finishes", () => {
    markSemifinalMonitorQueueCleared();
    const seen: string[] = [];
    const onChanged = () => seen.push("changed");
    window.addEventListener(SEMIFINAL_RESULT_CHANGED_EVENT, onChanged);
    notifySemifinalResultChanged({ mode: "open", runId: "run-1" });
    window.removeEventListener(SEMIFINAL_RESULT_CHANGED_EVENT, onChanged);
    expect(isSemifinalMonitorQueueCleared()).toBe(false);
    expect(seen).toEqual(["changed"]);
    expect(local.getItem(SEMIFINAL_RESULT_CHANGED_AT_KEY)).toBeTruthy();
  });
});
