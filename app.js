/* Translator Dream Tool. ES5 only; all navigation after loading is in memory. */
(function () {
  var data = null;
  var state = { glossary: "", tag: "", letter: "A", term: "" };
  var app = document.getElementById("app");
  var status = document.getElementById("status");
  var workspace = document.getElementById("workspace");
  var sectionNav = document.getElementById("section-nav");
  var bottomNav = document.getElementById("bottom-nav");
  var titleEl = document.getElementById("view-title");
  var summaryEl = document.getElementById("view-summary");
  var letterNav = document.getElementById("letter-nav");
  var termsEl = document.getElementById("term-list");
  var emptyEl = document.getElementById("empty");
  var clearFilterEl = document.getElementById("clear-filter");
  var selectedTermId = "";
  var SHORT = {
    pelvis: "Таз", vulva: "Вульва", vagina: "Влагалище", uterus: "Матка",
    cervix: "Шейка", tubes: "Трубы", ovaries: "Яичники", cycle: "Цикл"
  };
  var EN_SHORT = {
    pelvis: "PELVIS", vulva: "VULVA", vagina: "VAGINA", uterus: "UTERUS",
    cervix: "CERVIX", tubes: "TUBES", ovaries: "OVARIES", cycle: "CYCLE"
  };
  var COLORS = {
    pelvis: "#7057b8", vulva: "#c44770", vagina: "#16817d", uterus: "#2867b2",
    cervix: "#b9691c", tubes: "#39804f", ovaries: "#9451a8", cycle: "#987008"
  };
  var LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

  function decode(value) {
    try { return decodeURIComponent(String(value).replace(/\+/g, " ")); }
    catch (ignore) { return String(value); }
  }
  function encode(value) { return encodeURIComponent(value); }
  function termLetter(term) {
    var letter = String(term.term_en || "").charAt(0).toUpperCase();
    return LETTERS.indexOf(letter) !== -1 ? letter : "#";
  }
  function parseHash() {
    var result = { glossary: "", tag: "", letter: "A", term: "" };
    var hash = window.location.hash ? window.location.hash.substring(1) : "";
    var parts = hash.split("&"), i, pair, key, value;
    for (i = 0; i < parts.length; i += 1) {
      pair = parts[i].split("=");
      if (pair.length < 2) { continue; }
      key = decode(pair.shift()); value = decode(pair.join("="));
      if (key === "glossary" || key === "tag" || key === "letter" || key === "term") { result[key] = value; }
    }
    if (result.term) {
      var selected = findTerm(result.term);
      if (selected) { result.glossary = selected.glossary; result.tag = ""; result.letter = termLetter(selected); }
    }
    if (result.letter !== "" && result.letter !== "#" && LETTERS.indexOf(result.letter) === -1) { result.letter = "A"; }
    return result;
  }
  function buildHash() {
    var parts = [];
    if (state.term) { return "term=" + encode(state.term); }
    if (state.glossary) { parts.push("glossary=" + encode(state.glossary)); }
    if (state.tag) { parts.push("tag=" + encode(state.tag)); }
    if (state.letter !== "") { parts.push("letter=" + encode(state.letter)); }
    return parts.join("&");
  }
  function updateUrl() {
    var hash = buildHash();
    var url = window.location.pathname + window.location.search + (hash ? "#" + hash : "");
    var current = window.location.pathname + window.location.search + window.location.hash;
    if (url === current) { return; }
    if (window.history && window.history.pushState) {
      window.history.pushState(null, document.title, url);
    } else {
      window.location.hash = hash;
    }
  }
  function navigate(shouldScroll) {
    updateUrl();
    render();
    if (shouldScroll) { scrollToElement("view-heading", 150); }
  }
  function esc(value) {
    return String(value === null || typeof value === "undefined" ? "" : value)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function findTerm(id) {
    var i;
    if (!data) { return null; }
    for (i = 0; i < data.terms.length; i += 1) {
      if (data.terms[i].id === id) { return data.terms[i]; }
    }
    return null;
  }
  function glossaryLabel(id) {
    var i;
    for (i = 0; i < data.glossaries.length; i += 1) {
      if (data.glossaries[i].id === id) { return data.glossaries[i].name_ru || data.glossaries[i].name_en || id; }
    }
    return id;
  }
  function glossaryShort(id) { return SHORT[id] || glossaryLabel(id); }
  function sectionClass(id) { return "section-" + id; }
  function getScopedTerms() {
    var result = [], i, term;
    for (i = 0; i < data.terms.length; i += 1) {
      term = data.terms[i];
      if (state.glossary && term.glossary !== state.glossary) { continue; }
      if (state.tag && term.tags.indexOf(state.tag) === -1) { continue; }
      result.push(term);
    }
    result.sort(function (a, b) {
      var x = String(a.term_en).toLowerCase(), y = String(b.term_en).toLowerCase();
      if (x < y) { return -1; }
      if (x > y) { return 1; }
      return a.id < b.id ? -1 : (a.id > b.id ? 1 : 0);
    });
    return result;
  }
  function availableLetters(terms) {
    var found = {}, result = [], i, letter;
    for (i = 0; i < terms.length; i += 1) { found[termLetter(terms[i])] = true; }
    for (i = 0; i < LETTERS.length; i += 1) {
      letter = LETTERS.charAt(i);
      if (found[letter]) { result.push(letter); }
    }
    if (found["#"]) { result.push("#"); }
    return result;
  }
  function countForLetter(terms, letter) {
    var count = 0, i;
    for (i = 0; i < terms.length; i += 1) { if (termLetter(terms[i]) === letter) { count += 1; } }
    return count;
  }
  function validCurrentLetter(terms) {
    var available = availableLetters(terms);
    if (state.letter === "" || available.indexOf(state.letter) !== -1) { return; }
    if (available.indexOf("A") !== -1) { state.letter = "A"; }
    else { state.letter = available.length ? available[0] : ""; }
  }
  function buttonMarkup(id, isActive, isAll) {
    var label = isAll ? "Все разделы" : glossaryShort(id);
    var english = isAll ? "ALL TERMS" : (EN_SHORT[id] || id.toUpperCase());
    return '<button type="button" class="section-button' + (isAll ? ' nav-all' : ' ' + sectionClass(id)) + (isActive ? ' is-active' : '') +
      '" data-action="' + (isAll ? 'all' : 'glossary') + '"' + (isAll ? '' : ' data-glossary="' + esc(id) + '"') +
      ' aria-pressed="' + (isActive ? 'true' : 'false') + '">' + esc(label) + '<small>' + esc(english) + '</small></button>';
  }
  function renderSectionNav() {
    var html = "", i, item;
    for (i = 0; i < data.glossaries.length; i += 1) {
      item = data.glossaries[i];
      html += buttonMarkup(item.id, state.glossary === item.id && !state.tag, false);
    }
    sectionNav.innerHTML = html;
    bottomNav.innerHTML = html;
    var allButton = document.querySelector(".all-button");
    allButton.className = "all-button" + (!state.glossary && !state.tag ? " is-active" : "");
  }
  function renderLetters(scoped) {
    var letters = availableLetters(scoped), html = "", i, letter, count;
    html += '<button type="button" class="letter-button' + (state.letter === "" ? " is-active" : "") + '" data-action="letter" data-letter="" aria-pressed="' + (state.letter === "" ? "true" : "false") + '">Все</button>';
    for (i = 0; i < letters.length; i += 1) {
      letter = letters[i]; count = countForLetter(scoped, letter);
      html += '<button type="button" class="letter-button' + (state.letter === letter ? " is-active" : "") + '" data-action="letter" data-letter="' + esc(letter) + '" aria-pressed="' + (state.letter === letter ? "true" : "false") + '">' +
        esc(letter) + '<span class="letter-count">' + count + '</span></button>';
    }
    letterNav.innerHTML = html;
  }
  function tagMarkup(tags) {
    var html = "", max = Math.min(tags.length, 6), i;
    for (i = 0; i < max; i += 1) {
      html += '<button type="button" class="tag-chip" data-action="tag" data-tag="' + esc(tags[i]) + '">' + esc(tags[i]) + '</button>';
    }
    if (tags.length > max) { html += '<span class="tag-chip">+' + (tags.length - max) + '</span>'; }
    return html;
  }
  function relatedMarkup(term) {
    var html = "", i, related, color;
    for (i = 0; i < term.related.length; i += 1) {
      related = findTerm(term.related[i]);
      if (!related) { continue; }
      color = COLORS[related.glossary] || "#8a9bad";
      html += '<button type="button" class="related-link ' + sectionClass(related.glossary) + '" style="--related-color:' + color + '" data-action="term" data-id="' + esc(related.id) + '">' +
        '<strong>' + esc(related.term_en) + '</strong><small>' + esc(related.term_ru) + ' · ' + esc(glossaryShort(related.glossary)) + '</small></button>';
    }
    return html || '<span class="bottom-hint">Связи не указаны.</span>';
  }
  function termMarkup(term) {
    var expanded = state.term === term.id;
    var id = "term-" + term.id.replace(/[^A-Za-z0-9_-]/g, "-");
    var html = '<article id="' + esc(id) + '" class="term-row ' + sectionClass(term.glossary) + (expanded ? ' is-expanded' : '') + '">' +
      '<button type="button" class="term-main" data-action="term" data-id="' + esc(term.id) + '" aria-expanded="' + (expanded ? "true" : "false") + '">' +
      '<span class="row-cue">' + (expanded ? "−" : "+") + '</span><span class="term-line"><span class="term-en">' + esc(term.term_en) + '</span><span class="term-ru">' + esc(term.term_ru) + '</span></span>' +
      (term.pronunciation_ru ? '<span class="term-pronunciation">Произн.: ' + esc(term.pronunciation_ru) + '</span>' : '') + '</button>';
    if (expanded) {
      html += '<div class="term-detail"><p class="term-definition">' + esc(term.definition_ru) + '</p>' +
        '<div class="detail-label">Теги · нажмите, чтобы увидеть общий набор терминов</div><div class="detail-tags">' + tagMarkup(term.tags) + '</div>' +
        '<div class="detail-label">Связанные термины · цвет показывает раздел</div><div class="related-list">' + relatedMarkup(term) + '</div>' +
        '<div class="detail-footer"><button type="button" class="detail-action" data-action="close-term">Свернуть карточку</button>' +
        '<button type="button" class="detail-action" data-action="top">↑ Переключить раздел</button></div></div>';
    }
    return html + '</article>';
  }
  function render() {
    if (!data) { return; }
    var scoped = getScopedTerms(), letters, shown = [], i, term, sectionTitle;
    validCurrentLetter(scoped);
    renderSectionNav();
    renderLetters(scoped);
    letters = availableLetters(scoped);
    for (i = 0; i < scoped.length; i += 1) {
      term = scoped[i];
      if (state.letter === "" || termLetter(term) === state.letter) { shown.push(term); }
    }
    if (state.term) {
      term = findTerm(state.term);
      if (term) { state.glossary = term.glossary; state.tag = ""; }
    }
    if (state.tag) { sectionTitle = 'Тег: ' + state.tag; }
    else if (state.glossary) { sectionTitle = glossaryLabel(state.glossary); }
    else { sectionTitle = "Все термины"; }
    titleEl.innerHTML = esc(sectionTitle);
    summaryEl.innerHTML = shown.length + (shown.length === 1 ? " термин" : " терминов") +
      (state.letter ? " · буква " + esc(state.letter) : " · все буквы") +
      (state.glossary ? " · " + esc(glossaryShort(state.glossary)) : " · все разделы");
    clearFilterEl.hidden = !state.tag;
    termsEl.innerHTML = "";
    for (i = 0; i < shown.length; i += 1) { termsEl.innerHTML += termMarkup(shown[i]); }
    emptyEl.hidden = shown.length !== 0;
  }
  function scrollToElement(id, offset) {
    window.setTimeout(function () {
      var el = document.getElementById(id), top;
      if (!el) { return; }
      top = el.getBoundingClientRect().top + (window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0) - offset;
      if (top < 0) { top = 0; }
      window.scrollTo(0, top);
    }, 30);
  }
  function firstLetterForTerm(term) { return termLetter(term); }
  function firstAvailableLetter() {
    var letters = availableLetters(getScopedTerms());
    return letters.indexOf("A") !== -1 ? "A" : (letters.length ? letters[0] : "");
  }
  function onClick(event) {
    var node = event.target || event.srcElement, action, id, term, targetLetter;
    if (node && node.nodeType === 3) { node = node.parentNode; }
    while (node && node !== app && !(node.getAttribute && node.getAttribute("data-action"))) { node = node.parentNode; }
    if (!node || node === app) { return; }
    action = node.getAttribute("data-action");
    if (event.preventDefault) { event.preventDefault(); }
    if (action === "all") {
      state.glossary = ""; state.tag = ""; state.term = "";
      validCurrentLetter(getScopedTerms());
      navigate(true);
    } else if (action === "glossary") {
      state.glossary = node.getAttribute("data-glossary") || "";
      state.tag = ""; state.term = "";
      validCurrentLetter(getScopedTerms());
      navigate(true);
    } else if (action === "letter") {
      state.letter = node.getAttribute("data-letter") || "";
      state.term = "";
      navigate(true);
    } else if (action === "term") {
      id = node.getAttribute("data-id") || "";
      term = findTerm(id);
      if (term) {
        if (state.term === id) { state.term = ""; }
        else {
          state.term = id; state.glossary = term.glossary; state.tag = "";
          state.letter = firstLetterForTerm(term);
        }
        navigate(false);
        if (state.term) { scrollToElement("term-" + id.replace(/[^A-Za-z0-9_-]/g, "-"), 145); }
      }
    } else if (action === "tag") {
      state.tag = node.getAttribute("data-tag") || "";
      state.glossary = ""; state.term = ""; state.letter = "";
      navigate(true);
    } else if (action === "clear-filter") {
      state.tag = ""; state.glossary = ""; state.term = "";
      state.letter = firstAvailableLetter();
      navigate(true);
    } else if (action === "close-term") {
      state.term = "";
      navigate(false);
    } else if (action === "top") {
      scrollToElement("view-heading", 145);
      if (window.pageYOffset > 300) { window.scrollTo(0, 0); }
    }
  }
  function validate(parsed) {
    var ids = {}, knownGlossaries = {}, i, j, item;
    if (!parsed || !parsed.glossaries || !parsed.terms || !(parsed.terms instanceof Array)) { throw new Error("Некорректный манифест или массив терминов."); }
    for (i = 0; i < parsed.glossaries.length; i += 1) { knownGlossaries[parsed.glossaries[i].id] = true; }
    for (i = 0; i < parsed.terms.length; i += 1) {
      item = parsed.terms[i];
      if (!item.id || !item.glossary || !item.term_en || !item.term_ru || !item.definition_ru || !(item.tags instanceof Array) || !(item.related instanceof Array)) {
        throw new Error("У термина не заполнены обязательные поля.");
      }
      if (ids[item.id]) { throw new Error("Повторяется ID: " + item.id); }
      if (!knownGlossaries[item.glossary]) { throw new Error("Неизвестный раздел: " + item.glossary); }
      ids[item.id] = true;
    }
    for (i = 0; i < parsed.terms.length; i += 1) {
      for (j = 0; j < parsed.terms[i].related.length; j += 1) {
        if (!ids[parsed.terms[i].related[j]]) { throw new Error("Не найдена связанная запись: " + parsed.terms[i].related[j]); }
      }
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
          var manifest = JSON.parse(xhr.responseText);
          if (manifest.terms) {
            data = manifest;
            finishLoading();
          } else if (manifest.glossaries && manifest.term_files) {
            data = { glossaries: manifest.glossaries, terms: [], term_files: manifest.term_files };
            loadTermFiles(manifest.term_files);
          } else { throw new Error("В манифесте не найдены terms или term_files."); }
        } catch (error) {
          status.innerHTML = "Не удалось загрузить данные: " + esc(error.message);
        }
      } else { status.innerHTML = "Не удалось загрузить data/glossaries.json (HTTP " + xhr.status + ")."; }
    };
    xhr.onerror = function () { status.innerHTML = "Ошибка сети при загрузке манифеста."; };
    xhr.send(null);

    function finishLoading() {
      try {
        data = validate(data);
        state = parseHash();
        if (state.term) {
          var currentTerm = findTerm(state.term);
          if (!currentTerm) { state.term = ""; }
          else { state.glossary = currentTerm.glossary; state.letter = termLetter(currentTerm); state.tag = ""; }
        }
        validCurrentLetter(getScopedTerms());
        workspace.hidden = false;
        status.hidden = true;
        render();
        if (state.term) { scrollToElement("term-" + state.term.replace(/[^A-Za-z0-9_-]/g, "-"), 145); }
      } catch (error) { status.innerHTML = "Ошибка данных глоссария: " + esc(error.message); }
    }
    function loadTermFiles(paths) {
      var parts = [], pending = paths.length, failed = false, i;
      if (!pending) { finishLoading(); return; }
      function fail(message) {
        if (failed) { return; }
        failed = true;
        status.innerHTML = message;
      }
      for (i = 0; i < paths.length; i += 1) {
        (function (index) {
          var termXhr = new XMLHttpRequest();
          termXhr.open("GET", "data/" + paths[index], true);
          termXhr.onreadystatechange = function () {
            if (termXhr.readyState !== 4 || typeof parts[index] !== "undefined" || failed) { return; }
            if ((termXhr.status >= 200 && termXhr.status < 300) || termXhr.status === 0) {
              try {
                var parsedTerms = JSON.parse(termXhr.responseText);
                if (!(parsedTerms instanceof Array)) { throw new Error(paths[index] + " должен содержать массив."); }
                parts[index] = parsedTerms;
                pending -= 1;
                if (pending === 0) {
                  data.terms = [];
                  var j, k;
                  for (j = 0; j < parts.length; j += 1) {
                    for (k = 0; k < parts[j].length; k += 1) { data.terms.push(parts[j][k]); }
                  }
                  delete data.term_files;
                  finishLoading();
                }
              } catch (error) { fail("Ошибка в " + esc(paths[index]) + ": " + esc(error.message)); }
            } else { fail("Не удалось загрузить data/" + esc(paths[index]) + " (HTTP " + termXhr.status + ")."); }
          };
          termXhr.onerror = function () { fail("Сетевая ошибка при загрузке data/" + esc(paths[index]) + "."); };
          termXhr.send(null);
        }(i));
      }
    }
  }
  app.addEventListener("click", onClick, false);
  document.querySelector(".sticky-shell").addEventListener("click", onClick, false);
  window.addEventListener("popstate", function () {
    if (!data) { return; }
    state = parseHash();
    render();
  }, false);
  window.addEventListener("hashchange", function () {
    if (!data) { return; }
    state = parseHash();
    render();
  }, false);
  load();
}());