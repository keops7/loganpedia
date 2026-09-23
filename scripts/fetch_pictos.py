import json
import os
import time
import unicodedata
import requests

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(BASE, "content", "words_source.json")
OUT_JSON = os.path.join(BASE, "public", "content", "content.json")
PICTO_DIR = os.path.join(BASE, "public", "assets", "pictos")
os.makedirs(PICTO_DIR, exist_ok=True)

SEARCH_URL = "https://api.arasaac.org/api/pictograms/es/search/{}"
IMG_URL = "https://static.arasaac.org/pictograms/{id}/{id}_500.png"

# Palabras donde el primer resultado de ARASAAC no es el mas claro para un
# nino de 3 anos (ambiguo, poco representativo...); forzamos un id concreto.
OVERRIDES = {
    "querer": 5441,  # mano alcanzando algo (desear/pedir), no el de "querer" romantico
    "día": 26799,    # casa con sol (pareja visual de "noche" = casa con luna), no un calendario
    "cielo": 38270,  # cielo azul de dia con nubes, no un cielo nocturno estrellado
}

session = requests.Session()
session.headers.update({"User-Agent": "LoganPedia-kids-app/1.0"})


def slug(word):
    nfkd = unicodedata.normalize("NFKD", word)
    ascii_str = "".join(c for c in nfkd if not unicodedata.combining(c))
    return ascii_str.lower().replace(" ", "_")


def pick_best(results, word):
    if not results:
        return None
    word_l = word.lower()
    exact = [r for r in results if any(k.get("keyword", "").lower() == word_l for k in r.get("keywords", []))]
    pool = exact if exact else results
    aac = [r for r in pool if r.get("aac")]
    pool = aac if aac else pool
    safe = [r for r in pool if not r.get("violence") and not r.get("sex")]
    pool = safe if safe else pool
    return pool[0]


cache = {}
if os.path.exists(OUT_JSON):
    try:
        with open(OUT_JSON, "r", encoding="utf-8") as f:
            prev = json.load(f)
        cache = prev.get("_picto_cache", {})
    except Exception:
        cache = {}


def resolve_word(word):
    forced_id = OVERRIDES.get(word)
    if word in cache:
        entry = cache[word]
        local_path = os.path.join(PICTO_DIR, entry["file"])
        if os.path.exists(local_path) and (forced_id is None or entry["id"] == forced_id):
            return entry

    if forced_id is not None:
        picto_id = forced_id
        print(f"  forzando picto {picto_id} para: {word}")
    else:
        print(f"  buscando: {word}")
        try:
            resp = session.get(SEARCH_URL.format(word), timeout=15)
            resp.raise_for_status()
            results = resp.json()
        except Exception as e:
            print(f"  ERROR buscando '{word}': {e}")
            return None
        best = pick_best(results, word)
        if not best:
            print(f"  SIN RESULTADOS para '{word}'")
            return None
        picto_id = best["_id"]
    filename = f"{slug(word)}_{picto_id}.png"
    local_path = os.path.join(PICTO_DIR, filename)
    if not os.path.exists(local_path):
        img_resp = session.get(IMG_URL.format(id=picto_id), timeout=20)
        img_resp.raise_for_status()
        with open(local_path, "wb") as f:
            f.write(img_resp.content)
    time.sleep(0.15)
    entry = {"id": picto_id, "file": filename}
    cache[word] = entry
    return entry


def main():
    with open(SRC, "r", encoding="utf-8") as f:
        source = json.load(f)

    missing = []

    print("=== Frases simples ===")
    sentences_out = []
    for s in source["sentences"]:
        pictos = []
        labels = s.get("labels", s["words"])
        for i, w in enumerate(s["words"]):
            entry = resolve_word(w)
            if entry:
                label = labels[i] if i < len(labels) else w
                pictos.append({"word": label, "file": entry["file"]})
            else:
                missing.append(f"frase:{s['text']} -> {w}")
        sentences_out.append({
            "text": s["text"],
            "pictos": pictos,
            "anim": s.get("anim", "bob"),
            "video": s.get("video"),
            "preguntas": s.get("preguntas", []),
        })

    print("=== Vocabulario ===")
    letters_out = {}
    for letter, diffs in source["letters"].items():
        letters_out[letter] = {}
        for level in ("facil", "dificil"):
            words = diffs.get(level, [])
            items = []
            for w in words:
                entry = resolve_word(w)
                if entry:
                    items.append({"word": w, "file": entry["file"]})
                else:
                    missing.append(f"{letter}/{level} -> {w}")
            letters_out[letter][level] = items

    print("=== Sonidos ===")
    capitulos_out = []
    for cap in source.get("sonidos", {}).get("capitulos", []):
        items_out = []
        for item in cap["items"]:
            w = item["word"]
            entry = resolve_word(w)
            if entry:
                items_out.append({
                    "word": w,
                    "file": entry["file"],
                    "sound": item["sound"],
                })
            else:
                missing.append(f"sonidos/{cap['titulo']} -> {w}")
        capitulos_out.append({
            "titulo": cap["titulo"],
            "emoji": cap.get("emoji", ""),
            "items": items_out,
        })

    print("=== Conceptos ===")
    conceptos_out = []
    for pair in source.get("conceptos", []):
        items = []
        ok = True
        for w in pair:
            entry = resolve_word(w)
            if entry:
                items.append({"word": w, "file": entry["file"]})
            else:
                missing.append(f"conceptos -> {w}")
                ok = False
        if ok:
            conceptos_out.append({"pair": pair, "items": items})

    print("=== Frase libre (banco) ===")
    libre_out = []
    for w in source.get("libre_bank", []):
        entry = resolve_word(w)
        if entry:
            libre_out.append({"word": w, "file": entry["file"]})
        else:
            missing.append(f"libre_bank -> {w}")

    result = {
        "sentences": sentences_out,
        "letters": letters_out,
        "sonidos": {"capitulos": capitulos_out},
        "conceptos": conceptos_out,
        "libre_bank": libre_out,
        "_picto_cache": cache,
    }
    with open(OUT_JSON, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    print(f"\nListo. Guardado en {OUT_JSON}")
    if missing:
        print(f"\nPalabras SIN pictograma ({len(missing)}):")
        for m in missing:
            print(f"  - {m}")


if __name__ == "__main__":
    main()
