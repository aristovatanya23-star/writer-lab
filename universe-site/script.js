/* ====== Утилиты ====== */
const $ = (s) => document.querySelector(s);
const load = (k) => JSON.parse(localStorage.getItem(k) || "[]");
const save = (k, v) => localStorage.setItem(k, JSON.stringify(v));

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function toArr(s) { return (s || "").split(",").map(x => x.trim()).filter(Boolean); }
function me() { return localStorage.getItem("currentUser"); }
function avatarOf(name) {
  const users = JSON.parse(localStorage.getItem("users") || "{}");
  return (users[name] && users[name].avatar) || "";
}

/* ====== ТЕМА ====== */
(function () {
  const saved = localStorage.getItem("theme") || "dark";
  if (saved === "light") document.body.classList.add("light");
  const btn = $("#theme-toggle");
  if (btn) {
    btn.textContent = saved === "light" ? "☀️ Светлая тема" : "🌙 Тёмная тема";
    btn.addEventListener("click", () => {
      document.body.classList.toggle("light");
      const isLight = document.body.classList.contains("light");
      localStorage.setItem("theme", isLight ? "light" : "dark");
      btn.textContent = isLight ? "☀️ Светлая тема" : "🌙 Тёмная тема";
    });
  }
})();

/* ====== БОКОВАЯ НАВИГАЦИЯ (мобилка) ====== */
(function () {
  const toggle = $("#menu-toggle");
  const sidebar = $("#sidebar");
  if (!toggle || !sidebar) return;
  toggle.addEventListener("click", () => sidebar.classList.toggle("open"));
  document.addEventListener("click", (e) => {
    if (window.innerWidth > 800) return;
    if (!sidebar.contains(e.target) && e.target !== toggle) {
      sidebar.classList.remove("open");
    }
  });
})();

/* ====== АВТОРИЗАЦИЯ ====== */
(function () {
  const current = me();
  const welcome = $("#welcome");
  if (welcome && current)
    welcome.textContent = `Привет, ${current}! Пиши. Строй мир. Управляй героями.`;

  const authLink = $("#auth-link");
  if (authLink && current) {
    const av = avatarOf(current);
    authLink.innerHTML = `${av ? `<img src="${av}" class="avatar-small" alt="">` : ""}Выйти`;
    authLink.href = "#";
    authLink.addEventListener("click", (e) => {
      e.preventDefault();
      localStorage.removeItem("currentUser");
      location.reload();
    });
  }

  const avatarInput = $("#reg-avatar");
  if (avatarInput) {
    avatarInput.addEventListener("change", () => {
      const f = avatarInput.files[0];
      if (!f) return;
      const reader = new FileReader();
      reader.onload = () => {
        $("#avatar-preview").src = reader.result;
        $("#avatar-preview-wrap").style.display = "block";
      };
      reader.readAsDataURL(f);
    });
  }

  const reg = $("#register-form");
  if (reg) reg.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = $("#reg-name").value.trim();
    const pass = $("#reg-pass").value.trim();
    const all = JSON.parse(localStorage.getItem("users") || "{}");
    if (all[name]) { $("#auth-status").textContent = "Такое имя занято."; return; }
    let avatar = "";
    const file = $("#reg-avatar").files[0];
    if (file) avatar = await compressImage(file, 128);
    all[name] = { pass, avatar };
    localStorage.setItem("users", JSON.stringify(all));
    localStorage.setItem("currentUser", name);
    $("#auth-status").textContent = `Аккаунт ${name} создан! Переход...`;
    setTimeout(() => location.href = "index.html", 700);
  });

  const login = $("#login-form");
  if (login) login.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = $("#login-name").value.trim();
    const pass = $("#login-pass").value.trim();
    const all = JSON.parse(localStorage.getItem("users") || "{}");
    const u = all[name];
    if (u && u.pass === pass) {
      localStorage.setItem("currentUser", name);
      location.href = "index.html";
    } else $("#auth-status").textContent = "Неверное имя или пароль.";
  });
})();

function compressImage(file, maxSize = 128) {
  return new Promise((resolve) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onload = () => { img.src = reader.result; };
    img.onload = () => {
      const scale = maxSize / Math.max(img.width, img.height);
      const w = img.width * scale, h = img.height * scale;
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      canvas.getContext("2d").drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", 0.8));
    };
    reader.readAsDataURL(file);
  });
}

/* ====== ИЗБРАННОЕ ====== */
function getFavs() { return JSON.parse(localStorage.getItem("favorites") || "[]"); }
function setFavs(a) { localStorage.setItem("favorites", JSON.stringify(a)); }
function isFav(id) { return getFavs().includes(id); }
function toggleFav(id) {
  let favs = getFavs();
  favs = favs.includes(id) ? favs.filter(x => x !== id) : [...favs, id];
  setFavs(favs);
}

