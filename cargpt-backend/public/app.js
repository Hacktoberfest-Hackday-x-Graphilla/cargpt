const API_URL = "/api/chat";
const STORE_KEY = "cargpt.v1";
const MAX_FILES = 10;
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_TOTAL_SIZE = 30 * 1024 * 1024;

const CarGPTClient = {
  async reply(history, attachments = []) {
    const body = {
      messages: history.map(({ role, content }) => ({ role, content }))
    };

    if (attachments.length) {
      body.attachments = attachments.map(file => ({
        name: file.name,
        type: file.type,
        size: file.size,
        data: file.data
      }));
    }

    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${res.status}`);
    }

    const data = await res.json();

    if (typeof data.reply !== "string") {
      throw new Error("bad_response");
    }

    return data.reply;
  }
};

const state = {
  chats: [],
  activeId: null,
  attachments: []
};

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

  if (!state.chats.some(c => c.id === state.activeId)) {
    state.activeId = null;
  }
}

function save() {
  try {
    localStorage.setItem(
      STORE_KEY,
      JSON.stringify({
        chats: state.chats.map(c => ({
          id: c.id,
          title: c.title,
          messages: c.messages
        })),
        activeId: state.activeId
      })
    );
  } catch (_) {}
}

const activeChat = () =>
  state.chats.find(c => c.id === state.activeId) || null;

const isEmptyChat = c => !c.messages.length;

const $ = id => document.getElementById(id);

const els = {
  sidebar: $("sidebar"),
  scrim: $("scrim"),
  menuBtn: $("menuBtn"),
  history: $("history"),
  newChat: $("newChat"),
  topTitle: $("topTitle"),
  scroll: $("scroll"),
  stage: $("stage"),
  form: $("form"),
  input: $("input"),
  send: $("send"),
  fileInput: $("fileInput"),
  attachButton: $("attachButton"),
  attachmentTray: $("attachmentTray"),
  attachments: $("attachments"),
  clearAttachments: $("clearAttachments"),
  dropOverlay: $("dropOverlay"),
  toastContainer: $("toastContainer"),
  lightbox: $("lightbox"),
  lightboxImage: $("lightboxImage"),
  lightboxClose: $("lightboxClose")
};

function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);

  Object.entries(props).forEach(([k, v]) => {
    if (k === "class") {
      node.className = v;
    } else if (k === "text") {
      node.textContent = v;
    } else {
      node.setAttribute(k, v);
    }
  });

  children.forEach(c => node.append(c));

  return node;
}

function inline(text, parent) {
  text.split(/(\*\*[^*]+\*\*)/g).forEach(part => {
    if (!part) return;

    if (part.startsWith("**") && part.endsWith("**")) {
      parent.append(
        el("strong", {
          text: part.slice(2, -2)
        })
      );
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

      lines.forEach(l => {
        ul.append(
          inline(
            l.slice(2),
            el("li")
          )
        );
      });

      frag.append(ul);
      return;
    }

    if (lines.length && lines.every(l => l.startsWith("> "))) {
      frag.append(
        inline(
          lines.map(l => l.slice(2)).join(" "),
          el("p", { class: "note" })
        )
      );

      return;
    }

    const split = lines.findIndex(l => l.startsWith("- "));

    if (split > 0) {
      frag.append(
        inline(
          lines.slice(0, split).join(" "),
          el("p")
        )
      );

      const ul = el("ul");

      lines.slice(split).forEach(l => {
        ul.append(
          inline(
            l.replace(/^- /, ""),
            el("li")
          )
        );
      });

      frag.append(ul);
      return;
    }

    frag.append(
      inline(
        lines.join(" "),
        el("p")
      )
    );
  });

  return frag;
}

const PROMPTS = [
  [
    "What does a flashing check engine light mean?",
    "Warning lights and urgency"
  ],
  [
    "How often should I service my car?",
    "Oil, filters, fluids and plugs"
  ],
  [
    "How do I look after an EV battery?",
    "Charging habits and winter range"
  ],
  [
    "What should I check on a used car?",
    "Inspection checklist before buying"
  ]
];

function renderHero() {
  const hero = el("section", { class: "hero" }, [
    el("p", {
      class: "eyebrow",
      text: "CARGPT / AUTOMOTIVE ASSISTANT"
    }),

    el("h1", {
      text: "Ask anything about your car."
    }),

    el("p", {
      text: "Diagnostics, maintenance, tyres, brakes, EVs and buying advice. Clear answers, no guesswork."
    })
  ]);

  const grid = el("div", {
    class: "prompts"
  });

  PROMPTS.forEach(([title, sub], i) => {
    const b = el(
      "button",
      {
        class: "prompt",
        type: "button"
      },
      [
        el("span", {
          class: "prompt-num",
          text: String(i + 1).padStart(2, "0")
        }),

        el("span", {}, [
          el("span", {
            class: "prompt-title",
            text: title
          }),

          el("span", {
            class: "prompt-sub",
            text: sub
          })
        ])
      ]
    );

    b.addEventListener("click", () => submit(title));

    grid.append(b);
  });

  hero.append(grid);

  return hero;
}

function getFileIcon(file) {
  const type = file.type || "";

  if (type.startsWith("image/")) return "▧";
  if (type.includes("pdf")) return "PDF";
  if (type.includes("json")) return "{}";
  if (type.includes("csv")) return "CSV";
  if (type.includes("word")) return "DOC";
  if (type.includes("excel") || type.includes("sheet")) return "XLS";
  if (type.startsWith("text/")) return "TXT";

  return "FILE";
}

function formatFileSize(size) {
  if (size < 1024) {
    return `${size} B`;
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }

  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function showToast(message, error = false) {
  if (!els.toastContainer) return;

  const toast = el("div", {
    class: `toast${error ? " error" : ""}`,
    text: message
  });

  els.toastContainer.append(toast);

  setTimeout(() => {
    toast.remove();
  }, 2800);
}

function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;

    reader.readAsDataURL(file);
  });
}

async function processFiles(files) {
  const incoming = [...files];

  if (!incoming.length) return;

  if (state.attachments.length + incoming.length > MAX_FILES) {
    showToast(`You can attach up to ${MAX_FILES} files.`, true);
    return;
  }

  let totalSize = state.attachments.reduce(
    (sum, item) => sum + item.file.size,
    0
  );

  for (const file of incoming) {
    if (file.size > MAX_FILE_SIZE) {
      showToast(`${file.name} is larger than 10 MB.`, true);
      continue;
    }

    if (totalSize + file.size > MAX_TOTAL_SIZE) {
      showToast("Total attachment size cannot exceed 30 MB.", true);
      continue;
    }

    const duplicate = state.attachments.some(
      item =>
        item.file.name === file.name &&
        item.file.size === file.size &&
        item.file.lastModified === file.lastModified
    );

    if (duplicate) {
      showToast(`${file.name} is already attached.`, true);
      continue;
    }

    try {
      const data = await fileToDataURL(file);

      state.attachments.push({
        id: uid(),
        file,
        data,
        url: URL.createObjectURL(file)
      });

      totalSize += file.size;
    } catch (_) {
      showToast(`Could not read ${file.name}.`, true);
    }
  }

  renderAttachments();
  updateSend();
}

function removeAttachment(id) {
  const index = state.attachments.findIndex(
    item => item.id === id
  );

  if (index === -1) return;

  URL.revokeObjectURL(
    state.attachments[index].url
  );

  state.attachments.splice(index, 1);

  renderAttachments();
  updateSend();
}

function clearAttachments() {
  state.attachments.forEach(item => {
    URL.revokeObjectURL(item.url);
  });

  state.attachments = [];

  renderAttachments();
  updateSend();
}

function renderAttachments() {
  if (!els.attachmentTray || !els.attachments) return;

  els.attachments.replaceChildren();

  if (!state.attachments.length) {
    els.attachmentTray.classList.add("hidden");
    return;
  }

  els.attachmentTray.classList.remove("hidden");

  state.attachments.forEach(item => {
    const file = item.file;

    const card = el("div", {
      class: "attachment"
    });

    const remove = el("button", {
      class: "remove-attachment",
      type: "button",
      text: "×",
      "aria-label": `Remove ${file.name}`
    });

    remove.addEventListener(
      "click",
      () => removeAttachment(item.id)
    );

    if (file.type.startsWith("image/")) {
      const image = el("img", {
        class: "attachment-image",
        src: item.url,
        alt: file.name
      });

      image.addEventListener(
        "click",
        () => openLightbox(item.url)
      );

      card.append(image);
    } else {
      const preview = el(
        "div",
        {
          class: "file-preview"
        },
        [
          el("div", {
            class: "file-icon",
            text: getFileIcon(file)
          }),

          el("div", {
            class: "file-name",
            text: file.name
          }),

          el("div", {
            class: "file-size",
            text: formatFileSize(file.size)
          })
        ]
      );

      card.append(preview);
    }

    card.append(remove);

    els.attachments.append(card);
  });
}

function openLightbox(url) {
  if (!els.lightbox || !els.lightboxImage) return;

  els.lightboxImage.src = url;
  els.lightbox.classList.remove("hidden");
}

function closeLightbox() {
  if (!els.lightbox || !els.lightboxImage) return;

  els.lightbox.classList.add("hidden");
  els.lightboxImage.src = "";
}

function messageNode(m) {
  const body = el("div", {
    class: "msg-body"
  });

  if (m.role === "user") {
    body.textContent = m.content;
  } else {
    body.append(renderRich(m.content));
  }

  const message = el(
    "article",
    {
      class: "msg " + m.role
    },
    [
      el("div", {
        class: "msg-role",
        text: m.role === "user" ? "You" : "CarGPT"
      }),

      body
    ]
  );

  if (Array.isArray(m.attachments) && m.attachments.length) {
    const files = el("div", {
      class: "message-attachments"
    });

    m.attachments.forEach(file => {
      const card = el("div", {
        class: "message-file"
      });

      if (
        file.type &&
        file.type.startsWith("image/") &&
        file.data
      ) {
        const image = el("img", {
          src: file.data,
          alt: file.name
        });

        image.addEventListener(
          "click",
          () => openLightbox(file.data)
        );

        card.append(image);
      } else {
        card.append(
          el("span", {
            text: getFileIcon(file)
          })
        );
      }

      card.append(
        el(
          "div",
          {
            class: "message-file-info"
          },
          [
            el("div", {
              class: "message-file-name",
              text: file.name
            }),

            el("div", {
              class: "message-file-size",
              text: formatFileSize(file.size)
            })
          ]
        )
      );

      files.append(card);
    });

    body.append(files);
  }

  return message;
}

function typingNode() {
  const dots = el(
    "div",
    {
      class: "typing",
      role: "status",
      "aria-label": "CarGPT is typing"
    },
    [
      el("span"),
      el("span"),
      el("span")
    ]
  );

  return el(
    "article",
    {
      class: "msg assistant"
    },
    [
      el("div", {
        class: "msg-role",
        text: "CarGPT"
      }),

      el(
        "div",
        {
          class: "msg-body"
        },
        [dots]
      )
    ]
  );
}

function renderStage() {
  const chat = activeChat();

  els.stage.replaceChildren();

  if (!chat || (isEmptyChat(chat) && !chat.pending)) {
    els.stage.append(renderHero());
  } else {
    const thread = el("div", {
      class: "thread",
      "aria-live": "polite"
    });

    chat.messages.forEach(m => {
      thread.append(messageNode(m));
    });

    if (chat.pending) {
      thread.append(typingNode());
    }

    els.stage.append(thread);
  }

  els.topTitle.textContent =
    chat && chat.title
      ? chat.title
      : "New conversation";

  requestAnimationFrame(() => {
    els.scroll.scrollTop = els.scroll.scrollHeight;
  });
}

function renderHistory() {
  els.history.replaceChildren();

  const chats = state.chats.filter(
    c => !isEmptyChat(c)
  );

  if (!chats.length) {
    els.history.append(
      el("li", {
        class: "history-empty",
        text: "No conversations yet."
      })
    );

    return;
  }

  [...chats].reverse().forEach(c => {
    const open = el("button", {
      class: "history-item",
      type: "button",
      text: c.title
    });

    if (c.id === state.activeId) {
      open.setAttribute(
        "aria-current",
        "true"
      );
    }

    open.addEventListener("click", () => {
      state.activeId = c.id;
      save();
      render();
      closeMenu();
    });

    const del = el("button", {
      class: "history-delete",
      type: "button",
      "aria-label": "Delete conversation",
      text: "×"
    });

    del.addEventListener(
      "click",
      event => {
        event.stopPropagation();
        removeChat(c.id);
      }
    );

    els.history.append(
      el("li", {}, [
        open,
        del
      ])
    );
  });
}

function render() {
  renderHistory();
  renderStage();
  renderAttachments();
}

function findOrCreateEmptyChat() {
  let chat = state.chats.find(isEmptyChat);

  if (!chat) {
    chat = {
      id: uid(),
      title: "",
      messages: [],
      pending: false
    };

    state.chats.push(chat);
  }

  return chat;
}

function newChat() {
  const chat = findOrCreateEmptyChat();

  state.activeId = chat.id;

  clearAttachments();

  save();
  render();
  closeMenu();

  els.input.focus();
}

function removeChat(id) {
  state.chats = state.chats.filter(
    c => c.id !== id
  );

  if (state.activeId === id) {
    state.activeId = null;
  }

  save();
  render();
  updateSend();
}

async function submit(text) {
  text = text.trim().slice(0, 2000);

  if (!text && !state.attachments.length) {
    return;
  }

  let chat = activeChat();

  if (!chat) {
    chat = findOrCreateEmptyChat();
    state.activeId = chat.id;
  }

  if (chat.pending) return;

  if (!chat.title) {
    const title =
      text ||
      state.attachments[0]?.file.name ||
      "File analysis";

    chat.title =
      title.length > 48
        ? title.slice(0, 47) + "…"
        : title;
  }

  const attachments = state.attachments.map(item => ({
    name: item.file.name,
    type: item.file.type,
    size: item.file.size,
    data: item.data
  }));

  chat.messages.push({
    role: "user",
    content:
      text ||
      "Please analyze the attached file.",
    attachments
  });

  chat.pending = true;

  clearAttachments();

  save();
  render();
  updateSend();

  let answer;

  try {
    answer = await CarGPTClient.reply(
      chat.messages,
      attachments
    );
  } catch (error) {
    answer =
      "Something went wrong reaching the assistant. Please try again.";
  }

  if (
    state.chats.some(
      c => c.id === chat.id
    )
  ) {
    chat.messages.push({
      role: "assistant",
      content: answer
    });

    chat.pending = false;

    save();
  }

  render();
  updateSend();

  els.input.focus();
}

function updateSend() {
  const chat = activeChat();

  const hasText =
    Boolean(els.input.value.trim());

  const hasFiles =
    state.attachments.length > 0;

  els.send.disabled =
    Boolean(chat && chat.pending) ||
    (!hasText && !hasFiles);
}

function autosize() {
  els.input.style.height = "auto";

  els.input.style.height =
    Math.min(
      els.input.scrollHeight,
      160
    ) + "px";
}

function openMenu() {
  els.sidebar.classList.add("open");
  els.scrim.classList.add("open");
}

function closeMenu() {
  els.sidebar.classList.remove("open");
  els.scrim.classList.remove("open");
}

els.input.addEventListener(
  "input",
  () => {
    autosize();
    updateSend();
  }
);

els.input.addEventListener(
  "keydown",
  e => {
    if (
      e.key === "Enter" &&
      !e.shiftKey &&
      !e.isComposing
    ) {
      e.preventDefault();
      els.form.requestSubmit();
    }
  }
);

els.form.addEventListener(
  "submit",
  e => {
    e.preventDefault();

    const value = els.input.value;

    if (
      !value.trim() &&
      !state.attachments.length
    ) {
      return;
    }

    els.input.value = "";

    autosize();
    updateSend();

    submit(value);
  }
);

els.newChat.addEventListener(
  "click",
  newChat
);

els.menuBtn.addEventListener(
  "click",
  openMenu
);

els.scrim.addEventListener(
  "click",
  closeMenu
);

if (els.attachButton && els.fileInput) {
  els.attachButton.addEventListener(
    "click",
    () => els.fileInput.click()
  );

  els.fileInput.addEventListener(
    "change",
    e => {
      processFiles(e.target.files);
      e.target.value = "";
    }
  );
}

if (els.clearAttachments) {
  els.clearAttachments.addEventListener(
    "click",
    clearAttachments
  );
}

document.addEventListener(
  "paste",
  e => {
    const items = [
      ...(e.clipboardData?.items || [])
    ];

    const images = items
      .filter(item =>
        item.type.startsWith("image/")
      )
      .map(item => item.getAsFile())
      .filter(Boolean);

    if (images.length) {
      processFiles(images);
    }
  }
);

let dragCounter = 0;

document.addEventListener(
  "dragenter",
  e => {
    e.preventDefault();

    dragCounter++;

    if (
      [...(e.dataTransfer?.items || [])].some(
        item => item.kind === "file"
      )
    ) {
      if (els.dropOverlay) {
        els.dropOverlay.classList.add("active");
      }
    }
  }
);

document.addEventListener(
  "dragover",
  e => {
    e.preventDefault();
  }
);

document.addEventListener(
  "dragleave",
  e => {
    e.preventDefault();

    dragCounter--;

    if (dragCounter <= 0) {
      dragCounter = 0;

      if (els.dropOverlay) {
        els.dropOverlay.classList.remove(
          "active"
        );
      }
    }
  }
);

document.addEventListener(
  "drop",
  e => {
    e.preventDefault();

    dragCounter = 0;

    if (els.dropOverlay) {
      els.dropOverlay.classList.remove(
        "active"
      );
    }

    if (e.dataTransfer.files.length) {
      processFiles(
        e.dataTransfer.files
      );
    }
  }
);

if (els.lightbox) {
  els.lightbox.addEventListener(
    "click",
    e => {
      if (
        e.target === els.lightbox ||
        e.target === els.lightboxClose
      ) {
        closeLightbox();
      }
    }
  );
}

document.addEventListener(
  "keydown",
  e => {
    if (
      (e.ctrlKey || e.metaKey) &&
      e.shiftKey &&
      e.key.toLowerCase() === "u"
    ) {
      e.preventDefault();

      if (els.fileInput) {
        els.fileInput.click();
      }

      return;
    }

    if (
      (e.ctrlKey || e.metaKey) &&
      e.key.toLowerCase() === "k"
    ) {
      e.preventDefault();
      newChat();
      return;
    }

    if (e.key === "Escape") {
      closeLightbox();

      if (
        els.sidebar.classList.contains("open")
      ) {
        closeMenu();
      } else if (
        document.activeElement === els.input
      ) {
        els.input.blur();
      }
    }
  }
);

load();
render();
updateSend();

els.input.focus();
