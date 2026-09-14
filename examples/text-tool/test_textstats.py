from textstats import analyze, word_tokens

assert word_tokens("Hello, world! HELLO") == ["hello", "world", "hello"]

stats = analyze("hello world\nhello", top_n=2)
assert stats["lines"] == 2
assert stats["words"] == 3
assert stats["characters"] == len("hello world\nhello")
assert stats["top"][0] == ("hello", 2)

empty = analyze("")
assert empty["lines"] == 0
assert empty["words"] == 0
assert empty["avg_chars_per_line"] == 0.0

print("全部測試通過。")