/* ====== РЕДАКТОР ====== */
const editorForm = $("#editor-form");
if (editorForm) {
  editorForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const texts = load("texts");
    texts.unshift({
      id: Date.now(),
      title: $("#title").value.trim(),
      summary: $("#summary").value.trim(),
      text: $("#text").value.trim(),
      cover: $("#cover").value.trim(),
      genre: $("#genre").value,
      status: $("#status").value,
      warnings: toArr($("#warnings").value),
      tags: toArr($("#tags").value),
      fandom: $("#fandom").value.trim(),
      pairing: $("#pairing").value.trim(),
      authorNote: $("#authorNote").value.trim(),
      author: me() || "Аноним",
      date: new Date().toLocaleString("ru-RU"),
      published: false,
      likes: 0, recs: 0, comments: [],
    });
    save("texts", texts);
    editorForm.reset();
    renderTexts();
  });

  $("#search-text")?.addEventListener("input", renderTexts);

  $("#export-all")?.addEventListener("click", () => {
    const texts = load("texts");
    if (!texts.length) return alert("Нет текстов.");
    downloadBlob(texts.map(storyToTxt).join("\n\n"), "тексты.txt");
  });

  $("#clear-texts")?.addEventListener("click", () => {
    if (confirm("Удалить ВСЕ тексты?")) { localStorage.removeItem("texts"); renderTexts(); }
  });

  renderTexts();
}

function renderTexts() {
  const list = $("#texts-list");
  if (!list) return;
  const q = ($("#search-text")?.value || "").toLowerCase().trim();
  let texts = load("texts");
  if (q) texts = texts.filter(t =>
    t.title.toLowerCase().includes(q) || t.text.toLowerCase().includes(q));

  list.innerHTML = texts.length
    ? texts.map(t => `
      <div class="card">
        ${t.cover ? `<img class="card-cover" src="${escapeHtml(t.cover)}" alt="">` : ""}
        <div style="flex:1">
          <h3>${escapeHtml(t.title)} ${t.published ? "✅" : "📝"}</h3>
          <p class="muted">${escapeHtml(t.status || "")} · ${escapeHtml(t.genre || "")}</p>
          <p>${escapeHtml((t.summary || t.text).slice(0, 200))}…</p>
          <small>${t.date} · ${escapeHtml(t.author)}</small>
          <div class="toolbar">
            <button class="btn btn-ghost" onclick="togglePublish(${t.id})">
              ${t.published ? "🙈 Снять" : "🚀 Опубликовать"}</button>
            <button class="btn btn-ghost" onclick="dl('txt', ${t.id})">📄 .txt</button>
            <button class="btn btn-ghost" onclick="dl('md', ${t.id})">📝 .md</button>
            <button class="btn btn-ghost" onclick="dl('html', ${t.id})">🌐 .html</button>
            <button class="btn btn-ghost" onclick="dl('json', ${t.id})">💾 .json</button>
            <button class="btn btn-danger" onclick="deleteStory(${t.id})">🗑️ Удалить</button>
          </div>
        </div>
      </div>
    `).join("")
    : "<p>Пока нет текстов.</p>";
}

window.togglePublish = (id) => {
  const texts = load("texts");
  const t = texts.find(x => x.id === id);
  if (!t) return;
  if (!t.published && !me()) { alert("Войди, чтобы опубликовать."); return; }
  t.published = !t.published;
  if (t.published && !t.author) t.author = me() || "Аноним";
  save("texts", texts);
  renderTexts();
};
window.deleteStory = (id) => {
  if (!confirm("Удалить историю?")) return;
  save("texts", load("texts").filter(x => x.id !== id));
  renderTexts();
};

