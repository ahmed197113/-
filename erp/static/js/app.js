// أدوات الواجهة العامة
(function () {
  function initSearchable(root) {
    if (!window.TomSelect) return;
    (root || document).querySelectorAll("select.searchable").forEach(function (el) {
      if (el.tomselect || el.closest(".empty-form")) return;
      new TomSelect(el, { allowEmptyOption: true, maxOptions: 500, plugins: [] });
    });
  }
  window.initSearchable = initSearchable;

  // إضافة سطر جديد في جداول السطور (formsets)
  window.addFormRow = function (prefix) {
    var total = document.getElementById("id_" + prefix + "-TOTAL_FORMS");
    var tpl = document.getElementById(prefix + "-empty");
    var body = document.getElementById(prefix + "-body");
    var idx = parseInt(total.value, 10);
    var html = tpl.innerHTML.replace(/__prefix__/g, idx);
    var tmp = document.createElement("tbody");
    tmp.innerHTML = html.trim();
    var row = tmp.firstElementChild;
    body.appendChild(row);
    total.value = idx + 1;
    initSearchable(row);
    document.dispatchEvent(new CustomEvent("formset:added", { detail: { row: row, prefix: prefix } }));
    return row;
  };

  window.removeFormRow = function (btn) {
    var row = btn.closest("tr");
    var del = row.querySelector("input[name$='-DELETE']");
    if (del) { del.checked = true; row.style.display = "none"; }
    else { row.remove(); }
    document.dispatchEvent(new CustomEvent("formset:changed"));
  };

  window.num = function (v) { var n = parseFloat(String(v || "").replace(/,/g, "")); return isNaN(n) ? 0 : n; };
  window.fmt = function (v) {
    return Number(v || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // تصدير أي جدول إلى Excel
  window.exportTable = function (btn, filename) {
    var table = document.querySelector(btn && btn.dataset.target ? btn.dataset.target : "table.exportable") ||
      document.querySelector("table");
    var html = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">' +
      '<head><meta charset="utf-8"><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet>' +
      '<x:Name>Sheet1</x:Name><x:WorksheetOptions><x:DisplayRightToLeft/></x:WorksheetOptions></x:ExcelWorksheet>' +
      '</x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]--></head><body dir="rtl">' + table.outerHTML + "</body></html>";
    var blob = new Blob(["﻿" + html], { type: "application/vnd.ms-excel" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = (filename || document.title) + ".xls";
    a.click();
  };

  document.addEventListener("DOMContentLoaded", function () {
    initSearchable();
    document.querySelectorAll("tr.clickable[data-href]").forEach(function (tr) {
      tr.addEventListener("click", function (e) {
        if (e.target.closest("a,button,form")) return;
        window.location = tr.dataset.href;
      });
    });
    var t = document.getElementById("sidebarToggle");
    if (t) t.addEventListener("click", function () { document.querySelector(".sidebar").classList.toggle("show"); });
    document.querySelectorAll("form[data-confirm]").forEach(function (f) {
      f.addEventListener("submit", function (e) { if (!confirm(f.dataset.confirm)) e.preventDefault(); });
    });
  });
})();
