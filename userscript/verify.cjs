const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(path.join(process.env.TEMP, 'bili-userscript-qa/node_modules/playwright'));

(async () => {
  const browser = await chromium.launch({
    executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    headless: true
  });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => route.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body></body></html>'
    }));
    await page.goto('https://www.bilibili.com/video/BV1234567890/');
    await page.evaluate(() => {
      window.mock = { mode: 'normal', delay: 0, downloads: [], calls: [], stored: {}, aborted: 0 };
      window.GM_getValue = (key, fallback) => mock.stored[key] ?? fallback;
      window.GM_setValue = (key, value) => { mock.stored[key] = value; };
      window.GM_registerMenuCommand = () => {};
      window.GM_xmlhttpRequest = options => {
        const url = new URL(options.url);
        mock.calls.push(url.href);
        const part = url.searchParams.get('cid') || '';
        const data = url.pathname.endsWith('/view')
          ? { aid: 123, title: '测试视频 / Windows: 标题', pages: [{ cid: 11, part: '第一集' }, { cid: 22, part: '第二集' }] }
          : { quality: 64, accept_quality: [80, 64, 32, 16],
            durl: [{ url: `https://test.bilivideo.com/media-${part}.mp4?signature=keep%2Bthis` }] };
        if (mock.mode === 'multi' && data.durl) data.durl.push(data.durl[0]);
        if (mock.mode === 'dash' && data.durl) { delete data.durl; data.dash = {}; }
        if (mock.mode === 'preview') data.is_preview = 1;
        const response = { status: 200, response: { code: 0, data } };
        if (mock.mode === 'api-error') response.response = { code: -101, message: '请登录' };
        setTimeout(() => options.onload(response), mock.delay);
      };
      window.GM_download = options => {
        mock.downloads.push({ url: options.url, name: options.name, headers: options.headers, saveAs: options.saveAs });
        mock.callbacks = options;
        if (mock.mode === 'permission') setTimeout(() => options.onerror({ error: 'not_permitted' }), 5);
        else if (mock.mode === 'interrupted') setTimeout(() => options.onerror({ error: 'not_succeeded', details: 'NETWORK_FAILED' }), 5);
        else if (options.headers?.Referer) setTimeout(() => options.onerror({ error: 'unknown' }), 5);
        else setTimeout(() => options.onprogress({ loaded: 50, total: 100 }), 5);
        return { abort() { mock.aborted++; options.onerror({ error: 'aborted' }); } };
      };
    });
    await page.addScriptTag({ content: fs.readFileSync(path.join(__dirname, 'bilibili-video-saver.user.js'), 'utf8') });
    const ui = page.locator('#bvs-userscript');
    const status = ui.locator('#status');
    async function waitText(text) {
      await page.waitForFunction(text => document.querySelector('#bvs-userscript').shadowRoot.getElementById('status').textContent.includes(text), text);
    }
    async function refresh(mode = 'normal') {
      await page.evaluate(mode => { mock.mode = mode; mock.delay = 0; }, mode);
      await ui.locator('#refresh').click();
      await waitText('就绪');
    }

    assert.equal(await ui.locator('#panel').isVisible(), false);
    assert.equal(await ui.locator('#launch svg').count(), 1);
    const launchBox = await ui.locator('#launch').boundingBox();
    assert.equal(launchBox.width, 52);
    assert.equal(launchBox.height, 52);
    await ui.locator('#launch').click();
    await waitText('就绪');
    await ui.locator('#quality').focus();
    await page.keyboard.press('Escape');
    assert.equal(await ui.locator('#panel').isVisible(), false);
    await page.keyboard.press('Enter');
    assert.equal(await ui.locator('#panel').isVisible(), true);
    await page.mouse.click(20, 20);
    assert.equal(await ui.locator('#panel').isVisible(), false);
    await ui.locator('#launch').click();
    console.log('PASS floating icon, keyboard activation, Escape and outside-click dismissal');
    assert.equal(await ui.locator('#quality option').count(), 4);
    await ui.locator('#download').click();
    await waitText('50%');
    const download = await page.evaluate(() => mock.downloads[0]);
    assert.equal(download.headers, undefined);
    assert.ok(download.url.endsWith('signature=keep%2Bthis'));
    assert.ok(download.name.endsWith('-P1-720P.mp4'));
    assert.ok(!/[\\/:*?"<>|]/.test(download.name));
    assert.ok((await status.textContent()).includes('接口返回 720P'));
    await ui.locator('#launch').click();
    assert.equal(await ui.locator('#panel').isVisible(), false);
    assert.equal(await ui.locator('#badge').isVisible(), true);
    assert.equal(await ui.getAttribute('data-state'), 'busy');
    await ui.locator('#launch').click();
    assert.ok((await status.textContent()).includes('50%'));
    await page.evaluate(() => mock.callbacks.onload());
    await waitText('下载完成');
    assert.equal(await ui.getAttribute('data-state'), 'complete');
    console.log('PASS quality fallback, signed URL, no unsafe download headers, filename, progress and completion');

    await page.evaluate(() => history.pushState({}, '', '?p=2'));
    await page.waitForFunction(() => document.querySelector('#bvs-userscript').shadowRoot.getElementById('title').textContent.includes('P2'));
    await ui.locator('#download').click();
    await waitText('50%');
    assert.ok((await page.evaluate(() => mock.downloads.at(-1).url)).includes('media-22.mp4'));
    await ui.locator('#cancel').click();
    await waitText('已取消');
    assert.equal(await page.evaluate(() => mock.aborted), 1);
    console.log('PASS SPA part switch and cancellation ignores abort error callback');

    for (const [mode, text] of [['multi', '多个片段'], ['dash', '单文件视频'], ['preview', '试看内容'], ['permission', '管理下载'], ['interrupted', 'NETWORK_FAILED']]) {
      await refresh();
      await page.evaluate(mode => { mock.mode = mode; }, mode);
      const before = await page.evaluate(() => mock.downloads.length);
      await ui.locator('#download').click();
      await waitText(text);
      if (!['permission', 'interrupted'].includes(mode)) assert.equal(await page.evaluate(() => mock.downloads.length), before);
      assert.equal(await ui.locator('#download').isEnabled(), true);
      console.log(`PASS ${mode}`);
    }
    await refresh();
    await page.evaluate(() => { mock.mode = 'api-error'; });
    await ui.locator('#refresh').click();
    await waitText('请登录');
    assert.equal(await ui.locator('#download').isEnabled(), false);
    console.log('PASS API error disables download');

    await refresh();
    await page.evaluate(() => { mock.delay = 150; });
    const before = await page.evaluate(() => mock.downloads.length);
    await ui.locator('#download').click();
    await ui.locator('#cancel').click();
    await page.waitForTimeout(250);
    assert.equal(await page.evaluate(() => mock.downloads.length), before);
    assert.ok((await status.textContent()).includes('已取消'));
    console.log('PASS cancellation while API request is pending');

    await page.evaluate(() => { mock.delay = 150; });
    await ui.locator('#download').click();
    await page.evaluate(() => history.pushState({}, '', '?p=1'));
    await waitText('视频已切换');
    assert.equal(await page.evaluate(() => mock.downloads.length), before);
    console.log('PASS navigation during playback URL request prevents stale download');
    await page.evaluate(() => { mock.delay = 0; });
    await page.waitForFunction(() => document.querySelector('#bvs-userscript').shadowRoot.getElementById('title').textContent.includes('P1'));
    await ui.locator('#close').click();
    const beforeDrag = await ui.locator('#launch').boundingBox();
    await page.mouse.move(beforeDrag.x + 26, beforeDrag.y + 26);
    await page.mouse.down();
    await page.mouse.move(beforeDrag.x + 26, 50, { steps: 12 });
    await page.mouse.up();
    assert.equal(await ui.locator('#panel').isVisible(), false);
    assert.ok((await page.evaluate(() => mock.stored.floatingBottom)) > 130);
    await ui.locator('#launch').click();
    const topPanel = await ui.locator('#panel').boundingBox();
    const topLaunch = await ui.locator('#launch').boundingBox();
    assert.ok(topPanel.y >= topLaunch.y + topLaunch.height);
    console.log('PASS dragging saves position without opening menu; menu opens below near top');
    await ui.locator('#close').click();
    await page.mouse.move(topLaunch.x + 26, topLaunch.y + 26);
    await page.mouse.down();
    await page.mouse.move(topLaunch.x + 26, 670, { steps: 12 });
    await page.mouse.up();
    await ui.locator('#launch').click();
    for (const viewport of [{ width: 1280, height: 800 }, { width: 360, height: 640 }, { width: 320, height: 568 }]) {
      await page.setViewportSize(viewport);
      await page.waitForTimeout(50);
      const box = await ui.locator('#panel').boundingBox();
      const anchor = await ui.locator('#launch').boundingBox();
      assert.ok(box.x >= 0 && box.y >= 0 && box.x + box.width <= viewport.width && box.y + box.height <= viewport.height);
      assert.ok(box.y + box.height <= anchor.y || box.y >= anchor.y + anchor.height);
      const overflow = await ui.locator('#panel').evaluate(el => el.scrollWidth > el.clientWidth);
      assert.equal(overflow, false);
      if (process.env.BVS_SCREENSHOTS) {
        await page.screenshot({ path: path.join(process.env.BVS_SCREENSHOTS, `bilibili-saver-${viewport.width}.png`) });
        if (viewport.width === 1280) {
          await ui.locator('#launch').click();
          await ui.locator('#launch').hover();
          await page.waitForTimeout(180);
          await page.screenshot({ path: path.join(process.env.BVS_SCREENSHOTS, 'bilibili-saver-floating.png') });
          await ui.locator('#launch').click();
        }
      }
    }
    console.log('PASS desktop and 360/320px panel bounds and text overflow');
    await page.setViewportSize({ width: 640, height: 360 });
    await page.waitForTimeout(50);
    const compactPanel = await ui.locator('#panel').boundingBox();
    const compactAnchor = await ui.locator('#launch').boundingBox();
    assert.ok(compactPanel.y >= 16 && compactPanel.y + compactPanel.height <= 344);
    assert.ok(compactPanel.y + compactPanel.height <= compactAnchor.y || compactPanel.y >= compactAnchor.y + compactAnchor.height);
    console.log('PASS short landscape viewport keeps menu separate from floating icon');
    await page.evaluate(() => history.pushState({}, '', '/'));
    await page.waitForTimeout(900);
    assert.equal(await ui.isVisible(), true);
    assert.equal(await ui.locator('#download').isEnabled(), false);
    assert.ok((await status.textContent()).includes('请先打开'));
    assert.deepEqual(errors, []);
    console.log('PASS non-video page keeps floating menu with disabled download; no browser script errors');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