/* ====== СКАЧИВАНИЕ ====== */
function downloadBlob(content, filename, mime = "text/plain") {
  const blob = new Blob([content], { type: mime + ";charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function storyToTxt(t) {
  return `=== ${t.title} ===
Автор: ${t.author || "Аноним"}
Жанр: ${t.genre || "—"} · Статус: ${t.status || "—"}
${t.fandom ? "Фандом: " + t.fandom + "\n" : ""}${t.pairing ? "Пейринг: " + t.pairing + "\n" : ""}Дата: ${t.date}

${t.summary ? "Саммари:\n" + t.summary + "\n\n" : ""}--------------------------------

${t.text}

${t.authorNote ? "\n--------------------------------\nПримечание автора:\n" + t.authorNote : ""}
`;
}
function storyToMd(t) {
  return `# ${t.title}

**Автор:** ${t.author || "Аноним"}  
**Жанр:** ${t.genre || "—"}  
**Статус:** ${t.status || "—"}  
${t.fandom ? "**Фандом:** " + t.fandom + "  \n" : ""}${t.pairing ? "**Пейринг:** " + t.pairing + "  \n" : ""}**Дата:** ${t.date}

${t.summary ? "> " + t.summary.split("\n").join("\n> ") + "\n\n" : ""}---

${t.text}

${t.authorNote ? "---\n\n*Примечание автора:* " + t.authorNote : ""}
`;
}
function storyToHtml(t) {
  return `<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8">
<title>${escapeHtml(t.title)}</title>
<style>body{font-family:Georgia,serif;max-width:700px;margin:2rem auto;padding:0 1rem;line-height:1.7}h1{font-size:2rem}.meta{color:#666;margin-bottom:1.5rem}.summary{background:#f4f4f4;padding:1rem;border-radius:8px}hr{border:none;border-top:1px solid #ddd;margin:1.5rem 0}.note{font-style:italic;color:#555}</style>
</head><body>
<h1>${escapeHtml(t.title)}</h1>
<p class="meta">Автор: ${escapeHtml(t.author || "Аноним")} · ${t.date}<br>${escapeHtml(t.genre || "")} · ${escapeHtml(t.status || "")}${t.fandom ? " · " + escapeHtml(t.fandom) : ""}${t.pairing ? " · " + escapeHtml(t.pairing) : ""}</p>
${t.summary ? `<div class="summary">${escapeHtml(t.summary)}</div>` : ""}
<hr><div>${escapeHtml(t.text).replace(/\n/g, "<br>")}</div>
${t.authorNote ? `<hr><p class="note">Примечание автора: ${escapeHtml(t.authorNote)}</p>` : ""}
</body></html>`;
}
function storyToJson(t) { return JSON.stringify(t, null, 2); }

window.dl = (format, id) => {
  const t = load("texts").find(x => x.id === id);
  if (!t) return;
  const safeName = t.title.replace(/[\\/:*?"<>|]/g, "_");
  if (format === "txt") downloadBlob(storyToTxt(t), `${safeName}.txt`);
  if (format === "md") downloadBlob(storyToMd(t), `${safeName}.md`);
  if (format === "html") downloadBlob(storyToHtml(t), `${safeName}.html`, "text/html");
  if (format === "json") downloadBlob(storyToJson(t), `${safeName}.json`, "application/json");
};

window.dlAllMine = () => {
  const current = me();
  if (!current) return alert("Войди, чтобы скачать свои рукописи.");
  const mine = load("texts").filter(t => t.author === current);
  if (!mine.length) return alert("У тебя пока нет рукописей.");
  const combined = mine.map(storyToTxt).join("\n\n\n=====================\n\n\n");
  downloadBlob(combined, `мои-рукописи-${new Date().toISOString().slice(0,10)}.txt`);
};

/* ====== ВСЕЛЕННАЯ ====== */
const uForm = $("#universe-form");
if (uForm) {
  uForm.addEventListener("submit", (e) => {
    e.preventDefault();
    save("universe", {
      name: $("#world-name").value.trim(),
      desc: $("#world-desc").value.trim(),
      rules: $("#world-rules").value.trim(),
    });
    renderUniverse();
    alert("Вселенная сохранена!");
  });
  renderUniverse();
}
const lForm = $("#location-form");
if (lForm) {
  lForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const locs = load("locations");
    locs.push({
      id: Date.now(),
      name: $("#location-name").value.trim(),
      desc: $("#location-desc").value.trim(),
      img: $("#location-img").value.trim(),
    });
    save("locations", locs);
    lForm.reset(); renderLocations();
  });
  renderLocations();
}
function renderUniverse() {
  const view = $("#universe-view");
  if (!view) return;
  const u = JSON.parse(localStorage.getItem("universe") || "null");
  view.innerHTML = u
    ? `<h3>${escapeHtml(u.name)}</h3><p>${escapeHtml(u.desc).replace(/\n/g, "<br>")}</p><small>Правила: ${escapeHtml(u.rules)}</small>`
    : "<p>Опиши вселенную.</p>";
}
function renderLocations() {
  const list = $("#locations-list");
  if (!list) return;
  const locs = load("locations");
  list.innerHTML = locs.length
    ? locs.map(l => `
      <div class="card">
        ${l.img ? `<img class="card-cover" src="${escapeHtml(l.img)}" alt="">` : ""}
        <div><h3>${escapeHtml(l.name)}</h3><p>${escapeHtml(l.desc)}</p></div>
      </div>`).join("")
    : "<p>Локаций пока нет.</p>";
}

/* ====== ПЕРСОНАЖИ ====== */
const cForm = $("#character-form");
if (cForm) {
  cForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const chars = load("characters");
    chars.push({
      id: Date.now(),
      name: $("#char-name").value.trim(),
      role: $("#char-role").value.trim(),
      desc: $("#char-desc").value.trim(),
      img: $("#char-img").value.trim(),
    });
    save("characters", chars);
    cForm.reset(); renderCharacters();
  });
  renderCharacters();
}
function renderCharacters() {
  const list = $("#characters-list");
  if (!list) return;
  const chars = load("characters");
  list.innerHTML = chars.length
    ? chars.map(c => `
      <div class="card">
        ${c.img ? `<img class="card-cover" src="${escapeHtml(c.img)}" alt="">` : ""}
        <div><h3>${escapeHtml(c.name)} <small>— ${escapeHtml(c.role)}</small></h3>
        <p>${escapeHtml(c.desc)}</p></div>
      </div>`).join("")
    : "<p>Добавь персонажа.</p>";
}

