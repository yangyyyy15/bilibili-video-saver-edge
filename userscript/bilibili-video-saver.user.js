// ==UserScript==
// @name         Bilibili Video Saver - 视频下载
// @namespace    local.bilibili-video-saver
// @version      1.1.0
// @description  下载当前 B 站视频分 P，选择账号可用清晰度，显示进度并支持取消。
// @author       yangyyyy15; userscript adaptation
// @license      MIT
// @match        https://www.bilibili.com/*
// @match        https://bilibili.com/*
// @connect      api.bilibili.com
// @connect      bilivideo.com
// @connect      bilivideo.cn
// @connect      akamaized.net
// @grant        GM_xmlhttpRequest
// @grant        GM_download
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @run-at       document-idle
// @noframes
// ==/UserScript==

/*
 * Adapted from bilibili-video-saver-edge v1.3.0.
 * Copyright (c) 2026 yangyyyy15
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 *
 * Embedded Lucide icons (lucide-static v1.73.0), ISC License:
 * Copyright (c) 2026 Lucide Icons and Contributors
 * Permission to use, copy, modify, and/or distribute this software for any
 * purpose with or without fee is hereby granted, provided that the above
 * copyright notice and this permission notice appear in all copies.
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
 * WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
 * MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
 * ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
 * WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
 * ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
 * OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
 * Download and X icons also carry the MIT License above:
 * Copyright (c) 2013-present Cole Bemis
 */

