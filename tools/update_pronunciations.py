#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Audio Vocabulary Sprint — update local IPA from English Wiktionary.

Normal run:
  python3 tools/update_pronunciations.py

Recommended on macOS for long runs:
  caffeinate -i python3 tools/update_pronunciations.py

By default, customWords are read directly from the private GitHub
audio-vocabulary-sprint-data/progress.json. No local progress.json is needed.
The script uses GITHUB_TOKEN if present; otherwise it securely prompts for the
fine-grained token with hidden input. The token is never written to disk.

Retry genuine missing/no-IPA entries too:
  python3 tools/update_pronunciations.py --retry-missing

BASE_WORDS only, without GitHub:
  python3 tools/update_pronunciations.py --base-only
"""

import argparse
import base64
import getpass
import json
import os
import random
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

BASE_DELAY = 0.65
JITTER = 0.20
TIMEOUT = 10
MAX_RETRIES = 5
UA = "AudioVocabularySprint-PronunciationBuilder/1.4 (personal language-learning project)"

TRANSIENT_HTTP = {429, 500, 502, 503, 504}

def root():
    candidates = [Path.cwd(), Path(__file__).resolve().parent.parent]
    for p in candidates:
        if (p/"data"/"vocabulary.js").exists():
            return p
    raise SystemExit("Cannot find data/vocabulary.js. Run from the project root.")

def load_words(path):
    text = path.read_text(encoding="utf-8")
    m = re.search(r'window\.BASE_WORDS\s*=\s*(\[.*\])\s*;?\s*$', text, re.S)
    if not m:
        raise RuntimeError("Could not parse window.BASE_WORDS")
    return json.loads(m.group(1))


def normalise_words(words):
    out = []
    seen = set()
    for raw in words or []:
        w = str(raw or "").strip()
        k = w.lower()
        if not w or k in seen or k in {"a", "an", "the"} or k == "vc_vocabulary":
            continue
        seen.add(k)
        out.append(w)
    return out


GITHUB_OWNER = "zzZing0-0"
GITHUB_REPO = "audio-vocabulary-sprint-data"
GITHUB_PATH = "progress.json"
GITHUB_BRANCH = "main"

def github_progress_url(owner, repo, path, branch):
    encoded_path = "/".join(urllib.parse.quote(part, safe="") for part in path.split("/"))
    query = urllib.parse.urlencode({"ref": branch})
    return f"https://api.github.com/repos/{owner}/{repo}/contents/{encoded_path}?{query}"

def github_token():
    token = (os.environ.get("GITHUB_TOKEN") or "").strip()
    if token:
        return token
    print("GitHub token is required to read private progress.json.")
    print("Paste your fine-grained token here; input is hidden and is NOT saved.")
    return getpass.getpass("GitHub token: ").strip()

def load_cloud_custom_words(owner, repo, path, branch, token):
    if not token:
        raise SystemExit("No GitHub token supplied.")

    req = urllib.request.Request(
        github_progress_url(owner, repo, path, branch),
        headers={
            "User-Agent": UA,
            "Accept": "application/vnd.github+json",
            "Authorization": "Bearer " + token,
            "X-GitHub-Api-Version": "2022-11-28",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
            meta = json.loads(r.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        detail = ""
        try:
            detail = json.loads(e.read().decode("utf-8")).get("message", "")
        except Exception:
            pass
        raise SystemExit(f"GitHub {e.code}: {detail or e.reason}")
    except (TimeoutError, urllib.error.URLError) as e:
        raise SystemExit(f"Could not read GitHub progress.json: {e}")

    content = str(meta.get("content") or "").replace("\n", "")
    if not content:
        raise SystemExit("GitHub progress.json returned no content.")

    try:
        payload = json.loads(base64.b64decode(content).decode("utf-8"))
    except Exception as e:
        raise SystemExit(f"Could not decode GitHub progress.json: {e}")

    state = payload.get("state", payload) if isinstance(payload, dict) else {}
    if not isinstance(state, dict):
        raise SystemExit("GitHub progress.json has an unexpected format.")

    custom = normalise_words(state.get("customWords", []))
    removed_raw = state.get("removedWords", {})
    if isinstance(removed_raw, dict):
        removed = {str(w).lower() for w in removed_raw.keys()}
    elif isinstance(removed_raw, list):
        removed = {str(w).lower() for w in removed_raw}
    else:
        removed = set()
    return custom, removed

def load_db(path):
    if not path.exists():
        return {"_meta": {"source": "English Wiktionary"}, "words": {}}
    data = json.loads(path.read_text(encoding="utf-8"))
    if "words" not in data:
        data = {"_meta": {"source": "English Wiktionary"}, "words": data}
    return data

def save_db(path, db):
    db["_meta"] = {
        "source": "English Wiktionary",
        "format": 1,
        "note": "UK/US labels stored only when explicitly supported; fallback is unlabelled.",
        "entries": len(db["words"]),
    }
    tmp = path.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(db, ensure_ascii=False, indent=2, sort_keys=True), encoding="utf-8")
    tmp.replace(path)

def request_json(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
    last_err = None

    for attempt in range(MAX_RETRIES):
        try:
            with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
                return json.loads(r.read().decode("utf-8"))

        except urllib.error.HTTPError as e:
            last_err = e
            if e.code not in TRANSIENT_HTTP:
                raise
            retry_after = e.headers.get("Retry-After")
            if retry_after and retry_after.isdigit():
                wait = max(2.0, float(retry_after))
            else:
                wait = min(60.0, (2 ** attempt) * 3.0)
            print(f"      HTTP {e.code}; waiting {wait:.1f}s before retry {attempt+1}/{MAX_RETRIES}...")
            time.sleep(wait)

        except (TimeoutError, urllib.error.URLError) as e:
            last_err = e
            wait = min(45.0, (2 ** attempt) * 2.5)
            print(f"      {type(e).__name__}; waiting {wait:.1f}s before retry {attempt+1}/{MAX_RETRIES}...")
            time.sleep(wait)

    if isinstance(last_err, urllib.error.HTTPError):
        raise last_err
    raise last_err or RuntimeError("request failed")

def wikitext(word):
    params = urllib.parse.urlencode({
        "action": "parse",
        "page": word,
        "prop": "wikitext",
        "format": "json",
        "formatversion": "2",
        "origin": "*",
    })
    data = request_json("https://en.wiktionary.org/w/api.php?" + params)
    return ((data.get("parse") or {}).get("wikitext") or "")

def english_section(text):
    m = re.search(r'(?m)^==English==\s*$', text)
    if not m:
        return ""
    start = m.end()
    nxt = re.search(r'(?m)^==[^=].*?==\s*$', text[start:])
    return text[start:start+nxt.start()] if nxt else text[start:]

def pronunciation_sections(text):
    pieces = []
    for m in re.finditer(r'(?m)^={3,5}Pronunciation={3,5}\s*$', text):
        start = m.end()
        level = len(re.match(r'^=+', m.group(0)).group(0))
        nxt = re.search(r'(?m)^={%d}[^=].*?={%d}\s*$' % (level, level), text[start:])
        end = start + nxt.start() if nxt else len(text)
        pieces.append(text[start:end])
    return "\n".join(pieces)

IPA_RE = re.compile(r'\{\{IPA\|en\|([^{}]+?)\}\}', re.I)

def ipa_values(payload):
    vals, accent = [], None
    for p in (x.strip() for x in payload.split("|")):
        if p.startswith("a="):
            accent = p[2:].strip().lower()
        elif (p.startswith("/") and p.endswith("/")) or (p.startswith("[") and p.endswith("]")):
            vals.append(p)
    return vals, accent

def label_region(label):
    label = (label or "").lower()
    if any(x in label for x in ("uk", "british", "received pronunciation", "general british")):
        return "uk"
    if any(x in label for x in ("us", "american", "general american", "genam")):
        return "us"
    return None

def nearby_region(block, pos):
    left = block[max(0, pos-160):pos]
    labels = re.findall(r'\{\{(?:a|accent)\|([^{}]+?)\}\}', left, re.I)
    return label_region(labels[-1]) if labels else None

def first_unique(seq):
    seen = set()
    for x in seq:
        if x and x not in seen:
            return x
        seen.add(x)
    return None

def fetch(word):
    try:
        raw = wikitext(word)
    except urllib.error.HTTPError as e:
        return {"uk": None, "us": None, "fallback": None, "source": "wiktionary", "status": f"http_{e.code}"}
    except Exception as e:
        return {"uk": None, "us": None, "fallback": None, "source": "wiktionary", "status": f"error:{type(e).__name__}"}

    eng = english_section(raw)
    block = pronunciation_sections(eng)

    if not eng:
        return {"uk": None, "us": None, "fallback": None, "source": "wiktionary", "status": "no_english_section"}
    if not block:
        return {"uk": None, "us": None, "fallback": None, "source": "wiktionary", "status": "no_pronunciation_section"}

    found = {"uk": [], "us": [], "fallback": []}
    for m in IPA_RE.finditer(block):
        vals, accent = ipa_values(m.group(1))
        region = label_region(accent) or nearby_region(block, m.start()) or "fallback"
        found[region].extend(vals)

    uk = first_unique(found["uk"])
    us = first_unique(found["us"])
    fallback = first_unique(x for x in found["fallback"] if x not in {uk, us})
    status = "ok" if (uk or us or fallback) else "no_ipa"

    return {
        "uk": uk,
        "us": us,
        "fallback": fallback,
        "source": "wiktionary",
        "status": status,
    }

def is_transient_status(status):
    s = str(status or "")
    if s.startswith("error:"):
        return True
    if s.startswith("http_"):
        try:
            return int(s.split("_", 1)[1]) in TRANSIENT_HTTP
        except Exception:
            return False
    return False

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--retry-missing", action="store_true")
    ap.add_argument("--owner", default=GITHUB_OWNER)
    ap.add_argument("--repo", default=GITHUB_REPO)
    ap.add_argument("--path", default=GITHUB_PATH)
    ap.add_argument("--branch", default=GITHUB_BRANCH)
    ap.add_argument("--base-only", action="store_true",
                    help="Skip GitHub and update IPA for BASE_WORDS only.")
    args = ap.parse_args()

    project = root()
    base_vocab = normalise_words(load_words(project/"data"/"vocabulary.js"))

    if args.base_only:
        custom_vocab = []
        cloud_source = "skipped (--base-only)"
    else:
        token = github_token()
        custom_vocab, removed_cloud = load_cloud_custom_words(
            args.owner, args.repo, args.path, args.branch, token
        )
        cloud_source = f"github.com/{args.owner}/{args.repo}/{args.path}@{args.branch}"

    if args.base_only:
        removed_cloud = set()

    vocab = [w for w in normalise_words(base_vocab + custom_vocab) if w.lower() not in removed_cloud]
    out = project/"data"/"pronunciations.json"
    db = load_db(out)
    existing = db["words"]

    missing_statuses = {"no_ipa", "no_english_section", "no_pronunciation_section"}

    pending = []
    for word in vocab:
        key = word.lower()
        old = existing.get(key)

        if old is None:
            pending.append(word)
            continue

        status = old.get("status")

        # Always retry transient/network failures automatically.
        if is_transient_status(status):
            pending.append(word)
            continue

        # Retry genuine missing data only when explicitly requested.
        if args.retry_missing and status in missing_statuses:
            pending.append(word)

    print(f"Base vocabulary: {len(base_vocab)}")
    print(f"Custom words from cloud: {len(custom_vocab)}")
    print(f"Removed words excluded: {len(removed_cloud)}")
    print(f"Combined vocabulary: {len(vocab)}")
    print(f"Progress source: {cloud_source}")
    print(f"Already stored: {len(existing)}")
    print(f"To request/retry: {len(pending)}")
    print(f"Output: {out}\n")

    try:
        for i, word in enumerate(pending, 1):
            item = fetch(word)
            existing[word.lower()] = item
            save_db(out, db)

            shown = []
            if item["uk"]: shown.append("UK " + item["uk"])
            if item["us"]: shown.append("US " + item["us"])
            if item["fallback"]: shown.append("IPA " + item["fallback"])

            print(
                f"[{i:4d}/{len(pending)}] {word:<24} "
                + (" ; ".join(shown) if shown else f"[{item['status']}]")
            )

            # Polite steady-state rate plus small jitter.
            time.sleep(BASE_DELAY + random.random() * JITTER)

    except KeyboardInterrupt:
        save_db(out, db)
        print("\nStopped safely. Progress has been saved.")
        return

    save_db(out, db)

    vals = [existing.get(w.lower(), {}) for w in vocab]
    any_ipa = sum(bool(x.get("uk") or x.get("us") or x.get("fallback")) for x in vals)
    both = sum(bool(x.get("uk") and x.get("us")) for x in vals)
    transient = sum(is_transient_status(x.get("status")) for x in vals)
    missing = sum(
        not bool(x.get("uk") or x.get("us") or x.get("fallback"))
        and not is_transient_status(x.get("status"))
        for x in vals
    )

    print("\nDone.")
    print(f"Any IPA: {any_ipa}/{len(vocab)}")
    print(f"Explicit UK + US: {both}/{len(vocab)}")
    print(f"Transient failures remaining: {transient}/{len(vocab)}")
    print(f"True missing/no-IPA: {missing}/{len(vocab)}")
    print("Rerun the same command to retry transient failures automatically.")

if __name__ == "__main__":
    main()