/* ====== ПЛАНИРОВЩИК ====== */
const chForm = $("#chapter-form");
if (chForm) {
  chForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const chs = load("chapters");
    chs.push({
      title: $("#chapter-title").value.trim(),
      summary: $("#chapter-summary").value.trim(),
      status: "План",
    });
    save("chapters", chs);
    chForm.reset(); renderChapters();
  });
  renderChapters();
}
function renderChapters() {
  const body = $("#chapters-body");
  if (!body) return;
  const chs = load("chapters");
  body.innerHTML = chs.length
    ? chs.map((c, i) => `<tr><td>${i + 1}</td><td>${escapeHtml(c.title)}</td>
        <td>${escapeHtml(c.summary)}</td><td>${escapeHtml(c.status)}</td></tr>`).join("")
    : "<tr><td colspan='4'>Глав пока нет.</td></tr>";
}

/* ====== КАРТОЧКА ИСТОРИИ ====== */
function storyCard(t) {
  const author = t.author || "Аноним";
  const av = avatarOf(author);
  const short = (t.summary || t.text || "").slice(0, 280) +
    ((t.summary || t.text || "").length > 280 ? "…" : "");
  const fav = isFav(t.id);
  const badges = [
    t.genre ? `<span class="badge genre">${escapeHtml(t.genre)}</span>` : "",
    t.fandom ? `<span class="badge fandom">${escapeHtml(t.fandom)}</span>` : "",
    t.pairing ? `<span class="badge pairing">${escapeHtml(t.pairing)}</span>` : "",
    t.status ? `<span class="badge status">${escapeHtml(t.status)}</span>` : "",
  ].filter(Boolean).join(" ");
  const warnings = (t.warnings || []).map(w =>
    `<span class="badge warn">⚠️ ${escapeHtml(w)}</span>`).join(" ");
  const tags = (t.tags || []).map(x =>
    `<span class="badge tag">#${escapeHtml(x)}</span>`).join(" ");
  const approved = (t.comments || []).filter(c => c.approved).length;

  return `
    <div class="card story-card">
      ${t.cover ? `<img class="card-cover" src="${escapeHtml(t.cover)}" alt="">` : ""}
      <div style="flex:1">
        <h3><a href="story.html?id=${t.id}">${escapeHtml(t.title)}</a></h3>
        <div class="author-line">
          ${av ? `<img src="${av}" class="avatar-small" alt="">` : ""}
          <a href="profile.html?user=${encodeURIComponent(author)}" class="author-link">${escapeHtml(author)}</a>
          <small>• ${t.date}</small>
        </div>
        <p class="badges">${badges}</p>
        ${warnings ? `<p class="badges">${warnings}</p>` : ""}
        ${tags ? `<p class="badges">${tags}</p>` : ""}
        <p>${escapeHtml(short).replace(/\n/g, "<br>")}</p>
        <div class="toolbar">
          <a class="btn btn-ghost" href="story.html?id=${t.id}">📖 Читать</a>
          <button class="btn btn-ghost" onclick="likeStory(${t.id})">❤️ ${t.likes || 0}</button>
          <button class="btn btn-ghost" onclick="recStory(${t.id})">⭐ ${t.recs || 0}</button>
          <button class="btn btn-ghost" onclick="favStory(${t.id})">${fav ? "💔 Убрать" : "❤️ В избранное"}</button>
          <small class="muted">💬 ${approved}</small>
        </div>
      </div>
    </div>`;
}

/* ====== ЛАЙК / СОВЕТ / ИЗБРАННОЕ ====== */
window.likeStory = (id) => {
  const texts = load("texts");
  const t = texts.find(x => x.id === id);
  if (!t) return;
  t.likes = (t.likes || 0) + 1;
  save("texts", texts); refreshAll();
};
window.recStory = (id) => {
  const texts = load("texts");
  const t = texts.find(x => x.id === id);
  if (!t) return;
  t.recs = (t.recs || 0) + 1;
  save("texts", texts); refreshAll();
};
window.favStory = (id) => { toggleFav(id); refreshAll(); };
function refreshAll() {
  if ($("#library-list")) renderLibrary();
  if ($("#home-library")) renderHomeLibrary();
  if ($("#favorites-list")) renderFavorites();
  if ($("#texts-list")) renderTexts();
  if ($("#profile-stories")) renderProfilePage();
}

/* ====== БИБЛИОТЕКА ====== */
function getPublished() { return load("texts").filter(t => t.published); }

