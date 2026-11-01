# Bilibili Video Saver for Edge

A small Microsoft Edge extension that downloads the currently selected Bilibili video page using the playback quality available to the signed-in account. It downloads directly through Edge and does not rely on a third-party details page.

## Install in Edge

1. Download and extract the ZIP attached to the latest GitHub release.
2. Open `edge://extensions` and enable **Developer mode**.
3. Select **Load unpacked** and choose the extracted `bilibili-video-saver` folder.
4. Open a `bilibili.com/video/...` page, select the extension, choose a quality, then start the download.

Keep the extracted folder in place. Unpacked extensions do not automatically sync to another computer. Automatic installation across devices requires publication and approval in Microsoft Edge Add-ons, followed by installing the store listing and enabling Edge extension sync.

## Behavior and limitations

- The extension requests a playback URL from Bilibili with the current tab's signed-in session, then passes that URL to Edge Downloads.
- Signed playback URLs expire. Start the download promptly; reload the video page and retry if the URL has expired.
- The current implementation supports single-file MP4 responses. Multi-segment responses that need merging are reported as unsupported.
- Availability and maximum quality are controlled by Bilibili and the account's access.

## Permissions

- `activeTab`, `scripting`: read video metadata from the active Bilibili page.
- Bilibili API and CDN host access: request a playback URL and retrieve its media.
- `downloads`: hand the selected media URL to Edge's download manager.
- `declarativeNetRequestWithHostAccess`: set the Bilibili referrer on CDN requests.
- `storage`: clean up the temporary request-header rule when the download ends.

## License

MIT. See [LICENSE](LICENSE).
