
'use strict';

// Encore direct-link build 20261101-v3:
// diagnostic mode and resilient routing.
const DEEPLINK_BUILD = '20261101-v3';

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
let ageConfirmedInMemory = false;

function ageIsConfirmed() {
  if (ageConfirmedInMemory) return true;
  try {
    return sessionStorage.getItem('ageConfirmed') === 'yes';
  } catch (_) {
    logDiagnostic('此瀏覽器不允許 sessionStorage；已切換記憶體模式。');
    return false;
  }
}

function markAgeConfirmed() {
  ageConfirmedInMemory = true;
  try {
    sessionStorage.setItem('ageConfirmed', 'yes');
  } catch (_) {
    logDiagnostic('已在此頁暫存成年確認。');
  }
}

function normalize(item) {
  if (!item || typeof item !== 'object') return null;

  const published =
    item.published === true &&
    ['已發布', '已發佈'].includes(item.status);

  if (!published || !item.title || !item.content ||
      !(item.id || item.order)) {
    return null;
  }

  return {
    id: String(item.id || item.order || '').trim(),
    ids: [item.id, item.order, item.slug]
      .filter(v =>
        v !== null &&
        v !== undefined &&
        String(v).trim()
      )
      .map(v => String(v).trim()),
    order: Number(item.order) || 0,
    title: String(item.title),
    content: String(item.content),
    cp: Array.isArray(item.cp)
      ? item.cp.map(String)
      : [],
    rating: item.rating === '18+' ? '18+' : '一般'
  };
}

function matches(chapter) {
  if (filter === 'all') return true;
  if (filter === 'general') return chapter.rating === '一般';
  if (filter === 'adult') return chapter.rating === '18+';
  if (filter === 'reese') {
    return chapter.cp.some(v => /reese|orca/i.test(v));
  }
  if (filter === 'neil') {
    return chapter.cp.some(v => /neil|小海/i.test(v));
  }
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

    empty.append(el(
      'strong',
      '',
      chapters.length
        ? '此分類目前沒有公開曲目'
        : '曲目正在準備中'
    ));

    empty.append(el(
      'span',
      '',
      chapters.length
        ? '試試其他篩選條件。'
        : '34 篇故事已在創作資料庫中整理；待作者正式發布後，曲目就會出現在這裡。'
    ));

    list.append(empty);
    return;
  }

  visible.forEach(chapter => {
    const row = el('div', 'track-row');

    row.append(el(
      'span',
      'track-number',
      String(chapter.order).padStart(2, '0')
    ));

    const info = el('div', 'track-info');
    info.append(el('h3', 'track-title', chapter.title));

    const tags = el('div', 'track-tags');
    chapter.cp.forEach(cp => {
      tags.append(el('span', 'tag', cp));
    });

    tags.append(el(
      'span',
      chapter.rating === '18+' ? 'tag adult' : 'tag',
      chapter.rating
    ));

    info.append(tags);
    row.append(info);

    const button = el('button', 'play-track', '▶');
    button.type = 'button';
    button.setAttribute(
      'aria-label',
      `閱讀 ${chapter.title}`
    );
    button.addEventListener(
      'click',
      () => openChapterUrl(chapter)
    );

    row.append(button);
    list.append(row);
  });
}

function chapterHash(chapter) {
  return '#/read/' + encodeURIComponent(chapter.id);
}

function openChapterUrl(chapter) {
  const target = chapterHash(chapter);

  if (location.hash === target) {
    routeChapter();
  } else {
    location.hash = target;
  }
}

function closeToTrackList() {
  pendingChapter = null;

  if (location.hash !== '#tracks') {
    location.hash = '#tracks';
  } else {
    routeChapter();
  }
}

// Encore diagnostics — only with ?diag=1
const DIAGNOSTIC =
  new URLSearchParams(location.search).get('diag') === '1';

let diagLines = [];