function renderLibrary() {
  const list = $("#library-list");
  if (!list) return;
  const q = ($("#lib-search")?.value || "").toLowerCase().trim();
  const genre = $("#lib-genre")?.value || "";
  const sort = $("#lib-sort")?.value || "new";
  const favOnly = $("#lib-fav-only")?.checked;

  let s = getPublished();
  if (q) s = s.filter(t =>
    t.title.toLowerCase().includes(q) ||
    (t.summary || "").toLowerCase().includes(q) ||
    t.text.toLowerCase().includes(q) ||
    (t.author || "").toLowerCase().includes(q) ||
    (t.tags || []).some(x => x.toLowerCase().includes(q)) ||
    (t.fandom || "").toLowerCase().includes(q));
  if (genre) s = s.filter(t => t.genre === genre);
  if (favOnly) s = s.filter(t => isFav(t.id));

  if (sort === "new") s.sort((a, b) => b.id - a.id);
  else if (sort === "old") s.sort((a, b) => a.id - b.id);
  else if (sort === "az") s.sort((a, b) => a.title.localeCompare(b.title));
  else if (sort === "likes") s.sort((a, b) => (b.likes || 0) - (a.likes || 0));
  else if (sort === "recs") s.sort((a, b) => (b.recs || 0) - (a.recs || 0));

  const cnt = $("#lib-count");
  if (cnt) cnt.textContent = `Найдено историй: ${s.length}`;

  list.innerHTML = s.length ? s.map(storyCard).join("")
    : "<p>Пока нет историй по фильтру.</p>";
}

if ($("#library-list")) {
  $("#lib-search").addEventListener("input", renderLibrary);
  $("#lib-genre").addEventListener("change", renderLibrary);
  $("#lib-sort").addEventListener("change", renderLibrary);
  $("#lib-fav-only").addEventListener("change", renderLibrary);
  renderLibrary();
}

/* ====== ГЛАВНАЯ ====== */
function renderHomeLibrary() {
  const list = $("#home-library");
  if (!list) return;
  const s = getPublished().sort((a, b) => b.id - a.id).slice(0, 5);
  list.innerHTML = s.length ? s.map(storyCard).join("")
    : "<p>Пока нет историй. <a href='editor.html'>Напиши первую!</a></p>";
}
if ($("#home-library")) renderHomeLibrary();

/* ====== ИЗБРАННОЕ СТРАНИЦА ====== */
function renderFavorites() {
  const list = $("#favorites-list");
  if (!list) return;
  const favs = getFavs();
  const s = getPublished().filter(t => favs.includes(t.id));
  list.innerHTML = s.length ? s.map(storyCard).join("")
    : "<p>Избранное пусто. Добавляй истории кнопкой ❤️.</p>";
}
if ($("#favorites-list")) renderFavorites();

/* ====== ПОИСК ПО САЙТУ ====== */
function renderSiteSearch() {
  if (!$("#site-search")) return;
  const q = ($("#site-search").value || "").toLowerCase().trim();

  const stories = getPublished().filter(t =>
    t.title.toLowerCase().includes(q) ||
    (t.summary || "").toLowerCase().includes(q) ||
    t.text.toLowerCase().includes(q) ||
    (t.author || "").toLowerCase().includes(q));
  const chars = load("characters").filter(c =>
    c.name.toLowerCase().includes(q) || c.desc.toLowerCase().includes(q));
  const locs = load("locations").filter(l =>
    l.name.toLowerCase().includes(q) || l.desc.toLowerCase().includes(q));
  const chs = load("chapters").filter(c =>
    c.title.toLowerCase().includes(q) || c.summary.toLowerCase().includes(q));

  $("#site-stories").innerHTML = stories.length
    ? stories.map(storyCard).join("") : "<p>Ничего не найдено.</p>";
  $("#site-characters").innerHTML = chars.length
    ? chars.map(c => `<div class="card"><div><h3>${escapeHtml(c.name)}</h3><p>${escapeHtml(c.desc)}</p></div></div>`).join("")
    : "<p>—</p>";
  $("#site-locations").innerHTML = locs.length
    ? locs.map(l => `<div class="card"><div><h3>${escapeHtml(l.name)}</h3><p>${escapeHtml(l.desc)}</p></div></div>`).join("")
    : "<p>—</p>";
  $("#site-chapters").innerHTML = chs.length
    ? chs.map((c, i) => `<tr><td>${i+1}</td><td>${escapeHtml(c.title)}</td><td>${escapeHtml(c.summary)}</td></tr>`).join("")
    : "<tr><td colspan='3'>—</td></tr>";

  $("#site-search-count").textContent =
    `Найдено: историй — ${stories.length}, персонажей — ${chars.length}, локаций — ${locs.length}, глав — ${chs.length}`;
}
if ($("#site-search")) {
  $("#site-search").addEventListener("input", renderSiteSearch);
  renderSiteSearch();
}

