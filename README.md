# LoganPedia

App web para peques de 3 años, en español, con cinco secciones:

- **Frases simples** — frases de 2-3 elementos (ej. *"El niño bebe agua"*) mostradas como una pequeña escena animada
  (CSS, no GIFs de internet: sin problemas de derechos ni de estilo) con sus pictogramas debajo, tocables uno a uno.
- **Vocabulario** — la sección con más contenido de la app, al menos 20 palabras por letra del abecedario
  (menos en K, Q, W, X, Ñ, I, U: el español no tiene 20 palabras reales para niños que empiecen por esas letras),
  en dos niveles de dificultad:
  - **Fácil**: la palabra empieza por la letra elegida.
  - **Difícil**: la letra está dentro de la palabra, no al principio (ej. M → *almohada*).
- **Frase libre** — banco de pictogramas de vocabulario nuclear (CAA); el niño toca varios para construir su propia frase y la app la lee en voz alta.
- **¿Qué suena?** — juego de discriminación auditiva: suena un audio real (ladrido, maullido, bocina...) y el niño toca el pictograma correspondiente entre 3 opciones, con avance automático al acertar y sin penalización al fallar.
- **Conceptos** — pares de opuestos básicos (grande/pequeño, arriba/abajo, dentro/fuera...) en el mismo formato de carrusel que Frases simples.

Lee las palabras y frases en voz alta (español de España) con la síntesis de voz del navegador.
Instalable como app desde Safari (Añadir a pantalla de inicio) y funciona offline una vez cargada.

Alojado en **Cloudflare Workers** (assets estáticos), conectado a este repo (`keops7/loganpedia`):
cada push a `main` publica automáticamente. No hay build: `wrangler.jsonc` sirve `public/` tal cual.

## Estructura

- `public/` — todo lo que se publica.
  - `index.html`, `style.css`, `app.js` — la app.
  - `manifest.json`, `sw.js`, `icons/` — PWA instalable + caché offline.
  - `content/content.json` — frases, vocabulario, sonidos, conceptos y banco de frase libre, con sus pictogramas.
  - `assets/pictos/` — imágenes de [ARASAAC](https://arasaac.org) descargadas para cada palabra.
  - `assets/sounds/` — los 10 audios reales de "¿Qué suena?" (ver licencias abajo).
- `content/words_source.json` — listas de palabras origen (frases, letras, sonidos, conceptos, banco de frase libre) usadas para generar `content.json`.
- `scripts/fetch_pictos.py` — busca cada palabra en la API de ARASAAC, descarga su pictograma y genera `public/content/content.json`. Reutiliza lo ya descargado si se vuelve a ejecutar.
- `scripts/make_icons.py` — genera los iconos de la app (`public/icons/`).
- `wrangler.jsonc` — le dice a Cloudflare que sirva `public/` como sitio estático (sin código de Worker).

## Ajustes del proyecto en Cloudflare (Workers, flujo "Conectar a Git")

| Campo | Valor |
|---|---|
| Production branch | `main` |
| Build command | *(vacío)* |
| Deploy command | `npx wrangler deploy` |
| Root directory | `/` |

## Desarrollo local

```bash
python -m http.server 8123 --directory public
```

## Ampliar contenido

Añade palabras/frases en `content/words_source.json` y ejecuta:

```bash
python scripts/fetch_pictos.py
```

## Pictogramas

Los pictogramas son © [ARASAAC](https://arasaac.org) (Gobierno de Aragón), usados bajo su licencia
Creative Commons (BY-NC-SA), que permite este uso no comercial.

Si el primer resultado de ARASAAC para una palabra no es el más claro (ambiguo, poco representativo...),
se puede forzar un pictograma concreto añadiendo su id al diccionario `OVERRIDES` en `scripts/fetch_pictos.py`.

## Sonidos

Los 10 audios de "¿Qué suena?" (`public/assets/sounds/`) son grabaciones reales recortadas y niveladas a mano
(no voz sintética), descargadas de bancos de sonido gratuitos:

- **Mixkit** (`perro`, `gato`, `vaca`, `reloj`) — [Mixkit Free Sound Effects License](https://mixkit.co/license/#sfxFree), uso libre sin atribución.
- **Pixabay** (`oveja`, `pato`, `coche`, `tren`, `abeja`, `campana`) — [Pixabay Content License](https://pixabay.com/service/license-summary/), uso libre sin atribución.

Para añadir o cambiar un sonido: descargar el audio, recortarlo a 1-3s con `ffmpeg` y guardarlo en
`public/assets/sounds/<palabra>.mp3`, luego apuntar el nombre de fichero en el campo `"sound"` de la
entrada correspondiente en `content/words_source.json` (sección `sonidos`) y volver a ejecutar
`scripts/fetch_pictos.py`.

## Escena animada de "Frases simples"

Cada frase tiene una familia de animación (campo `"anim"` en `content/words_source.json`, ej. `sip`, `munch`,
`sleep`, `read`, `art`, `bounce`, `shine`, `drive`, `wash`, `stir`, `cry`, `hug`, `fall`) definida en `style.css`
como clases `.anim-*` con `@keyframes` reutilizables, aplicadas al sujeto y al objeto de la frase (los dos
pictogramas que se muestran grandes en el escenario). Para añadir una frase nueva, basta con elegir la familia
que mejor encaje con su verbo; si ninguna encaja, se usa `bob` (balanceo suave) por defecto.

## Pendiente

- Elegir/confirmar el pictograma de algunas palabras poco comunes (K, Q, W, X, Ñ tienen pocas opciones en español).
