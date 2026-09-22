(function () {
  "use strict";

  var state = {
    content: null,
    fraseIndex: 0,
    nivel: "facil",
    letra: null,
    palabraIndex: 0,
    conceptoIndex: 0,
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
    stopSound();
  }

  document.body.addEventListener("click", function (e) {
    var btn = e.target.closest("[data-go]");
    if (!btn) return;
    var target = btn.getAttribute("data-go");
    if (target === "vocab-letras" && btn.dataset.nivel) {
      state.nivel = btn.dataset.nivel;
      buildLetrasGrid();
    }
    if (target === "sonidos") {
      nextSonidoRound();
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

  // ---------- SONIDOS REALES (audio) ----------
  var currentSoundAudio = null;
  function stopSound() {
    if (currentSoundAudio) {
      currentSoundAudio.pause();
      currentSoundAudio = null;
    }
  }
  function playSound(filename) {
    stopSound();
    if (state.muted) return;
    currentSoundAudio = new Audio("assets/sounds/" + filename);
    currentSoundAudio.play().catch(function () {});
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
      if (state.muted) { window.speechSynthesis.cancel(); stopSound(); }
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
      buildLibreBank();
      buildConceptosScreen();
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
  // ---------- FRASE LIBRE ----------
  var libreBankEl = document.getElementById("libre-bank");
  var librePizarraEl = document.getElementById("libre-pizarra");
  var libreSeleccion = [];

  function buildLibreBank() {
    libreBankEl.innerHTML = "";
    state.content.libre_bank.forEach(function (w) {
      var btn = document.createElement("button");
      btn.className = "libre-bank-item";
      btn.innerHTML =
        '<img src="assets/pictos/' + w.file + '" alt="' + w.word + '">' +
        "<span>" + w.word + "</span>";
      btn.addEventListener("click", function () {
        libreSeleccion.push(w);
        renderLibrePizarra();
        speak(w.word);
      });
      libreBankEl.appendChild(btn);
    });
  }

  function renderLibrePizarra() {
    librePizarraEl.innerHTML = "";
    if (libreSeleccion.length === 0) {
      var vacio = document.createElement("p");
      vacio.className = "libre-vacio";
      vacio.id = "libre-vacio";
      vacio.textContent = "Toca los dibujos para hacer tu frase";
      librePizarraEl.appendChild(vacio);
      return;
    }
    libreSeleccion.forEach(function (w, i) {
      var chip = document.createElement("div");
      chip.className = "libre-chip";
      chip.innerHTML =
        '<img src="assets/pictos/' + w.file + '" alt="' + w.word + '">' +
        "<span>" + w.word + "</span>";
      chip.addEventListener("click", function () {
        libreSeleccion.splice(i, 1);
        renderLibrePizarra();
      });
      librePizarraEl.appendChild(chip);
    });
  }

  document.getElementById("libre-borrar").addEventListener("click", function () {
    libreSeleccion = [];
    renderLibrePizarra();
    window.speechSynthesis.cancel();
  });
  document.getElementById("libre-leer").addEventListener("click", function () {
    if (libreSeleccion.length === 0) return;
    speak(libreSeleccion.map(function (w) { return w.word; }).join(" "));
  });

  // ---------- SONIDOS ----------
  var sonidoPlayEl = document.getElementById("sonido-play");
  var sonidosOpcionesEl = document.getElementById("sonidos-opciones");
  var sonidosFeedbackEl = document.getElementById("sonidos-feedback");
  var sonidoActual = null;
  var sonidoAnteriorWord = null;
  var sonidosBloqueado = false;

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function nextSonidoRound() {
    if (!state.content) return;
    sonidosBloqueado = false;
    sonidosFeedbackEl.textContent = "";
    var banco = state.content.sonidos;
    var candidatos = banco.filter(function (s) { return s.word !== sonidoAnteriorWord; });
    sonidoActual = candidatos[Math.floor(Math.random() * candidatos.length)];
    sonidoAnteriorWord = sonidoActual.word;

    var distractores = shuffle(banco.filter(function (s) { return s.word !== sonidoActual.word; })).slice(0, 2);
    var opciones = shuffle([sonidoActual].concat(distractores));

    sonidosOpcionesEl.innerHTML = "";
    opciones.forEach(function (op) {
      var btn = document.createElement("button");
      btn.className = "sonido-opcion";
      btn.innerHTML =
        '<img src="assets/pictos/' + op.file + '" alt="' + op.word + '">' +
        "<span>" + op.word + "</span>";
      btn.addEventListener("click", function () {
        if (sonidosBloqueado) return;
        if (op.word === sonidoActual.word) {
          sonidosBloqueado = true;
          btn.classList.add("correcta");
          sonidosFeedbackEl.textContent = "¡Muy bien! Es " + op.word;
          speak("¡Muy bien! " + op.word);
          setTimeout(nextSonidoRound, 2200);
        } else {
          btn.classList.add("incorrecta");
          speak("Inténtalo otra vez");
          setTimeout(function () { btn.classList.remove("incorrecta"); }, 700);
        }
      });
      sonidosOpcionesEl.appendChild(btn);
    });

    playSound(sonidoActual.sound);
  }

  sonidoPlayEl.addEventListener("click", function () {
    if (sonidoActual) playSound(sonidoActual.sound);
  });

  // ---------- CONCEPTOS ----------
  var conceptosContentEl = document.getElementById("conceptos-content");
  var conceptoDotsEl = document.getElementById("concepto-dots");

  function renderConcepto() {
    var pares = state.content.conceptos;
    var par = pares[state.conceptoIndex];
    conceptosContentEl.innerHTML = "";
    par.items.forEach(function (it, i) {
      var card = document.createElement("div");
      card.className = "concepto-card";
      card.innerHTML =
        '<img src="assets/pictos/' + it.file + '" alt="' + it.word + '">' +
        "<span>" + it.word + "</span>";
      card.addEventListener("click", function () {
        speak(it.word);
      });
      conceptosContentEl.appendChild(card);
      if (i === 0) {
        var vs = document.createElement("span");
        vs.className = "concepto-vs";
        vs.textContent = "🆚";
        conceptosContentEl.appendChild(vs);
      }
    });
    conceptoDotsEl.innerHTML = "";
    pares.forEach(function (_, i) {
      var dot = document.createElement("span");
      dot.className = "dot" + (i === state.conceptoIndex ? " active" : "");
      conceptoDotsEl.appendChild(dot);
    });
    speak(par.items[0].word + ". " + par.items[1].word + ".");
  }

  function buildConceptosScreen() {
    state.conceptoIndex = 0;
    renderConcepto();
  }

  document.getElementById("concepto-prev").addEventListener("click", function () {
    var n = state.content.conceptos.length;
    state.conceptoIndex = (state.conceptoIndex - 1 + n) % n;
    renderConcepto();
  });
  document.getElementById("concepto-next").addEventListener("click", function () {
    var n = state.content.conceptos.length;
    state.conceptoIndex = (state.conceptoIndex + 1) % n;
    renderConcepto();
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
