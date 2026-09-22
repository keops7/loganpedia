(function () {
  "use strict";

  var state = {
    content: null,
    fraseIndex: 0,
    nivel: "facil",
    letra: null,
    palabraIndex: 0,
    muted: false,
  };

  try {
    state.muted = localStorage.getItem("loganpedia-muted") === "1";
  } catch (e) {}

  var screens = {};
  document.querySelectorAll(".screen").forEach(function (el) {
    screens[el.id.replace("screen-", "")] = el;
  });

  function goTo(name) {
    Object.keys(screens).forEach(function (k) {
      screens[k].classList.toggle("active", k === name);
    });
    window.speechSynthesis.cancel();
  }

  document.body.addEventListener("click", function (e) {
    var btn = e.target.closest("[data-go]");
    if (!btn) return;
    var target = btn.getAttribute("data-go");
    if (target === "vocab-letras" && btn.dataset.nivel) {
      state.nivel = btn.dataset.nivel;
      buildLetrasGrid();
    }
    goTo(target);
  });

  // ---------- VOZ ----------
  var spanishVoice = null;
  function pickVoice() {
    var voices = window.speechSynthesis.getVoices();
    spanishVoice =
      voices.find(function (v) { return v.lang === "es-ES"; }) ||
      voices.find(function (v) { return v.lang && v.lang.indexOf("es") === 0; }) ||
      null;
  }
  if ("speechSynthesis" in window) {
    pickVoice();
    window.speechSynthesis.onvoiceschanged = pickVoice;
  }

  function speak(text) {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    if (state.muted) return;
    var utter = new SpeechSynthesisUtterance(text);
    utter.lang = "es-ES";
    if (spanishVoice) utter.voice = spanishVoice;
    utter.rate = 0.85;
    utter.pitch = 1.15;
    window.speechSynthesis.speak(utter);
  }

  // ---------- SILENCIO ----------
  var muteButtons = document.querySelectorAll(".mute-toggle");

  function renderMuteButtons() {
    muteButtons.forEach(function (btn) {
      btn.textContent = state.muted ? "🔇" : "🔊";
      btn.classList.toggle("is-muted", state.muted);
      btn.setAttribute("aria-pressed", state.muted ? "true" : "false");
      btn.setAttribute("aria-label", state.muted ? "Activar sonido" : "Silenciar sonido");
    });
  }
  renderMuteButtons();

  muteButtons.forEach(function (btn) {
    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      state.muted = !state.muted;
      if (state.muted) window.speechSynthesis.cancel();
      try {
        localStorage.setItem("loganpedia-muted", state.muted ? "1" : "0");
      } catch (err) {}
      renderMuteButtons();
    });
  });

  // ---------- CARGA DE CONTENIDO ----------
  fetch("content/content.json")
    .then(function (r) { return r.json(); })
    .then(function (data) {
      state.content = data;
      buildFraseScreen();
      buildLetrasGrid();
    })
    .catch(function (err) {
      console.error("No se pudo cargar el contenido", err);
    });

  // ---------- FRASES SIMPLES ----------
  var fraseTextEl = document.getElementById("frase-text");
  var fracePictosEl = document.getElementById("frase-pictos");
  var fraseDotsEl = document.getElementById("frase-dots");

  function renderFrase() {
    var sentences = state.content.sentences;
    var s = sentences[state.fraseIndex];
    fraseTextEl.textContent = s.text;
    fracePictosEl.innerHTML = "";
    s.pictos.forEach(function (p) {
      var card = document.createElement("div");
      card.className = "picto-card";
      card.innerHTML =
        '<img src="assets/pictos/' + p.file + '" alt="' + p.word + '">' +
        "<span>" + p.word + "</span>";
      card.addEventListener("click", function (e) {
        e.stopPropagation();
        speak(p.word);
      });
      fracePictosEl.appendChild(card);
    });
    fraseDotsEl.innerHTML = "";
    sentences.forEach(function (_, i) {
      var dot = document.createElement("span");
      dot.className = "dot" + (i === state.fraseIndex ? " active" : "");
      fraseDotsEl.appendChild(dot);
    });
    speak(s.text);
  }

  function buildFraseScreen() {
    state.fraseIndex = 0;
    renderFrase();
  }

  document.getElementById("frase-prev").addEventListener("click", function () {
    var n = state.content.sentences.length;
    state.fraseIndex = (state.fraseIndex - 1 + n) % n;
    renderFrase();
  });
  document.getElementById("frase-next").addEventListener("click", function () {
    var n = state.content.sentences.length;
    state.fraseIndex = (state.fraseIndex + 1) % n;
    renderFrase();
  });
  // ---------- VOCABULARIO: LETRAS ----------
  var LETRAS = "ABCDEFGHIJKLMNÑOPQRSTUVWXYZ".split("");
  var letrasGridEl = document.getElementById("letras-grid");
  var letrasTitleEl = document.getElementById("letras-title");

  function buildLetrasGrid() {
    if (!state.content) return;
    letrasTitleEl.textContent =
      state.nivel === "facil" ? "Fácil · elige una letra" : "Difícil · elige una letra";
    letrasGridEl.innerHTML = "";
    LETRAS.forEach(function (letra) {
      var entry = state.content.letters[letra];
      var words = entry ? entry[state.nivel] : [];
      var btn = document.createElement("button");
      btn.className = "letra-btn";
      btn.textContent = letra;
      if (!words || words.length === 0) {
        btn.disabled = true;
      } else {
        btn.addEventListener("click", function () {
          state.letra = letra;
          state.palabraIndex = 0;
          renderPalabra();
          goTo("vocab-palabra");
        });
      }
      letrasGridEl.appendChild(btn);
    });
  }

  // ---------- VOCABULARIO: PALABRA ----------
  var palabraLetraTitleEl = document.getElementById("palabra-letra-title");
  var palabraPictoEl = document.getElementById("palabra-picto");
  var palabraTextEl = document.getElementById("palabra-text");
  var palabraDotsEl = document.getElementById("palabra-dots");

  function currentWords() {
    return state.content.letters[state.letra][state.nivel];
  }

  function renderPalabra() {
    var words = currentWords();
    var w = words[state.palabraIndex];
    palabraLetraTitleEl.textContent = "Letra " + state.letra;
    palabraPictoEl.src = "assets/pictos/" + w.file;
    palabraPictoEl.alt = w.word;
    palabraTextEl.textContent = w.word;
    palabraDotsEl.innerHTML = "";
    words.forEach(function (_, i) {
      var dot = document.createElement("span");
      dot.className = "dot" + (i === state.palabraIndex ? " active" : "");
      palabraDotsEl.appendChild(dot);
    });
    speak(w.word);
  }

  document.getElementById("palabra-prev").addEventListener("click", function () {
    var n = currentWords().length;
    state.palabraIndex = (state.palabraIndex - 1 + n) % n;
    renderPalabra();
  });
  document.getElementById("palabra-next").addEventListener("click", function () {
    var n = currentWords().length;
    state.palabraIndex = (state.palabraIndex + 1) % n;
    renderPalabra();
  });
  document.getElementById("palabra-picto").addEventListener("click", function () {
    speak(currentWords()[state.palabraIndex].word);
  });

  // ---------- SERVICE WORKER ----------
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("sw.js").catch(function () {});
    });
  }
})();
