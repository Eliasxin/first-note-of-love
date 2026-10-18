'use strict';
const $ = (selector) => document.querySelector(selector);
const list = $('#trackList');
const reader = $('#readerDialog');
const ageDialog = $('#ageDialog');
const musicDialog = $('#musicDialog');
const videoWrap = $('#videoWrap');
let chapters = [];
let filter = 'all';
let pendingChapter = null;
let currentChapter = null;

function normalize(item) {
  if (!item || typeof item !== 'object') return null;
  const published = item.published === true && item.status === '已發布';
  if (!published || !item.title || !item.content) return null;
  return {
    id: String(item.id ?? item.order ?? ''),
    order: Number(item.order) || 0,
    title: String(item.title),
    content: String(item.content),
    cp: Array.isArray(item.cp) ? item.cp.map(String) : [],
    rating: item.rating === '18+' ? '18+' : '一般'
  };
}
function matches(chapter) {
  if (filter === 'all') return true;
  if (filter === 'general') return chapter.rating === '一般';
  if (filter === 'adult') return chapter.rating === '18+';
  if (filter === 'reese') return chapter.cp.some(v => /reese|orca/i.test(v));
  if (filter === 'neil') return chapter.cp.some(v => /neil|小海/i.test(v));
  return true;
}
function el(tag, cls, value) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (value !== undefined) node.textContent = value;
  return node;
}
function render() {
  list.replaceChildren();
  const visible = chapters.filter(matches);
  if (!visible.length) {
    const empty = el('div', 'empty-state');
    empty.append(el('strong', '', chapters.length ? '此分類目前沒有公開曲目' : '曲目正在準備中'));
    empty.append(el('span', '', chapters.length ? '試試其他篩選條件。' : '34 篇故事已在創作資料庫中整理；待作者正式發布後，曲目就會出現在這裡。'));
    list.append(empty);
    return;
  }
  visible.forEach(chapter => {
    const row = el('div', 'track-row');
    row.append(el('span', 'track-number', String(chapter.order).padStart(2, '0')));
    const info = el('div', 'track-info');
    info.append(el('h3', 'track-title', chapter.title));
    const tags = el('div', 'track-tags');
    chapter.cp.forEach(cp => tags.append(el('span', 'tag', cp)));
    tags.append(el('span', chapter.rating === '18+' ? 'tag adult' : 'tag', chapter.rating));
    info.append(tags);
    row.append(info);
    const button = el('button', 'play-track', '▶');
    button.type = 'button';
    button.setAttribute('aria-label', `閱讀 ${chapter.title}`);
    button.addEventListener('click', () => requestRead(chapter));
    row.append(button);
    list.append(row);
  });
}
function requestRead(chapter) {
  if (chapter.rating === '18+' && sessionStorage.getItem('ageConfirmed') !== 'yes') {
    pendingChapter = chapter;
    ageDialog.showModal();
    return;
  }
  showReader(chapter);
}
function showReader(chapter) {
  currentChapter = chapter;
  $('#readerNumber').textContent = `TRACK ${String(chapter.order).padStart(2, '0')}`;
  $('#readerTitle').textContent = chapter.title;
  $('#readerBody').textContent = chapter.content;
  const meta = $('#readerMeta');
  meta.replaceChildren();
  chapter.cp.forEach(cp => meta.append(el('span', 'tag', cp)));
  meta.append(el('span', chapter.rating === '18+' ? 'tag adult' : 'tag', chapter.rating));
  const index = chapters.indexOf(chapter);
  $('#prevTrack').disabled = index <= 0;
  $('#nextTrack').disabled = index >= chapters.length - 1;
  if (!reader.open) reader.showModal();
  $('.reader-shell').scrollTop = 0;
}
function goRelative(step) {
  const target = chapters[chapters.indexOf(currentChapter) + step];
  if (target) { reader.close(); requestRead(target); }
}
function openMusic() {
  if (!videoWrap.querySelector('iframe')) {
    const iframe = document.createElement('iframe');
    iframe.src = 'https://www.youtube-nocookie.com/embed/VdYIMjVJU90?rel=0';
    iframe.title = '彈一場完美戀愛官方音樂影片';
    iframe.allow = 'accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
    iframe.allowFullscreen = true;
    iframe.referrerPolicy = 'strict-origin-when-cross-origin';
    videoWrap.append(iframe);
  }
  musicDialog.showModal();
}
function closeMusic() { musicDialog.close(); videoWrap.replaceChildren(); }
for (const button of document.querySelectorAll('.chip')) {
  button.addEventListener('click', () => {
    filter = button.dataset.filter;
    document.querySelectorAll('.chip').forEach(chip => {
      const active = chip === button;
      chip.classList.toggle('active', active);
      chip.setAttribute('aria-pressed', String(active));
    });
    render();
  });
}
$('#openMusic').addEventListener('click', openMusic);
$('#heroMusic').addEventListener('click', openMusic);
$('#closeMusic').addEventListener('click', closeMusic);
musicDialog.addEventListener('close', () => videoWrap.replaceChildren());
$('#closeReader').addEventListener('click', () => reader.close());
$('#backToList').addEventListener('click', () => reader.close());
$('#prevTrack').addEventListener('click', () => goRelative(-1));
$('#nextTrack').addEventListener('click', () => goRelative(1));
$('#cancelAge').addEventListener('click', () => { pendingChapter = null; ageDialog.close(); });
$('#confirmAge').addEventListener('click', () => {
  sessionStorage.setItem('ageConfirmed', 'yes');
  ageDialog.close();
  if (pendingChapter) showReader(pendingChapter);
  pendingChapter = null;
});
fetch('./data/chapters.json', { cache: 'no-store' })
  .then(response => { if (!response.ok) throw new Error('讀取失敗'); return response.json(); })
  .then(data => { chapters = (Array.isArray(data) ? data : []).map(normalize).filter(Boolean).sort((a,b) => a.order - b.order); render(); })
  .catch(() => { list.replaceChildren(el('div', 'empty-state', '目前無法讀取曲目資料，請稍後再試。')); });
