/* يبني شبكة موريتانيا الرقمية للهيرو.
 *
 * لماذا سكربت بناء بدل كتابة SVG يدويًا: سياسة CSP في الموقع تضع
 * connect-src 'none'، فلا يمكن جلب حدود الدولة وقت التشغيل — يجب أن تكون
 * مضمّنة في الصفحة. والحدود الحقيقية ٣٣ كيلوبايت، فتُبسَّط هنا مرة واحدة.
 *
 * المصدر: geoBoundaries gbOpen MRT ADM0 (simplified) — حدود حقيقية، لا شكل
 * مخترع. الأمر في الـ prompt صريح: DO NOT invent an incorrect country shape.
 *
 * التشغيل:  node build/make-mauritania.mjs
 */

import { readFileSync, writeFileSync } from "node:fs";

const SRC = new URL("./mauritania.geo.json", import.meta.url);
const OUT = new URL("./mauritania.out.json", import.meta.url);

/* عرض مساحة الرسم. الارتفاع يُشتق من نسبة الدولة نفسها. */
const W = 1000;
/* هدف عدد النقاط بعد التبسيط: يكفي للحفاظ على الساحل والزوايا الحادة
   دون أن ينتفخ الـ HTML. */
const TARGET_POINTS = 460;

/* ----------------------------------------------------------------- الإسقاط
 * مسقط أسطواني متساوي المسافات مع تصحيح بجيب تمام خط العرض الأوسط. على
 * امتداد موريتانيا (١٤°–٢٧° شمالًا) تشوّهه أقل من أن يُرى، وهو أبسط وأدق
 * بكثير من مِركاتور في هذا النطاق الضيق.
 */
function makeProjection(bbox) {
  const [minLon, minLat, maxLon, maxLat] = bbox;
  const lat0 = ((minLat + maxLat) / 2) * (Math.PI / 180);
  const kx = Math.cos(lat0);
  const spanX = (maxLon - minLon) * kx;
  const spanY = maxLat - minLat;
  const scale = W / spanX;
  const H = spanY * scale;
  return {
    H,
    project: ([lon, lat]) => [
      (lon - minLon) * kx * scale,
      /* خط العرض يزداد شمالًا، ومحور y في SVG يزداد نزولًا */
      (maxLat - lat) * scale,
    ],
  };
}

/* ------------------------------------------------- تبسيط دوغلاس-بويكر
 * يحتفظ بالنقاط التي تحمل الشكل (رؤوس الزوايا، انحناءات الساحل) ويحذف ما
 * يقع على خط مستقيم تقريبًا. البحث الثنائي أدناه يضبط العتبة للوصول إلى
 * عدد النقاط الهدف بدل تخمين رقم سحري.
 */