(() => {
  'use strict';
  if (document.getElementById('bvs-userscript')) return;

  const qualityNames = new Map([
    [127, '8K'], [126, '杜比视界'], [125, 'HDR'], [120, '4K'],
    [116, '1080P 60帧'], [112, '1080P+'], [100, '智能修复'],
    [80, '1080P'], [74, '720P 60帧'], [64, '720P'], [32, '480P'], [16, '360P']
  ]);
  const host = document.createElement('div');
  host.id = 'bvs-userscript';
  const root = host.attachShadow({ mode: 'open' });
  const iconPaths = {
    monitor: '<path d="M12 13V7"/><path d="m15 10-3 3-3-3"/><rect width="20" height="14" x="2" y="3" rx="2"/><path d="M12 17v4"/><path d="M8 21h8"/>',
    download: '<path d="M12 15V3"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/>',
    refresh: '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
    close: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>'
  };
  const icon = name => `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${iconPaths[name]}</svg>`;
  // This template is static. All API-provided text is assigned via textContent.
  root.innerHTML = `
    <style>
      :host { all: initial; position: fixed; right: 24px; bottom: 130px; width: 52px; height: 52px; z-index: 2147483646;
        font: 14px/1.5 "Segoe UI", "Microsoft YaHei", sans-serif; color: #24272c; letter-spacing: 0; }
      :host([hidden]) { display: none !important; }
      * { box-sizing: border-box; } [hidden] { display: none !important; }
      button, select, input { font: inherit; } button { cursor: pointer; }
      button:disabled { cursor: default; opacity: .55; }
      button:focus-visible, select:focus-visible { outline: 2px solid #007a9e; outline-offset: 2px; }
      svg { display: block; flex: none; pointer-events: none; }
      #launch { display: grid; place-items: center; position: relative; width: 52px; height: 52px;
        border: 2px solid white; border-radius: 50%; padding: 0; background: #00a0cf; color: white;
        box-shadow: 0 3px 12px #007a9e38, 0 1px 3px #0002; touch-action: none;
        transition: background .16s, box-shadow .16s; }
      #launch > svg { width: 25px; height: 25px; }
      #launch:hover, #launch[aria-expanded="true"] { background: #008ab5; box-shadow: 0 4px 16px #007a9e50; }
      #launch:active { cursor: grabbing; }
      #badge { position: absolute; right: -2px; top: -2px; width: 13px; height: 13px;
        border: 2px solid white; border-radius: 50%; background: #fb7299; }
      :host([data-state="busy"]) #badge { background: #fb7299; animation: pulse 1.4s ease-in-out infinite; }
      :host([data-state="complete"]) #badge { background: #219c70; }
      :host([data-state="error"]) #badge { background: #da4654; }
      #tooltip { position: absolute; right: 64px; top: 11px; padding: 5px 9px; white-space: nowrap;
        border-radius: 4px; background: #30343b; color: white; font-size: 12px; pointer-events: none;
        opacity: 0; transition: opacity .15s; }
      #launch[aria-expanded="false"]:hover + #tooltip,
      #launch[aria-expanded="false"]:focus-visible + #tooltip { opacity: 1; }
      #panel { position: absolute; right: 0; top: 0; width: 328px; max-width: calc(100vw - 48px); padding: 16px;
        max-height: calc(100dvh - 32px); overflow: auto; border: 1px solid #e0e5e9;
        border-radius: 8px; background: #fff; box-shadow: 0 8px 32px #17253024, 0 2px 6px #1725300a; }
      header { display: flex; align-items: center; gap: 8px; margin-bottom: 14px; }
      .brand { display: grid; place-items: center; width: 32px; height: 32px; background: #eaf8fc; color: #0099c5; border-radius: 6px; }
      h2 { font-size: 15px; margin: 0; flex: 1; font-weight: 600; }
      .icon { display: grid; place-items: center; flex: none; width: 28px; height: 28px; padding: 0;
        border: 0; border-radius: 4px; color: #737b86; background: transparent; }
      .icon:hover { color: #24272c; background: #f0f3f5; }
      .icon svg { width: 17px; height: 17px; }
      #title { margin: 0 0 14px; padding-bottom: 14px; border-bottom: 1px solid #eef0f3;
        font-size: 13px; line-height: 1.65; overflow-wrap: anywhere; }
      label { display: block; margin: 8px 0; }
      select { display: block; width: 100%; min-height: 36px; padding: 4px 8px;
        border: 1px solid #aeb4bd; border-radius: 4px; background: white; color: #24272c; }
      .save { display: flex; align-items: center; gap: 6px; color: #555b65; font-size: 13px; }
      .actions { display: flex; gap: 8px; margin-top: 12px; }
      .actions button { min-height: 36px; padding: 6px 12px; border: 1px solid #adb4bd;
        border-radius: 4px; background: #f7f8fa; color: #303640; }
      #download { display: flex; align-items: center; justify-content: center; gap: 8px;
        flex: 1; background: #009bc7; color: #fff; border-color: #009bc7; }
      #download:hover:enabled { background: #0087ae; }
      #download svg { width: 17px; height: 17px; }
      progress { width: 100%; height: 8px; margin-top: 14px; accent-color: #007a9e; }
      #status { margin: 10px 0 0; color: #555b65; font-size: 13px; overflow-wrap: anywhere; }
      #status.error { color: #b3261e; }
      @keyframes pulse { 50% { opacity: .45; } }
      @media (max-width: 420px) { :host { right: 16px; } #panel { max-width: calc(100vw - 32px); } }
      @media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation: none !important; transition: none !important; } }
    </style>
    <section id="panel" aria-label="Bilibili 视频下载" hidden>
      <header><span class="brand">${icon('monitor')}</span><h2>视频下载</h2>
        <button id="refresh" class="icon" title="刷新视频信息" aria-label="刷新视频信息">${icon('refresh')}</button>
        <button id="close" class="icon" title="收起" aria-label="收起">${icon('close')}</button></header>
      <p id="title">正在读取视频信息...</p>
      <label for="quality">清晰度</label><select id="quality" disabled></select>
      <label class="save"><input id="saveAs" type="checkbox" checked>下载时选择保存位置</label>
      <div class="actions"><button id="download" disabled>${icon('download')}<span>下载视频</span></button><button id="cancel" hidden>取消</button></div>
      <progress id="progress" hidden></progress>
      <p id="status" role="status" aria-live="polite"></p>
    </section>
    <button id="launch" title="视频下载 · 可上下拖动" aria-label="打开视频下载菜单" aria-controls="panel" aria-expanded="false">${icon('monitor')}<span id="badge" hidden></span></button>
    <span id="tooltip" role="tooltip">视频下载</span>`;
  document.documentElement.append(host);
  const $ = id => root.getElementById(id);
  let video = null;
  let loading = false;
  let busy = false;
  let generation = 0;
  let operation = 0;
  let downloadHandle = null;
  let observedPage = '';
  let drag = null;
  let dragged = false;
  const storedPosition = Number(GM_getValue('floatingBottom', 130));
  let floatingBottom = Number.isFinite(storedPosition) ? storedPosition : 130;

  function placePanel() {
    if ($('panel').hidden) return;
    const anchor = host.getBoundingClientRect();
    const aboveSpace = Math.max(0, anchor.top - 28);
    const belowSpace = Math.max(0, innerHeight - anchor.bottom - 28);
    const naturalHeight = $('panel').scrollHeight + 2;
    const above = aboveSpace >= naturalHeight || (belowSpace < naturalHeight && aboveSpace >= belowSpace);
    $('panel').style.maxHeight = `${above ? aboveSpace : belowSpace}px`;
    const height = $('panel').getBoundingClientRect().height;
    $('panel').style.top = `${above ? -12 - height : anchor.height + 12}px`;
  }

  function placeButton() {
    floatingBottom = Math.max(16, Math.min(floatingBottom, innerHeight - 68));
    host.style.bottom = `${floatingBottom}px`;
    placePanel();
  }

  function indicator(state) {
    host.dataset.state = state;
    $('badge').hidden = !state;
    const text = { busy: '正在下载', complete: '下载完成', error: '下载失败' }[state] || '视频下载';
    $('tooltip').textContent = text;
    $('launch').title = `${text} · 可上下拖动`;
  }

  function pageKey() {
    const match = location.pathname.match(/^\/video\/(BV[0-9a-z]+|av\d+)\/?$/i);
    if (!match) return '';
    const raw = Number(new URL(location.href).searchParams.get('p') || 1);
    const page = Number.isSafeInteger(raw) && raw > 0 ? raw : 1;
    return `${match[1]}:${page}`;
  }

  function status(text, error = false) {
    $('status').textContent = text;
    $('status').classList.toggle('error', error);
    placePanel();
  }

  function controls() {
    $('download').disabled = busy || loading || !video;
    $('quality').disabled = busy || loading || !video;
    $('refresh').disabled = busy || loading;
    $('saveAs').disabled = busy;
    $('cancel').hidden = !busy;
  }

  function api(path, params) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: 'GET', url: `https://api.bilibili.com${path}?${new URLSearchParams(params)}`,
        headers: { Referer: 'https://www.bilibili.com/' },
        anonymous: false, responseType: 'json', timeout: 20000,
        onload(response) {
          try {
            if (response.status !== 200) throw new Error(`Bilibili 接口返回 HTTP ${response.status}`);
            const payload = response.response || JSON.parse(response.responseText);
            if (payload.code !== 0) throw new Error(payload.message || `接口错误 ${payload.code}`);
            if (!payload.data) throw new Error('接口没有返回视频数据。');
            resolve(payload.data);
          } catch (error) { reject(error); }
        },
        onerror: () => reject(new Error('无法连接 Bilibili 接口，请检查网络及油猴域名授权。')),
        ontimeout: () => reject(new Error('请求超时，请重试。'))
      });
    });
  }

  function playurl(current, qn) {
    return api('/x/player/playurl', {
      avid: String(current.aid), cid: String(current.cid), qn: String(qn),
      otype: 'json', platform: 'html5', fnver: '0', fnval: '0'
    });
  }

  async function loadVideo() {
    if (busy) return;
    const key = pageKey();
    const token = ++generation;
    observedPage = key;
    video = null;
    indicator('');
    loading = Boolean(key);
    controls();
    $('quality').replaceChildren();
    if (!key) {
      $('title').textContent = '当前页面没有可下载的视频';
      status('请先打开一个 B 站视频页面。');
      return;
    }
    $('title').textContent = '正在读取视频信息...';
    status('正在读取可用清晰度...');
    try {
      const [id, part] = key.split(':');
      const data = await api('/x/web-interface/view', /^av/i.test(id) ? { aid: id.slice(2) } : { bvid: id });
      const page = data.pages?.[Number(part) - 1];
      if (!data.aid || !page?.cid) throw new Error('找不到当前分 P，请检查视频地址。');
      const current = { key, aid: data.aid, cid: page.cid, page: Number(part),
        title: data.title || id, part: data.pages.length > 1 ? page.part : '' };
      const info = await playurl(current, 80);
      if (token !== generation || pageKey() !== key) return;
      const qualities = Array.from(new Set((info.accept_quality?.length ? info.accept_quality : [info.quality || 80])
        .map(Number).filter(q => Number.isFinite(q) && q > 0)));
      for (const qn of qualities) {
        const option = document.createElement('option');
        option.value = String(qn);
        option.textContent = qualityNames.get(qn) || `画质 ${qn}`;
        $('quality').append(option);
      }
      const saved = Number(GM_getValue('quality', 80));
      $('quality').value = String(qualities.includes(saved) ? saved : qualities[0]);
      video = current;
      $('title').textContent = `${current.title}${current.part ? ` / P${current.page} ${current.part}` : ''}`;
      status('就绪');
    } catch (error) {
      if (token === generation && pageKey() === key) {
        $('title').textContent = '无法读取当前视频';
        status(error.message, true);
      }
    } finally {
      if (token === generation) { loading = false; controls(); }
    }
  }

  function filename(current, extension, qn) {
    let base = `${current.title}${current.part || current.page > 1 ? `-P${current.page}` : ''}-${qualityNames.get(qn) || qn}`
      .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').slice(0, 150).replace(/[. ]+$/g, '');
    if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(base)) base = `_${base}`;
    return `${base || 'bilibili-video'}.${extension}`;
  }

  function downloadError(error) {
    const messages = {
      not_enabled: '请在油猴设置中启用下载功能，并将下载模式设为“浏览器 API”。',
      not_whitelisted: '请在油猴设置的下载扩展名白名单中添加 mp4、flv 和 m4v。',
      not_permitted: '请允许油猴的“管理下载”权限。',
      not_supported: '当前脚本管理器不支持下载，请使用 Tampermonkey 并启用下载功能。'
    };
    if (messages[error?.error]) return messages[error.error];
    const detail = typeof error?.details === 'string' ? error.details
      : error?.details?.message || error?.details?.error || error?.message || '';
    const reason = [error?.error, detail].filter(Boolean).join(': ') || '未知错误';
    if (/unsafe request header/i.test(reason)) return 'Edge 拒绝了下载请求头，请确认油猴中已更新为 1.0.1 或更高版本。';
    if (/user_canceled|aborted/i.test(reason)) return '下载已取消。';
    return `下载失败（${reason}）。请重新下载获取新地址；若仍失败，请查看 Edge 下载记录（edge://downloads）的错误原因。`;
  }

  async function startDownload() {
    if (busy || loading || !video) return;
    if (pageKey() !== video.key) { await loadVideo(); return; }
    const current = video;
    const qn = Number($('quality').value);
    const token = ++operation;
    busy = true;
    indicator('busy');
    controls();
    $('progress').hidden = false;
    $('progress').removeAttribute('value');
    status('正在获取视频地址...');

    function finish(message, error = false) {
      if (token !== operation) return;
      busy = false;
      downloadHandle = null;
      $('progress').hidden = true;
      controls();
      status(message, error);
      indicator(error ? 'error' : 'complete');
    }

    try {
      GM_setValue('quality', qn);
      const data = await playurl(current, qn);
      if (token !== operation) return;
      if (pageKey() !== current.key) throw new Error('视频已切换，请刷新下载面板后重试。');
      if (data.is_preview) throw new Error('接口返回的是试看内容，请确认当前账号拥有完整视频权限。');
      if (data.durl?.length > 1) throw new Error('该视频包含多个片段，原扩展及此脚本暂不支持合并下载。');
      const media = data.durl?.[0];
      if (!media?.url) throw new Error('接口未返回单文件视频。此画质可能需要音视频合并，请尝试其他清晰度。');
      const url = new URL(media.url);
      if (!['https:', 'http:'].includes(url.protocol)) throw new Error('接口返回了无效的视频地址。');
      const allowedDomains = ['bilivideo.com', 'bilivideo.cn', 'akamaized.net'];
      if (!allowedDomains.some(domain => url.hostname === domain || url.hostname.endsWith(`.${domain}`))) {
        throw new Error(`尚未支持的视频域名：${url.hostname}`);
      }
      // Upgrade CDN transport; never rewrite the signed query parameters.
      url.protocol = 'https:';
      const extension = url.pathname.match(/\.(mp4|flv|m4v)$/i)?.[1]?.toLowerCase() || 'mp4';
      const actual = Number(data.quality) || qn;
      const label = qualityNames.get(actual) || `画质 ${actual}`;
      const prefix = actual !== qn ? `接口返回 ${label}（低于所选或与所选不同）。` : `${label}。`;
      status(`${prefix}正在下载...`);
      downloadHandle = GM_download({
        url: url.href, name: filename(current, extension, actual),
        // Edge's downloads API rejects Referer as an unsafe request header.
        // Keep this a direct download so large videos are not buffered in memory.
        saveAs: $('saveAs').checked,
        onprogress(event) {
          if (token !== operation) return;
          const total = Number(event.total || event.totalSize);
          const loaded = Number(event.loaded || 0);
          if (total > 0) {
            const percent = Math.min(100, Math.floor(loaded / total * 100));
            $('progress').max = 100;
            $('progress').value = percent;
            status(`${prefix}已下载 ${percent}%`);
          }
        },
        onload: () => finish(`${label} 下载完成。`),
        onerror: error => finish(downloadError(error), true),
        ontimeout: () => finish('下载超时，请重新下载。', true)
      });
    } catch (error) { finish(error.message || '下载失败。', true); }
  }

  function togglePanel(open = $('panel').hidden) {
    $('panel').hidden = !open;
    $('launch').setAttribute('aria-expanded', String(open));
    $('launch').setAttribute('aria-label', open ? '收起视频下载菜单' : '打开视频下载菜单');
    if (open && !busy && !loading && (!video || pageKey() !== video.key)) loadVideo();
    placePanel();
  }

  $('launch').addEventListener('click', event => {
    if (dragged && event.detail !== 0) { dragged = false; return; }
    togglePanel();
  });
  $('launch').addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    dragged = false;
    drag = { id: event.pointerId, y: event.clientY, bottom: floatingBottom };
    $('launch').setPointerCapture(event.pointerId);
  });
  $('launch').addEventListener('pointermove', event => {
    if (!drag || event.pointerId !== drag.id) return;
    const distance = event.clientY - drag.y;
    if (Math.abs(distance) > 5) dragged = true;
    if (dragged) { floatingBottom = drag.bottom - distance; placeButton(); }
  });
  function endDrag(event) {
    if (!drag || event.pointerId !== drag.id) return;
    drag = null;
    if (dragged) GM_setValue('floatingBottom', floatingBottom);
  }
  $('launch').addEventListener('pointerup', endDrag);
  $('launch').addEventListener('pointercancel', endDrag);
  $('launch').addEventListener('lostpointercapture', endDrag);
  $('close').addEventListener('click', () => { togglePanel(false); $('launch').focus(); });
  document.addEventListener('pointerdown', event => {
    if (!event.composedPath().includes(host) && !$('panel').hidden) togglePanel(false);
  });
  root.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !$('panel').hidden) {
      event.stopPropagation();
      togglePanel(false);
      $('launch').focus();
    }
  });
  window.addEventListener('resize', placeButton);
  new ResizeObserver(placePanel).observe($('panel'));
  $('refresh').addEventListener('click', loadVideo);
  $('download').addEventListener('click', startDownload);
  $('cancel').addEventListener('click', () => {
    const handle = downloadHandle;
    ++operation;
    busy = false;
    downloadHandle = null;
    $('progress').hidden = true;
    controls();
    try { handle?.abort(); } catch (_) { /* Cancellation may race completion. */ }
    status('已取消。');
    indicator('');
  });
  GM_registerMenuCommand('Bilibili 视频下载', () => togglePanel(true));

  // Bilibili can navigate without reloading the document. Keep active downloads alive.
  setInterval(() => {
    const key = pageKey();
    if (!busy && key !== observedPage) loadVideo();
  }, 800);
  observedPage = pageKey();
  placeButton();
})();
