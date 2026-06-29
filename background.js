// Seedling Focus Blocker — service worker
// Owns focus state and dynamic declarativeNetRequest rules.

const STORAGE_KEYS = {
  blockList: "blockList",
  focusActive: "focusActive",
  focusEndsAt: "focusEndsAt",
  focusStrict: "focusStrict",
};

const DEFAULT_BLOCKLIST = ["twitter.com", "x.com", "youtube.com", "reddit.com", "facebook.com", "instagram.com", "tiktok.com"];
const RULE_ID_BASE = 1000;
const ALARM_END = "seedling-focus-end";

chrome.runtime.onInstalled.addListener(async () => {
  const { blockList } = await chrome.storage.local.get(STORAGE_KEYS.blockList);
  if (!blockList) {
    await chrome.storage.local.set({ [STORAGE_KEYS.blockList]: DEFAULT_BLOCKLIST });
  }
  await clearRules(); // ensure clean slate
  await chrome.storage.local.set({ [STORAGE_KEYS.focusActive]: false, [STORAGE_KEYS.focusEndsAt]: null });
});

chrome.runtime.onStartup.addListener(async () => {
  // If browser restarted mid-session, clear stale rules.
  const { focusActive, focusEndsAt } = await chrome.storage.local.get([STORAGE_KEYS.focusActive, STORAGE_KEYS.focusEndsAt]);
  if (focusActive && focusEndsAt && Date.now() < focusEndsAt) {
    await applyRules();
    scheduleEnd(focusEndsAt);
  } else {
    await stopFocus();
  }
});

function normalizeDomain(input) {
  return String(input || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "");
}

async function getBlockList() {
  const { blockList } = await chrome.storage.local.get(STORAGE_KEYS.blockList);
  return (blockList || []).map(normalizeDomain).filter(Boolean);
}

async function clearRules() {
  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  if (existing.length) {
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: existing.map(r => r.id),
    });
  }
}

async function applyRules() {
  await clearRules();
  const list = await getBlockList();
  if (!list.length) return;

  const blockedUrl = chrome.runtime.getURL("blocked.html");
  const rules = list.map((domain, i) => ({
    id: RULE_ID_BASE + i,
    priority: 1,
    action: {
      type: "redirect",
      redirect: { regexSubstitution: `${blockedUrl}?from=\\0`, },
    },
    condition: {
      // Match the domain and any subdomain on http/https main-frame loads.
      regexFilter: `^https?://([a-z0-9-]+\\.)*${domain.replace(/\./g, "\\.")}(/.*)?$`,
      resourceTypes: ["main_frame"],
    },
  }));

  await chrome.declarativeNetRequest.updateDynamicRules({ addRules: rules });
}

async function startFocus(durationMin, strict = false) {
  const endsAt = durationMin > 0 ? Date.now() + durationMin * 60 * 1000 : null;
  await chrome.storage.local.set({
    [STORAGE_KEYS.focusActive]: true,
    [STORAGE_KEYS.focusEndsAt]: endsAt,
    [STORAGE_KEYS.focusStrict]: !!strict,
  });
  await applyRules();
  if (endsAt) scheduleEnd(endsAt);
}

async function stopFocus(opts = {}) {
  const { auto = false } = opts;
  if (!auto) {
    const { [STORAGE_KEYS.focusStrict]: strict, [STORAGE_KEYS.focusEndsAt]: endsAt } =
      await chrome.storage.local.get([STORAGE_KEYS.focusStrict, STORAGE_KEYS.focusEndsAt]);
    if (strict && endsAt && Date.now() < endsAt) {
      return { rejected: true, reason: "strict" };
    }
  }
  await chrome.alarms.clear(ALARM_END);
  await clearRules();
  await chrome.storage.local.set({
    [STORAGE_KEYS.focusActive]: false,
    [STORAGE_KEYS.focusEndsAt]: null,
    [STORAGE_KEYS.focusStrict]: false,
    // Only a natural, completed session is a "win" worth celebrating.
    focusCompletedAt: auto ? Date.now() : null,
  });
  if (auto) notifyEnd();
  return { rejected: false };
}

function notifyEnd() {
  try {
    chrome.notifications.create({
      type: "basic",
      iconUrl: chrome.runtime.getURL("icons/icon128.png"),
      title: "Focus complete — good kitty 🐱",
      message: "Your cat stayed the whole time. Block list cleared.",
      priority: 1,
    });
  } catch {}
}

function scheduleEnd(endsAt) {
  chrome.alarms.create(ALARM_END, { when: endsAt });
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === ALARM_END) await stopFocus({ auto: true });
});

// Re-apply rules whenever the block list changes during an active session.
chrome.storage.onChanged.addListener(async (changes, area) => {
  if (area !== "local") return;
  if (!changes[STORAGE_KEYS.blockList]) return;
  const { focusActive } = await chrome.storage.local.get(STORAGE_KEYS.focusActive);
  if (focusActive) await applyRules();
});

// Messages from popup (same extension) and the bridge content script.
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    try {
      if (msg?.type === "START_FOCUS") {
        if (Array.isArray(msg.blockList)) {
          await chrome.storage.local.set({
            [STORAGE_KEYS.blockList]: msg.blockList.map(normalizeDomain).filter(Boolean),
          });
        }
        await startFocus(Number(msg.durationMin) || 25, !!msg.strict);
        sendResponse({ ok: true });
      } else if (msg?.type === "STOP_FOCUS") {
        const result = await stopFocus();
        sendResponse({ ok: !result.rejected, rejected: result.rejected, reason: result.reason });
      } else if (msg?.type === "GET_STATE") {
        const state = await chrome.storage.local.get([
          STORAGE_KEYS.blockList,
          STORAGE_KEYS.focusActive,
          STORAGE_KEYS.focusEndsAt,
          STORAGE_KEYS.focusStrict,
        ]);
        sendResponse({ ok: true, state });
      } else if (msg?.type === "SET_BLOCKLIST") {
        await chrome.storage.local.set({
          [STORAGE_KEYS.blockList]: (msg.blockList || []).map(normalizeDomain).filter(Boolean),
        });
        sendResponse({ ok: true });
      } else {
        sendResponse({ ok: false, error: "unknown message" });
      }
    } catch (err) {
      sendResponse({ ok: false, error: String(err) });
    }
  })();
  return true; // async response
});
