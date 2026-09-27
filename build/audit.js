/* أداة فحص للتجربة اليدوية فقط — لا تُحمَّل في صفحات الموقع.
 * تُستدعى من لوحة المعاينة أثناء الاختبار على العروض المختلفة.
 *
 * تُحمَّل كملف خارجي من نفس الأصل عمدًا: سياسة CSP هي script-src 'self'،
 * فنجاح تحميلها هنا يثبت عمليًا أن جافاسكربت الموقع المستقبلي (Three.js)
 * سيعمل تحت نفس السياسة دون تعديلها.
 */
(function () {
  const cls = (el) => {
    const c = el.className;
    const s = typeof c === "string" ? c : c && c.baseVal ? c.baseVal : "";
    return s.split(" ")[0] || "";
  };

  window.__audit = function () {
    const R = { w: innerWidth, h: innerHeight };

    R.overflowX =
      document.body.scrollWidth > innerWidth ? document.body.scrollWidth : false;
    R.docH = document.documentElement.scrollHeight;

    /* عناصر تخرج عن حافة الشاشة */
    const out = [];
    document.querySelectorAll("body *").forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && (r.right > innerWidth + 1 || r.left < -1)) {
        out.push(el.tagName.toLowerCase() + (cls(el) ? "." + cls(el) : ""));
      }
    });
    R.clipped = [...new Set(out)].slice(0, 6);

    /* أهداف لمس أصغر من ٢٤ بكسل — تفشل على الهاتف */
    R.smallTargets = [...document.querySelectorAll("a,button")]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && (r.height < 24 || r.width < 24);
      })
      .map((el) => (el.textContent || "").trim().slice(0, 20))
      .slice(0, 8);

    /* روابط ميتة أو فارغة (§١٥: لا تنشئ روابط ميتة) */
    R.deadLinks = [...document.querySelectorAll("a")]
      .filter((a) => {
        const h = a.getAttribute("href");
        return !h || h === "#" || h.trim() === "";
      })
      .map((a) => (a.textContent || "").trim().slice(0, 20));

    /* مراسي داخلية لا تقابل عنصرًا */
    R.brokenAnchors = [...document.querySelectorAll('a[href^="#"]')]
      .map((a) => a.getAttribute("href"))
      .filter((h) => h.length > 1 && !document.querySelector(h));

    /* الخريطة */
    const s = document.querySelector(".mrt");
    if (s) {
      const b = s.getBoundingClientRect();
      R.map = {
        w: Math.round(b.width),
        h: Math.round(b.height),
        nodes: s.querySelectorAll(".mrt-node").length,
        links: s.querySelectorAll(".mrt-link").length,
        title: !!s.querySelector("title"),
        role: s.getAttribute("role"),
      };
    } else {
      R.map = null;
    }

    /* التخطيط */
    const cols = (sel) => {
      const el = document.querySelector(sel);
      return el
        ? getComputedStyle(el).gridTemplateColumns.split(" ").length
        : null;
    };
    R.heroCols = cols(".hero-in");
    R.galaxyCols = cols(".galaxy");
    R.sysCols = cols(".systems");

    /* بنية الوصول والسيو */
    R.h1 = document.querySelectorAll("h1").length;
    R.h2 = document.querySelectorAll("h2").length;
    R.imgNoAlt = [...document.querySelectorAll("img")].filter(
      (i) => i.getAttribute("alt") === null,
    ).length;
    R.lang = document.documentElement.lang;
    R.dir = document.documentElement.dir || "ltr";

    return JSON.stringify(R);
  };
})();
