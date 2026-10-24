/* ES5 only. Glossary JSON is requested once and then filtered in memory. */
(function () {
  var data = null;
  var state = { glossary: "", tag: "", q: "", term: "" };
  var limit = 30;
  var app = document.getElementById("app");
  var status = document.getElementById("status");
  var workspace = document.getElementById("workspace");
  var glossariesEl = document.getElementById("glossaries");
  var tagsEl = document.getElementById("tags");
  var searchEl = document.getElementById("search");
  var summaryEl = document.getElementById("summary");
  var resultsTitleEl = document.getElementById("results-title");
  var detailEl = document.getElementById("detail");
  var termsEl = document.getElementById("terms");
  var moreEl = document.getElementById("more");
  var emptyEl = document.getElementById("empty");

  function decode(value) {
    try { return decodeURIComponent(String(value).replace(/\+/g, " ")); }
    catch (ignore) { return String(value); }
  }
  function encode(value) { return encodeURIComponent(value); }
  function parseHash() {
    var result = { glossary: "", tag: "", q: "", term: "" };
    var hash = window.location.hash ? window.location.hash.substring(1) : "";
    var parts = hash.split("&");
    var i, pair, key, value;
    for (i = 0; i < parts.length; i += 1) {
      pair = parts[i].split("=");
      if (pair.length < 2) { continue; }
      key = decode(pair.shift());
      value = decode(pair.join("="));
      if (key === "glossary" || key === "tag" || key === "q" || key === "term") { result[key] = value; }
    }
    if (result.term) { result.glossary = ""; result.tag = ""; result.q = ""; }
    return result;
  }
  function buildHash() {
    var parts = [];
    if (state.term) { return "term=" + encode(state.term); }
    if (state.glossary) { parts.push("glossary=" + encode(state.glossary)); }
    if (state.tag) { parts.push("tag=" + encode(state.tag)); }
    if (state.q) { parts.push("q=" + encode(state.q)); }
    return parts.join("&");
  }
  function navigate() {
    var next = buildHash();
    if (next !== (window.location.hash ? window.location.hash.substring(1) : "")) {
      window.location.hash = next;
    } else {
      render();
    }
    render();
  }
  function replaceSearchHash() {
    var next = buildHash();
    var url = window.location.pathname + window.location.search + (next ? "#" + next : "");
    if (window.history && window.history.replaceState) {
      window.history.replaceState(null, document.title, url);
    } else {
      window.location.hash = next;
    }
  }
  function esc(value) {
    return String(value === null || typeof value === "undefined" ? "" : value)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function findTerm(id) {
    var i;
    for (i = 0; i < data.terms.length; i += 1) {
      if (data.terms[i].id === id) { return data.terms[i]; }
    }
    return null;
  }
  function glossaryLabel(id) {
    var i;
    for (i = 0; i < data.glossaries.length; i += 1) {
      if (data.glossaries[i].id === id) { return data.glossaries[i].name_en; }
    }
    return id;
  }
  function tagCount(tag) {
    var count = 0, i, j;
    for (i = 0; i < data.terms.length; i += 1) {
      for (j = 0; j < data.terms[i].tags.length; j += 1) {
        if (data.terms[i].tags[j] === tag) { count += 1; break; }
      }
    }
    return count;
  }
  function allTags() {
    var result = [], i, j, tag;
    for (i = 0; i < data.terms.length; i += 1) {
      for (j = 0; j < data.terms[i].tags.length; j += 1) {
        tag = data.terms[i].tags[j];
        if (result.indexOf(tag) === -1) { result.push(tag); }
      }
    }
    result.sort(function (a, b) { return a.toLowerCase() < b.toLowerCase() ? -1 : (a.toLowerCase() > b.toLowerCase() ? 1 : 0); });
    return result;
  }
  function renderGlossaries() {
    var html = '<button type="button" class="button' + (!state.glossary ? ' is-active' : '') + '" data-action="glossary" data-glossary="">Все словари</button>';
    var i, item;
    for (i = 0; i < data.glossaries.length; i += 1) {
      item = data.glossaries[i];
      html += '<button type="button" class="button' + (state.glossary === item.id ? ' is-active' : '') + '" data-action="glossary" data-glossary="' + esc(item.id) + '">' + esc(item.name_en) + ' · ' + esc(item.name_ru) + '</button>';
    }
    glossariesEl.innerHTML = html;
  }
  function renderTags() {
    var tags = allTags(), html = "", i, tag;
    for (i = 0; i < tags.length; i += 1) {
      tag = tags[i];
      html += '<button type="button" class="tag' + (state.tag === tag ? ' is-active' : '') + '" data-action="tag" data-tag="' + esc(tag) + '" aria-pressed="' + (state.tag === tag ? 'true' : 'false') + '">' + esc(tag) + '<span class="count"> ' + tagCount(tag) + '</span></button>';
    }
    tagsEl.innerHTML = html;
  }
  function matches(term) {
    var q = (state.q || "").toLowerCase().replace(/^\s+|\s+$/g, "");
    var text;
    if (state.glossary && term.glossary !== state.glossary) { return false; }
    if (state.tag && term.tags.indexOf(state.tag) === -1) { return false; }
    if (!q) { return true; }
    text = (term.term_en + " " + term.term_ru + " " + term.definition_ru).toLowerCase();
    if (text.indexOf(q) !== -1) { return true; }
    var words = q.split(/\s+/), i;
    for (i = 0; i < words.length; i += 1) {
      if (words[i] && text.indexOf(words[i]) === -1) { return false; }
    }
    return true;
  }
  function tagButtons(tags) {
    var html = "", i;
    for (i = 0; i < tags.length; i += 1) {
      html += '<button type="button" class="tag" data-action="tag" data-tag="' + esc(tags[i]) + '">' + esc(tags[i]) + '</button>';
    }
    return html;
  }
  function relatedButtons(term) {
    var html = "", i, related;
    for (i = 0; i < term.related.length; i += 1) {
      related = findTerm(term.related[i]);
      if (related) {
        html += '<button type="button" class="related-link" data-action="term" data-id="' + esc(related.id) + '"><strong>' + esc(related.term_en) + '</strong><br>' + esc(related.term_ru) + ' · ' + esc(glossaryLabel(related.glossary)) + '</button>';
      }
    }
    return html || '<p>Связанные термины не указаны.</p>';
  }
  function renderDetail() {
    var term = state.term ? findTerm(state.term) : null;
    if (!state.term) { detailEl.innerHTML = ""; return; }
    if (!term) { detailEl.innerHTML = '<div class="detail-card"><p>Термин не найден.</p><button class="back-button" type="button" data-action="back">← Назад</button></div>'; return; }
    detailEl.innerHTML = '<button class="back-button" type="button" data-action="back">← Назад</button>' +
      '<article class="detail-card"><div class="term-title-row"><h3 class="term-open">' + esc(term.term_en) + '</h3><span class="glossary-label">' + esc(glossaryLabel(term.glossary)) + '</span></div>' +
      '<p class="term-ru">' + esc(term.term_ru) + '</p><p class="definition">' + esc(term.definition_ru) + '</p>' +
      '<p class="label">Теги</p><div class="card-tags">' + tagButtons(term.tags) + '</div>' +
      '<p class="label">Связанные термины</p><div class="related-list">' + relatedButtons(term) + '</div></article>';
  }
  function termCard(term) {
    return '<article class="term-card' + (state.term === term.id ? ' is-selected' : '') + '">' +
      '<div class="term-title-row"><button type="button" class="term-open" data-action="term" data-id="' + esc(term.id) + '">' + esc(term.term_en) + '</button><span class="glossary-label">' + esc(glossaryLabel(term.glossary)) + '</span></div>' +
      '<p class="term-ru">' + esc(term.term_ru) + '</p><p class="definition">' + esc(term.definition_ru) + '</p>' +
      '<div class="card-tags">' + tagButtons(term.tags) + '</div></article>';
  }
  function describeFilters() {
    var parts = [];
    if (state.glossary) { parts.push(glossaryLabel(state.glossary)); }
    if (state.tag) { parts.push("тег: " + state.tag); }
    if (state.q) { parts.push("поиск: " + state.q); }
    return parts.length ? parts.join(" · ") : "Все словари";
  }
  function render() {
    var found = [], i, term, shown, end;
    if (!data) { return; }
    renderGlossaries();
    renderTags();
    renderDetail();
    for (i = 0; i < data.terms.length; i += 1) {
      term = data.terms[i];
      if (matches(term)) { found.push(term); }
    }
    resultsTitleEl.innerHTML = state.term ? "Результаты" : "Термины";
    summaryEl.innerHTML = esc(describeFilters()) + " · найдено: " + found.length;
    end = Math.min(found.length, limit);
    shown = found.slice(0, end);
    termsEl.innerHTML = "";
    for (i = 0; i < shown.length; i += 1) { termsEl.innerHTML += termCard(shown[i]); }
    emptyEl.hidden = found.length !== 0;
    moreEl.innerHTML = end < found.length ? '<button type="button" class="button more-button" data-action="more">Показать ещё (' + (found.length - end) + ')</button>' : "";
  }
  function onClick(event) {
    var node = event.target || event.srcElement, action, id;
    if (node && node.nodeType === 3) { node = node.parentNode; }
    while (node && node !== app && !(node.getAttribute && node.getAttribute("data-action"))) { node = node.parentNode; }
    if (!node || node === app) { return; }
    action = node.getAttribute("data-action");
    if (event.preventDefault) { event.preventDefault(); }
    if (action === "glossary") {
      state.glossary = node.getAttribute("data-glossary") || ""; state.tag = ""; state.term = ""; limit = 30; navigate();
    } else if (action === "tag") {
      state.tag = node.getAttribute("data-tag") || ""; state.glossary = ""; state.term = ""; state.q = ""; searchEl.value = ""; limit = 30; navigate();
    } else if (action === "term") {
      id = node.getAttribute("data-id") || ""; if (findTerm(id)) { state.term = id; state.glossary = ""; state.tag = ""; state.q = ""; searchEl.value = ""; limit = 30; navigate(); }
    } else if (action === "reset") {
      state = { glossary: "", tag: "", q: "", term: "" }; searchEl.value = ""; limit = 30; navigate();
    } else if (action === "more") {
      limit += 30; render();
    } else if (action === "back") {
      if (window.history && window.history.length > 1) { window.history.back(); }
      else { state = { glossary: "", tag: "", q: "", term: "" }; navigate(); }
    }
  }
  function onSearch() {
    state.q = searchEl.value || "";
    state.term = "";
    limit = 30;
    replaceSearchHash();
    render();
  }
  function validate(parsed) {
    var ids = {}, i, j, item, required = ["id", "glossary", "term_en", "term_ru", "definition_ru", "tags", "related"];
    if (!parsed || !parsed.glossaries || !parsed.terms) { throw new Error("JSON должен содержать glossaries и terms."); }
    for (i = 0; i < parsed.terms.length; i += 1) {
      item = parsed.terms[i];
      for (j = 0; j < required.length; j += 1) {
        if (typeof item[required[j]] === "undefined") { throw new Error("У термина отсутствует поле " + required[j]); }
      }
      if (ids[item.id]) { throw new Error("Повторяется ID: " + item.id); }
      ids[item.id] = true;
    }
    return parsed;
  }
  function load() {
    var xhr = new XMLHttpRequest();
    xhr.open("GET", "data/glossaries.json", true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) { return; }
      if ((xhr.status >= 200 && xhr.status < 300) || xhr.status === 0) {
        try {
          data = validate(JSON.parse(xhr.responseText));
          state = parseHash();
          searchEl.value = state.q;
          workspace.hidden = false;
          status.hidden = true;
          render();
        } catch (error) {
          status.innerHTML = "Не удалось разобрать данные глоссария: " + esc(error.message);
        }
      } else {
        status.innerHTML = "Не удалось загрузить data/glossaries.json (HTTP " + xhr.status + "). Откройте сайт через HTTPS GitHub Pages.";
      }
    };
    xhr.onerror = function () { status.innerHTML = "Ошибка сети при загрузке data/glossaries.json."; };
    xhr.send(null);
  }
  app.addEventListener("click", onClick, false);
  searchEl.addEventListener("input", onSearch, false);
  window.addEventListener("hashchange", function () {
    if (!data) { return; }
    state = parseHash(); searchEl.value = state.q; limit = 30; render();
  }, false);
  load();
}());