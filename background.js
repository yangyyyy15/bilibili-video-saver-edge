chrome.downloads.onChanged.addListener(async ({ id, state }) => {
  if (!state || !["complete", "interrupted"].includes(state.current)) return;
  const key = `download-rule-${id}`;
  const stored = await chrome.storage.session.get(key);
  const ruleId = stored[key];
  if (ruleId) {
    await chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: [ruleId] });
    await chrome.storage.session.remove(key);
  }
});