/* ====== СТРАНИЦА STORY ====== */
if ($("#story-view")) {
  const id = Number(new URLSearchParams(location.search).get("id"));
  const t = load("texts").find(x => x.id === id);

  if (!t) {
    $("#story-view").innerHTML = "<p>История не найдена.</p>";
  } else {
    const author = t.author || "Аноним";
    const av = avatarOf(author);
    const mine = me() === author;

    $("#story-view").innerHTML = `
      ${t.cover ? `<img class="story-cover" src="${escapeHtml(t.cover)}" alt="">` : ""}
      <h1>${escapeHtml(t.title)}</h1>
      <div class="author-line">
        ${av ? `<img src="${av}" class="avatar-small" alt="">` : ""}
        <a href="profile.html?user=${encodeURIComponent(author)}" class="author-link">${escapeHtml(author)}</a>
        <small>• ${t.date} • ${escapeHtml(t.status || "")} • ${escapeHtml(t.genre || "")}</small>
      </div>
      ${t.fandom ? `<p class="muted">Фандом: ${escapeHtml(t.fandom)}</p>` : ""}
      ${t.pairing ? `<p class="muted">Пейринг: ${escapeHtml(t.pairing)}</p>` : ""}
      ${(t.warnings || []).length ? `<p class="badges">${t.warnings.map(w => `<span class="badge warn">⚠️ ${escapeHtml(w)}</span>`).join(" ")}</p>` : ""}
      ${(t.tags || []).length ? `<p class="badges">${t.tags.map(x => `<span class="badge tag">#${escapeHtml(x)}</span>`).join(" ")}</p>` : ""}
      ${t.summary ? `<div class="summary-box"><b>Саммари:</b> ${escapeHtml(t.summary)}</div>` : ""}
      <hr>
      <div class="story-text">${escapeHtml(t.text).replace(/\n/g, "<br>")}</div>
      ${t.authorNote ? `<hr><p class="author-note"><b>Примечание автора:</b> ${escapeHtml(t.authorNote)}</p>` : ""}
      <div class="toolbar" style="margin-top:1rem">
        <button class="btn btn-ghost" onclick="likeStory(${t.id})">❤️ ${t.likes||0}</button>
        <button class="btn btn-ghost" onclick="recStory(${t.id})">⭐ ${t.recs||0}</button>
        <button class="btn btn-ghost" onclick="favStory(${t.id})">${isFav(t.id)?"💔 Убрать":"❤️ В избранное"}</button>
      </div>
    `;
    $("#download-buttons").innerHTML = `
      <button class="btn btn-ghost" onclick="dl('txt', ${t.id})">📄 .txt</button>
      <button class="btn btn-ghost" onclick="dl('md', ${t.id})">📝 .md</button>
      <button class="btn btn-ghost" onclick="dl('html', ${t.id})">🌐 .html</button>
      <button class="btn btn-ghost" onclick="dl('json', ${t.id})">💾 .json</button>
    `;
    renderComments(t, mine);
  }
}

function renderComments(t, isAuthor) {
  const published = (t.comments || []).filter(c => c.approved);
  const pending = (t.comments || []).filter(c => !c.approved);

  $("#comments-list").innerHTML = published.length
    ? published.map(c => `
      <div class="card">
        ${c.avatar ? `<img src="${c.avatar}" class="avatar-small" alt="">` : ""}
        <div><a href="profile.html?user=${encodeURIComponent(c.author)}"><b>${escapeHtml(c.author)}</b></a>
        <small>${c.date}</small><p>${escapeHtml(c.text)}</p></div>
      </div>`).join("")
    : "<p class='muted'>Комментариев пока нет.</p>";

  if (isAuthor && pending.length) {
    $("#comments-pending-wrap").style.display = "block";
    $("#comments-pending").innerHTML = pending.map(c => `
      <div class="card">
        <div style="flex:1">
          <a href="profile.html?user=${encodeURIComponent(c.author)}"><b>${escapeHtml(c.author)}</b></a>
          <small>${c.date}</small>
          <p>${escapeHtml(c.text)}</p>
          <div class="toolbar">
            <button class="btn btn-ghost" onclick="approveComment(${t.id}, ${c.id})">✅ Пропустить</button>
            <button class="btn btn-danger" onclick="rejectComment(${t.id}, ${c.id})">❌ Удалить</button>
          </div>
        </div>
      </div>`).join("");
  } else {
    $("#comments-pending-wrap").style.display = "none";
  }
}

if ($("#comment-form")) {
  $("#comment-form").addEventListener("submit", (e) => {
    e.preventDefault();
    if (!me()) { $("#comment-status").textContent = "Войди, чтобы комментировать."; return; }
    const id = Number(new URLSearchParams(location.search).get("id"));
    const texts = load("texts");
    const t = texts.find(x => x.id === id);
    if (!t) return;
    t.comments = t.comments || [];
    t.comments.push({
      id: Date.now(),
      author: me(),
      avatar: avatarOf(me()),
      text: $("#comment-text").value.trim(),
      date: new Date().toLocaleString("ru-RU"),
      approved: false,
    });
    save("texts", texts);
    $("#comment-text").value = "";
    $("#comment-status").textContent = "✅ Отправлено на модерацию автору.";
  });
}

