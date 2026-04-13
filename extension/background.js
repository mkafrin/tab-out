/**
 * background.js — Service Worker
 *
 * This script runs in the background and is responsible for updating the
 * extension's badge (showing the number of open tabs).
 */

// Badge colors — service workers have no DOM, so CSS variables are unavailable.
// These match the OKLCH accent values in newtab.css (converted back to hex).
const BADGE_COLOR_CALM  = '#3d7a4a'; // < 20 tabs (sage/active green)
const BADGE_COLOR_WARM  = '#c8713a'; // 20-39 tabs (amber)
const BADGE_COLOR_HOT   = '#b35a5a'; // 40+ tabs (rose)

/**
 * updateBadge — Counts all open tabs and updates the badge.
 * The badge color reflects the "heat" level (count of open tabs).
 */
async function updateBadge() {
  try {
    const tabs = await chrome.tabs.query({});
    const count = tabs.length;

    chrome.action.setBadgeText({ text: count.toString() });

    let color = BADGE_COLOR_CALM;
    if (count >= 20 && count < 40) {
      color = BADGE_COLOR_WARM;
    } else if (count >= 40) {
      color = BADGE_COLOR_HOT;
    }

    chrome.action.setBadgeBackgroundColor({ color });
  } catch (err) {
    console.error('Error updating badge:', err);
  }
}

// Update badge when tabs are created, removed, or updated
chrome.tabs.onCreated.addListener(updateBadge);
chrome.tabs.onRemoved.addListener(updateBadge);
chrome.tabs.onUpdated.addListener(updateBadge);

// Initial update on startup
updateBadge();
