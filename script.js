
(() => {
  "use strict";

  const KNOWLEDGE = [
    {
      match: [/\bwarning\b/i, /\bdash\b/i, /\blights?\b/i, /check engine/i, /\bmil\b/i],
      answer:
`Dashboard lights are grouped by colour, which tells you how urgent they are.

- **Red** (oil pressure, battery, brake, coolant temperature): stop safely as soon as you can and switch the engine off.
- **Amber** (check engine, ABS, tyre pressure, traction control): the car is usable, but book a diagnosis soon.
- **Green / blue**: informational only (lights on, cruise control active).

A **flashing** check engine light means active misfire and can damage the catalytic converter. Reduce load and get it checked promptly.

> Tell me the exact symbol, make, model and year and I can narrow down likely causes.`
    },
    {
      match: [/\btyres?\b/i, /\btires?\b/i, /\bpressure\b/i, /\bpsi\b/i, /\bbar\b/i],
      answer:
`Use the pressure printed on the driver's door jamb or in the owner's manual, not the number moulded on the tyre sidewall.

- Check when tyres are **cold** (parked for 3+ hours or driven under 2 km).
- Check monthly and before long trips; add a few PSI of margin only if the manual specifies a loaded figure.
- Inspect tread depth: 1.6 mm is the legal minimum in many regions, but performance in rain drops well before that. Replace around 3 mm.
- Rotate every 8,000–10,000 km unless your manual says otherwise.

> A sudden drop of more than 4–5 PSI in a week usually points to a slow puncture or a leaking valve.`
    },
    {
      match: [/\bev\b/i, /\belectric/i, /\bcharg/i, /\bbattery\b/i, /\brange\b/i, /\bkwh\b/i],
      answer:
`For daily EV use, battery habits matter more than any single setting.

- Keep the state of charge between roughly **20% and 80%** for daily driving; charge to 100% only before long trips.
- Prefer AC charging at home. Frequent DC fast charging is fine, but it generates more heat over time.
- Precondition the battery in cold weather. Winter range loss of 20–30% is normal.
- Avoid leaving the car for long periods at very high or very low charge.

> Range estimates depend heavily on speed. At 120 km/h expect noticeably less than the rated figure.`
    },
    {
      match: [/\boil\b/i, /\bservice\b/i, /\bmaintenance\b/i, /\binterval\b/i, /\bschedule\b/i],
      answer:
`Maintenance intervals depend on engine type and driving pattern, so the manual is the authority. As a general guide:

- **Engine oil and filter**: 10,000–15,000 km or 12 months for most modern engines on synthetic oil; shorter for heavy city, towing or dusty use.
- **Air filter**: 15,000–30,000 km.
- **Brake fluid**: every 2 years, regardless of mileage.
- **Coolant**: 4–5 years or per manual.
- **Spark plugs**: 40,000–100,000 km depending on plug type.

> Tell me the make, model, year and mileage and I can build a service checklist.`
    },
    {
      match: [/\bbrakes?\b/i, /\bsqueal/i, /\bgrind/i, /\bpads?\b/i, /\brotors?\b/i, /\bdiscs?\b/i],
      answer:
`Brake noise tells you roughly where to look.

- **High-pitched squeal** at low speed: often a wear indicator or glazed pads.
- **Grinding**: pads are likely worn through to the backing plate. Stop driving it and have it inspected, as rotors will be damaged quickly.
- **Pulsing pedal**: warped or unevenly worn rotors.
- **Soft pedal**: air or moisture in the fluid, or a leak. Treat as urgent.

> Brakes are safety-critical. Have any of these confirmed by a qualified technician.`
    },
    {
      match: [/\bbuy\b/i, /\bbuying\b/i, /\bused\b/i, /\bpurchase\b/i, /inspection/i, /\bworth\b/i],
      answer:
`A short checklist for a used car:

- **History**: service records, number of owners, accident and mileage verification (VIN check).
- **Cold start**: listen for rattles, look for smoke from the exhaust, and check that the engine idles smoothly.
- **Body**: uneven panel gaps, paint mismatch and overspray suggest past repairs.
- **Drive**: check for pulling under braking, clunks over bumps and gearbox hesitation.
- **Inspection**: pay for an independent inspection; it costs little compared with a major repair.

> Share the model and asking price and I can list common faults for that generation.`
    },
    {
      match: [/\bfuel\b/i, /\bmpg\b/i, /\beconomy\b/i, /\bconsumption\b/i, /efficien/i, /\bmileage\b/i],
      answer:
`Fuel economy is mostly driving behaviour and maintenance.

- Smooth acceleration and early lifting off the throttle make the biggest difference.
- Highway speed matters: drag grows with the square of speed, so 100 km/h is much cheaper than 130 km/h.
- Correct tyre pressure and removing roof boxes or racks when unused each recover a few percent.
- Short trips with a cold engine are the least efficient pattern.`
    }
  ];

  const FALLBACK =
`I can help with maintenance, diagnostics, tyres, brakes, EV charging, fuel economy and buying advice.

To give a useful answer, include the **make, model, year** and a short description of what you are seeing or hearing.

> Try: "My 2018 Corolla shakes at 100 km/h. What should I check first?"`;

  function bestAnswer(text) {
    let best = null;
    let bestScore = 0;
    for (const entry of KNOWLEDGE) {
      let score = 0;
      for (const re of entry.match) if (re.test(text)) score++;
      if (score > bestScore) { bestScore = score; best = entry; }
    }
    return best ? best.answer : FALLBACK;
  }

  const CarGPTClient = {
    reply(history) {
      const last = history[history.length - 1].content;
      const text = bestAnswer(last);
      const delay = 500 + Math.random() * 400;
      return new Promise(resolve => setTimeout(() => resolve(text), delay));
    }
  };

  const STORE_KEY = "cargpt.v1";
  const state = { chats: [], activeId: null };

  const uid = () => Math.random().toString(36).slice(2, 10);

  function load() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORE_KEY) || "null");
      if (raw && Array.isArray(raw.chats)) {
        state.chats = raw.chats.map(c => ({
          id: c.id,
          title: c.title || "",
          messages: Array.isArray(c.messages) ? c.messages : [],
          pending: false
        }));
        state.activeId = raw.activeId;
      }
    } catch (_) {}
    if (!state.chats.some(c => c.id === state.activeId)) state.activeId = null;
  }

  function save() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({
        chats: state.chats.map(c => ({ id: c.id, title: c.title, messages: c.messages })),
        activeId: state.activeId
      }));
    } catch (_) {}
  }

  const activeChat = () => state.chats.find(c => c.id === state.activeId) || null;
  const isEmptyChat = c => !c.messages.length;

  const $ = id => document.getElementById(id);
  const els = {
    sidebar: $("sidebar"), scrim: $("scrim"), menuBtn: $("menuBtn"),
    history: $("history"), newChat: $("newChat"), topTitle: $("topTitle"),
    scroll: $("scroll"), stage: $("stage"),
    form: $("form"), input: $("input"), send: $("send")
  };

  function el(tag, props = {}, children = []) {
    const node = document.createElement(tag);
    Object.entries(props).forEach(([k, v]) => {
      if (k === "class") node.className = v;
      else if (k === "text") node.textContent = v;
      else node.setAttribute(k, v);
    });
    children.forEach(c => node.append(c));
    return node;
  }

  function inline(text, parent) {
    text.split(/(\*\*[^*]+\*\*)/g).forEach(part => {
      if (!part) return;
      if (part.startsWith("**") && part.endsWith("**")) {
        parent.append(el("strong", { text: part.slice(2, -2) }));
      } else {
        parent.append(document.createTextNode(part));
      }
    });
    return parent;
  }

  function renderRich(text) {
    const frag = document.createDocumentFragment();
    text.trim().split(/\n{2,}/).forEach(block => {
      const lines = block.split("\n");
      if (lines.length && lines.every(l => l.startsWith("- "))) {
        const ul = el("ul");
        lines.forEach(l => ul.append(inline(l.slice(2), el("li"))));
        frag.append(ul);
      } else if (lines.length && lines.every(l => l.startsWith("> "))) {
        frag.append(inline(lines.map(l => l.slice(2)).join(" "), el("p", { class: "note" })));
      } else {
        const split = lines.findIndex(l => l.startsWith("- "));
        if (split > 0) {
          frag.append(inline(lines.slice(0, split).join(" "), el("p")));
          const ul = el("ul");
          lines.slice(split).forEach(l => ul.append(inline(l.replace(/^- /, ""), el("li"))));
          frag.append(ul);
        } else {
          frag.append(inline(lines.join(" "), el("p")));
        }
      }
    });
    return frag;
  }

  const PROMPTS = [
    ["What does a flashing check engine light mean?", "Warning lights and urgency"],
    ["How often should I service my car?", "Oil, filters, fluids and plugs"],
    ["How do I look after an EV battery?", "Charging habits and winter range"],
    ["What should I check on a used car?", "Inspection checklist before buying"]
  ];

  function renderHero() {
    const hero = el("section", { class: "hero" }, [
      el("p", { class: "eyebrow", text: "CARGPT / AUTOMOTIVE ASSISTANT" }),
      el("h1", { text: "Ask anything about your car." }),
      el("p", { text: "Diagnostics, maintenance, tyres, brakes, EVs and buying advice. Clear answers, no guesswork." })
    ]);
    const grid = el("div", { class: "prompts" });
    PROMPTS.forEach(([title, sub], i) => {
      const b = el("button", { class: "prompt", type: "button" }, [
        el("span", { class: "prompt-num", text: String(i + 1).padStart(2, "0") }),
        el("span", {}, [el("span", { class: "prompt-title", text: title }), el("span", { class: "prompt-sub", text: sub })])
      ]);
      b.addEventListener("click", () => submit(title));
      grid.append(b);
    });
    hero.append(grid);
    return hero;
  }

  function messageNode(m) {
    const body = el("div", { class: "msg-body" });
    if (m.role === "user") body.textContent = m.content;
    else body.append(renderRich(m.content));
    return el("article", { class: "msg " + m.role }, [
      el("div", { class: "msg-role", text: m.role === "user" ? "You" : "CarGPT" }),
      body
    ]);
  }

  function typingNode() {
    const dots = el("div", { class: "typing", role: "status", "aria-label": "CarGPT is typing" },
      [el("span"), el("span"), el("span")]);
    return el("article", { class: "msg assistant" }, [
      el("div", { class: "msg-role", text: "CarGPT" }),
      el("div", { class: "msg-body" }, [dots])
    ]);
  }

  function renderStage() {
    const chat = activeChat();
    els.stage.replaceChildren();
    if (!chat || (isEmptyChat(chat) && !chat.pending)) {
      els.stage.append(renderHero());
    } else {
      const thread = el("div", { class: "thread", "aria-live": "polite" });
      chat.messages.forEach(m => thread.append(messageNode(m)));
      if (chat.pending) thread.append(typingNode());
      els.stage.append(thread);
    }
    els.topTitle.textContent = chat && chat.title ? chat.title : "New conversation";
    els.scroll.scrollTop = els.scroll.scrollHeight;
  }

  function renderHistory() {
    els.history.replaceChildren();
    const chats = state.chats.filter(c => !isEmptyChat(c));
    if (!chats.length) {
      els.history.append(el("li", { class: "history-empty", text: "No conversations yet." }));
      return;
    }
    [...chats].reverse().forEach(c => {
      const open = el("button", { class: "history-item", type: "button", text: c.title });
      if (c.id === state.activeId) open.setAttribute("aria-current", "true");
      open.addEventListener("click", () => { state.activeId = c.id; save(); render(); closeMenu(); });
      const del = el("button", { class: "history-delete", type: "button", "aria-label": "Delete conversation", text: "×" });
      del.addEventListener("click", () => removeChat(c.id));
      els.history.append(el("li", {}, [open, del]));
    });
  }

  function render() { renderHistory(); renderStage(); }

  function findOrCreateEmptyChat() {
    let chat = state.chats.find(isEmptyChat);
    if (!chat) {
      chat = { id: uid(), title: "", messages: [], pending: false };
      state.chats.push(chat);
    }
    return chat;
  }

  function newChat() {
    const chat = findOrCreateEmptyChat();
    state.activeId = chat.id;
    save(); render(); closeMenu();
    els.input.focus();
  }

  function removeChat(id) {
    state.chats = state.chats.filter(c => c.id !== id);
    if (state.activeId === id) state.activeId = null;
    save(); render(); updateSend();
  }

  async function submit(text) {
    text = text.trim().slice(0, 2000);
    if (!text) return;

    let chat = activeChat();
    if (!chat) {
      chat = findOrCreateEmptyChat();
      state.activeId = chat.id;
    }
    if (chat.pending) return;

    if (!chat.title) {
      const title = text.replace(/\s+/g, " ").trim();
      chat.title = title.length > 48 ? title.slice(0, 47) + "…" : title;
    }

    chat.messages.push({ role: "user", content: text });
    chat.pending = true;
    save(); render(); updateSend();

    let answer;
    try {
      answer = await CarGPTClient.reply(chat.messages);
    } catch (_) {
      answer = "Something went wrong reaching the assistant. Please try again.";
    }

    if (state.chats.some(c => c.id === chat.id)) {
      chat.messages.push({ role: "assistant", content: answer });
      chat.pending = false;
      save();
    }

    render(); updateSend();
    els.input.focus();
  }

  function updateSend() {
    const chat = activeChat();
    els.send.disabled = Boolean(chat && chat.pending) || !els.input.value.trim();
  }

  function autosize() {
    els.input.style.height = "auto";
    els.input.style.height = Math.min(els.input.scrollHeight, 160) + "px";
  }

  els.input.addEventListener("input", () => { autosize(); updateSend(); });

  els.input.addEventListener("keydown", e => {
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      els.form.requestSubmit();
    }
  });

  els.form.addEventListener("submit", e => {
    e.preventDefault();
    const v = els.input.value;
    if (!v.trim()) return;
    els.input.value = "";
    autosize(); updateSend();
    submit(v);
  });

  els.newChat.addEventListener("click", newChat);

  document.addEventListener("keydown", e => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      newChat();
      return;
    }
    if (e.key === "Escape") {
      if (els.sidebar.classList.contains("open")) closeMenu();
      else if (document.activeElement === els.input) els.input.blur();
    }
  });

  function openMenu() { els.sidebar.classList.add("open"); els.scrim.classList.add("open"); }
  function closeMenu() { els.sidebar.classList.remove("open"); els.scrim.classList.remove("open"); }

  els.menuBtn.addEventListener("click", openMenu);
  els.scrim.addEventListener("click", closeMenu);

  load();
  render();
  updateSend();
  els.input.focus();
})();
