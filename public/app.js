(function () {
  "use strict";

  var state = {
    content: null,
    fraseIndex: 0,
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
    // goTo primero: corta voz/sonido en curso, y si fuera despues cortaria el
    // sonido que arranca la ronda de ¿Qué suena? nada mas entrar al capitulo.
    goTo(target);
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
      renderFrase();
    }
    if (target === "papas") {
      renderPapas();
    }
    if (target === "dobble") {
      startDobble();
    }
  });

  // ---------- VOZ ----------
  var spanishVoice = null;
  function pickVoice() {
    var voices = window.speechSynthesis.getVoices();
    var esVoices = voices.filter(function (v) { return v.lang === "es-ES"; });
    if (!esVoices.length) {
      esVoices = voices.filter(function (v) { return v.lang && v.lang.indexOf("es") === 0; });
    }
    // Confirmado en el iPad del usuario: las voces "de Siri" (ej. "Voz 2 de Siri"
    // elegida en Ajustes) NO se exponen a las paginas web via speechSynthesis,
    // asi que no se pueden usar aqui aunque el sistema las use en otros sitios.
    // Las es-ES que si llegan a la web incluyen voces "de personaje"/efecto que
    // trae iOS desde hace anios (Shelley, Grandma, Grandpa, Rocko, Sandy, Flo,
    // Eddy, Reed...), pensadas para gracietas, no para narrar. "Monica" es la
    // unica voz seria de ese lote, asi que se prioriza por nombre explicitamente.
    var goodNames = /^m[oó]nica$/i;
    var quality = /enhanced|premium|mejorad|neural/i;
    spanishVoice =
      esVoices.find(function (v) { return goodNames.test(v.name); }) ||
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
  // Un unico elemento Audio reutilizado: iOS solo deja reproducir sin gesto del
  // usuario en un elemento que ya se haya "desbloqueado" con un toque, asi que
  // crear un Audio nuevo por ronda impedia el autoplay de las rondas siguientes.
  var soundAudio = new Audio();
  function stopSound() {
    soundAudio.pause();
  }
  function playSound(filename) {
    stopSound();
    if (state.muted) return;
    soundAudio.src = "assets/sounds/" + filename;
    soundAudio.currentTime = 0;
    soundAudio.play().catch(function () {});
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

  // ---------- ORDEN DIARIO ----------
  // Cada dia (fecha local) todas las listas se barajan con una semilla distinta:
  // mismo orden durante todo el dia, orden nuevo al dia siguiente, sin servidor.
  function hashStr(s) {
    var h = 2166136261;
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
  function seededRandom(seed) {
    return function () {
      seed = (seed + 0x6D2B79F5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function shuffleDailyList(arr, key) {
    var d = new Date();
    var day = d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
    var rnd = seededRandom(hashStr(key + "|" + day));
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(rnd() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
  }
  function shuffleContentDaily(data) {
    shuffleDailyList(data.sentences, "frases");
    shuffleDailyList(data.conceptos, "conceptos");
    Object.keys(data.letters).forEach(function (l) {
      shuffleDailyList(data.letters[l].facil, "letra-" + l + "-facil");
      shuffleDailyList(data.letters[l].dificil, "letra-" + l + "-dificil");
    });
  }

  // ---------- CARGA DE CONTENIDO ----------
  fetch("content/content.json", { cache: "no-cache" })
    .then(function (r) { return r.json(); })
    .then(function (data) {
      state.content = data;
      shuffleContentDaily(data);
      buildFraseScreen();
      buildLetrasGrid();
      buildLibreBank();
      buildCapitulosScreen();
      buildConceptosScreen();
    })
    .catch(function (err) {
      console.error("No se pudo cargar el contenido", err);
    });

  // ---------- FRASES SIMPLES ----------
  var fraseTextEl = document.getElementById("frase-text");
  var fraseDotsEl = document.getElementById("frase-dots");
  var fraseVideoEl = document.getElementById("frase-video");
  var fraseVideoWrapEl = document.getElementById("frase-video-wrap");

  function renderFrase() {
    var s = state.content.sentences[state.fraseIndex];
    fraseTextEl.textContent = s.text;

    var src = "assets/videos/" + s.video;
    if (fraseVideoEl.getAttribute("src") !== src) {
      fraseVideoEl.setAttribute("src", src);
    }
    fraseVideoEl.play().catch(function () {});

    fraseDotsEl.innerHTML = "";
    state.content.sentences.forEach(function (_, i) {
      var dot = document.createElement("span");
      dot.className = "dot" + (i === state.fraseIndex ? " active" : "");
      fraseDotsEl.appendChild(dot);
    });
  }

  fraseVideoWrapEl.addEventListener("click", function () {
    speak(state.content.sentences[state.fraseIndex].text);
  });

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

  // ---------- DOBBLE ----------
  // Dos tarjetas con N dibujos cada una y exactamente UNO en comun: el nino toca
  // el repetido. Empieza con 4 por tarjeta y sube 1 por ronda hasta 7.
  var DOBBLE_MIN = 4;
  var DOBBLE_MAX = 7;
  // Casi iguales entre si: si coincidieran en una ronda el juego seria injusto.
  var DOBBLE_EXCLUIDOS = ["coche de carreras", "tranvía", "lancha"];
  var DOBBLE_TAM = { 4: 34, 5: 31, 6: 28, 7: 25 };
  var dobbleCardsEl = document.getElementById("dobble-cards");
  var dobbleFeedbackEl = document.getElementById("dobble-feedback");
  var dobbleNivelesEl = document.getElementById("dobble-niveles");
  var dobbleRonda = 0;
  var dobbleComun = null;
  var dobbleBloqueado = false;

  function dobblePool() {
    var vistos = {};
    var pool = [];
    state.content.sonidos.capitulos.forEach(function (cap) {
      cap.items.forEach(function (it) {
        if (vistos[it.word] || DOBBLE_EXCLUIDOS.indexOf(it.word) >= 0) return;
        vistos[it.word] = true;
        pool.push({ word: it.word, file: it.file });
      });
    });
    return pool;
  }

  // Posiciones (en % de la tarjeta, centro del dibujo) en anillo; con 7 el septimo va en el centro.
  function dobbleLayout(n) {
    var s = DOBBLE_TAM[n];
    var enAnillo = n === 7 ? 6 : n;
    var r = 50 - s / 2 - 3;
    var off = Math.random() * Math.PI * 2;
    var pos = [];
    for (var i = 0; i < enAnillo; i++) {
      var a = off + (i * 2 * Math.PI) / enAnillo;
      pos.push({ x: 50 + r * Math.cos(a), y: 50 + r * Math.sin(a), s: s });
    }
    if (n === 7) pos.push({ x: 50, y: 50, s: s });
    return shuffle(pos);
  }

  function dobbleCard(items, n) {
    var card = document.createElement("div");
    card.className = "dobble-card";
    var pos = dobbleLayout(n);
    items.forEach(function (it, i) {
      var p = pos[i];
      var btn = document.createElement("button");
      btn.className = "dobble-item";
      btn.setAttribute("data-word", it.word);
      btn.setAttribute("aria-label", it.word);
      btn.style.width = p.s + "%";
      btn.style.height = p.s + "%";
      btn.style.left = p.x - p.s / 2 + "%";
      btn.style.top = p.y - p.s / 2 + "%";
      var img = document.createElement("img");
      img.src = "assets/pictos/" + it.file;
      img.alt = "";
      img.style.transform = "rotate(" + Math.round(Math.random() * 50 - 25) + "deg)";
      btn.appendChild(img);
      btn.addEventListener("click", function () { dobbleToque(btn, it); });
      card.appendChild(btn);
    });
    return card;
  }

  function renderDobble() {
    var n = Math.min(DOBBLE_MAX, DOBBLE_MIN + dobbleRonda);
    var pool = shuffle(dobblePool());
    var previo = dobbleComun ? dobbleComun.word : null;
    var comun = pool.filter(function (it) { return it.word !== previo; })[0];
    var resto = pool.filter(function (it) { return it.word !== comun.word; });
    var a = shuffle([comun].concat(resto.slice(0, n - 1)));
    var b = shuffle([comun].concat(resto.slice(n - 1, 2 * (n - 1))));
    dobbleComun = comun;
    dobbleBloqueado = false;
    dobbleFeedbackEl.textContent = "";
    dobbleCardsEl.innerHTML = "";
    dobbleCardsEl.appendChild(dobbleCard(a, n));
    dobbleCardsEl.appendChild(dobbleCard(b, n));

    dobbleNivelesEl.innerHTML = "";
    for (var lvl = DOBBLE_MIN; lvl <= DOBBLE_MAX; lvl++) {
      var dot = document.createElement("span");
      dot.className = "dot" + (lvl <= n ? " active" : "");
      dobbleNivelesEl.appendChild(dot);
    }
  }

  function dobbleToque(btn, it) {
    if (dobbleBloqueado) return;
    if (it.word === dobbleComun.word) {
      dobbleBloqueado = true;
      dobbleCardsEl.querySelectorAll('.dobble-item[data-word="' + it.word + '"]').forEach(function (el) {
        el.classList.add("correcta");
      });
      dobbleFeedbackEl.textContent = "¡Muy bien! " + it.word;
      speak("¡Muy bien! " + it.word);
      dobbleRonda++;
      setTimeout(renderDobble, 2600);
    } else {
      btn.classList.remove("incorrecta");
      void btn.offsetWidth;
      btn.classList.add("incorrecta");
      speak("Inténtalo otra vez");
    }
  }

  function startDobble() {
    if (!state.content) return;
    dobbleRonda = 0;
    dobbleComun = null;
    renderDobble();
  }

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
  }

  // ---------- SERVICE WORKER ----------
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("sw.js").catch(function () {});
    });
  }
})();
