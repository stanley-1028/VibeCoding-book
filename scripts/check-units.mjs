#!/usr/bin/env node
// 檢查 docs/ 單元的 frontmatter、相對連結，以及 paths/*.yaml 的引用。
// 用法：node scripts/check-units.mjs
// 無外部依賴，僅使用 Node 內建模組。

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname, resolve, basename } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DOCS = join(ROOT, "docs");
const PATHS = join(ROOT, "paths");

// 統一換行，避免 Windows（CRLF）checkout 被誤判為缺少 frontmatter。
const readText = (file) => readFileSync(file, "utf8").replace(/\r\n/g, "\n");

const ALLOWED = {
  level: ["beginner", "intermediate", "advanced"],
  path: ["beginner", "intermediate", "advanced"],
  status: ["active", "stale", "draft"],
};
const ALLOWED_TAGS = [
  "入門", "提示詞", "除錯", "工具鏈", "工作流", "部署",
  "最佳實踐", "實作專案", "測試", "資料", "安全", "架構",
];
const REQUIRED = [
  "title", "slug", "level", "tags", "prerequisites",
  "estimated_minutes", "path", "updated", "maintainers", "status",
];

const errors = [];
const warn = (file, msg) => errors.push(`${file}: ${msg}`);

function parseFrontmatter(file, text) {
  if (!text.startsWith("---\n")) {
    warn(file, "缺少開頭的 `---` frontmatter");
    return null;
  }
  const end = text.indexOf("\n---", 4);
  if (end === -1) {
    warn(file, "frontmatter 沒有收尾的 `---`");
    return null;
  }
  const block = text.slice(4, end);
  const data = {};
  for (const raw of block.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const i = line.indexOf(":");
    if (i === -1) { warn(file, `無法解析 frontmatter 行：${line}`); continue; }
    const key = line.slice(0, i).trim();
    let val = line.slice(i + 1).trim();
    if (val.startsWith("[") && val.endsWith("]")) {
      val = val.slice(1, -1).split(",").map((s) => s.trim()).filter(Boolean);
    } else if (/^-?\d+$/.test(val)) {
      val = Number(val);
    } else if (val === "") {
      val = [];
    }
    data[key] = val;
  }
  return { data, body: text.slice(end + 4) };
}

function checkFrontmatter(file, data) {
  for (const key of REQUIRED) {
    if (!(key in data)) warn(file, `缺少必填欄位 \`${key}\``);
  }
  const slug = basename(file, ".md");
  if (data.slug && data.slug !== slug) {
    warn(file, `slug「${data.slug}」與檔名「${slug}」不一致`);
  }
  for (const key of ["level", "path", "status"]) {
    if (key in data && !ALLOWED[key].includes(data[key])) {
      warn(file, `${key}「${data[key]}」不在允許值 ${ALLOWED[key].join("/")}`);
    }
  }
  if ("tags" in data) {
    const arr = Array.isArray(data.tags) ? data.tags : [data.tags];
    for (const t of arr) {
      if (!ALLOWED_TAGS.includes(t)) warn(file, `標籤「${t}」不在允許清單`);
    }
  }
  if ("estimated_minutes" in data && typeof data.estimated_minutes !== "number") {
    warn(file, "estimated_minutes 必須是數字");
  }
  if ("updated" in data && !/^\d{4}-\d{2}-\d{2}$/.test(String(data.updated))) {
    warn(file, "updated 必須是 YYYY-MM-DD 格式");
  }
}

function checkBodySections(file, body) {
  const required = ["## 學習目標", "## 動手練", "## 完成檢核標準", "## 下一單元"];
  for (const s of required) {
    if (!body.includes(s)) warn(file, `正文缺少段落「${s}」`);
  }
}

function checkLinks(file, body) {
  const re = /\]\((\.[^)]+)\)/g;
  let m;
  while ((m = re.exec(body)) !== null) {
    const target = m[1].split("#")[0];
    const abs = resolve(dirname(file), target);
    if (!existsSync(abs)) warn(file, `相對連結失效：${m[1]}`);
  }
}

function checkPathFile(pathFile) {
  const text = readText(pathFile);
  const units = [];
  let inUnits = false;
  for (const raw of text.split("\n")) {
    const line = raw.replace(/\r$/, "");
    if (/^units:/.test(line)) { inUnits = true; continue; }
    if (inUnits) {
      const m = line.match(/^\s*-\s+(\S+)\s*$/);
      if (m) units.push(m[1]);
      else if (line.trim() && !/^\s/.test(line)) inUnits = false;
    }
  }
  const name = basename(pathFile);
  if (units.length === 0) warn(name, "units 清單為空");
  for (const slug of units) {
    if (!existsSync(join(DOCS, `${slug}.md`))) {
      warn(name, `引用的單元不存在：docs/${slug}.md`);
    }
  }
  return units;
}

function main() {
  const docs = readdirSync(DOCS).filter((f) => f.endsWith(".md"));
  const slugs = new Set(docs.map((f) => basename(f, ".md")));

  for (const f of docs) {
    const file = join(DOCS, f);
    const text = readText(file);
    const parsed = parseFrontmatter(file, text);
    if (!parsed) continue;
    checkFrontmatter(file, parsed.data);
    checkBodySections(file, parsed.body);
    checkLinks(file, parsed.body);
  }

  const pathFiles = existsSync(PATHS)
    ? readdirSync(PATHS).filter((f) => f.endsWith(".yaml"))
    : [];
  const referenced = new Set();
  for (const p of pathFiles) {
    for (const slug of checkPathFile(join(PATHS, p))) referenced.add(slug);
  }

  const orphans = [...slugs].filter((s) => !referenced.has(s));
  for (const o of orphans) {
    errors.push(`docs/${o}.md 未被任何 paths/*.yaml 引用（孤立單元）`);
  }

  console.log(`掃描 docs/：${docs.length} 個單元，paths/：${pathFiles.length} 條路徑`);
  if (errors.length) {
    console.error(`\n發現 ${errors.length} 個問題：`);
    for (const e of errors) console.error("  - " + e);
    process.exit(1);
  }
  console.log("全部檢查通過。");
}

main();
