#!/usr/bin/env node
// Zero-dependency tests for the core logic embedded in index.html.
// Run: node tests.js
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const m = html.match(/<script id="antcms-core">([\s\S]*?)<\/script>/);
if (!m) throw new Error('core script not found in index.html');
const mod = { exports: {} };
new Function('module', 'exports', m[1])(mod, mod.exports);
const C = mod.exports;

const tests = [];
const test = (name, fn) => tests.push([name, fn]);

test('slugify normalises text', () => {
  assert.equal(C.slugify('  The Queen\'s   Chamber! '), 'the-queen-s-chamber');
  assert.equal(C.slugify('Café Ünïcode'), 'cafe-unicode');
  assert.equal(C.slugify('---'), '');
  assert.equal(C.slugify('a'.repeat(100)).length, 64);
  assert.equal(C.slugify(null), '');
});

test('escapeHtml escapes the five characters', () => {
  assert.equal(C.escapeHtml(`<a href="x">&'</a>`), '&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;');
});

test('createPage creates with auto slug and timestamps', () => {
  const r = C.createPage([], { title: 'Hello Ants', body: 'hi' }, 1000);
  assert.equal(r.ok, true);
  assert.deepEqual(r.page, { title: 'Hello Ants', slug: 'hello-ants', body: 'hi', createdAt: 1000, updatedAt: 1000 });
  assert.equal(r.pages.length, 1);
});

test('createPage rejects missing title, bad slug, reserved slug, duplicate', () => {
  assert.match(C.createPage([], { title: '   ' }).errors.join(), /Title is required/);
  assert.match(C.createPage([], { title: 'x', slug: 'Bad Slug' }).errors.join(), /lowercase/);
  assert.match(C.createPage([], { title: 'x', slug: 'colony' }).errors.join(), /reserved/);
  const first = C.createPage([], { title: 'Dup' }).pages;
  const r = C.createPage(first, { title: 'Dup' });
  assert.equal(r.ok, false);
  assert.match(r.errors.join(), /already exists/);
  assert.equal(r.pages, first, 'pages untouched on failure');
});

test('createPage rejects title and body over limits', () => {
  assert.match(C.createPage([], { title: 'x'.repeat(121) }).errors.join(), /120 characters/);
  assert.match(C.createPage([], { title: 'x', body: 'y'.repeat(50001) }).errors.join(), /too long/);
});

test('updatePage edits, keeps createdAt, allows same slug, allows slug change', () => {
  const pages = C.createPage([], { title: 'One', body: 'a' }, 1).pages;
  let r = C.updatePage(pages, 'one', { title: 'One!', slug: 'one', body: 'b' }, 2);
  assert.equal(r.ok, true);
  assert.equal(r.page.createdAt, 1);
  assert.equal(r.page.updatedAt, 2);
  assert.equal(r.page.body, 'b');
  r = C.updatePage(pages, 'one', { title: 'One', slug: 'uno', body: 'a' }, 3);
  assert.equal(r.ok, true);
  assert.equal(r.pages[0].slug, 'uno');
  assert.equal(C.findPage(r.pages, 'one'), null);
});

test('updatePage rejects unknown page and slug clash with another page', () => {
  let pages = C.createPage([], { title: 'A' }).pages;
  pages = C.createPage(pages, { title: 'B' }).pages;
  assert.equal(C.updatePage(pages, 'zzz', { title: 'x' }).ok, false);
  const r = C.updatePage(pages, 'a', { title: 'A', slug: 'b' });
  assert.equal(r.ok, false);
  assert.match(r.errors.join(), /already exists/);
});

test('deletePage removes and reports missing', () => {
  const pages = C.createPage([], { title: 'Gone' }).pages;
  assert.deepEqual(C.deletePage(pages, 'gone').pages, []);
  assert.equal(C.deletePage(pages, 'nope').ok, false);
  assert.equal(pages.length, 1, 'input not mutated');
});

test('render: paragraphs, headings, lists, inline', () => {
  const html = C.render('# Title\n\nHello **bold** and *it*.\nline two\n\n- one\n- two\n\n## Sub');
  assert.equal(html, [
    '<h1>Title</h1>',
    '<p>Hello <strong>bold</strong> and <em>it</em>.<br>line two</p>',
    '<ul><li>one</li><li>two</li></ul>',
    '<h2>Sub</h2>',
  ].join('\n'));
});

test('render: escapes HTML and blocks unsafe links', () => {
  assert.equal(C.render('<script>alert(1)</script>'), '<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>');
  assert.equal(C.render('[x](javascript:alert(1))'), '<p>[x](javascript:alert(1))</p>');
  assert.equal(C.render('[x](https://a.b/?q=1)'), '<p><a href="https://a.b/?q=1">x</a></p>');
  assert.equal(C.render('[x](#/p/welcome)'), '<p><a href="#/p/welcome">x</a></p>');
  assert.equal(C.render('[<b>](https://a.b)'), '<p><a href="https://a.b">&lt;b&gt;</a></p>');
  assert.equal(C.render('[x](https://a.b/"onmouseover="x)'), '<p><a href="https://a.b/&quot;onmouseover=&quot;x">x</a></p>');
});

test('render: CRLF and empty input', () => {
  assert.equal(C.render('a\r\n\r\nb'), '<p>a</p>\n<p>b</p>');
  assert.equal(C.render(''), '');
  assert.equal(C.render(null), '');
});

test('excerpt strips markup and truncates', () => {
  assert.equal(C.excerpt('# Hi **there**'), 'Hi there');
  const e = C.excerpt('word '.repeat(100));
  assert.ok(e.length <= 120 && e.endsWith('…'));
});

test('sanitisePages drops junk and duplicates', () => {
  const out = C.sanitisePages([
    { slug: 'ok', title: 'Ok', body: 'b', createdAt: 1, updatedAt: 2 },
    { slug: 'ok', title: 'dupe' },
    { slug: 'Bad Slug' },
    null, 'str', { title: 'no slug' },
    { slug: 'min' },
  ]);
  assert.deepEqual(out, [
    { slug: 'ok', title: 'Ok', body: 'b', createdAt: 1, updatedAt: 2 },
    { slug: 'min', title: 'min', body: '', createdAt: 0, updatedAt: 0 },
  ]);
  assert.deepEqual(C.sanitisePages('nope'), []);
  assert.deepEqual(C.sanitisePages(null), []);
});

let failed = 0;
for (const [name, fn] of tests) {
  try { fn(); console.log('  ok   ' + name); }
  catch (e) { failed++; console.log('  FAIL ' + name + '\n       ' + String(e.message).split('\n').join('\n       ')); }
}
console.log(`\n${tests.length - failed}/${tests.length} passed`);
process.exit(failed ? 1 : 0);
