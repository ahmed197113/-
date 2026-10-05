// المساعد الذكي للتوجيه المحاسبي: يقترح الحساب والمشروع والضريبة أثناء الكتابة
(function () {
  const form = document.querySelector("form[data-smart]");
  if (!form) return;
  const side = form.dataset.side || "purchase";
  const AUTO = 75; // نسبة الثقة التي يتم عندها التوجيه تلقائياً إذا كان الحساب فارغاً

  function csrf() { const el = form.querySelector("input[name=csrfmiddlewaretoken]"); return el ? el.value : ""; }
  function val(sel) { const el = form.querySelector(sel); return el ? el.value : ""; }
  function setSelect(el, value) {
    if (!el || value == null) return;
    if (el.tomselect) el.tomselect.setValue(String(value)); else el.value = value;
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }
  function scope(input) { return input.closest("tr") || form; }
  function find(sc, names) {
    for (const n of names) { const el = sc.querySelector(`select[name$='${n}']`); if (el) return el; }
    return null;
  }
  function debounce(fn, ms) { let t; return function () { const a = arguments; clearTimeout(t); t = setTimeout(() => fn.apply(this, a), ms); }; }

  function box(input) {
    let b = input.parentElement.querySelector(".smart-box");
    if (!b) { b = document.createElement("div"); b.className = "smart-box"; input.parentElement.appendChild(b); }
    return b;
  }

  async function suggest(input) {
    const text = input.value.trim();
    const b = box(input);
    if (text.length < 3) { b.innerHTML = ""; return; }
    const sc = scope(input);
    const product = sc.querySelector("select[name$='product']");
    const params = new URLSearchParams({ text, side, partner: val("#id_partner"), product: product ? product.value : "" });
    let data;
    try { data = await (await fetch("/api/suggest/line/?" + params)).json(); } catch (e) { return; }
    const accSel = find(sc, ["-account", "counter_account"]);
    const prjSel = find(sc, ["-project", "project"]);
    const vatSel = find(sc, ["-vat"]);
    let html = "";
    if (data.accounts.length) {
      const top = data.accounts[0];
      if (accSel && !accSel.value && top.confidence >= AUTO) {
        setSelect(accSel, top.account_id);
        html += `<div class="smart-auto"><i class="bi bi-stars"></i> تم التوجيه تلقائياً إلى <b>${top.account}</b> (ثقة ${top.confidence}%)</div>`;
      }
      html += `<div class="smart-chips"><i class="bi bi-lightbulb text-warning"></i> `;
      data.accounts.forEach(s => {
        const cls = s.confidence >= AUTO ? "high" : s.confidence >= 45 ? "mid" : "low";
        const why = (s.reasons || []).join(" • ").replace(/"/g, "&quot;");
        html += `<button type="button" class="smart-chip ${cls}" data-acc="${s.account_id}" title="${why}">${s.account} <span>${s.confidence}%</span></button>`;
      });
      html += `</div>`;
      if (top.hint) html += `<div class="smart-hint"><i class="bi bi-info-circle"></i> ${top.hint}</div>`;
    }
    if (data.project && prjSel && !prjSel.value) {
      html += `<div class="smart-hint"><button type="button" class="smart-chip mid" data-prj="${data.project.id}"><i class="bi bi-building"></i> ${data.project.name}</button> <small>${data.project.reason}</small></div>`;
    }
    if (data.taxes && data.taxes.vat && vatSel && !vatSel.value) {
      setSelect(vatSel, data.taxes.vat.id);
    }
    const wht = form.querySelector("#id_wht");
    if (data.taxes && data.taxes.wht && wht && !wht.value && !wht.dataset.touched) {
      setSelect(wht, data.taxes.wht.id);
    }
    b.innerHTML = html;
    b.querySelectorAll("[data-acc]").forEach(btn => btn.addEventListener("click", () => { setSelect(accSel, btn.dataset.acc); b.querySelector(".smart-chips").classList.add("applied"); }));
    b.querySelectorAll("[data-prj]").forEach(btn => btn.addEventListener("click", () => { setSelect(prjSel, btn.dataset.prj); btn.closest(".smart-hint").remove(); }));
    review();
  }

  form.addEventListener("input", e => {
    const el = e.target;
    if (!el.classList.contains("smart-text")) return;
    clearTimeout(el._smartTimer);
    el._smartTimer = setTimeout(() => suggest(el), 450);
  });
  form.addEventListener("change", e => {
    if (e.target.name && e.target.name.endsWith("product")) {
      const desc = scope(e.target).querySelector(".smart-text");
      if (desc && desc.value) suggest(desc);
    }
    if (e.target.id === "id_wht") e.target.dataset.touched = "1";
  });

  // مراجعة المستند بالكامل (تكرار، مقاول باطن، أصول، مشروعات...)
  const notesBox = document.getElementById("smart-notes");
  const review = debounce(async function () {
    if (!notesBox) return;
    const lines = [];
    form.querySelectorAll("tbody tr").forEach(tr => {
      if (tr.style.display === "none") return;
      const t = tr.querySelector(".smart-text"); if (!t) return;
      const acc = tr.querySelector("select[name$='-account']"), prj = tr.querySelector("select[name$='-project']");
      lines.push({ text: t.value, account_id: acc && acc.value ? +acc.value : null, project_id: prj && prj.value ? +prj.value : null });
    });
    const body = { kind: val("#id_kind"), partner: val("#id_partner"), date: val("#id_date"), reference: val("#id_reference"),
      total: (document.getElementById("g-total") || {}).dataset ? (document.getElementById("g-total").dataset.value || 0) : 0,
      project: val("#id_project"), id: form.dataset.id || null, lines };
    let data;
    try {
      data = await (await fetch("/api/suggest/invoice/", { method: "POST", headers: { "Content-Type": "application/json", "X-CSRFToken": csrf() }, body: JSON.stringify(body) })).json();
    } catch (e) { return; }
    const icons = { danger: "bi-exclamation-octagon", warning: "bi-exclamation-triangle", info: "bi-lightbulb" };
    notesBox.innerHTML = data.notes.length ? data.notes.map(n =>
      `<div class="alert alert-${n.level} py-2 px-3 mb-2 small"><i class="bi ${icons[n.level]}"></i> ${n.text}${n.link ? ` <a href="${n.link}" target="_blank" class="alert-link">فتح</a>` : ""}</div>`).join("")
      : `<div class="text-success small"><i class="bi bi-check-circle"></i> لا توجد ملاحظات — المستند يبدو سليماً</div>`;
  }, 700);
  window.smartReview = review;
  form.addEventListener("change", review);
  document.addEventListener("formset:changed", review);
  review();
})();
