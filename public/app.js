(function () {
  "use strict";

  var state = {
    content: null,
    fraseIndex: 0,
    fraseStep: 0,
    nivel: "facil",
    letra: null,
    palabraIndex: 0,
    conceptoIndex: 0,
    sonidoCapitulo: 0,
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
    var video = document.getElementById("frase-video");
    if (video) video.pause();
  }

  document.body.addEventListener("click", function (e) {
    var btn = e.target.closest("[data-go]");
    if (!btn) return;
    var target = btn.getAttribute("data-go");
    if (target === "vocab-letras" && btn.dataset.nivel) {
      state.nivel = btn.dataset.nivel;
      buildLetrasGrid();
    }
    if (target === "sonidos" && btn.dataset.capitulo !== undefined) {
      state.sonidoCapitulo = parseInt(btn.dataset.capitulo, 10);
      sonidoAnteriorWord = null;
      nextSonidoRound();
    }
    if (target === "frases" && state.content) {
      state.fraseStep = 0;
      renderFrase();
    }
    if (target === "papas") {
      renderPapas();
    }
    goTo(target);
  });

  // ---------- VOZ ----------
  var spanishVoice = null;
  function pickVoice() {
    var voices = window.speechSynthesis.getVoices();
    var esVoices = voices.filter(function (v) { return v.lang === "es-ES"; });
    if (!esVoices.length) {
      esVoices = voices.filter(function (v) { return v.lang && v.lang.indexOf("es") === 0; });
    }
    // En iOS/Safari, si el usuario ha descargado una voz "Mejorada"/"Premium" en
    // Ajustes > Accesibilidad > Contenido hablado, aparece junto a la voz compacta
    // por defecto (mas robotica) con el mismo idioma: preferimos la de mas calidad.
    // Desde iOS 17, las voces neuronales nuevas (las mismas que usa Siri) se listan
    // ahi como "Voz 1".."Voz 5" / "Voice 1".."Voice 5" en vez de nombres clasicos
    // (Monica, Paulina...), asi que tambien se priorizan por ese patron de nombre.
    var quality = /enhanced|premium|mejorad|neural|^voz\s*\d|^voice\s*\d/i;
    spanishVoice =
      esVoices.find(function (v) { return quality.test(v.name); }) ||
      esVoices[0] ||
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
  fetch("content/content.json", { cache: "no-cache" })
    .then(function (r) { return r.json(); })
    .then(function (data) {
      state.content = data;
      buildFraseScreen();
      buildLetrasGrid();
      buildLibreBank();
      buildCapitulosScreen();
      buildConceptosScreen();
    })
    .catch(function (err) {
      console.error("No se pudo cargar el contenido", err);
    });

  // ---------- FRASES SIMPLES (juego de preguntas) ----------
  var fraseTextEl = document.getElementById("frase-text");
  var fraseDotsEl = document.getElementById("frase-dots");
  var fraseSujetoEl = document.getElementById("frase-sujeto");
  var fraseObjetoEl = document.getElementById("frase-objeto");
  var fraseFxEl = document.getElementById("frase-fx");
  var fraseVideoEl = document.getElementById("frase-video");
  var fraseEscenaEl = document.getElementById("frase-escena");
  var qaStepsEl = document.getElementById("qa-steps");
  var qaPreguntaEl = document.getElementById("qa-pregunta");
  var qaPictoWrapEl = document.getElementById("qa-picto-wrap");
  var qaPictoEl = document.getElementById("qa-picto");
  var qaDecirBtnEl = document.getElementById("qa-decir-btn");
  var qaRevealEl = document.getElementById("qa-reveal");
  var qaRepetirBtnEl = document.getElementById("qa-repetir-btn");
  var fraseBloqueado = false;

  var FAMILY_CLASS = {
    sip: "anim-sip",
    munch: "anim-munch",
    sleep: "anim-sleep",
    read: "anim-read",
    art: "anim-art",
    bounce: "anim-bounce",
    shine: "anim-shine",
    drive: "anim-drive",
    wash: "anim-wash",
    stir: "anim-stir",
    cry: "anim-cry",
    fall: "anim-idle",
    bob: "anim-idle",
  };

  var FX_SPEC = {
    sip: { emoji: "💧", cls: "fx-rise", dur: 1.4, pos: [[64, 50], [72, 38]] },
    shine: { emoji: "✨", cls: "fx-pop", dur: 1.3, pos: [[18, 15], [78, 12], [50, 55]] },
    sleep: { emoji: "z", cls: "fx-rise", dur: 2.2, pos: [[14, 25], [22, 10]] },
    fall: { emoji: "💧", cls: "fx-fall", dur: 1.5, pos: [[12, 0], [34, 0], [56, 0], [80, 0]] },
    wash: { emoji: "🫧", cls: "fx-rise", dur: 1.6, pos: [[58, 55], [68, 45]] },
    stir: { emoji: "💨", cls: "fx-rise", dur: 1.8, pos: [[50, 35]] },
    cry: { emoji: "💧", cls: "fx-fall", dur: 1.1, pos: [[26, 30]] },
    hug: { emoji: "💕", cls: "fx-pop", dur: 1.2, pos: [[44, 30], [56, 20]] },
  };

  function renderFx(anim) {
    fraseFxEl.innerHTML = "";
    var spec = FX_SPEC[anim];
    if (!spec) return;
    spec.pos.forEach(function (p, i) {
      var span = document.createElement("span");
      span.className = "fx-item " + spec.cls;
      span.textContent = spec.emoji;
      span.style.left = p[0] + "%";
      span.style.top = p[1] + "%";
      span.style.animationDuration = spec.dur + "s";
      span.style.animationDelay = i * 0.4 + "s";
      fraseFxEl.appendChild(span);
    });
  }

  function wordDelay(text) {
    return Math.max(900, Math.min(2200, 700 + text.length * 70));
  }
  function sentenceDelay(text) {
    return Math.max(1500, Math.min(4000, 900 + text.length * 45));
  }

  function renderEscenaReveal(s) {
    fraseTextEl.textContent = s.text;

    if (s.video) {
      fraseEscenaEl.hidden = true;
      fraseVideoEl.hidden = false;
      var src = "assets/videos/" + s.video;
      if (fraseVideoEl.getAttribute("src") !== src) {
        fraseVideoEl.setAttribute("src", src);
      }
      fraseVideoEl.play().catch(function () {});
      return;
    }

    fraseVideoEl.hidden = true;
    fraseVideoEl.removeAttribute("src");
    fraseEscenaEl.hidden = false;

    var sujeto = s.pictos[0];
    var objeto = s.pictos[s.pictos.length - 1];
    fraseSujetoEl.src = "assets/pictos/" + sujeto.file;
    fraseSujetoEl.alt = sujeto.word;
    fraseObjetoEl.src = "assets/pictos/" + objeto.file;
    fraseObjetoEl.alt = objeto.word;

    fraseSujetoEl.className = "escena-picto escena-sujeto";
    fraseObjetoEl.className = "escena-picto escena-objeto";
    if (s.anim === "hug") {
      fraseSujetoEl.classList.add("anim-hug-a");
      fraseObjetoEl.classList.add("anim-hug-b");
    } else {
      fraseSujetoEl.classList.add("anim-idle");
      fraseObjetoEl.classList.add(FAMILY_CLASS[s.anim] || "anim-idle");
    }
    renderFx(s.anim);
  }

  function renderQaSteps(n) {
    qaStepsEl.innerHTML = "";
    for (var i = 0; i < n; i++) {
      var dot = document.createElement("span");
      var cls = "qa-step-dot";
      if (i < state.fraseStep) cls += " qa-step-done";
      else if (i === state.fraseStep) cls += " qa-step-current";
      dot.className = cls;
      qaStepsEl.appendChild(dot);
    }
  }

  function renderFrase() {
    var s = state.content.sentences[state.fraseIndex];
    var n = s.pictos.length;
    fraseBloqueado = false;
    renderQaSteps(n);

    if (state.fraseStep < n) {
      qaPictoWrapEl.hidden = false;
      qaDecirBtnEl.hidden = true;
      qaRevealEl.hidden = true;
      var picto = s.pictos[state.fraseStep];
      qaPictoEl.src = "assets/pictos/" + picto.file;
      qaPictoEl.alt = picto.word;
      qaPreguntaEl.textContent = s.preguntas[state.fraseStep];
      speak(s.preguntas[state.fraseStep]);
    } else if (state.fraseStep === n) {
      qaPictoWrapEl.hidden = true;
      qaDecirBtnEl.hidden = false;
      qaRevealEl.hidden = true;
      qaPreguntaEl.textContent = "¿Puedes decir la frase tú solo?";
      speak("¿Puedes decir la frase tú solo?");
    } else {
      qaPictoWrapEl.hidden = true;
      qaDecirBtnEl.hidden = true;
      qaPreguntaEl.textContent = "";
      qaRevealEl.hidden = false;
      renderEscenaReveal(s);
    }

    fraseDotsEl.innerHTML = "";
    state.content.sentences.forEach(function (_, i) {
      var dot = document.createElement("span");
      dot.className = "dot" + (i === state.fraseIndex ? " active" : "");
      fraseDotsEl.appendChild(dot);
    });
  }

  qaPictoWrapEl.addEventListener("click", function () {
    if (fraseBloqueado) return;
    fraseBloqueado = true;
    var s = state.content.sentences[state.fraseIndex];
    var word = s.pictos[state.fraseStep].word;
    speak(word);
    setTimeout(function () {
      state.fraseStep++;
      renderFrase();
    }, state.muted ? 350 : wordDelay(word));
  });

  qaDecirBtnEl.addEventListener("click", function () {
    if (fraseBloqueado) return;
    fraseBloqueado = true;
    var s = state.content.sentences[state.fraseIndex];
    speak(s.text);
    setTimeout(function () {
      state.fraseStep++;
      renderFrase();
    }, state.muted ? 350 : sentenceDelay(s.text));
  });

  qaRepetirBtnEl.addEventListener("click", function (e) {
    e.stopPropagation();
    speak(state.content.sentences[state.fraseIndex].text);
  });

  fraseSujetoEl.addEventListener("click", function (e) {
    e.stopPropagation();
    speak(fraseSujetoEl.alt);
  });
  fraseObjetoEl.addEventListener("click", function (e) {
    e.stopPropagation();
    speak(fraseObjetoEl.alt);
  });

  function buildFraseScreen() {
    state.fraseIndex = 0;
    state.fraseStep = 0;
    renderFrase();
  }

  document.getElementById("frase-prev").addEventListener("click", function () {
    var n = state.content.sentences.length;
    state.fraseIndex = (state.fraseIndex - 1 + n) % n;
    state.fraseStep = 0;
    renderFrase();
  });
  document.getElementById("frase-next").addEventListener("click", function () {
    var n = state.content.sentences.length;
    state.fraseIndex = (state.fraseIndex + 1) % n;
    state.fraseStep = 0;
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

  // ---------- SONIDOS: CAPITULOS ----------
  var capitulosCardsEl = document.getElementById("capitulos-cards");
  var sonidosTituloEl = document.getElementById("sonidos-titulo");

  function buildCapitulosScreen() {
    capitulosCardsEl.innerHTML = "";
    state.content.sonidos.capitulos.forEach(function (cap, i) {
      var btn = document.createElement("button");
      btn.className = "capitulo-card";
      btn.setAttribute("data-go", "sonidos");
      btn.setAttribute("data-capitulo", i);
      btn.innerHTML =
        '<span class="capitulo-emoji" aria-hidden="true">' + cap.emoji + "</span>" +
        '<span class="capitulo-num">Capítulo ' + (i + 1) + "</span>" +
        '<span class="capitulo-titulo">' + cap.titulo + "</span>";
      capitulosCardsEl.appendChild(btn);
    });
  }

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
    var cap = state.content.sonidos.capitulos[state.sonidoCapitulo];
    sonidosTituloEl.textContent = cap.emoji + " " + cap.titulo;
    var banco = cap.items;
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

  // ---------- ESTADISTICAS DE VOCABULARIO (para el Área para papás) ----------
  var VOCAB_STATS_KEY = "loganpedia_vocab_stats";

  function loadVocabStats() {
    var stats = {};
    LETRAS.forEach(function (l) { stats[l] = 0; });
    try {
      var raw = localStorage.getItem(VOCAB_STATS_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        LETRAS.forEach(function (l) {
          if (typeof parsed[l] === "number") stats[l] = parsed[l];
        });
      }
    } catch (e) {}
    return stats;
  }

  function registrarVisitaLetra(letra) {
    try {
      var stats = loadVocabStats();
      stats[letra] = (stats[letra] || 0) + 1;
      localStorage.setItem(VOCAB_STATS_KEY, JSON.stringify(stats));
    } catch (e) {}
  }

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
          registrarVisitaLetra(letra);
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
    window.speechSynthesis.cancel();
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

  // ---------- AREA PARA PAPAS ----------
  var papasResumenEl = document.getElementById("papas-resumen");
  var papasRankingEl = document.getElementById("papas-ranking");
  var papasSinExplorarEl = document.getElementById("papas-sin-explorar");

  function renderPapas() {
    var stats = loadVocabStats();
    var vistas = LETRAS.filter(function (l) { return stats[l] > 0; });
    var sinVer = LETRAS.filter(function (l) { return !stats[l]; });

    papasResumenEl.textContent = vistas.length + " de " + LETRAS.length + " letras exploradas";

    papasRankingEl.innerHTML = "";
    if (vistas.length === 0) {
      var vacio = document.createElement("p");
      vacio.className = "papas-vacio";
      vacio.textContent = "Logan todavía no ha explorado ninguna letra.";
      papasRankingEl.appendChild(vacio);
    } else {
      vistas
        .slice()
        .sort(function (a, b) { return stats[b] - stats[a]; })
        .forEach(function (l, i) {
          var row = document.createElement("div");
          row.className = "papas-row";
          row.innerHTML =
            '<span class="papas-row-pos">' + (i + 1) + "</span>" +
            '<span class="papas-row-letra">' + l + "</span>" +
            '<span class="papas-row-veces">' + stats[l] + (stats[l] === 1 ? " vez" : " veces") + "</span>";
          papasRankingEl.appendChild(row);
        });
    }

    papasSinExplorarEl.innerHTML = "";
    if (sinVer.length === 0) {
      var todas = document.createElement("p");
      todas.className = "papas-vacio";
      todas.textContent = "¡Logan ha explorado todas las letras!";
      papasSinExplorarEl.appendChild(todas);
    } else {
      sinVer.forEach(function (l) {
        var chip = document.createElement("span");
        chip.className = "papas-chip";
        chip.textContent = l;
        papasSinExplorarEl.appendChild(chip);
      });
    }

    var papasVozActualEl = document.getElementById("papas-voz-actual");
    var papasVocesEl = document.getElementById("papas-voces");
    if (papasVozActualEl && papasVocesEl) {
      papasVozActualEl.textContent = spanishVoice
        ? "La app está usando: " + spanishVoice.name + " (" + spanishVoice.lang + ")"
        : "La app no ha encontrado ninguna voz en español instalada.";
      papasVocesEl.innerHTML = "";
      var todasVoces = ("speechSynthesis" in window) ? window.speechSynthesis.getVoices() : [];
      if (!todasVoces.length) {
        var sinVoces = document.createElement("p");
        sinVoces.className = "papas-vacio";
        sinVoces.textContent = "El navegador todavía no ha listado ninguna voz.";
        papasVocesEl.appendChild(sinVoces);
      } else {
        todasVoces.forEach(function (v) {
          var row = document.createElement("div");
          row.className = "papas-row papas-voz-row";
          row.innerHTML =
            '<span class="papas-row-letra papas-voz-nombre">' + v.name + "</span>" +
            '<span class="papas-row-veces">' + v.lang + "</span>";
          papasVocesEl.appendChild(row);
        });
      }
    }
  }

  // ---------- SERVICE WORKER ----------
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("sw.js").catch(function () {});
    });
  }
})();
