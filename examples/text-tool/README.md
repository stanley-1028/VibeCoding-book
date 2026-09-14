# textstats：命令列文字統計工具

對應單元：[入門實戰：做出一個可用的文字工具](../../docs/first-project.md)

## 檔案

| 檔案 | 說明 |
|---|---|
| `textstats.py` | 主程式 |
| `test_textstats.py` | 以 `assert` 撰寫的測試 |
| `sample.txt` | 測試用輸入 |

## 執行

```console
$ python textstats.py sample.txt
行數：3
單字數：11
字元數：51
平均每行字元：17.0
最常見單字：
1. the (3)
2. quick (1)
3. brown (1)
4. fox (1)
5. jumps (1)
```

JSON 輸出：

```console
$ python textstats.py sample.txt --json
```

從標準輸入讀取（路徑用 `-`）：

```console
$ Get-Content sample.txt | python textstats.py -     # Windows PowerShell
$ cat sample.txt | python textstats.py -             # macOS / Linux
```

## 測試

```console
$ python test_textstats.py
全部測試通過。
```
