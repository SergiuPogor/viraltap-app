// Replays short versions of the five ViralTap formats inside the phone frame.
// Content comes from the app's bundled packs. No network, no storage.
(() => {
  const screen = document.getElementById("screen");
  if (!screen) return;
  const orbs = screen.querySelector(".orbs");
  const prog = screen.querySelector(".prog i");
  const pauseBtn = document.getElementById("pause");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const CHECK = '<svg viewBox="0 0 512 512"><path d="M470.6 105.4a32 32 0 0 1 0 45.3l-256 256a32 32 0 0 1-45.3 0l-128-128a32 32 0 0 1 45.3-45.3L192 338.7l233.4-233.3a32 32 0 0 1 45.3 0z"/></svg>';
  const PLAY = '<svg viewBox="0 0 24 24" fill="#fff"><path d="M6 4l14 8-14 8z"/></svg>';
  const esc = s => s.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

  const ring = (n, ms) => `<div class="ring" style="--d:${ms}ms"><svg viewBox="0 0 100 100"><circle class="track" cx="50" cy="50" r="45"/><circle class="arc" cx="50" cy="50" r="45"/></svg><b data-count="${n}">${n}</b></div>`;
  const end = { ms: 2200, html: `<div class="endcard"><div class="mark">${PLAY}</div><p class="mid">Follow for part 2</p></div>` };

  // Captions show three words at a time and light up the word being spoken.
  const caps = (text, msPerWord = 330) => {
    const words = text.split(" ");
    const out = [];
    for (let i = 0; i < words.length; i += 3) {
      const group = words.slice(i, i + 3);
      out.push({ ms: group.length * msPerWord, html: `<p class="caps">${group.map(w => `<span>${esc(w)}</span>`).join(" ")}</p>`, words: msPerWord });
    }
    return out;
  };

  const FORMATS = {
    quiz: {
      colors: ["#6d5bff", "#c04dff", "#2a1f7a"],
      scenes: [
        { ms: 1800, html: `<p class="big">Answer before the timer ends</p>` },
        { ms: 3400, html: `<div class="panel"><p class="tag">Question 1</p><p class="big">How many legs does a spider have?</p></div>${ring(3, 3000)}`, count: 3 },
        { ms: 2400, html: `<div class="panel"><div class="tick">${CHECK}</div><p class="big answer">Eight</p></div>` },
        end,
      ],
    },
    story: {
      colors: ["#0f8a8a", "#1d3b6b", "#5cf2c7"],
      scenes: [
        { ms: 1900, html: `<div class="panel"><p class="tag">Story time</p><p class="big">The Perfect Roommate</p></div>` },
        ...caps("My new roommate was perfect. He never left dishes in the sink. The only odd thing was that I never actually saw him."),
        end,
      ],
    },
    wyr: {
      colors: ["#ff5c8a", "#7b2cff", "#c04dff"],
      scenes: [
        { ms: 1700, html: `<p class="big">Would you rather…</p>` },
        { ms: 3600, html: `<div class="vs"><div class="opt"><i class="fill" style="background:#ff5c8a"></i><span>Be invisible</span></div><p class="or">or</p><div class="opt"><i class="fill" style="background:#5cf2c7"></i><span>Be super strong</span></div></div>${ring(3, 3000)}`, count: 3 },
        { ms: 2200, html: `<p class="mid">Which one would you pick?</p><p class="small">Tell us in the comments</p>` },
        end,
      ],
    },
    top5: {
      colors: ["#ff7a2f", "#e3306c", "#ffd84d"],
      scenes: [
        { ms: 1800, html: `<div class="panel"><p class="big">5 facts about cats</p></div>` },
        { ms: 2300, html: `<p class="rank">3</p><div class="panel"><p class="mid">Nose print</p><p class="small">Every cat has a unique nose pattern, a bit like a human fingerprint.</p></div>` },
        { ms: 2300, html: `<p class="rank">2</p><div class="panel"><p class="mid">Floating collarbone</p><p class="small">Tiny, unattached collarbones let cats squeeze through tight gaps.</p></div>` },
        { ms: 2300, html: `<p class="rank">1</p><div class="panel"><p class="mid">Air twist</p><p class="small">Cats can twist their bodies in mid-air to land on their feet.</p></div>` },
        end,
      ],
    },
    factfake: {
      colors: ["#1db58a", "#3d2fb8", "#5cf2c7"],
      scenes: [
        { ms: 1600, html: `<p class="big">Fact or fake?</p>` },
        { ms: 3400, html: `<div class="panel"><p class="big">A day on Venus is longer than its year.</p></div>${ring(3, 3000)}`, count: 3 },
        { ms: 2800, html: `<span class="verdict">Fact</span><div class="panel"><p class="small" style="margin:0">Venus spins so slowly that one day outlasts its orbit.</p></div>` },
        end,
      ],
    },
  };

  let current = "quiz", index = 0, timers = [], paused = false, visible = true, started = 0;

  const clear = () => { timers.forEach(clearTimeout); timers = []; };
  const later = (fn, ms) => timers.push(setTimeout(fn, ms));

  function total(f) { return FORMATS[f].scenes.reduce((s, x) => s + x.ms, 0); }
  function elapsedBefore(f, i) { return FORMATS[f].scenes.slice(0, i).reduce((s, x) => s + x.ms, 0); }

  function setProgress(f, i) {
    const t = total(f), from = elapsedBefore(f, i) / t, to = elapsedBefore(f, i + 1) / t;
    prog.style.transition = "none";
    prog.style.transform = `scaleX(${from})`;
    if (reduce) return;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      prog.style.transition = `transform ${FORMATS[f].scenes[i].ms}ms linear`;
      prog.style.transform = `scaleX(${to})`;
    }));
  }

  function render() {
    clear();
    const fmt = FORMATS[current], scene = fmt.scenes[index];
    screen.style.setProperty("--o1", fmt.colors[0]);
    screen.style.setProperty("--o2", fmt.colors[1]);
    screen.style.setProperty("--o3", fmt.colors[2]);
    screen.querySelectorAll(".scene").forEach(n => n.remove());
    const el = document.createElement("div");
    el.className = "scene" + (reduce ? "" : " in");
    el.innerHTML = scene.html;
    screen.insertBefore(el, prog.parentElement);
    setProgress(current, index);
    started = Date.now();

    if (scene.count) {
      const b = el.querySelector("[data-count]");
      for (let n = scene.count - 1; n >= 1; n--) later(() => { b.textContent = n; }, (scene.count - n) * 1000);
      later(() => {
        el.querySelectorAll(".opt .fill").forEach((f, k) => { f.style.transform = `scaleX(${k ? 0.38 : 0.62})`; });
      }, scene.count * 1000 - 200);
    }
    if (scene.words) {
      const spans = el.querySelectorAll(".caps span");
      spans.forEach((s, k) => later(() => {
        spans.forEach((o, j) => { o.classList.toggle("on", j === k); o.classList.toggle("done", j < k); });
      }, k * scene.words));
    }
    if (!paused && visible) later(next, scene.ms);
  }

  function next() {
    index = (index + 1) % FORMATS[current].scenes.length;
    render();
  }

  function pick(f) { current = f; index = 0; render(); }

  document.querySelectorAll('input[name="format"]').forEach(r => r.addEventListener("change", () => pick(r.value)));

  function setPaused(p) {
    paused = p;
    pauseBtn.setAttribute("aria-pressed", String(p));
    pauseBtn.querySelector("span").textContent = p ? "Play demo" : "Pause demo";
    pauseBtn.querySelector("svg").innerHTML = p ? '<path d="M3 1l11 7-11 7z"/>' : '<path d="M3 1h3.5v14H3zM9.5 1H13v14H9.5z"/>';
    orbs.style.animationPlayState = p ? "paused" : "";
    screen.querySelectorAll(".orbs i").forEach(i => { i.style.animationPlayState = p ? "paused" : ""; });
    render();
  }
  pauseBtn.addEventListener("click", () => setPaused(!paused));

  new IntersectionObserver(([e]) => {
    const was = visible;
    visible = e.isIntersecting && !document.hidden;
    if (visible && !was) render(); else if (!visible) clear();
  }).observe(screen);
  document.addEventListener("visibilitychange", () => { visible = !document.hidden; visible ? render() : clear(); });

  if (reduce) setPaused(true); else render();
})();