window.approveComment = (sid, cid) => {
  const texts = load("texts");
  const t = texts.find(x => x.id === sid);
  if (!t) return;
  const c = (t.comments || []).find(x => x.id === cid);
  if (c) c.approved = true;
  save("texts", texts);
  renderComments(t, true);
};
window.rejectComment = (sid, cid) => {
  const texts = load("texts");
  const t = texts.find(x => x.id === sid);
  if (!t) return;
  t.comments = (t.comments || []).filter(x => x.id !== cid);
  save("texts", texts);
  renderComments(t, true);
};

/* ====== ТЕХПОДДЕРЖКА ====== */
const supportForm = $("#support-form");
if (supportForm) {
  supportForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const tickets = JSON.parse(localStorage.getItem("supportTickets") || "[]");
    tickets.unshift({
      id: Date.now(),
      name: $("#sup-name").value.trim(),
      email: $("#sup-email").value.trim(),
      topic: $("#sup-topic").value,
      text: $("#sup-text").value.trim(),
      from: me() || "Гость",
      date: new Date().toLocaleString("ru-RU"),
      status: "Новое",
    });
    localStorage.setItem("supportTickets", JSON.stringify(tickets));
    supportForm.reset();
    $("#support-status").textContent = "✅ Спасибо! Мы ответим в сообщениях.";
    renderSupportList();
  });
  renderSupportList();
}
function renderSupportList() {
  const list = $("#support-list");
  if (!list) return;
  const tickets = JSON.parse(localStorage.getItem("supportTickets") || "[]");
  list.innerHTML = tickets.length
    ? tickets.map(t => `
      <div class="card"><div>
        <h3>${escapeHtml(t.topic)} <small>— ${escapeHtml(t.status)}</small></h3>
        <p>${escapeHtml(t.text)}</p>
        <small>${escapeHtml(t.name)} · ${t.date} · ${escapeHtml(t.email || "без контакта")}</small>
      </div></div>`).join("")
    : "<p>Обращений пока нет.</p>";
}

/* ====== СООБЩЕНИЯ ====== */
function getMessages() { return JSON.parse(localStorage.getItem("messages") || "[]"); }
function saveMessages(ms) { localStorage.setItem("messages", JSON.stringify(ms)); }

function renderUsersList() {
  const list = $("#users-list");
  if (!list) return;
  const users = JSON.parse(localStorage.getItem("users") || "{}");
  const current = me();
  const q = ($("#user-search")?.value || "").toLowerCase().trim();
  const names = Object.keys(users).filter(n => n !== current);
  const filtered = q ? names.filter(n => n.toLowerCase().includes(q)) : names;
  list.innerHTML = filtered.length
    ? filtered.map(n => {
        const av = users[n]?.avatar || "";
        return `<li>
          <a href="#" onclick="openChat('${escapeHtml(n)}');return false;">
            ${av ? `<img src="${av}" class="avatar-small" alt="">` : ""} ${escapeHtml(n)}
          </a>
          <a href="profile.html?user=${encodeURIComponent(n)}" class="muted" style="font-size:.75rem;padding-left:.6rem">профиль →</a>
        </li>`;
      }).join("")
    : "<li class='muted'>Пользователей нет</li>";
}
if ($("#user-search")) {
  $("#user-search").addEventListener("input", renderUsersList);
  renderUsersList();
}

let currentChat = null;
window.openChat = (name) => {
  currentChat = name;
  $("#chat-header").innerHTML = `<b>Чат с ${escapeHtml(name)}</b>`;
  renderChatMessages();
  $("#chat-form").style.display = "flex";
};

(function () {
  const target = sessionStorage.getItem("openChatWith");
  if (target && $("#chat-header")) {
    sessionStorage.removeItem("openChatWith");
    openChat(target);
  }
})();

function renderChatMessages() {
  const box = $("#chat-messages");
  if (!box) return;
  const current = me();
  if (!currentChat) {
    box.innerHTML = "<p class='muted'>Выбери собеседника слева.</p>"; return;
  }
  const all = getMessages().filter(m =>
    (m.from === current && m.to === currentChat) ||
    (m.from === currentChat && m.to === current));
  box.innerHTML = all.length
    ? all.map(m => `
      <div class="msg ${m.from === current ? "my" : "their"}">
        <small>${escapeHtml(m.from)} · ${m.date}</small>
        <p>${escapeHtml(m.text)}</p>
      </div>`).join("")
    : "<p class='muted'>Сообщений пока нет.</p>";
  box.scrollTop = box.scrollHeight;
}
const chatForm = $("#chat-form");
if (chatForm) {
  chatForm.style.display = "none";
  chatForm.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!me()) return alert("Войди, чтобы писать.");
    if (!currentChat) return;
    const text = $("#chat-input").value.trim();
    if (!text) return;
    const ms = getMessages();
    ms.push({ from: me(), to: currentChat, text, date: new Date().toLocaleString("ru-RU") });
    saveMessages(ms);
    $("#chat-input").value = "";
    renderChatMessages();
  });
}

