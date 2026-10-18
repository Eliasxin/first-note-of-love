
'use strict';

import fs from 'node:fs/promises';

const TOKEN = process.env.NOTION_TOKEN;
const DATABASE_ID = process.env.NOTION_DATABASE_ID;

// 《戀習曲》作品資料頁面的 ID
const WORK_ID = '3fc9214c53e38011964bd9b56a6b1226';

const API_VERSION = '2022-06-28';
const BASE_URL = 'https://api.notion.com/v1';

if (!TOKEN || !DATABASE_ID) {
  throw new Error(
    'Missing NOTION_TOKEN or NOTION_DATABASE_ID'
  );
}

async function notion(path, method = 'GET', body) {
  const response = await fetch(BASE_URL + path, {
    method,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Notion-Version': API_VERSION,
      'Content-Type': 'application/json'
    },
    ...(body !== undefined
      ? { body: JSON.stringify(body) }
      : {})
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(
      `Notion API ${response.status}: ${detail}`
    );
  }

  return response.json();
}

function plainText(items = []) {
  return items
    .map(item =>
      item.plain_text ??
      item.text?.content ??
      ''
    )
    .join('');
}

function propertyText(property) {
  if (!property) return '';

  switch (property.type) {
    case 'title':
      return plainText(property.title ?? []);

    case 'rich_text':
      return plainText(property.rich_text ?? []);

    case 'select':
      return property.select?.name ?? '';

    case 'status':
      return property.status?.name ?? '';

    default:
      return '';
  }
}

function propertyValues(property) {
  if (!property) return [];

  if (property.type === 'multi_select') {
    return (property.multi_select ?? [])
      .map(item => item.name);
  }

  const text = propertyText(property);
  return text ? [text] : [];
}

async function queryDatabase() {
  const pages = [];
  let cursor = null;

  do {
    const body = {
      page_size: 100,
      filter: {
        and: [
          {
            property: '發布狀態',
            select: {
              equals: '已發佈'
            }
          },
          {
            property: '網站公開',
            checkbox: {
              equals: true
            }
          }
        ]
      }
    };

    if (cursor) {
      body.start_cursor = cursor;
    }

    const data = await notion(
      `/databases/${DATABASE_ID}/query`,
      'POST',
      body
    );

    pages.push(...data.results);

    cursor = data.has_more
      ? data.next_cursor
      : null;

  } while (cursor);

  return pages;
}

async function getBlocks(blockId) {
  const blocks = [];
  let cursor = null;

  do {
    const params = new URLSearchParams({
      page_size: '100'
    });

    if (cursor) {
      params.set('start_cursor', cursor);
    }

    const data = await notion(
      `/blocks/${blockId}/children?${params}`
    );

    blocks.push(...data.results);

    cursor = data.has_more
      ? data.next_cursor
      : null;

  } while (cursor);

  return blocks;
}

async function readBlock(block, depth = 0) {
  const type = block.type;
  const data = block[type] ?? {};

  const text = plainText(data.rich_text ?? []);
  const indent = '  '.repeat(depth);

  let output = '';

  switch (type) {
    case 'paragraph':
      output = text;
      break;

    case 'heading_1':
    case 'heading_2':
    case 'heading_3':
      output = text;
      break;

    case 'bulleted_list_item':
      output = `${indent}• ${text}`;
      break;

    case 'numbered_list_item':
      output = `${indent}1. ${text}`;
      break;

    case 'quote':
      output = `「${text}」`;
      break;

    case 'to_do':
      output =
        `${data.checked ? '☑' : '☐'} ${text}`;
      break;

    case 'code':
      output = text;
      break;

    case 'divider':
      output = '────────';
      break;

    case 'image':
      output = data.caption?.length
        ? `[圖片：${plainText(data.caption)}]`
        : '[圖片]';
      break;

    default:
      output = text;
  }

  if (block.has_children && depth < 10) {
    const children = await getBlocks(block.id);
    const nested = [];

    for (const child of children) {
      const childText = await readBlock(
        child,
        depth + 1
      );

      if (childText) {
        nested.push(childText);
      }
    }

    if (nested.length) {
      output = [
        output,
        ...nested
      ].filter(Boolean).join('\n');
    }
  }

  return output.trim();
}

async function readPageContent(pageId) {
  const blocks = await getBlocks(pageId);
  const paragraphs = [];

  for (const block of blocks) {
    const text = await readBlock(block);

    if (text) {
      paragraphs.push(text);
    }
  }

  return paragraphs.join('\n\n').trim();
}

function belongsToLoveStory(page) {
  const property =
    page.properties['所屬作品'];

  if (!property) {
    throw new Error(
      `Missing 所屬作品: ${page.id}`
    );
  }

  if (property.type !== 'relation') {
    throw new Error(
      `Unexpected 所屬作品 type: ${property.type}`
    );
  }

  if (property.has_more === true) {
    throw new Error(
      `Incomplete relation data: ${page.id}`
    );
  }

  return (property.relation ?? []).some(
    item =>
      item.id.replace(/-/g, '').toLowerCase() ===
      WORK_ID
  );
}

function getCP(page) {
  return propertyValues(
    page.properties['CP / 配對']
  );
}

function getRating(page) {
  const value = propertyText(
    page.properties['閱讀分級']
  );

  if (value !== '一般' && value !== '18+') {
    throw new Error(
      `Unknown reading rating for ${page.id}: ${value}`
    );
  }

  return value;
}

async function main() {
  console.log(
    'Starting Notion sync validation...'
  );

  const pages = await queryDatabase();

  console.log(
    `Published and public candidates: ${pages.length}`
  );

  const chapters = [];

  for (const page of pages) {
    if (!belongsToLoveStory(page)) {
      continue;
    }

    const properties = page.properties;

    // Notion 使用「已發佈」
    const status = propertyText(
      properties['發布狀態']
    );

    const published =
      properties['網站公開']?.checkbox === true;

    if (status !== '已發佈' || !published) {
      continue;
    }

    const title = propertyText(
      properties['文章名稱']
    );

    const order =
      properties['章節順序']?.number;

    const cp = getCP(page);
    const rating = getRating(page);

    const content = await readPageContent(
      page.id
    );

    if (
      !title ||
      !content ||
      !Number.isFinite(order)
    ) {
      throw new Error(
        `Incomplete chapter: ${page.id}`
      );
    }

    chapters.push({
      id: page.id,
      order,
      title,
      content,
      cp,
      rating,

      // 網站 app.js 使用「已發布」
      status: '已發布',
      published: true
    });
  }

  chapters.sort(
    (a, b) => a.order - b.order
  );

  console.log(
    `Validated Love Story chapters: ${chapters.length}`
  );

  if (process.env.SYNC_WRITE !== 'true') {
    console.log(
      'DRY RUN: no files changed.'
    );
    return;
  }

  if (chapters.length === 0) {
    throw new Error(
      'Refusing to overwrite chapters.json with an empty array.'
    );
  }

  await fs.mkdir('data', {
    recursive: true
  });

  await fs.writeFile(
    'data/chapters.json',
    JSON.stringify(chapters, null, 2) + '\n',
    'utf8'
  );

  console.log(
    'Updated data/chapters.json'
  );
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
