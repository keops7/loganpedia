# LoganPedia

App web para peques de 3 años, en español, con cinco secciones:

- **Frases simples** — frases de 2-3 elementos (ej. *"El niño bebe agua"*) acompañadas de sus pictogramas.
- **Vocabulario** — dos niveles de dificultad por letra del abecedario:
  - **Fácil**: la palabra empieza por la letra elegida.
  - **Difícil**: la letra está dentro de la palabra, no al principio (ej. M → *almohada*).
- **Frase libre** — banco de pictogramas de vocabulario nuclear (CAA); el niño toca varios para construir su propia frase y la app la lee en voz alta.
- **¿Qué suena?** — juego de discriminación auditiva: suena una onomatopeya y el niño toca el pictograma correspondiente entre 3 opciones, con avance automático al acertar y sin penalización al fallar.
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

## Pendiente

- Elegir/confirmar el pictograma de algunas palabras poco comunes (K, Q, W, X, Ñ tienen pocas opciones en español).
- Sonidos de "¿Qué suena?" son onomatopeyas dichas por la voz del navegador, no grabaciones reales — valorar sustituirlas por audio real más adelante.
