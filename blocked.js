const params = new URLSearchParams(location.search);
const fromUrl = params.get("from") || "";
if (fromUrl) {
  try {
    const u = new URL(fromUrl);
    document.getElementById("fromUrl").textContent = u.hostname + u.pathname;
  } catch {
    document.getElementById("fromUrl").textContent = fromUrl;
  }
} else {
  document.getElementById("fromUrl").remove();
}

const $ = (id) => document.getElementById(id);
$("back").addEventListener("click", () => history.back());

// chrome APIs are only present when this runs inside the extension.
const inExtension = typeof chrome !== "undefined" && chrome.runtime?.id;

let celebrated = false; // focus finished naturally -> happy cat
let leaving = false;    // user stopped early -> cat runs off

// ---- live countdown --------------------------------------------------
async function tick() {
  if (celebrated) return;
  const el = $("countdown");
  if (!inExtension) { el.textContent = ""; return; }
  const { focusEndsAt } = await chrome.storage.local.get("focusEndsAt");
  if (!focusEndsAt) { el.textContent = "Open-ended focus session 🐱"; return; }
  const ms = focusEndsAt - Date.now();
  if (ms <= 0) { el.textContent = "Wrapping up…"; return; }
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  el.textContent = `Kitty wakes in ${m}:${String(s).padStart(2, "0")}`;
}
tick();
if (inExtension) setInterval(tick, 1000);

// ---- success! focus timer completed naturally ------------------------
function celebrate() {
  if (celebrated || leaving) return;
  celebrated = true;

  const cat = $("catImg");
  cat.classList.remove("runoff");
  cat.classList.add("happy");
  cat.src = "cathappygif.gif";
  cat.alt = "A happy cat";

  $("title").textContent = "Focus complete! 🎉";
  $("subtitle").textContent = "Nice work — your cat is proud of you.";
  $("countdown").remove();
  const from = $("fromUrl"); if (from) from.remove();
  $("note").textContent = "";

  // Ask: focus again, or go on through to the site (now unblocked).
  const actions = document.querySelector(".actions");
  actions.innerHTML = "";

  const wrap = document.createElement("div");
  wrap.className = "again";
  const lbl = document.createElement("span");
  lbl.className = "lbl";
  lbl.textContent = "Focus again?";
  const mins = document.createElement("input");
  mins.type = "number"; mins.min = "1"; mins.max = "240"; mins.value = "25";
  const minLbl = document.createElement("span");
  minLbl.className = "lbl"; minLbl.textContent = "min";
  const startBtn = document.createElement("button");
  startBtn.className = "btn-stop"; startBtn.textContent = "🐱 Start focus";
  wrap.append(lbl, mins, minLbl, startBtn);

  const visitBtn = document.createElement("button");
  visitBtn.className = "btn-ghost";
  visitBtn.textContent = "Just visit the site →";

  actions.append(wrap, visitBtn);

  startBtn.addEventListener("click", async () => {
    startBtn.disabled = true;
    const durationMin = Math.max(1, Math.min(240, parseInt(mins.value, 10) || 25));
    await chrome.runtime.sendMessage({ type: "START_FOCUS", durationMin });
    // This site is blocked again — reload to drop back to the sleeping cat.
    location.reload();
  });

  visitBtn.addEventListener("click", () => {
    if (fromUrl) location.href = fromUrl; else history.back();
  });
}

// The service worker sets focusCompletedAt when a session ends on its own.
if (inExtension) {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (changes.focusCompletedAt && changes.focusCompletedAt.newValue) celebrate();
  });
  // In case the session completed in the instant before this page wired up.
  chrome.storage.local.get("focusCompletedAt").then(({ focusCompletedAt }) => {
    if (focusCompletedAt && Date.now() - focusCompletedAt < 4000) celebrate();
  });
}

// Preview helper: blocked.html?celebrate=1 shows the success state with no extension.
if (!inExtension && params.get("celebrate")) celebrate();

// ---- stop focus early: cat runs off, then the site loads -------------
function runCatOff(then) {
  const cat = $("catImg");
  cat.src = "orangcat-walkaway-pixelart.gif"; // swap sleeping -> walking away
  cat.classList.add("runoff");
  let done = false;
  const finish = () => { if (!done) { done = true; then(); } };
  cat.addEventListener("animationend", finish, { once: true });
  setTimeout(finish, 1800); // fallback in case animationend doesn't fire
}

$("stop").addEventListener("click", async () => {
  if (leaving) return;
  leaving = true;
  const stopBtn = $("stop");
  stopBtn.disabled = true;

  // Outside the extension (preview) just play the animation.
  if (!inExtension) {
    $("note").textContent = "(preview — cat runs off)";
    runCatOff(() => {});
    return;
  }

  const res = await chrome.runtime.sendMessage({ type: "STOP_FOCUS" });
  if (res?.rejected) {
    // Strict mode: the cat won't budge until the timer ends.
    leaving = false;
    stopBtn.disabled = false;
    $("note").textContent = "🔒 Strict focus is on — your cat won't leave until the timer ends.";
    return;
  }

  $("title").textContent = "Off they go!";
  $("subtitle").textContent = "Focus stopped — taking you to the site…";
  runCatOff(() => {
    if (fromUrl) location.href = fromUrl; else history.back();
  });
});