function logDiagnostic(line) {
  if (!DIAGNOSTIC) return;

  diagLines.push(line);

  let panel = document.getElementById('deeplinkDiagnostic');

  if (!panel) {
    panel = document.createElement('aside');
    panel.id = 'deeplinkDiagnostic';
    panel.setAttribute('role', 'status');

    panel.style.cssText = [
      'position:relative',
      'z-index:2147483647',
      'box-sizing:border-box',
      'margin:12px auto',
      'padding:15px',
      'max-width:900px',
      'border:2px solid #185b6a',
      'border-radius:10px',
      'background:#ffffff',
      'color:#153844',
      'font:14px/1.65 system-ui,sans-serif',
      'white-space:pre-wrap',
      'overflow-wrap:anywhere',
      'box-shadow:0 6px 18px #0002'
    ].join(';');

    const heading = document.createElement('strong');
    heading.textContent =
      'Encore 跳轉診斷（僅在 ?diag=1 顯示）';

    panel.appendChild(heading);

    const body = document.createElement('pre');
    body.id = 'deeplinkDiagnosticText';
    body.style.cssText =
      'font:13px/1.6 ui-monospace,monospace;' +
      'white-space:pre-wrap;margin:8px 0 0;color:inherit';

    panel.appendChild(body);

    document.body.insertBefore(
      panel,
      document.body.firstChild
    );
  }

  document.getElementById(
    'deeplinkDiagnosticText'
  ).textContent = diagLines.join('\n');
}

function normalizeLookup(value) {
  return String(value || '')
    .normalize('NFKC')
    .replace(
      /^[\s〈《「『【\[]+|[\s〉》」』】\]]+$/g,
      ''
    )
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase();
}

function decoded(value) {
  try {
    return decodeURIComponent(value);
  } catch (_) {
    return '';
  }
}

function requestedChapter() {
  const params = new URLSearchParams(location.search);
  const fragment = /^#\/?read\/(.+)$/i.exec(location.hash);
  const title = params.get('title') || '';

  if (fragment) {
    return {
      id: decoded(fragment[1]),
      title
    };
  }

  if (!location.hash || location.hash === '#') {
    return {
      id: params.get('chapter') ||
          params.get('read') ||
          '',
      title
    };
  }

  return null;
}

function findPublishedChapter(request) {
  if (!request) return null;

  const id = normalizeLookup(request.id);
  const title = normalizeLookup(request.title);

  if (id) {
    const match = chapters.find(ch =>
      ch.ids.some(
        key => normalizeLookup(key) === id
      )
    );

    if (match) return match;
  }

  if (title) {
    const matches = chapters.filter(
      ch => normalizeLookup(ch.title) === title
    );

    if (matches.length === 1) return matches[0];
  }

  if (id) {
    const matches = chapters.filter(
      ch => normalizeLookup(ch.title) === id
    );

    if (matches.length === 1) return matches[0];
  }

  return null;
}

function routeChapter() {
  const requested = requestedChapter();

  if (!requested ||
      (!requested.id && !requested.title)) {
    pendingChapter = null;

    if (ageDialog.open) ageDialog.close();
    if (reader.open) reader.close();

    logDiagnostic(
      '未指定閱讀篇章；目前顯示曲目列表。'
    );
    return;
  }

  const chapter = findPublishedChapter(requested);

  if (!chapter) {
    logDiagnostic(
      '找不到符合的公開篇章；' +
      '請核對下方的公開篇章數與實際標題。'
    );

    if (!DIAGNOSTIC) closeToTrackList();
    return;
  }

  logDiagnostic(
    '公開篇章匹配成功：' +
    chapter.title + '／' + chapter.rating
  );

  if (chapter.rating === '18+' &&
      !ageIsConfirmed()) {
    pendingChapter = chapter;

    if (!ageDialog.open) {
      ageDialog.showModal();
    }

    logDiagnostic(
      '已呼叫 18+ 年齡確認視窗：' +
      (ageDialog.open ? '已開啟' : '未開啟')
    );

    return;
  }

  pendingChapter = null;

  if (ageDialog.open) ageDialog.close();

  showReader(chapter);

  logDiagnostic(
    '已呼叫閱讀視窗：' +
    (reader.open ? '已開啟' : '未開啟')
  );
}

function showReader(chapter) {
  currentChapter = chapter;

  $('#readerNumber').textContent =
    `TRACK ${String(chapter.order).padStart(2, '0')}`;

  $('#readerTitle').textContent = chapter.title;
  $('#readerBody').textContent = chapter.content;

  const meta = $('#readerMeta');
  meta.replaceChildren();

  chapter.cp.forEach(cp => {
    meta.append(el('span', 'tag', cp));
  });

  meta.append(el(
    'span',
    chapter.rating === '18+' ? 'tag adult' : 'tag',
    chapter.rating
  ));

  const index = chapters.indexOf(chapter);

  $('#prevTrack').disabled = index <= 0;
  $('#nextTrack').disabled =
    index >= chapters.length - 1;

  if (!reader.open) reader.showModal();

  $('.reader-shell').scrollTop = 0;
}

