/* يبصم site.css ببصمة محتواه في كل صفحة.
 *
 * السبب من تجربة حقيقية لا من نظرية: أثناء العمل على هذا الموقع بقي
 * المتصفح يخدم نسخة CSS قديمة بعد كل تعديل، فاحتجنا ثلاثة عناوين مختلفة
 * (localhost ثم 127.0.0.1 ثم 127.0.0.2) لنرى التعديلات. الزائر العائد
 * سيصيبه الشيء نفسه بعد كل نشر: اسم الملف ثابت، فلا شيء يخبر متصفحه أن
 * المحتوى تغيّر.
 *
 * البصمة في الاستعلام تكفي — لا حاجة لتغيير اسم الملف على القرص، وهذا
 * أبسط في موقع يُنشر كملفات ثابتة بلا حزم.
 *
 * يُشغَّل بعد أي تعديل على CSS وقبل النشر:  node build/stamp.mjs
 */

import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";

const CSS = "../assets/css/site.css";
const PAGES = ["../index.html", "../ar/index.html", "../en/index.html", "../fr/index.html", "../404.html"];

const cssUrl = new URL(CSS, import.meta.url);
const hash = createHash("sha256")
  .update(readFileSync(cssUrl))
  .digest("hex")
  .slice(0, 8);

/* يطابق الرابط ببصمة سابقة أو بدونها، فتشغيله مرتين يعطي نفس النتيجة */
const LINK = /(<link rel="stylesheet" href="\/assets\/css\/site\.css)(\?v=[a-f0-9]+)?(">)/;

let changed = 0;
for (const page of PAGES) {
  const url = new URL(page, import.meta.url);
  const html = readFileSync(url, "utf8");

  if (!LINK.test(html)) {
    console.error(`  ✗ ${page}: لم يُعثر على رابط التنسيق — تُرك دون تغيير`);
    continue;
  }
  const next = html.replace(LINK, `$1?v=${hash}$3`);
  if (next === html) {
    console.log(`  = ${page} (البصمة نفسها)`);
    continue;
  }
  writeFileSync(url, next);
  console.log(`  ✓ ${page}`);
  changed++;
}

console.log(`\nالبصمة   ?v=${hash}`);
console.log(`الصفحات  ${changed}/${PAGES.length} معدَّلة`);