/* ====== ПРОФИЛЬ ====== */
if ($("#profile-view")) {
  renderProfilePage();
}

function renderProfilePage() {
  const users = JSON.parse(localStorage.getItem("users") || "{}");
  const params = new URLSearchParams(location.search);
  const requested = params.get("user") || me();
  const isMine = !params.get("user") || params.get("user") === me();

  if (!requested || !users[requested]) {
    $("#profile-view").innerHTML = `
      <h2>Профиль не найден</h2>
      <p class="muted">Такого пользователя нет. 
      ${me() ? `<a href="profile.html?user=${encodeURIComponent(me())}">Перейти в свой профиль →</a>` 
              : `<a href="login.html">Войти →</a>`}</p>`;
    return;
  }

  const u = users[requested];
  const stories = load("texts").filter(t => t.published && t.author === requested);

  $("#profile-view").innerHTML = `
    <div class="profile-header">
      ${u.avatar ? `<img src="${u.avatar}" alt="" class="profile-avatar">` : `<div class="profile-avatar placeholder">${requested[0].toUpperCase()}</div>`}
      <div style="flex:1">
        <h2 style="margin:0 0 .3rem">${escapeHtml(requested)}</h2>
        <p class="muted">${u.bio ? escapeHtml(u.bio) : "Пользователь пока ничего о себе не написал."}</p>
        ${u.link ? `<p><a href="${escapeHtml(u.link)}" target="_blank" rel="noopener">🔗 ${escapeHtml(u.link)}</a></p>` : ""}
        <p class="muted">📚 Опубликовано историй: ${stories.length}</p>
        <div class="toolbar">
          ${isMine ? `<button class="btn" onclick="showProfileEdit()">✏️ Редактировать профиль</button>` : ""}
          ${!isMine && me() ? `<button class="btn btn-ghost" onclick="writeTo('${escapeHtml(requested)}')">💬 Написать</button>` : ""}
        </div>
      </div>
    </div>
  `;

  $("#profile-stories-section").style.display = "block";
  $("#profile-stories").innerHTML = stories.length
    ? stories.map(storyCard).join("")
    : "<p class='muted'>Опубликованных историй пока нет.</p>";
}

window.showProfileEdit = () => {
  const users = JSON.parse(localStorage.getItem("users") || "{}");
  const cur = me();
  if (!cur || !users[cur]) { alert("Войди в аккаунт."); return; }
  const u = users[cur];
  $("#pe-name").value = cur;
  $("#pe-bio").value = u.bio || "";
  $("#pe-link").value = u.link || "";
  $("#profile-edit-section").style.display = "block";
  $("#profile-edit-section").scrollIntoView({ behavior: "smooth" });

  const av = $("#pe-avatar");
  av.onchange = () => {
    const f = av.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      $("#pe-avatar-preview").src = reader.result;
      $("#pe-avatar-preview-wrap").style.display = "block";
    };
    reader.readAsDataURL(f);
  };
};

window.cancelProfileEdit = () => {
  $("#profile-edit-section").style.display = "none";
};

const peForm = $("#profile-edit-form");
if (peForm) {
  peForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const cur = me();
    if (!cur) return;
    const users = JSON.parse(localStorage.getItem("users") || "{}");
    const u = users[cur];
    if (!u) return;

    const newName = $("#pe-name").value.trim() || cur;
    if (newName !== cur && users[newName]) {
      $("#profile-edit-status").textContent = "Это имя уже занято.";
      return;
    }

    const file = $("#pe-avatar").files[0];
    if (file) u.avatar = await compressImage(file, 128);
    u.bio = $("#pe-bio").value.trim();
    u.link = $("#pe-link").value.trim();

    if (newName !== cur) {
      users[newName] = u;
      delete users[cur];
      localStorage.setItem("users", JSON.stringify(users));
      localStorage.setItem("currentUser", newName);

      const texts = load("texts");
      texts.forEach(t => {
        if (t.author === cur) t.author = newName;
        (t.comments || []).forEach(c => {
          if (c.author === cur) c.author = newName;
        });
      });
      save("texts", texts);

      const ms = JSON.parse(localStorage.getItem("messages") || "[]");
      ms.forEach(m => {
        if (m.from === cur) m.from = newName;
        if (m.to === cur) m.to = newName;
      });
      localStorage.setItem("messages", JSON.stringify(ms));
    } else {
      localStorage.setItem("users", JSON.stringify(users));
    }

    $("#profile-edit-status").textContent = "✅ Профиль сохранён!";
    setTimeout(() => {
      location.href = `profile.html?user=${encodeURIComponent(newName)}`;
    }, 700);
  });
}

window.writeTo = (name) => {
  sessionStorage.setItem("openChatWith", name);
  location.href = "messages.html";
};