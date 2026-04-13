/**
 * background.js — Service Worker
 *
 * This script runs in the background and is responsible for updating the
 * extension's badge (showing the number of open tabs).
 */

/**
 * updateBadge — Counts all open tabs and updates the badge.
 * The badge color reflects the "heat" level (count of open tabs).
 */
async function updateBadge() {
  try {
    const tabs = await chrome.tabs.query({});
    const count = tabs.length;

    // Update badge text
    chrome.action.setBadgeText({ text: count.toString() });

    // Update color based on count thresholds
    // - Green (Calm):  < 20 tabs
    // - Amber (Warm):  20-39 tabs
    // - Red (Hot):     40+ tabs
    let color = '#3d7a4a'; // Green
    if (count >= 20 && count < 40) {
      color = '#c8713a'; // Amber
    } else if (count >= 40) {
      color = '#b35a5a'; // Red
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
