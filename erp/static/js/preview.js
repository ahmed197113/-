// خاص بنسخة المعاينة الثابتة فقط
(function () {
  function toast(msg) {
    var t = document.getElementById("pv-toast");
    if (!t) { t = document.createElement("div"); t.id = "pv-toast"; document.body.appendChild(t); }
    t.textContent = msg; t.className = "show";
    clearTimeout(t._h); t._h = setTimeout(function () { t.className = ""; }, 2600);
  }
  var css = document.createElement("style");
  css.textContent = ".preview-banner{background:#fff8e1;color:#7a5200;border-bottom:1px solid #f0d58a;padding:.45rem 1rem;font-size:.85rem;text-align:center;position:relative;z-index:1040;margin-right:var(--sidebar-w)}" +
    "@media(max-width:991px){.preview-banner{margin-right:0}}" +
    "#pv-toast{position:fixed;bottom:20px;left:50%;transform:translateX(-50%) translateY(120px);background:#1f3a5f;color:#fff;padding:.6rem 1.1rem;border-radius:.6rem;z-index:3000;transition:transform .25s;font-size:.9rem}" +
    "#pv-toast.show{transform:translateX(-50%) translateY(0)}";
  document.head.appendChild(css);
  document.addEventListener("submit", function (e) { e.preventDefault(); toast("دي نسخة معاينة — الحفظ والترحيل بيشتغلوا بعد التثبيت"); }, true);
  document.addEventListener("click", function (e) {
    var a = e.target.closest("a[href='#nopreview']");
    if (a) { e.preventDefault(); toast("الصفحة دي مش ضمن المعاينة"); }
  }, true);
  window.addEventListener("hashchange", function () { if (location.hash === "#nopreview") toast("الصفحة دي مش ضمن المعاينة"); });
  window.print = function () { toast("الطباعة متاحة في النسخة المثبتة"); };
  window.exportTable = function () { toast("التصدير لـ Excel متاح في النسخة المثبتة"); };
})();
