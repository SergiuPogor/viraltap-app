// Replays short versions of the five ViralTap formats inside the phone frame.
// Content comes from the app's bundled packs. No network, no storage.
// Sound is off until the visitor turns it on. Music and effects are generated live with Web Audio,
// the same way the app makes them on the phone, and the voice is the browser's own speech.
(() => {
  const screen = document.getElementById("screen");
  if (!screen) return;
  const orbs = screen.querySelector(".orbs");
  const prog = screen.querySelector(".prog i");
  const pauseBtn = document.getElementById("pause");
  const soundBtn = document.getElementById("sound");
  const hint = document.getElementById("demo-hint");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const CHECK = '<svg viewBox="0 0 512 512"><path d="M470.6 105.4a32 32 0 0 1 0 45.3l-256 256a32 32 0 0 1-45.3 0l-128-128a32 32 0 0 1 45.3-45.3L192 338.7l233.4-233.3a32 32 0 0 1 45.3 0z"/></svg>';
  const CROSS = '<svg viewBox="0 0 384 512"><path d="M342.6 150.6a32 32 0 0 0-45.3-45.3L192 210.7 86.6 105.4a32 32 0 0 0-45.3 45.3L146.7 256 41.4 361.4a32 32 0 0 0 45.3 45.3L192 301.3l105.4 105.4a32 32 0 0 0 45.3-45.3L237.3 256z"/></svg>';
  const PLAY = '<svg viewBox="0 0 24 24" fill="#fff"><path d="M6 4l14 8-14 8z"/></svg>';
  const SPEAKER_OFF = '<path d="M1 5.5h3L8 2v12L4 10.5H1zM10.5 5.5l4 5m0-5l-4 5" stroke="currentColor" stroke-width="1.6" fill="currentColor"/>';
  const SPEAKER_ON = '<path d="M1 5.5h3L8 2v12L4 10.5H1z"/><path d="M10.5 5a4 4 0 0 1 0 6M12.5 3a7 7 0 0 1 0 10" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round"/>';
  const esc = s => s.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

  // ---------- Sound ----------
  const audio = (() => {
    let ctx = null, master, musicBus, fxBus, noiseBuf, timer = null, style = null, step = 0, nextAt = 0;
    const midi = n => 440 * Math.pow(2, (n - 69) / 12);
    const MAJOR = [0, 2, 4, 5, 7, 9, 11], MINOR = [0, 2, 3, 5, 7, 8, 10];
    // One music style per format, matching the styles the app generates.
    const STYLES = {
      quiz: { bpm: 122, root: 50, scale: MAJOR, prog: [0, 4, 5, 3], kick: "x...x...x...x...", snare: "....x.......x...", hat: "..x...x...x...x.", lead: "sine" },
      story: { bpm: 80, root: 48, scale: MAJOR, prog: [0, 5, 3, 4], kick: "x.........x.....", snare: "....x.......x...", hat: "..x...x...x...x.", lead: "triangle" },
      wyr: { bpm: 108, root: 52, scale: MINOR, prog: [0, 3, 0, 4], kick: "x..x..x...x..x..", snare: "....x.......x..x", hat: "x.xxx.xxx.xxx.xx", lead: "square" },
      top5: { bpm: 100, root: 45, scale: MINOR, prog: [0, 5, 3, 4], kick: "x...x...x...x.x.", snare: "....x.......x...", hat: "..x...x...x...x.", lead: "sawtooth" },
      factfake: { bpm: 96, root: 47, scale: MINOR, prog: [0, 0, 5, 4], kick: "x.......x.......", snare: "................", hat: "x...x...x...x...", lead: "triangle" },
    };
    const deg = (st, d) => st.scale[((d % 7) + 7) % 7] + 12 * Math.floor(d / 7);

    function init() {
      if (ctx) return true;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = 0.8;
      const comp = ctx.createDynamicsCompressor();
      master.connect(comp).connect(ctx.destination);
      musicBus = ctx.createGain(); musicBus.gain.value = 0.32; musicBus.connect(master);
      fxBus = ctx.createGain(); fxBus.gain.value = 0.55; fxBus.connect(master);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      return true;
    }

    function tone(bus, freq, at, dur, { type = "sine", gain = 0.3, to = null, attack = 0.004, filter = null } = {}) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, at);
      if (to) o.frequency.exponentialRampToValueAtTime(to, at + dur);
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(gain, at + attack);
      g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
      let node = o.connect(g);
      if (filter) { const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = filter; node = g.connect(f); }
      node.connect(bus);
      o.start(at); o.stop(at + dur + 0.05);
    }

    function noise(bus, at, dur, { gain = 0.2, type = "highpass", freq = 7000, to = null, q = 0.8 } = {}) {
      const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      src.buffer = noiseBuf;
      f.type = type; f.Q.value = q;
      f.frequency.setValueAtTime(freq, at);
      if (to) f.frequency.exponentialRampToValueAtTime(to, at + dur);
      g.gain.setValueAtTime(gain, at);
      g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
      src.connect(f).connect(g).connect(bus);
      src.start(at, Math.random() * 0.5); src.stop(at + dur + 0.05);
    }

    function beat(st, i, at) {
      const s = i % 16, bar = Math.floor(i / 16) % st.prog.length, chord = st.prog[bar], len = 60 / st.bpm / 4;
      if (st.kick[s] === "x") tone(musicBus, 150, at, 0.22, { gain: 0.9, to: 45 });
      if (st.snare[s] === "x") { noise(musicBus, at, 0.14, { gain: 0.3, type: "bandpass", freq: 1800 }); tone(musicBus, 190, at, 0.08, { gain: 0.2 }); }
      if (st.hat[s] === "x") noise(musicBus, at, 0.04, { gain: 0.12 });
      if (s % 4 === 0) tone(musicBus, midi(st.root - 12 + deg(st, chord)), at, len * 3, { type: "triangle", gain: 0.45 });
      if (s === 0) [0, 2, 4].forEach(t => tone(musicBus, midi(st.root + 12 + deg(st, chord + t)), at, len * 16, { type: "triangle", gain: 0.07, attack: 0.25 }));
      // A seeded arpeggio, so each loop sounds the same and does not feel random.
      if ((s * 7 + bar * 3) % 5 < 3 && s % 2 === 0) {
        const off = [0, 2, 4, 7][(s * 5 + bar) % 4];
        tone(musicBus, midi(st.root + 24 + deg(st, chord + off)), at, len * 2.5, { type: st.lead, gain: st.lead === "sine" || st.lead === "triangle" ? 0.12 : 0.05, filter: 3200 });
      }
    }

    function schedule() {
      const len = 60 / style.bpm / 4;
      while (nextAt < ctx.currentTime + 0.15) { beat(style, step++, nextAt); nextAt += len; }
    }

    const FX = {
      tick: at => tone(fxBus, 1800, at, 0.06, { gain: 0.5 }),
      tock: at => tone(fxBus, 1050, at, 0.07, { gain: 0.45 }),
      tickHi: at => tone(fxBus, 2400, at, 0.1, { gain: 0.55 }),
      pop: at => tone(fxBus, 900, at, 0.12, { gain: 0.5, to: 280 }),
      whoosh: at => noise(fxBus, at, 0.45, { gain: 0.35, type: "bandpass", freq: 400, to: 2600, q: 1.2 }),
      ding: at => { tone(fxBus, 1319, at, 0.7, { gain: 0.3 }); tone(fxBus, 1760, at, 0.6, { gain: 0.15 }); },
      correct: at => { tone(fxBus, 1319, at, 0.2, { gain: 0.32 }); tone(fxBus, 1976, at + 0.11, 0.7, { gain: 0.32 }); tone(fxBus, 3952, at + 0.11, 0.4, { gain: 0.06 }); },
      wrong: at => { tone(fxBus, 220, at, 0.2, { type: "square", gain: 0.12, filter: 1200 }); tone(fxBus, 165, at + 0.18, 0.3, { type: "square", gain: 0.12, filter: 1000 }); },
      boom: at => { tone(fxBus, 98, at, 0.6, { gain: 0.9, to: 38 }); noise(fxBus, at, 0.08, { gain: 0.25, type: "lowpass", freq: 1200 }); },
      sparkle: at => [0, 4, 7, 12, 7, 16].forEach((n, i) => tone(fxBus, midi(84 + n), at + i * 0.06, 0.3, { gain: 0.1 })),
      tada: at => { [72, 76, 79].forEach((n, i) => tone(fxBus, midi(n), at + i * 0.1, 0.9 - i * 0.1, { type: "triangle", gain: 0.25 })); },
    };

    let speaking = false;
    function duck() {
      if (ctx) musicBus.gain.setTargetAtTime(speaking ? 0.1 : 0.32, ctx.currentTime, 0.08);
    }
    let voice = null;
    function pickVoice() {
      const all = window.speechSynthesis ? speechSynthesis.getVoices() : [];
      // Only voices that run on the visitor's device, so no text is sent to a speech server.
      const en = all.filter(v => v.localService && /^en(-|_|$)/i.test(v.lang));
      voice = en.find(v => /samantha|daniel|karen|zira|david/i.test(v.name)) || en[0] || null;
    }
    if (window.speechSynthesis) { pickVoice(); speechSynthesis.addEventListener?.("voiceschanged", pickVoice); }

    return {
      on: false,
      enable() {
        if (!init()) return false;
        this.on = true;
        ctx.resume();
        return true;
      },
      disable() { this.on = false; this.stopMusic(); this.hush(); },
      music(name) {
        if (!this.on) return;
        if (style !== STYLES[name] || !timer) {
          this.stopMusic();
          style = STYLES[name]; step = 0; nextAt = ctx.currentTime + 0.05;
          timer = setInterval(schedule, 40);
          schedule();
        }
      },
      stopMusic() { clearInterval(timer); timer = null; style = null; },
      fx(name, delay = 0) { if (this.on && FX[name]) FX[name](ctx.currentTime + delay / 1000 + 0.01); },
      say(text) {
        if (!this.on || !window.speechSynthesis || !text || !voice) return;
        speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        if (voice) u.voice = voice;
        u.lang = voice ? voice.lang : "en-US";
        u.rate = 1.08; u.pitch = 1.05;
        u.onstart = () => { speaking = true; duck(); };
        u.onend = u.onerror = () => { speaking = false; duck(); };
        speechSynthesis.speak(u);
      },
      hush() { if (window.speechSynthesis) speechSynthesis.cancel(); speaking = false; duck(); },
    };
  })();

  // ---------- Scenes ----------
  const ring = (n, ms) => `<div class="ring" style="--d:${ms}ms"><svg viewBox="0 0 100 100"><circle class="track" cx="50" cy="50" r="45"/><circle class="arc" cx="50" cy="50" r="45"/></svg><b data-count="${n}">${n}</b></div>`;
  const end = { ms: 2200, html: () => `<div class="endcard"><div class="mark">${PLAY}</div><p class="mid">Follow for part 2</p></div>`, say: "Follow for part two!", sfx: [["whoosh", 0], ["tada", 150]] };
  const choices = (opts, label) => `<div class="choices" role="group" aria-label="${label}">${opts.map((o, k) => `<button type="button" data-choice="${k}">${esc(o)}</button>`).join("")}</div>`;

  // Captions show three words at a time and light up the word being spoken.
  const caps = (text, msPerWord = 330) => {
    const words = text.split(" ");
    const out = [];
    for (let i = 0; i < words.length; i += 3) {
      const group = words.slice(i, i + 3);
      out.push({ ms: group.length * msPerWord, html: () => `<p class="caps">${group.map(w => `<span>${esc(w)}</span>`).join(" ")}</p>`, words: msPerWord, say: i === 0 ? text : null, keepVoice: i > 0 });
    }
    return out;
  };
  const STORY = "My new roommate was perfect. He never left dishes in the sink. The only odd thing was that I never actually saw him.";
  const result = (right, yes, no) => `<p class="you ${right ? "ok" : "no"}">${right ? yes : no}</p>`;

  const FORMATS = {
    quiz: {
      colors: ["#6d5bff", "#c04dff", "#2a1f7a"],
      hint: "Tap an answer before the timer runs out.",
      scenes: [
        { ms: 1800, html: () => `<p class="big">Answer before the timer ends</p>`, say: "Answer before the timer ends!", sfx: [["whoosh", 0]] },
        { ms: 3600, ask: true, html: () => `<div class="panel"><p class="tag">Question 1</p><p class="big">How many legs does a spider have?</p></div>${choices(["6", "8", "10"], "Your answer")}${ring(3, 3000)}`, count: 3, say: "How many legs does a spider have?", sfx: [["pop", 0]] },
        { ms: 2600, html: c => `<div class="panel"><div class="tick">${CHECK}</div><p class="big answer">Eight</p>${c == null ? "" : result(c === 1, "You got it!", "Not this time")}</div>`, say: "Eight!", sfx: c => c == null || c === 1 ? [["correct", 0], ["sparkle", 300]] : [["wrong", 0]] },
        end,
      ],
    },
    story: {
      colors: ["#0f8a8a", "#1d3b6b", "#5cf2c7"],
      hint: "Turn the sound on to hear the voice and music.",
      scenes: [
        { ms: 1900, html: () => `<div class="panel"><p class="tag">Story time</p><p class="big">The Perfect Roommate</p></div>`, say: "The perfect roommate.", sfx: [["whoosh", 0], ["sparkle", 250]] },
        ...caps(STORY),
        end,
      ],
    },
    wyr: {
      colors: ["#ff5c8a", "#7b2cff", "#c04dff"],
      hint: "Tap the one you would pick.",
      scenes: [
        { ms: 1700, html: () => `<p class="big">Would you rather…</p>`, say: "Would you rather...", sfx: [["whoosh", 0]] },
        { ms: 3800, ask: true, vote: true, html: () => `<div class="vs" role="group" aria-label="Your pick"><button type="button" class="opt" data-choice="0"><i class="fill" style="background:#ff5c8a"></i><span>Be invisible</span><em>62%</em></button><p class="or">or</p><button type="button" class="opt" data-choice="1"><i class="fill" style="background:#5cf2c7"></i><span>Be super strong</span><em>38%</em></button></div>${ring(3, 3000)}`, count: 3, say: "Be invisible, or be super strong?", sfx: [["pop", 0]] },
        { ms: 2400, html: c => c == null ? `<p class="mid">Which one would you pick?</p><p class="small">Tell us in the comments</p>` : `<p class="mid">You picked ${c === 0 ? "invisible" : "super strong"}</p><p class="small">${c === 0 ? "62%" : "38%"} of people agree with you</p>`, say: "Which one would you pick? Tell us in the comments!", sfx: [["ding", 0]] },
        end,
      ],
    },
    top5: {
      colors: ["#ff7a2f", "#e3306c", "#ffd84d"],
      hint: "Turn the sound on to hear the countdown.",
      scenes: [
        { ms: 1800, html: () => `<div class="panel"><p class="big">5 facts about cats</p></div>`, say: "Five facts about cats.", sfx: [["whoosh", 0]] },
        { ms: 2800, html: () => `<p class="rank">3</p><div class="panel"><p class="mid">Nose print</p><p class="small">Every cat has a unique nose pattern, a bit like a human fingerprint.</p></div>`, say: "Number three. Every cat has a unique nose print.", sfx: [["boom", 0]] },
        { ms: 2800, html: () => `<p class="rank">2</p><div class="panel"><p class="mid">Floating collarbone</p><p class="small">Tiny, unattached collarbones let cats squeeze through tight gaps.</p></div>`, say: "Number two. Floating collarbones let cats squeeze through tight gaps.", sfx: [["boom", 0]] },
        { ms: 2800, html: () => `<p class="rank">1</p><div class="panel"><p class="mid">Air twist</p><p class="small">Cats can twist their bodies in mid-air to land on their feet.</p></div>`, say: "Number one. Cats twist in mid air to land on their feet!", sfx: [["boom", 0], ["sparkle", 200]] },
        end,
      ],
    },
    factfake: {
      colors: ["#1db58a", "#3d2fb8", "#5cf2c7"],
      hint: "Tap Fact or Fake before the timer runs out.",
      scenes: [
        { ms: 1600, html: () => `<p class="big">Fact or fake?</p>`, say: "Fact or fake?", sfx: [["whoosh", 0]] },
        { ms: 3600, ask: true, html: () => `<div class="panel"><p class="big">A day on Venus is longer than its year.</p></div>${choices(["Fact", "Fake"], "Your guess")}${ring(3, 3000)}`, count: 3, say: "A day on Venus is longer than its year.", sfx: [["pop", 0]] },
        { ms: 3000, html: c => `<span class="verdict">Fact</span><div class="panel"><p class="small" style="margin:0">Venus spins so slowly that one day outlasts its orbit.</p>${c == null ? "" : result(c === 0, "You got it!", "Fooled you!")}</div>`, say: "Fact! Venus spins so slowly that one day outlasts its year.", sfx: c => c == null || c === 0 ? [["correct", 0]] : [["wrong", 0]] },
        end,
      ],
    },
  };

  let current = "quiz", index = 0, timers = [], paused = false, visible = true, choice = null;

  const clear = () => { timers.forEach(clearTimeout); timers = []; };
  const later = (fn, ms) => timers.push(setTimeout(fn, ms));
  const live = () => !paused && visible;

  function total(f) { return FORMATS[f].scenes.reduce((s, x) => s + x.ms, 0); }
  function elapsedBefore(f, i) { return FORMATS[f].scenes.slice(0, i).reduce((s, x) => s + x.ms, 0); }

  function setProgress(f, i) {
    const t = total(f), from = elapsedBefore(f, i) / t, to = elapsedBefore(f, i + 1) / t;
    prog.style.transition = "none";
    prog.style.transform = `scaleX(${from})`;
    if (reduce || !live()) return;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      prog.style.transition = `transform ${FORMATS[f].scenes[i].ms}ms linear`;
      prog.style.transform = `scaleX(${to})`;
    }));
  }

  function showVotes(el) {
    el.querySelectorAll(".opt .fill").forEach((f, k) => { f.style.transform = `scaleX(${k ? 0.38 : 0.62})`; });
    el.querySelector(".vs")?.classList.add("voted");
  }

  function answer(el, scene, k) {
    if (choice != null) return;
    choice = k;
    el.querySelectorAll("[data-choice]").forEach(b => {
      b.disabled = true;
      b.classList.toggle("picked", Number(b.dataset.choice) === k);
    });
    audio.fx("pop");
    if (scene.vote) showVotes(el);
    // Answering skips the rest of the timer, like tapping through a real video.
    if (live()) { clear(); later(next, scene.vote ? 1100 : 500); }
  }

  function render() {
    clear();
    const fmt = FORMATS[current], scene = fmt.scenes[index];
    if (index === 0) choice = null;
    screen.style.setProperty("--o1", fmt.colors[0]);
    screen.style.setProperty("--o2", fmt.colors[1]);
    screen.style.setProperty("--o3", fmt.colors[2]);
    screen.querySelectorAll(".scene").forEach(n => n.remove());
    const el = document.createElement("div");
    el.className = "scene" + (reduce ? "" : " in");
    el.innerHTML = scene.html(choice);
    screen.insertBefore(el, prog.parentElement);
    setProgress(current, index);
    if (hint) hint.textContent = fmt.hint;

    el.querySelectorAll("[data-choice]").forEach(b => b.addEventListener("click", () => answer(el, scene, Number(b.dataset.choice))));

    if (!live()) { audio.stopMusic(); audio.hush(); return; }

    audio.music(current);
    if (scene.say) audio.say(scene.say); else if (!scene.keepVoice) audio.hush();
    const sfx = typeof scene.sfx === "function" ? scene.sfx(choice) : scene.sfx || [];
    sfx.forEach(([name, at]) => audio.fx(name, at));

    if (scene.count) {
      const b = el.querySelector("[data-count]");
      // A clock: tick on each second, tock between, and a higher tick on the last second.
      for (let i = 0; i < scene.count; i++) {
        later(() => audio.fx(i === scene.count - 1 ? "tickHi" : "tick"), i * 1000);
        later(() => audio.fx("tock"), i * 1000 + 500);
      }
      for (let n = scene.count - 1; n >= 1; n--) later(() => { b.textContent = n; }, (scene.count - n) * 1000);
      if (scene.vote) later(() => showVotes(el), scene.count * 1000 - 200);
    }
    if (scene.words) {
      const spans = el.querySelectorAll(".caps span");
      spans.forEach((s, k) => later(() => {
        spans.forEach((o, j) => { o.classList.toggle("on", j === k); o.classList.toggle("done", j < k); });
      }, k * scene.words));
    }
    later(next, scene.ms);
  }

  function next() {
    index = (index + 1) % FORMATS[current].scenes.length;
    render();
  }

  function pick(f) { current = f; index = 0; audio.stopMusic(); render(); }

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

  function setSound(on) {
    if (on && !audio.enable()) { soundBtn.hidden = true; return; }
    if (!on) audio.disable();
    soundBtn.setAttribute("aria-pressed", String(on));
    soundBtn.querySelector("span").textContent = on ? "Sound off" : "Sound on";
    soundBtn.querySelector("svg").innerHTML = on ? SPEAKER_ON : SPEAKER_OFF;
    // Start the current format from the top, so the voice and music line up with the scenes.
    if (on) { index = 0; if (paused) setPaused(false); else render(); }
  }
  if (soundBtn) {
    soundBtn.querySelector("svg").innerHTML = SPEAKER_OFF;
    soundBtn.addEventListener("click", () => setSound(!audio.on));
  }

  new IntersectionObserver(([e]) => {
    const was = visible;
    visible = e.isIntersecting && !document.hidden;
    if (visible !== was) render();
  }).observe(screen);
  document.addEventListener("visibilitychange", () => { visible = !document.hidden; render(); });

  if (reduce) setPaused(true); else render();
})();
