const qualityNames = new Map([
  [120, "4K"], [116, "1080P 60帧"], [112, "1080P+"], [80, "1080P"],
  [74, "720P 60帧"], [64, "720P"], [32, "480P"], [16, "360P"]
]);

const titleEl = document.querySelector("#title");
const qualityEl = document.querySelector("#quality");
const button = document.querySelector("#download");
const statusEl = document.querySelector("#status");
let activeTab;

function status(message, isError = false) {
  statusEl.textContent = message;
  statusEl.classList.toggle("error", isError);
}

async function readVideo(tabId) {
  const [result] = await chrome.scripting.executeScript({
    target: { tabId },
    world: "MAIN",
    func: () => {
      const state = window.__INITIAL_STATE__;
      const video = state?.videoData;
      const page = video?.pages?.[(state?.p || 1) - 1];
      if (!video?.aid || !page?.cid) return { error: "无法读取当前视频信息，请刷新 Bilibili 页面后重试。" };
      const playinfo = window.__playinfo__?.data;
      const qualities = playinfo?.accept_quality?.length
        ? playinfo.accept_quality
        : [80, 64, 32, 16];
      return {
        aid: video.aid,
        bvid: video.bvid,
        cid: page.cid,
        page: state.p || 1,
        title: video.title || document.title,
        qualities
      };
    }
  });
  return result?.result;
}

async function getMedia(video, qn) {
  const [result] = await chrome.scripting.executeScript({
    target: { tabId: activeTab.id },
    world: "MAIN",
    args: [video.aid, video.cid, qn],
    func: async (aid, cid, qn) => {
      const params = new URLSearchParams({
        otype: "json", platform: "html5", avid: String(aid), cid: String(cid),
        fnver: "0", fnval: "0", qn: String(qn)
      });
      const response = await fetch(`https://api.bilibili.com/x/player/playurl?${params}`, { credentials: "include" });
      if (!response.ok) return { error: `Bilibili 播放接口返回 HTTP ${response.status}` };
      const payload = await response.json();
      if (payload.code !== 0) return { error: payload.message || `Bilibili 错误 ${payload.code}` };
      if (payload.data?.durl?.length > 1) return { error: "该视频由多个片段组成，此版本暂不支持合并下载。" };
      const media = payload.data?.durl?.[0];
      if (!media?.url) return { error: "当前画质没有可下载的视频地址。" };
      const pathname = new URL(media.url).pathname;
      const extension = pathname.match(/\.(mp4|flv|m4v)$/i)?.[1] || "mp4";
      return { url: media.url, format: extension };
    }
  });
  return result?.result;
}

function safeFilename(title, page, extension) {
  const base = `${title}${page > 1 ? `-${page}` : ""}`
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_")
    .replace(/[. ]+$/g, "")
    .slice(0, 170) || "bilibili-video";
  return `${base}.${extension.replace(/^\./, "") || "mp4"}`;
}

async function initialize() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  activeTab = tab;
  if (!tab?.id || !/^https?:\/\/(www\.)?bilibili\.com\/video\//i.test(tab.url || "")) {
    titleEl.textContent = "请先打开一个 Bilibili 视频页面。";
    status("支持 bilibili.com/video 页面。", true);
    return;
  }
  const video = await readVideo(tab.id);
  if (!video || video.error) {
    titleEl.textContent = video?.error || "无法读取当前视频。";
    status("请刷新视频页后重试。", true);
    return;
  }
  activeTab.video = video;
  titleEl.textContent = video.title;
  qualityEl.replaceChildren(...video.qualities.map(qn => {
    const option = document.createElement("option");
    option.value = String(qn);
    option.textContent = qualityNames.get(qn) || `${qn}P`;
    return option;
  }));
  qualityEl.disabled = false;
  button.disabled = false;
  status("将使用当前账号可播放的画质。下载会打开 Edge 保存对话框。");
}

button.addEventListener("click", async () => {
  button.disabled = true;
  status("正在获取视频地址…");
  try {
    const media = await getMedia(activeTab.video, Number(qualityEl.value));
    if (!media || media.error) throw new Error(media?.error || "未取得视频地址。");

    const ruleId = Math.floor(Date.now() % 1_000_000_000) + 1;
    await chrome.declarativeNetRequest.updateSessionRules({
      removeRuleIds: [ruleId],
      addRules: [{
        id: ruleId,
        priority: 1,
        action: { type: "modifyHeaders", requestHeaders: [{ header: "Referer", operation: "set", value: "https://www.bilibili.com/" }] },
        condition: {
          urlFilter: "||bilivideo.com/",
          initiatorDomains: [chrome.runtime.id],
          resourceTypes: ["other", "xmlhttprequest"]
        }
      }]
    });

    const downloadId = await chrome.downloads.download({
      url: media.url,
      filename: safeFilename(activeTab.video.title, activeTab.video.page, media.format),
      saveAs: true
    });
    await chrome.storage?.session?.set?.({ [`download-rule-${downloadId}`]: ruleId });
    status("已交给 Edge 下载。若地址已过期，请刷新 Bilibili 页面后重试。");
  } catch (error) {
    status(error?.message || "下载初始化失败。", true);
  } finally {
    button.disabled = false;
  }
});

initialize().catch(error => status(error?.message || "读取视频失败。", true));
