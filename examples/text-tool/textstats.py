#!/usr/bin/env python3
"""textstats：文字檔統計工具。"""
import argparse
import json
import re
import sys
from collections import Counter


def read_text(path):
    if path == "-":
        return sys.stdin.read()
    with open(path, encoding="utf-8") as f:
        return f.read()


def word_tokens(text):
    return re.findall(r"\w+", text.lower())


def analyze(text, top_n=5):
    lines = text.splitlines()
    chars = len(text)
    words = word_tokens(text)
    counter = Counter(words)
    avg = chars / len(lines) if lines else 0.0
    return {
        "lines": len(lines),
        "words": len(words),
        "characters": chars,
        "avg_chars_per_line": round(avg, 1),
        "top": counter.most_common(top_n),
    }


def format_report(stats):
    out = [
        f"行數：{stats['lines']}",
        f"單字數：{stats['words']}",
        f"字元數：{stats['characters']}",
        f"平均每行字元：{stats['avg_chars_per_line']}",
    ]
    if stats["top"]:
        out.append("最常見單字：")
        for i, (word, count) in enumerate(stats["top"], start=1):
            out.append(f"{i}. {word} ({count})")
    return "\n".join(out)


def build_parser():
    parser = argparse.ArgumentParser(description="統計文字檔的行數、單字數與常用字")
    parser.add_argument("path", help="檔案路徑，使用 - 代表從標準輸入讀取")
    parser.add_argument("--top", type=int, default=5, help="顯示前 N 名單字（預設 5）")
    parser.add_argument("--json", action="store_true", help="以 JSON 格式輸出")
    return parser


def main(argv=None):
    args = build_parser().parse_args(argv)
    try:
        text = read_text(args.path)
    except FileNotFoundError:
        print(f"找不到檔案：{args.path}", file=sys.stderr)
        return 1
    stats = analyze(text, top_n=args.top)
    if args.json:
        print(json.dumps(stats, ensure_ascii=False, indent=2))
    else:
        print(format_report(stats))
    return 0


if __name__ == "__main__":
    sys.exit(main())
