const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const http = require('node:http');
const assert = require('node:assert/strict');
const { chromium } = require(path.join(process.env.TEMP, 'bili-userscript-qa/node_modules/playwright'));

(async () => {
  const requests = [];
  const server = http.createServer((req, res) => {
    requests.push({ referer: req.headers.referer || null });
    res.writeHead(200, { 'Content-Type': 'video/mp4', 'Content-Length': '8' });
    res.end('BVS-TEST');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let context;
  try {
    const extension = path.join(__dirname, 'diagnostics');
    context = await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(), 'bvs-edge-diagnostic-')), {
      executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
      headless: true,
      args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`]
    });
    const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker', { timeout: 15000 });
    let downloadId;
    for (const referer of [true, false]) {
      const result = await worker.evaluate(async ({ url, referer }) => new Promise(resolve => {
        chrome.downloads.download({ url, filename: 'bvs-test.mp4',
          ...(referer ? { headers: [{ name: 'Referer', value: 'https://www.bilibili.com/' }] } : {})
        }, id => resolve({ id: id ?? null, error: chrome.runtime.lastError?.message || null }));
      }), { url: `http://127.0.0.1:${server.address().port}/test.mp4`, referer });
      console.log(JSON.stringify({ referer, ...result }));
      if (referer) {
        assert.equal(result.id, null);
        assert.equal(result.error, 'Unsafe request header name');
      } else {
        assert.equal(result.error, null);
        assert.equal(typeof result.id, 'number');
        downloadId = result.id;
      }
    }
    let item;
    for (let attempt = 0; attempt < 30; attempt++) {
      item = await worker.evaluate(id => chrome.downloads.search({ id }).then(items => items[0]), downloadId);
      if (item?.state === 'complete' || item?.state === 'interrupted') break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.equal(item?.state, 'complete');
    assert.equal(item.bytesReceived, 8);
    console.log(JSON.stringify({ state: item.state, bytesReceived: item.bytesReceived }));
    console.log(JSON.stringify({ requests }));
  } finally {
    if (context) await context.close();
    server.close();
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
