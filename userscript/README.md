# Bilibili Video Saver 油猴版

当前版本：1.1.0。已安装旧版的用户请重新导入同一个脚本，确认更新后刷新视频页。

界面示意图见项目根目录的 [README](../README.md)。独立 `.user.js` 安装文件随 [GitHub Release](https://github.com/yangyyyy15/bilibili-video-saver-edge/releases/latest) 发布。

从上游 v1.3.0（提交 `aaea05208d6b124aa7a71bbe27b334fc799176ad`）迁移，保留 MIT 许可。

## 安装

1. 在 Edge 扩展商店安装正式版 **Tampermonkey（篡改猴）**。
2. 打开油猴的管理面板，进入“实用工具”，在“从文件导入”中选择同目录的 `bilibili-video-saver.user.js`，确认安装。也可以新建脚本，完整替换默认内容后保存。
3. 打开或刷新 B 站视频页，点击网页右侧蓝色圆形下载图标，展开菜单后选择清晰度并下载。
4. 首次使用时，允许油猴访问 B 站 API、视频 CDN 及管理下载。如果提示下载未启用，在油猴设置中启用下载，下载模式选择“浏览器 API”；如有扩展名白名单提示，添加 `mp4`、`flv`、`m4v`。
5. 若油猴提示需要“允许用户脚本”或开发者模式，按其提示到 `edge://extensions` 的油猴详情页或扩展管理页启用，然后刷新 B 站页面。

脚本安装后保存在油猴中，下载完成后可以删除安装文件及本地上游项目目录。不要卸载油猴或清除其扩展数据；换电脑时请使用油猴的导出/导入或备份功能迁移。

## 功能和边界

- 使用当前浏览器的 B 站登录会话，不导出 Cookie，不经过第三方解析站。
- 按当前 URL 获取视频及分 P 信息；支持网页内部切换视频后更新。
- 选择画质、记住上次选择、保存位置选项、进度、取消及错误提示。
- 网页悬浮图标，点击展开下载菜单；支持沿右侧上下拖动并记住位置，菜单自动避开窗口边缘。点击菜单外或按 Esc 收起；收起后仍保留下载进度，图标上的状态点显示下载中、完成或失败。
- B 站其他页面也保留图标，打开菜单会提示进入视频页。图标使用内嵌 Lucide 图形，无需从外部加载资源。
- 发起下载前重新获取签名地址。API 查询附加 B 站 Referer；实际下载不设置该请求头，因为 Edge 的浏览器下载 API 会拒绝它。地址过期或下载失败时重新点击下载。
- 画质选项由接口提供，不保证每一档都能返回单文件；账号权限及接口实际返回结果决定最终清晰度。接口降级时显示实际画质，并按实际画质命名文件。
- 与原扩展相同，只下载接口返回的单文件 MP4/FLV/M4V，不合并 DASH 音视频或多个分段，不支持番剧专用页面、直播、整合集批量下载或绕过会员限制。试看响应会拒绝下载。
- 下载期间保留视频标签页；关闭页面可能中断下载或进度回调，具体取决于油猴的下载模式。
- 没有自动更新地址，避免被上游浏览器扩展代码误覆盖。后续更新请手动导入新的脚本文件。

## 原扩展为何消失

仅凭现象无法确认原因。开发者模式加载的扩展依赖原始解压目录，路径被移动、删除、临时文件被清理，或切换 Edge 配置文件，都需要排查。若扩展卡片显示被禁用，具体提示也很关键。

继续使用原扩展时，应把目录放在固定位置，通过 `edge://extensions` 的“加载解压缩的扩展”安装。面向普通用户分发的长期安装方式是由作者发布到 Edge 扩展商店；自行打包 CRX 不等于商店安装。油猴版则只需要从商店安装脚本管理器，再导入本脚本。

## 验证范围

仓库附有浏览器模拟验证，覆盖画质降级、分 P 切换、取消、多片段、DASH、下载权限、接口错误及窄屏布局。模拟测试不能证明 B 站真实账号、CDN 防盗链和当前油猴版本的组合一定成功；仍需在登录的实际视频页完成一次下载验证。

1.0.1 修复依据：在本机 Edge 157 中使用隔离的临时扩展复现，`chrome.downloads.download` 带 `Referer` 时返回 `Unsafe request header name`，去掉后可正常完成一个 8 字节测试下载。已安装的 Tampermonkey 5.5.1 在此调用失败路径会报告 `unknown`。视频 `BV1GXWQ6wEmC` 的播放接口返回 835,321,140 字节的 720P MP4，CDN 在不带 Referer 时返回 HTTP 206 及正确的 1 KB 范围数据；尚未实测整段视频下载完成。

开发验证（Windows PowerShell，需要 Node.js 和默认路径安装的 Edge）：

```powershell
npm install --prefix "$env:TEMP\bili-userscript-qa" playwright
node .\verify.cjs
node .\diagnose-download.cjs
```

上游：https://github.com/yangyyyy15/bilibili-video-saver-edge

Tampermonkey 下载 API：https://www.tampermonkey.net/documentation.php?locale=en&q=GM_download

Edge 本地加载说明：https://learn.microsoft.com/en-us/microsoft-edge/extensions-chromium/getting-started/extension-sideloading
