import { h, toast, hu, clear } from '../ui.js';
import { exportText, importText, resetAll } from '../lib/store.js';
import { planInputs } from './setup.js';

export function render(app) {
  const st = app.state;
  const file = h('input', { type: 'file', accept: 'application/json,.json,text/plain', hidden: true });
  file.addEventListener('change', async () => {
    const f = file.files?.[0];
    if (!f) return;
    try {
      const next = importText(await f.text());
      Object.assign(st, next);
      app.save();
      toast('✅ رجّعت تقدمك من الملف');
      app.go('home');
    } catch {
      toast('❌ الملف ده مش ملف تقدم من التطبيق');
    }
  });

  async function doExport() {
    const text = exportText(st);
    const name = `hungarian-exam-progress-${new Date().toISOString().slice(0, 10)}.json`;
    try {
      const f = new File([text], name, { type: 'application/json' });
      if (navigator.canShare?.({ files: [f] })) { await navigator.share({ files: [f], title: 'نسخة احتياطية' }); return; }
    } catch (e) { if (e?.name === 'AbortError') return; }
    const a = h('a', { href: URL.createObjectURL(new Blob([text], { type: 'application/json' })), download: name });
    document.body.append(a); a.click(); a.remove();
    toast('⬇️ اتحفظ الملف في Downloads / Files');
  }

  async function doCopy() {
    try { await navigator.clipboard.writeText(exportText(st)); toast('📋 اتنسخ — الصقه في Notes واحفظه'); } catch { toast('مقدرتش أنسخ — استخدم «صدّر»'); }
  }

  const resetBox = h('div', {});
  const askReset = () => {
    clear(resetBox);
    resetBox.append(h('div', { class: 'card danger' },
      h('p', {}, 'متأكد؟ هيتمسح كل تقدمك (الكروت، الأيام، الامتحانات). خد نسخة احتياطية الأول.'),
      h('div', { class: 'grade-row' },
        h('button', { class: 'btn ghost', type: 'button', onclick: () => clear(resetBox) }, 'لأ'),
        h('button', { class: 'btn bad', type: 'button', onclick: () => { Object.assign(st, resetAll()); app.save(); app.go('setup'); } }, 'امسح كل حاجة'))));
  };

  const D = app.DATA;
  return h('div', { class: 'screen page' },
    h('header', { class: 'page-top' }, h('a', { class: 'icon-btn', href: '#/home', 'aria-label': 'رجوع' }, '→'), h('h1', {}, '⚙️ الإعدادات')),
    h('div', { class: 'card' }, h('h2', {}, 'الخطة'), planInputs(app, () => toast('اتحفظ ✅ — الخطة اتظبطت')), h('a', { class: 'row-link', href: '#/plan' }, 'شوف الخطة بالتواريخ ←')),
    h('div', { class: 'card' }, h('h2', {}, 'الكتابة بالقلم'), h('a', { class: 'row-link', href: '#/pad' }, '✍️ جرّب الكتابة بالقلم (أو بصباعك) ←'), h('a', { class: 'row-link', href: '#/scribble' }, '🔤 إعداد Scribble (ألماني) + تجربة ←')),
    h('div', { class: 'card' }, h('h2', {}, 'نسخة احتياطية'),
      h('p', { class: 'muted small' }, 'تقدمك محفوظ على الجهاز ده بس (الآيفون والآيباد كل واحد لوحده). خد نسخة كل أسبوع، وعشان تنقل تقدمك لجهاز تاني: صدّر هنا واستورد هناك.'),
      h('div', { class: 'actions' },
        h('button', { class: 'btn', type: 'button', onclick: doExport }, '⬇️ صدّر التقدم'),
        h('button', { class: 'btn ghost', type: 'button', onclick: () => file.click() }, '⬆️ استورد'),
        h('button', { class: 'btn ghost', type: 'button', onclick: doCopy }, '📋 انسخ')), file),
    h('div', { class: 'card' }, h('h2', {}, 'المصادر'),
      h('ul', { class: 'small' },
        h('li', {}, 'الإجابات من كتيّب BFKH الرسمي — أحدث نسخة: ', hu(D.meta.mainSource), '.'),
        h('li', {}, `الأسئلة: ${D.meta.questions} سؤال حقيقي من ملف الفيسبوك، و${D.papers.length} ورقة امتحان متجمعة.`),
        h('li', {}, `آخر تحديث للبيانات: ${D.meta.built.slice(0, 10)}.`)),
      h('h3', {}, 'اللي اتغير في 2026'),
      h('ul', { class: 'small' }, D.changes.map((c) => h('li', {}, hu(c.old, { cls: 'old' }), ' ← ', hu(c.new, { cls: 'new' }))))),
    h('div', { class: 'card' }, h('button', { class: 'btn ghost bad-text', type: 'button', onclick: askReset }, '🗑 امسح التقدم وابدأ من الأول'), resetBox),
    h('p', { class: 'muted small center' }, `نسخة التطبيق ${D.meta.version}`));
}
