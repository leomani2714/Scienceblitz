"""
Clean and organize a quiz question bank JSON with this shape:
    { subject: { topic: { difficulty: [ {q, a, opts}, ... ] } } }

Fixes applied:
  1. Mojibake re-encoding (UTF-8 text that was mis-decoded as Latin-1/CP1252).
  2. Flattens any difficulty bucket that is accidentally a list-of-lists.
  3. Removes exact duplicate questions within each (subject, topic, difficulty) bucket.
  4. Reports counts before/after so you can see what changed.

Usage:
    python organize_quiz_bank.py input.json output.json
"""
import json
import sys
from collections import OrderedDict


def fix_mojibake(text: str) -> str:
    """Attempt to repair UTF-8 text that was incorrectly decoded as Latin-1/CP1252."""
    if not isinstance(text, str):
        return text
    # Only attempt the fix if we see the tell-tale corrupted byte sequences.
    if any(marker in text for marker in ("Ã", "Â", "â€", "Î")):
        for src_enc in ("latin1", "cp1252"):
            try:
                repaired = text.encode(src_enc).decode("utf-8")
                # Sanity check: repaired text shouldn't still contain the markers.
                if not any(m in repaired for m in ("Ã", "Â", "â€")):
                    return repaired
            except (UnicodeDecodeError, UnicodeEncodeError):
                continue
    return text


def fix_question(q: dict) -> dict:
    fixed = OrderedDict()
    fixed["q"] = fix_mojibake(q.get("q", ""))
    fixed["a"] = fix_mojibake(q.get("a", ""))
    fixed["opts"] = [fix_mojibake(o) for o in q.get("opts", [])]
    return fixed


def flatten(bucket):
    """Flatten a difficulty bucket that might be a list of questions
    OR (bug) a list of lists of questions."""
    flat = []
    for item in bucket:
        if isinstance(item, list):
            flat.extend(item)
        else:
            flat.append(item)
    return flat


def dedupe(questions):
    seen = set()
    out = []
    for q in questions:
        key = (q["q"], q["a"], tuple(q["opts"]))
        if key not in seen:
            seen.add(key)
            out.append(q)
    return out


def organize(data: dict) -> dict:
    before_total = 0
    after_total = 0
    cleaned = OrderedDict()

    for subject, topics in data.items():
        cleaned[subject] = OrderedDict()
        for topic, difficulties in topics.items():
            cleaned[subject][topic] = OrderedDict()
            for difficulty, bucket in difficulties.items():
                before_total += len(bucket) if isinstance(bucket, list) else 0
                flat = flatten(bucket)
                fixed = [fix_question(q) for q in flat]
                deduped = dedupe(fixed)
                after_total += len(deduped)
                cleaned[subject][topic][difficulty] = deduped

    print(f"Questions before cleanup: {before_total}")
    print(f"Questions after cleanup:  {after_total}")
    print(f"Removed as duplicates:    {before_total - after_total}")
    return cleaned


def main():
    if len(sys.argv) != 3:
        print("Usage: python organize_quiz_bank.py input.json output.json")
        sys.exit(1)

    in_path, out_path = sys.argv[1], sys.argv[2]
    with open(in_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    cleaned = organize(data)

    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(cleaned, f, ensure_ascii=False, indent=2)

    print(f"Wrote cleaned file to: {out_path}")


if __name__ == "__main__":
    main()