function goRelative(step) {
  const target =
    chapters[chapters.indexOf(currentChapter) + step];

  if (target) openChapterUrl(target);
}

function openMusic() {
  if (!videoWrap.querySelector('iframe')) {
    const iframe = document.createElement('iframe');

    iframe.src =
      'https://www.youtube-nocookie.com/embed/' +
      'VdYIMjVJU90?rel=0';

    iframe.title = '彈一場完美戀愛官方音樂影片';

    iframe.allow =
      'accelerometer; clipboard-write; ' +
      'encrypted-media; gyroscope; ' +
      'picture-in-picture; web-share';

    iframe.allowFullscreen = true;
    iframe.referrerPolicy =
      'strict-origin-when-cross-origin';

    videoWrap.append(iframe);
  }

  musicDialog.showModal();
}

function closeMusic() {
  musicDialog.close();
  videoWrap.replaceChildren();
}

for (const button of document.querySelectorAll('.chip')) {
  button.addEventListener('click', () => {
    filter = button.dataset.filter;

    document.querySelectorAll('.chip').forEach(chip => {
      const active = chip === button;

      chip.classList.toggle('active', active);
      chip.setAttribute(
        'aria-pressed',
        String(active)
      );
    });

    render();
  });
}

$('#openMusic').addEventListener('click', openMusic);
$('#heroMusic').addEventListener('click', openMusic);
$('#closeMusic').addEventListener('click', closeMusic);

musicDialog.addEventListener(
  'close',
  () => videoWrap.replaceChildren()
);

$('#closeReader').addEventListener(
  'click',
  closeToTrackList
);

$('#backToList').addEventListener(
  'click',
  closeToTrackList
);

$('#prevTrack').addEventListener(
  'click',
  () => goRelative(-1)
);

$('#nextTrack').addEventListener(
  'click',
  () => goRelative(1)
);

$('#cancelAge').addEventListener(
  'click',
  closeToTrackList
);

$('#confirmAge').addEventListener('click', () => {
  markAgeConfirmed();
  ageDialog.close();
  routeChapter();
});

window.addEventListener('hashchange', routeChapter);
window.addEventListener('popstate', routeChapter);

reader.addEventListener('close', () => {
  if (requestedChapter()) closeToTrackList();
});

ageDialog.addEventListener('cancel', event => {
  event.preventDefault();
  closeToTrackList();
});

logDiagnostic(
  '閱讀器程式版本：' + DEEPLINK_BUILD
);

logDiagnostic(
  '網址搜尋參數：title=' +
  (new URLSearchParams(location.search)
    .get('title') || '(無)')
);

logDiagnostic(
  '網址片段：' + (location.hash || '(無)')
);

fetch('./data/chapters.json', {
  cache: 'no-store'
})
  .then(response => {
    if (!response.ok) {
      throw new Error('讀取失敗');
    }

    return response.json();
  })
  .then(data => {
    const rows = Array.isArray(data)
      ? data
      : (
          Array.isArray(data?.chapters)
            ? data.chapters
            : []
        );

    chapters = rows
      .map(normalize)
      .filter(Boolean)
      .sort((a, b) => a.order - b.order);

    logDiagnostic(
      'JSON 回傳筆數：' + rows.length +
      '；符合公開條件：' + chapters.length
    );

    logDiagnostic(
      '含 Encore 字樣的公開標題：' +
      (
        chapters
          .filter(ch => /encore/i.test(ch.title))
          .map(ch => ch.title)
          .join('、') || '(找不到)'
      )
    );

    render();
    routeChapter();
  })
  .catch(error => {
    logDiagnostic(
      '執行或讀取錯誤：' +
      (
        error && error.message
          ? error.message
          : String(error)
      )
    );

    list.replaceChildren(
      el(
        'div',
        'empty-state',
        '目前無法讀取曲目資料，請稍後再試。'
      )
    );
  });
