
'use strict';

const $ = selector => document.querySelector(selector);

const list = $('#trackList');
const reader = $('#readerDialog');
const ageDialog = $('#ageDialog');
const musicDialog = $('#musicDialog');
const videoWrap = $('#videoWrap');

let chapters = [];
let filter = 'all';
let pendingChapter = null;
let currentChapter = null;
let selectedSong = 0;

// OFFICIAL SOUNDTRACK
// Each song uses its own YouTube video, not a playlist.
const soundtrack = [
  {
    title: '我愛，我在',
    artist: '小宇 宋念宇',
    videoId: 'VdYIMjVJU90'
  },
  {
    title: 'Sleepless Night',
    artist: '李佳歡 Kaia Lee',
    videoId: 'w6j_U-ebSdE'
  },
  {
    title: 'Shatter Of The Sun',
    artist: 'Release',
    videoId: 'q8RhdhSEZeg'
  },
  {
    title: "Ain't Gonna Stop",
    artist: 'Release',
    videoId: 'oDEWrS8kEzE'
  },
  {
    title: 'Heal Your Broken Heart',
    artist: '吳思賢',
    videoId: 'Ka1FvoxIIJs'
  },
  {
    title: 'Until The Sunrise',
    artist: 'PATRICKANANDA',
    videoId: '2WSN6fp24WU'
  },
  {
    title: 'Not Afraid',
    artist: 'TAIYO',
    videoId: 'CxuMhNROmqU'
  },
  {
    title: 'Neil',
    artist: 'MAX',
    videoId: 'A4TjT02wZAE'
  }
];

function el(tag, cls, value) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (value !== undefined) node.textContent = value;
  return node;
}

// CHAPTER DATA

function normalize(item) {
  if (!item || typeof item !== 'object') return null;

  const published =
    item.published === true &&
    item.status === '已發布';

  if (!published || !item.title || !item.content) {
    return null;
  }

  return {
    id: String(item.id ?? item.order ?? ''),
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

  if (filter === 'general') {
    return chapter.rating === '一般';
  }

  if (filter === 'adult') {
    return chapter.rating === '18+';
  }

  if (filter === 'reese') {
    return chapter.cp.some(
      value => /reese|orca/i.test(value)
    );
  }

  if (filter === 'neil') {
    return chapter.cp.some(
      value => /neil|小海/i.test(value)
    );
  }

  return true;
}

function render() {
  list.replaceChildren();

  const visible = chapters.filter(matches);

  if (!visible.length) {
    const empty = el('div', 'empty-state');

    empty.append(
      el(
        'strong',
        '',
        chapters.length
          ? '此分類目前沒有公開曲目'
          : '曲目正在準備中'
      )
    );

    empty.append(
      el(
        'span',
        '',
        chapters.length
          ? '試試其他篩選條件。'
          : '故事正式發布後，曲目就會出現在這裡。'
      )
    );

    list.append(empty);
    return;
  }

  visible.forEach(chapter => {
    const row = el('div', 'track-row');

    row.append(
      el(
        'span',
        'track-number',
        String(chapter.order).padStart(2, '0')
      )
    );

    const info = el('div', 'track-info');

    info.append(
      el('h3', 'track-title', chapter.title)
    );

    const tags = el('div', 'track-tags');

    chapter.cp.forEach(cp => {
      tags.append(el('span', 'tag', cp));
    });

    tags.append(
      el(
        'span',
        chapter.rating === '18+'
          ? 'tag adult'
          : 'tag',
        chapter.rating
      )
    );

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
      () => requestRead(chapter)
    );

    row.append(button);
    list.append(row);
  });
}

// READER AND AGE CONFIRMATION

function requestRead(chapter) {
  if (
    chapter.rating === '18+' &&
    sessionStorage.getItem('ageConfirmed') !== 'yes'
  ) {
    pendingChapter = chapter;
    ageDialog.showModal();
    return;
  }

  showReader(chapter);
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

  meta.append(
    el(
      'span',
      chapter.rating === '18+'
        ? 'tag adult'
        : 'tag',
      chapter.rating
    )
  );

  const index = chapters.indexOf(chapter);

  $('#prevTrack').disabled = index <= 0;

  $('#nextTrack').disabled =
    index >= chapters.length - 1;

  if (!reader.open) {
    reader.showModal();
  }

  $('.reader-shell').scrollTop = 0;
}

function goRelative(step) {
  const index = chapters.indexOf(currentChapter);
  const target = chapters[index + step];

  if (!target) return;

  reader.close();
  requestRead(target);
}

// SOUNDTRACK PLAYER

function youtubeUrl(song) {
  return (
    'https://www.youtube.com/watch?v=' +
    encodeURIComponent(song.videoId)
  );
}

function stopMusic() {
  videoWrap.replaceChildren();
}

function playSong(index) {
  if (index < 0 || index >= soundtrack.length) return;

  selectedSong = index;
  stopMusic();

  const song = soundtrack[index];

  const heading = el(
    'div',
    'ost-current',
    `♪ ${song.title} — ${song.artist}`
  );

  const iframe = document.createElement('iframe');

  iframe.src =
    'https://www.youtube-nocookie.com/embed/' +
    encodeURIComponent(song.videoId) +
    '?rel=0&playsinline=1';

  iframe.title =
    `${song.title} — ${song.artist}`;

  iframe.allow =
    'accelerometer; autoplay; clipboard-write; ' +
    'encrypted-media; gyroscope; picture-in-picture; ' +
    'web-share';

  iframe.allowFullscreen = true;

  iframe.referrerPolicy =
    'strict-origin-when-cross-origin';

  iframe.loading = 'eager';

  const externalLink = el(
    'a',
    'ost-external',
    '在 YouTube 開啟這首歌 ↗'
  );

  externalLink.href = youtubeUrl(song);
  externalLink.target = '_blank';
  externalLink.rel = 'noopener noreferrer';

  videoWrap.append(
    heading,
    iframe,
    externalLink
  );

  renderSoundtrack();
}

