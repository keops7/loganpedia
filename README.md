# LoganPedia

App web para peques de 3 años, en español, con dos secciones:

- **Frases simples** — frases de 2-3 elementos (ej. *"El niño bebe agua"*) acompañadas de sus pictogramas.
- **Vocabulario** — dos niveles de dificultad por letra del abecedario:
  - **Fácil**: la palabra empieza por la letra elegida.
  - **Difícil**: la letra está dentro de la palabra, no al principio (ej. M → *almohada*).

Lee las palabras y frases en voz alta (español de España) con la síntesis de voz del navegador.
Instalable como app desde Safari (Añadir a pantalla de inicio) y funciona offline una vez cargada.

Alojado en **Cloudflare Pages**, conectado a este repo (`keops7/loganpedia`):
cada push a `main` publica automáticamente. No hay build: se sirve `public/` tal cual.

## Estructura

- `public/` — todo lo que se publica.
  - `index.html`, `style.css`, `app.js` — la app.
  - `manifest.json`, `sw.js`, `icons/` — PWA instalable + caché offline.
  - `content/content.json` — frases y vocabulario con sus pictogramas.
  - `assets/pictos/` — imágenes de [ARASAAC](https://arasaac.org) descargadas para cada palabra.
- `content/words_source.json` — listas de palabras origen (frases y letras) usadas para generar `content.json`.
- `scripts/fetch_pictos.py` — busca cada palabra en la API de ARASAAC, descarga su pictograma y genera `public/content/content.json`. Reutiliza lo ya descargado si se vuelve a ejecutar.
- `scripts/make_icons.py` — genera los iconos de la app (`public/icons/`).

## Ajustes del proyecto en Cloudflare Pages

| Campo | Valor |
|---|---|
| Production branch | `main` |
| Framework preset | None |
| Build command | *(vacío)* |
| Deploy command | *(vacío)* |
| Build output directory | `public` |
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

## Pendiente

- Elegir/confirmar el pictograma de algunas palabras poco comunes (K, Q, W, X, Ñ tienen pocas opciones en español).
- Conectar el repo a un proyecto de Cloudflare Pages (ver tabla de ajustes arriba).