function perpDist(p, a, b) {
  const [px, py] = p, [ax, ay] = a, [bx, by] = b;
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(px - ax, py - ay);
  let t = ((px - ax) * dx + (py - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function simplify(points, eps) {
  if (points.length < 3) return points;
  let maxD = 0, idx = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const d = perpDist(points[i], points[0], points[points.length - 1]);
    if (d > maxD) { maxD = d; idx = i; }
  }
  if (maxD <= eps) return [points[0], points[points.length - 1]];
  return [
    ...simplify(points.slice(0, idx + 1), eps).slice(0, -1),
    ...simplify(points.slice(idx), eps),
  ];
}

function simplifyToTarget(rings, target) {
  let lo = 0, hi = 20, best = rings;
  for (let i = 0; i < 40; i++) {
    const eps = (lo + hi) / 2;
    const out = rings.map((r) => simplify(r, eps));
    const n = out.reduce((s, r) => s + r.length, 0);
    if (n > target) lo = eps; else { hi = eps; best = out; }
  }
  return best;
}

/* -------------------------------------------------------- نقطة داخل مضلّع */
function inRing(pt, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if (yi > pt[1] !== yj > pt[1] &&
        pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
const inCountry = (pt, rings) => rings.some((r) => inRing(pt, r));

/* ------------------------------------------------------------------ المدن
 * عقد الشبكة مدن موريتانية حقيقية بإحداثياتها الفعلية. الـ prompt يمنع
 * التوزيع العشوائي الفوضوي (§٧)، والمدن الحقيقية تجعل الشبكة تعني شيئًا:
 * هذه هي المواقع التي يعمل فيها عملاء سند فعلًا.
 * weight: ٣ العاصمة، ٢ مدن كبرى، ١ البقية — يحدّد نصف قطر العقدة.
 */
const CITIES = [
  ["نواكشوط",        "Nouakchott",      -15.9582, 18.0735, 3],
  ["نواذيبو",        "Nouadhibou",      -17.0347, 20.9310, 2],
  ["كيهيدي",         "Kaedi",           -13.5000, 16.1500, 2],
  ["كيفة",           "Kiffa",           -11.4042, 16.6200, 2],
  ["روصو",           "Rosso",           -15.8050, 16.5138, 2],
  ["زويرات",         "Zouerat",         -12.4714, 22.7350, 2],
  ["أطار",           "Atar",            -13.0499, 20.5169, 2],
  ["النعمة",         "Nema",             -7.2500, 16.6170, 2],
  ["سيليبابي",       "Selibaby",        -12.1847, 15.1590, 1],
  ["ألاك",           "Aleg",            -13.9070, 17.0530, 1],
  ["أكجوجت",         "Akjoujt",         -14.3850, 19.7469, 1],
  ["تجكجة",          "Tidjikja",        -11.4333, 18.5500, 1],
  ["عيون العطروس",   "Aioun",            -9.6147, 16.6614, 1],
  ["بوتلميت",        "Boutilimit",      -14.7000, 17.5500, 1],
  ["شنقيط",          "Chinguetti",      -12.3644, 20.4633, 1],
  ["بئر أم اكرين",   "Bir Moghrein",    -11.6167, 25.2333, 1],
  ["تمبدغة",         "Timbedra",         -8.1667, 16.2500, 1],
  ["وادان",          "Ouadane",         -11.6167, 20.9333, 1],
  ["تيشيت",          "Tichit",           -9.5000, 18.4500, 1],
  ["باسكنو",         "Bassikounou",      -5.9833, 15.8333, 1],
  ["مقطع لحجار",     "Magta Lahjar",    -13.0667, 17.4000, 1],
  ["مودجرية",        "Moudjeria",       -12.3667, 17.8667, 1],
  ["كرو",            "Guerou",          -11.6667, 16.8000, 1],
  ["بركيول",         "Barkeol",         -12.4333, 16.6833, 1],
  ["تنتان",          "Tintane",         -10.1500, 16.4333, 1],
  ["كوبني",          "Kobenni",          -9.2167, 15.9167, 1],
  ["جيكني",          "Djiguenni",        -8.5000, 15.7500, 1],
  ["أمبود",          "Mbout",           -12.5833, 16.0167, 1],
  ["مدردة",          "Mederdra",        -15.6500, 16.9167, 1],
  ["بوكي",           "Boghe",           -14.2667, 16.5833, 1],
  ["فديرك",          "Fderik",          -12.7167, 22.6833, 1],
  ["بنشاب",          "Benichab",        -15.3833, 19.4500, 1],
  /* الشمال والشرق: بلدات ومحطات حقيقية، أغلبها على سكة الحديد أو على طرق
     الصحراء. أُضيفت لأن الشبكة بلا شمالٍ تبدو كأن نصف البلد غير موجود —
     لا لملء الفراغ باختراع. */
  ["عين بن تيلي",    "Ain Ben Tili",     -9.5300, 25.9500, 1],
  ["الشݣة",          "Chegga",           -5.7800, 25.3800, 1],
  ["الشوم",          "Choum",           -13.0333, 21.3000, 1],
  ["بولنوار",        "Bou Lanouar",     -16.5333, 21.3000, 1],
  ["أوجفت",          "Aoujeft",         -13.0333, 20.1000, 1],
  ["ولاتة",          "Oualata",          -7.0300, 17.3000, 1],
  ["تامشكط",         "Tamchekett",      -10.8167, 17.2333, 1],
  ["كنكوصة",         "Kankossa",        -11.5167, 15.9500, 1],
  ["فصالة",          "Fassala",          -6.7167, 15.7300, 1],
  ["عدل بݣرو",       "Adel Bagrou",      -7.2000, 15.5333, 1],
  ["مقامة",          "Maghama",         -12.8500, 15.5167, 1],
  ["ولد ينج",        "Ould Yenge",      -12.3167, 15.3000, 1],
  ["منقل",           "Monguel",         -13.1667, 16.4333, 1],
];

/* ------------------------------------------------------------------- بناء */
const gj = JSON.parse(readFileSync(SRC, "utf8"));
const geom = gj.features ? gj.features[0].geometry : gj.geometry ?? gj;

/* نأخذ الحلقات الخارجية فقط — الجزر والثقوب لا تُقرأ في هذا المقياس */
const ringsLL =
  geom.type === "Polygon"
    ? [geom.coordinates[0]]
    : geom.coordinates.map((poly) => poly[0]);

const bbox = ringsLL.flat().reduce(
  ([a, b, c, d], [lon, lat]) =>
    [Math.min(a, lon), Math.min(b, lat), Math.max(c, lon), Math.max(d, lat)],
  [Infinity, Infinity, -Infinity, -Infinity],
);

const { H, project } = makeProjection(bbox);
const ringsXY = ringsLL.map((r) => r.map(project));
const simplified = simplifyToTarget(ringsXY, TARGET_POINTS);

const round = (n) => Math.round(n * 10) / 10;
const d = simplified
  .map((r) => "M" + r.map(([x, y]) => `${round(x)} ${round(y)}`).join("L") + "Z")
  .join("");

/* العقد: المدن المسقطة، مع رفض أي مدينة تقع خارج المضلّع المبسَّط (قد
   يحدث على الساحل) حتى لا تطفو عقدة في الفراغ. */
const nodes = [];
for (const [ar, en, lon, lat, weight] of CITIES) {
  const [x, y] = project([lon, lat]);
  if (!inCountry([x, y], simplified)) {
    console.warn(`  تُركت خارج الحدود بعد التبسيط: ${en}`);
    continue;
  }
  nodes.push({ ar, en, x: round(x), y: round(y), w: weight });
}

/* الوصلات: كل عقدة إلى أقرب ٣ جيران. ينتج نسيجًا مثلثيًا عضويًا يشبه
   شبكة اتصال حقيقية، لا خطوطًا عشوائية متقاطعة. */
const K = 3;
const seen = new Set();
const edges = [];
nodes.forEach((a, i) => {
  nodes
    .map((b, j) => ({ j, dist: Math.hypot(a.x - b.x, a.y - b.y) }))
    .filter((o) => o.j !== i)
    .sort((p, q) => p.dist - q.dist)
    .slice(0, K)
    .forEach(({ j, dist }) => {
      const key = i < j ? `${i}-${j}` : `${j}-${i}`;
      if (seen.has(key)) return;
      seen.add(key);
      edges.push({ a: Math.min(i, j), b: Math.max(i, j), len: round(dist) });
    });
});

const out = {
  viewBox: `0 0 ${W} ${Math.round(H)}`,
  width: W,
  height: Math.round(H),
  d,
  points: simplified.reduce((s, r) => s + r.length, 0),
  nodes,
  edges,
  source: "geoBoundaries gbOpen MRT ADM0 (simplified)",
};

writeFileSync(OUT, JSON.stringify(out, null, 2));

console.log(`viewBox   ${out.viewBox}`);
console.log(`المسار    ${out.points} نقطة، ${d.length} حرفًا`);
console.log(`العقد     ${nodes.length}`);
console.log(`الوصلات   ${edges.length}`);