function renderSoundtrack() {
  let container = $('#ostSongList');

  if (!container) {
    container = el('div', 'ost-song-list');
    container.id = 'ostSongList';

    videoWrap.insertAdjacentElement(
      'afterend',
      container
    );
  }

  container.replaceChildren();

  soundtrack.forEach((song, index) => {
    const button = el('button', 'ost-song');

    button.type = 'button';

    const active = index === selectedSong;

    button.classList.toggle('selected', active);

    button.setAttribute(
      'aria-pressed',
      String(active)
    );

    button.setAttribute(
      'aria-label',
      `選擇歌曲 ${song.title}`
    );

    const number = el(
      'span',
      'ost-number',
      String(index + 1).padStart(2, '0')
    );

    const details = el('span', 'ost-details');

    details.append(
      el('strong', '', song.title),
      el('small', '', song.artist)
    );

    const symbol = el(
      'span',
      'ost-symbol',
      active ? '♫' : '▶'
    );

    button.append(number, details, symbol);

    button.addEventListener('click', () => {
      playSong(index);
    });

    container.append(button);
  });
}

function openMusic() {
  if (!musicDialog.open) {
    musicDialog.showModal();
  }

  playSong(selectedSong);
}

function closeMusic() {
  if (musicDialog.open) {
    musicDialog.close();
  }

  stopMusic();
}

// SOUNDTRACK STYLES

function addSoundtrackStyles() {
  if ($('#ostDynamicStyles')) return;

  const style = document.createElement('style');

  style.id = 'ostDynamicStyles';

  style.textContent = `
    .ost-current {
      color: #28556a;
      font-size: 1rem;
      font-weight: 700;
      margin: 14px 0;
      line-height: 1.6;
    }

    .ost-song-list {
      display: grid;
      gap: 10px;
      margin: 24px 0;
    }

    .ost-song {
      display: flex;
      align-items: center;
      gap: 14px;
      width: 100%;
      padding: 15px;
      border: 1px solid #cce8f2;
      border-radius: 16px;
      background: #f4fbfe;
      color: #28556a;
      text-align: left;
      cursor: pointer;
      font: inherit;
      transition:
        background .2s,
        border-color .2s;
    }

    .ost-song:hover {
      background: #e7f6fc;
    }

    .ost-song.selected {
      background: #dff3fb;
      border-color: #78c4e2;
    }

    .ost-song:focus-visible {
      outline: 3px solid #28556a;
      outline-offset: 2px;
    }

    .ost-number {
      color: #70b7d2;
      font-weight: 700;
      min-width: 25px;
    }

    .ost-details {
      display: flex;
      flex-direction: column;
      gap: 4px;
      flex: 1;
      min-width: 0;
    }

    .ost-details strong {
      font-size: .98rem;
      overflow-wrap: anywhere;
    }

    .ost-details small {
      color: #718f9d;
      font-size: .82rem;
    }

    .ost-symbol {
      display: grid;
      place-items: center;
      width: 34px;
      height: 34px;
      flex-shrink: 0;
      border-radius: 50%;
      background: #78c4e2;
      color: white;
    }

    .ost-external {
      display: inline-block;
      margin: 14px 0;
      padding: 11px 17px;
      border-radius: 999px;
      background: #78c4e2;
      color: #fff;
      text-decoration: none;
      font-size: .9rem;
      font-weight: 700;
    }
  `;

  document.head.append(style);
}

// FILTER EVENTS

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

// MUSIC EVENTS

$('#openMusic').addEventListener('click', openMusic);
$('#heroMusic').addEventListener('click', openMusic);
$('#closeMusic').addEventListener('click', closeMusic);

musicDialog.addEventListener('close', stopMusic);

// READER EVENTS

$('#closeReader').addEventListener(
  'click',
  () => reader.close()
);

$('#backToList').addEventListener(
  'click',
  () => reader.close()
);

$('#prevTrack').addEventListener(
  'click',
  () => goRelative(-1)
);

$('#nextTrack').addEventListener(
  'click',
  () => goRelative(1)
);

// AGE CONFIRMATION EVENTS

$('#cancelAge').addEventListener('click', () => {
  pendingChapter = null;
  ageDialog.close();
});

$('#confirmAge').addEventListener('click', () => {
  sessionStorage.setItem('ageConfirmed', 'yes');

  ageDialog.close();

  if (pendingChapter) {
    showReader(pendingChapter);
  }

  pendingChapter = null;
});

// INITIALIZATION

addSoundtrackStyles();

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
    chapters = (
      Array.isArray(data) ? data : []
    )
      .map(normalize)
      .filter(Boolean)
      .sort((a, b) => a.order - b.order);

    render();
  })
  .catch(() => {
    list.replaceChildren(
      el(
        'div',
        'empty-state',
        '目前無法讀取曲目資料，請稍後再試。'
      )
    );
  });
