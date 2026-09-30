/* يحوّل mauritania.out.json إلى وسم SVG جاهز للحقن في صفحات الهيرو الثلاث،
 * ويكتب صفحة معاينة مستقلة للتحقق البصري.
 *
 * قيد حاسم: سياسة CSP في الموقع هي style-src 'self' بلا 'unsafe-inline'.
 * لذلك ممنوع هنا:
 *   - وسم <style> داخل الـ SVG
 *   - أي سمة style="..."
 * كل التنسيق والحركة يعيشان في assets/css/site.css. ما يُسمح به داخل الوسم
 * هو سمات العرض (fill / stroke / r) — وهي خارج نطاق CSP تمامًا.
 *
 * التشغيل:  node build/make-hero.mjs
 */

import { readFileSync, writeFileSync } from "node:fs";

const data = JSON.parse(
  readFileSync(new URL("./mauritania.out.json", import.meta.url), "utf8"),
);

/* الموقع ثلاثي اللغات وصفحاته ثلاثة ملفات منفصلة. الحقن من هنا يمنع أن
   تتباعد النسخ الثلاث مع أول تعديل. */
const LOCALES = [
  {
    file: "../ar/index.html",
    lang: "ar",
    label:
      "شبكة سند الرقمية عبر موريتانيا: عقد المدن متصلة ببعضها وتتحرك بينها البيانات",
    name: (n) => n.ar,
  },
  {
    file: "../en/index.html",
    lang: "en",
    label:
      "Sened's digital network across Mauritania: city nodes linked together, with data moving between them",
    name: (n) => n.en,
  },
  {
    file: "../fr/index.html",
    lang: "fr",
    label:
      "Le réseau numérique de Sened à travers la Mauritanie : des nœuds urbains reliés entre eux, parcourus par les données",
    name: (n) => n.en,
  },
];
LOCALES.push({ ...LOCALES[1], file: "../index.html" });

/* ثمانية دلاء تأخير للنبضات. التأخير سمة تنسيق، ولا يمكن وضعها على كل عنصر
   عبر style، فتوزَّع الوصلات على أصناف وتتكفّل الـ CSS بالباقي. */
const PULSE_BUCKETS = 8;

const nodeRadius = (w) => ({ 3: 9, 2: 5.5, 1: 3.4 })[w] ?? 3.4;

const edges = data.edges
  .map((e, i) => {
    const a = data.nodes[e.a];
    const b = data.nodes[e.b];
    const bucket = i % PULSE_BUCKETS;
    /* pathLength يُطبِّع طول كل وصلة إلى ١٠٠ وحدة، فتسير النبضة على الوصلة
       القصيرة والطويلة بنفس الإيقاع بنبضة واحدة لكل دورة. بدونه كانت
       stroke-dasharray الثابتة ستجعل النبضات متفرّقة عشوائيًا. */
    return `<line class="mrt-link" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"/>` +
      `<line class="mrt-pulse mrt-p${bucket}" pathLength="100" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"/>`;
  })
  .join("\n      ");

const nodesFor = (nameOf) =>
  data.nodes
    .map((n, i) => {
      const primary = n.w === 3 ? " mrt-primary" : "";
      const bucket = i % PULSE_BUCKETS;
      return `<circle class="mrt-node mrt-n${bucket}${primary}" cx="${n.x}" cy="${n.y}" r="${nodeRadius(n.w)}"><title>${nameOf(n)}</title></circle>`;
    })
    .join("\n      ");

/* العاصمة تحمل حلقة نابضة واحدة — إشارة إلى المركز دون مبالغة (§٧). */
const capital = data.nodes.find((n) => n.w === 3);

const svgFor = ({ label, name }) => {
  const nodes = nodesFor(name);
  return `<svg class="mrt" viewBox="${data.viewBox}" role="img" aria-labelledby="mrt-t" preserveAspectRatio="xMidYMid meet">
      <title id="mrt-t">${label}</title>
      <defs>
        <radialGradient id="mrt-fill" cx="50%" cy="38%" r="72%">
          <stop offset="0%" stop-color="#14120C"/>
          <stop offset="100%" stop-color="#07070A"/>
        </radialGradient>
        <filter id="mrt-glow" x="-35%" y="-35%" width="170%" height="170%">
          <feGaussianBlur stdDeviation="7" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <!-- هالة أضيق للعقد: نفس الأسلوب بنصف القوة، وإلا ابتلع الوهج
             المدن الصغيرة وصارت الشبكة بقعة واحدة. -->
        <filter id="mrt-glow-s" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="3.4" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <!-- الحدّ يُعرَّف مرة واحدة ويُعاد استعماله أربع مرات. كتابته حرفيًا
             في كل طبقة تضيف ١٥ كيلوبايت لكل صفحة بلا مقابل. -->
        <path id="mrt-shape" d="${data.d}"/>
      </defs>

      <use class="mrt-body" href="#mrt-shape" fill="url(#mrt-fill)"/>

      <g class="mrt-net">
        ${edges}
      </g>

      <g class="mrt-nodes" filter="url(#mrt-glow-s)">
        ${nodes}
      </g>

      <g class="mrt-outline" fill="none" filter="url(#mrt-glow)">
        <use class="mrt-o1" href="#mrt-shape"/>
        <use class="mrt-o2" href="#mrt-shape"/>
        <use class="mrt-o3" href="#mrt-shape"/>
      </g>

      <circle class="mrt-ring" cx="${capital.x}" cy="${capital.y}" r="16" fill="none"/>
    </svg>`;
};

/* ------------------------------------------------------------------ الحقن
 * الحقن محصور بين علامتين في الوسم. تشغيل السكربت مرتين يعطي نفس النتيجة،
 * ولا يلمس شيئًا خارج .hero-art.
 */
const OPEN = "<!-- mrt:start -->";
const CLOSE = "<!-- mrt:end -->";
const BLOCK = /<div class="hero-art">[\s\S]*?<\/div>/;

let touched = 0;
for (const loc of LOCALES) {
  const url = new URL(loc.file, import.meta.url);
  const html = readFileSync(url, "utf8");
  const block = `<div class="hero-art">\n        ${OPEN}\n    ${svgFor(loc)}\n        ${CLOSE}\n      </div>`;

  if (!BLOCK.test(html)) {
    console.error(`  ✗ ${loc.file}: لم يُعثر على .hero-art — تُرك دون تغيير`);
    continue;
  }
  writeFileSync(url, html.replace(BLOCK, block));
  console.log(`  ✓ ${loc.lang.padEnd(2)} ${loc.file}`);
  touched++;
}

/* صفحة معاينة: تستدعي نفس site.css الحقيقي، فما يظهر هنا هو ما سيظهر
   في الموقع بالضبط — لا تنسيق خاص بالمعاينة. */
writeFileSync(
  new URL("./preview.html", import.meta.url),
  `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>معاينة — شبكة موريتانيا</title>
<link rel="stylesheet" href="/assets/css/site.css">
</head>
<body>
<main class="wrap" id="main">
  <div class="hero-art">
    ${svgFor(LOCALES[0])}
  </div>
</main>
</body>
</html>
`,
);

console.log(`\nSVG        ${svgFor(LOCALES[0]).length} حرفًا لكل صفحة`);
console.log(`الوصلات    ${data.edges.length} (×٢ لطبقة النبض)`);
console.log(`العقد      ${data.nodes.length}`);
console.log(`العاصمة    ${capital.ar} عند ${capital.x},${capital.y}`);
console.log(`الصفحات    ${touched}/${LOCALES.length}`);
