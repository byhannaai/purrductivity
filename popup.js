const $ = (id) => document.getElementById(id);
let blockList = [];
let focusActive = false;
let focusEndsAt = null;
let focusStrict = false;
let countdownHandle = null;

async function refresh() {
  const res = await chrome.runtime.sendMessage({ type: "GET_STATE" });
  if (!res?.ok) return;
  blockList = res.state.blockList || [];
  focusActive = !!res.state.focusActive;
  focusEndsAt = res.state.focusEndsAt || null;
  focusStrict = !!res.state.focusStrict;
  render();
}

function render() {
  $("dot").classList.toggle("active", focusActive);
  $("startBtn").classList.toggle("hidden", focusActive);
  $("stopBtn").classList.toggle("hidden", !focusActive || focusStrict);
  $("duration").disabled = focusActive;

  if (focusActive) {
    $("statusLabel").textContent = focusStrict ? "Strict focus active 🔒" : "Focus active";
    updateCountdown();
    if (countdownHandle) clearInterval(countdownHandle);
    countdownHandle = setInterval(updateCountdown, 1000);
  } else {
    $("statusLabel").textContent = "Idle";
    $("statusSub").textContent = blockList.length
      ? `${blockList.length} site${blockList.length === 1 ? "" : "s"} on the block list.`
      : "Add sites below, then start focus.";
    if (countdownHandle) { clearInterval(countdownHandle); countdownHandle = null; }
  }

  const ul = $("list");
  ul.innerHTML = "";
  if (!blockList.length) {
    const li = document.createElement("li");
    li.className = "empty";
    li.textContent = "No sites blocked yet.";
    ul.appendChild(li);
  }
  for (const domain of blockList) {
    const li = document.createElement("li");
    li.textContent = domain;
    const x = document.createElement("button");
    x.textContent = "✕";
    x.title = "Remove";
    x.addEventListener("click", () => removeDomain(domain));
    li.appendChild(x);
    ul.appendChild(li);
  }
}

function updateCountdown() {
  if (!focusEndsAt) {
    $("statusSub").textContent = "Open-ended session.";
    return;
  }
  const ms = focusEndsAt - Date.now();
  if (ms <= 0) {
    $("statusSub").textContent = "Wrapping up…";
    refresh();
    return;
  }
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  $("statusSub").textContent = `Ends in ${m}:${String(s).padStart(2, "0")}`;
}

$("startBtn").addEventListener("click", async () => {
  const durationMin = Math.max(1, Math.min(240, parseInt($("duration").value, 10) || 25));
  const strict = $("strict").checked;
  await chrome.runtime.sendMessage({ type: "START_FOCUS", durationMin, blockList, strict });
  await refresh();
});

function playRunaway() {
  const overlay = $("runaway");
  overlay.classList.remove("show");
  void overlay.offsetWidth; // restart the animation if it just played
  overlay.classList.add("show");
  setTimeout(() => overlay.classList.remove("show"), 1750);
}

$("stopBtn").addEventListener("click", async () => {
  // The stop button only shows on a non-strict, still-running session,
  // so clicking it always means the user is bailing before the timer.
  const earlyQuit = focusEndsAt && Date.now() < focusEndsAt;
  const res = await chrome.runtime.sendMessage({ type: "STOP_FOCUS" });
  if (res?.ok && earlyQuit) playRunaway();
  await refresh();
});

$("addForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const v = $("addInput").value.trim().toLowerCase();
  if (!v) return;
  if (!blockList.includes(v)) blockList = [...blockList, v];
  await chrome.runtime.sendMessage({ type: "SET_BLOCKLIST", blockList });
  $("addInput").value = "";
  await refresh();
});

async function removeDomain(domain) {
  blockList = blockList.filter(d => d !== domain);
  await chrome.runtime.sendMessage({ type: "SET_BLOCKLIST", blockList });
  await refresh();
}

chrome.storage.onChanged.addListener((_changes, area) => {
  if (area === "local") refresh();
});

refresh();
