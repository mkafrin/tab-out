/**
 * newtab.js — Main Dashboard Logic
 *
 * This script runs the Tab Out dashboard. It manages open tabs via the
 * Chrome Tabs API and persists "Saved for Later" items via chrome.storage.local.
 */

'use strict';

/* ----------------------------------------------------------------
   STATE & CONSTANTS
   ---------------------------------------------------------------- */

let openTabs = [];
let domainGroups = [];

// Map of known domains → friendly display names.
const FRIENDLY_DOMAINS = {
  'github.com':           'GitHub',
  'www.github.com':       'GitHub',
  'gist.github.com':      'GitHub Gist',
  'youtube.com':          'YouTube',
  'www.youtube.com':      'YouTube',
  'music.youtube.com':    'YouTube Music',
  'x.com':                'X',
  'www.x.com':            'X',
  'twitter.com':          'X',
  'www.twitter.com':      'X',
  'reddit.com':           'Reddit',
  'www.reddit.com':       'Reddit',
  'old.reddit.com':       'Reddit',
  'substack.com':         'Substack',
  'www.substack.com':     'Substack',
  'medium.com':           'Medium',
  'www.medium.com':       'Medium',
  'linkedin.com':         'LinkedIn',
  'www.linkedin.com':     'LinkedIn',
  'stackoverflow.com':    'Stack Overflow',
  'www.stackoverflow.com':'Stack Overflow',
  'news.ycombinator.com': 'Hacker News',
  'google.com':           'Google',
  'www.google.com':       'Google',
  'mail.google.com':      'Gmail',
  'docs.google.com':      'Google Docs',
  'drive.google.com':     'Google Drive',
  'calendar.google.com':  'Google Calendar',
  'meet.google.com':      'Google Meet',
  'gemini.google.com':    'Gemini',
  'chatgpt.com':          'ChatGPT',
  'www.chatgpt.com':      'ChatGPT',
  'chat.openai.com':      'ChatGPT',
  'claude.ai':            'Claude',
  'www.claude.ai':        'Claude',
  'code.claude.com':      'Claude Code',
  'notion.so':            'Notion',
  'www.notion.so':        'Notion',
  'figma.com':            'Figma',
  'www.figma.com':        'Figma',
  'slack.com':            'Slack',
  'app.slack.com':        'Slack',
  'discord.com':          'Discord',
  'www.discord.com':      'Discord',
  'wikipedia.org':        'Wikipedia',
  'en.wikipedia.org':     'Wikipedia',
  'amazon.com':           'Amazon',
  'www.amazon.com':       'Amazon',
  'netflix.com':          'Netflix',
  'www.netflix.com':      'Netflix',
  'spotify.com':          'Spotify',
  'open.spotify.com':     'Spotify',
  'vercel.com':           'Vercel',
  'www.vercel.com':       'Vercel',
  'npmjs.com':            'npm',
  'www.npmjs.com':        'npm',
  'developer.mozilla.org':'MDN',
  'arxiv.org':            'arXiv',
  'www.arxiv.org':        'arXiv',
  'huggingface.co':       'Hugging Face',
  'www.huggingface.co':   'Hugging Face',
  'producthunt.com':      'Product Hunt',
  'www.producthunt.com':  'Product Hunt',
  'xiaohongshu.com':      'RedNote',
  'www.xiaohongshu.com':  'RedNote',
  'local-files':          'Local Files',
};

const ICONS = {
  tabs: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M3 8.25V18a2.25 2.25 0 0 0 2.25 2.25h13.5A2.25 2.25 0 0 0 21 18V8.25m-18 0V6a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 6v2.25m-18 0h18" /></svg>`,
  close: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>`,
  archive: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5m6 4.125l2.25 2.25m0 0l2.25 2.25M12 13.875l2.25-2.25M12 13.875l-2.25 2.25M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" /></svg>`,
  focus: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m4.5 19.5 15-15m0 0H8.25m11.25 0v11.25" /></svg>`
};

/* ----------------------------------------------------------------
   CHROME API HELPERS
   ---------------------------------------------------------------- */

async function fetchOpenTabs() {
  const tabs = await chrome.tabs.query({});
  const extensionId = chrome.runtime.id;
  const newtabUrl = `chrome-extension://${extensionId}/newtab.html`;

  openTabs = tabs.map(tab => ({
    id:       tab.id,
    url:      tab.url,
    title:    tab.title,
    windowId: tab.windowId,
    active:   tab.active,
    isTabOut: tab.url === newtabUrl || tab.url === 'chrome://newtab/',
  }));
}

async function closeTabsByUrls(urls, exact = false) {
  if (!urls || urls.length === 0) return;

  if (exact) {
    const urlSet = new Set(urls);
    const allTabs = await chrome.tabs.query({});
    const matchingIds = allTabs
      .filter(tab => urlSet.has(tab.url))
      .map(tab => tab.id);
    if (matchingIds.length > 0) await chrome.tabs.remove(matchingIds);
    return;
  }

  const targetHostnames = [];
  const targetExactUrls = new Set();
  for (const u of urls) {
    if (u.startsWith('file://')) {
      targetExactUrls.add(u);
    } else {
      try { targetHostnames.push(new URL(u).hostname); }
      catch { /* skip */ }
    }
  }

  const allTabs = await chrome.tabs.query({});
  const matchingTabIds = allTabs
    .filter(tab => {
      const tabUrl = tab.url || '';
      if (tabUrl.startsWith('file://') && targetExactUrls.has(tabUrl)) return true;
      try {
        const tabHostname = new URL(tabUrl).hostname;
        return tabHostname && targetHostnames.includes(tabHostname);
      } catch { return false; }
    })
    .map(tab => tab.id);

  if (matchingTabIds.length > 0) await chrome.tabs.remove(matchingTabIds);
}

async function focusTabByUrl(url) {
  if (!url) return;
  const allTabs = await chrome.tabs.query({});
  const currentWindow = await chrome.windows.getCurrent();

  let matches = allTabs.filter(t => t.url === url);
  if (matches.length === 0) {
    try {
      const targetHost = new URL(url).hostname;
      matches = allTabs.filter(t => {
        try { return new URL(t.url).hostname === targetHost; }
        catch { return false; }
      });
    } catch {}
  }

  if (matches.length === 0) return;
  const match = matches.find(t => t.windowId !== currentWindow.id) || matches[0];
  await chrome.tabs.update(match.id, { active: true });
  await chrome.windows.update(match.windowId, { focused: true });
}

async function closeDuplicates(urls, keepOne = true) {
  const allTabs = await chrome.tabs.query({});
  const tabIdsToClose = [];

  for (const url of urls) {
    const matching = allTabs.filter(t => t.url === url);
    if (keepOne) {
      const keep = matching.find(t => t.active) || matching[0];
      for (const tab of matching) {
        if (tab.id !== keep.id) tabIdsToClose.push(tab.id);
      }
    } else {
      for (const tab of matching) tabIdsToClose.push(tab.id);
    }
  }

  if (tabIdsToClose.length > 0) await chrome.tabs.remove(tabIdsToClose);
}

async function closeTabOutDupes() {
  const allTabs = await chrome.tabs.query({});
  const extensionId = chrome.runtime.id;
  const newtabUrl = `chrome-extension://${extensionId}/newtab.html`;

  const tabOutTabs = allTabs.filter(t =>
    t.url === newtabUrl || t.url === 'chrome://newtab/'
  );

  if (tabOutTabs.length <= 1) return;
  const keep = tabOutTabs.find(t => t.active) || tabOutTabs[0];
  const toClose = tabOutTabs.filter(t => t.id !== keep.id).map(t => t.id);
  if (toClose.length > 0) await chrome.tabs.remove(toClose);
}

/* ----------------------------------------------------------------
   STORAGE HELPERS (Saved for later)
   ---------------------------------------------------------------- */

async function getDeferredItems() {
  const data = await chrome.storage.local.get('deferredItems');
  return data.deferredItems || [];
}

async function saveDeferredItem(tab) {
  const items = await getDeferredItems();
  const newItem = {
    id: Date.now() + Math.random().toString(36).substr(2, 9),
    url: tab.url,
    title: tab.title,
    deferred_at: new Date().toISOString(),
    archived: false
  };
  items.push(newItem);
  await chrome.storage.local.set({ deferredItems: items });
}

async function updateDeferredItem(id, updates) {
  let items = await getDeferredItems();
  items = items.map(item => {
    if (item.id === id) {
      return { ...item, ...updates, archived_at: updates.archived ? new Date().toISOString() : item.archived_at };
    }
    return item;
  });
  await chrome.storage.local.set({ deferredItems: items });
}

/* ----------------------------------------------------------------
   UI HELPERS
   ---------------------------------------------------------------- */

function playCloseSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const t = ctx.currentTime;
    const duration = 0.25;
    const buffer = ctx.createBuffer(1, ctx.sampleRate * duration, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      const pos = i / data.length;
      const env = pos < 0.1 ? pos / 0.1 : Math.pow(1 - (pos - 0.1) / 0.9, 1.5);
      data[i] = (Math.random() * 2 - 1) * env;
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 2.0;
    filter.frequency.setValueAtTime(4000, t);
    filter.frequency.exponentialRampToValueAtTime(400, t + duration);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.15, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    source.connect(filter).connect(gain).connect(ctx.destination);
    source.start(t);
    setTimeout(() => ctx.close(), 500);
  } catch {}
}

function shootConfetti(x, y) {
  const colors = ['#c8713a', '#e8a070', '#5a7a62', '#8aaa92', '#5a6b7a', '#8a9baa', '#d4b896', '#b35a5a'];
  const particleCount = 17;
  for (let i = 0; i < particleCount; i++) {
    const el = document.createElement('div');
    const isCircle = Math.random() > 0.5;
    const size = 5 + Math.random() * 6;
    const color = colors[Math.floor(Math.random() * colors.length)];
    el.style.cssText = `position:fixed; left:${x}px; top:${y}px; width:${size}px; height:${size}px; background:${color}; border-radius:${isCircle ? '50%' : '2px'}; pointer-events:none; z-index:9999; transform:translate(-50%, -50%); opacity:1;`;
    document.body.appendChild(el);
    const angle = Math.random() * Math.PI * 2;
    const speed = 60 + Math.random() * 120;
    const vx = Math.cos(angle) * speed;
    const vy = Math.sin(angle) * speed - 80;
    const gravity = 200;
    const startTime = performance.now();
    const duration = 700 + Math.random() * 200;
    function frame(now) {
      const elapsed = (now - startTime) / 1000;
      const progress = elapsed / (duration / 1000);
      if (progress >= 1) { el.remove(); return; }
      const px = vx * elapsed;
      const py = vy * elapsed + 0.5 * gravity * elapsed * elapsed;
      const opacity = progress < 0.5 ? 1 : 1 - (progress - 0.5) * 2;
      const rotate = elapsed * 200 * (isCircle ? 0 : 1);
      el.style.transform = `translate(calc(-50% + ${px}px), calc(-50% + ${py}px)) rotate(${rotate}deg)`;
      el.style.opacity = opacity;
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }
}

function showToast(message) {
  const toast = document.getElementById('toast');
  document.getElementById('toastText').textContent = message;
  toast.classList.add('visible');
  setTimeout(() => toast.classList.remove('visible'), 2500);
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function getDateDisplay() {
  return new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const then = new Date(dateStr);
  const now = new Date();
  const diffMs = now - then;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return diffMins + ' min ago';
  if (diffHours < 24) return diffHours + ' hr' + (diffHours !== 1 ? 's' : '') + ' ago';
  if (diffDays === 1) return 'yesterday';
  return diffDays + ' days ago';
}

/* ----------------------------------------------------------------
   CONTENT CLEANUP HELPERS
   ---------------------------------------------------------------- */

function friendlyDomain(hostname) {
  if (!hostname) return '';
  if (FRIENDLY_DOMAINS[hostname]) return FRIENDLY_DOMAINS[hostname];
  if (hostname.endsWith('.substack.com') && hostname !== 'substack.com') {
    return hostname.replace('.substack.com', '').charAt(0).toUpperCase() + hostname.replace('.substack.com', '').slice(1) + "'s Substack";
  }
  if (hostname.endsWith('.github.io')) {
    return hostname.replace('.github.io', '').charAt(0).toUpperCase() + hostname.replace('.github.io', '').slice(1) + ' (GitHub Pages)';
  }
  let clean = hostname.replace(/^www\./, '').replace(/\.(com|org|net|io|co|ai|dev|app|so|me|xyz|info|us|uk|co\.uk|co\.jp)$/, '');
  return clean.split('.').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}

function stripTitleNoise(title) {
  if (!title) return '';
  title = title.replace(/^\(\d+\+?\)\s*/, '');
  title = title.replace(/\s*\([\d,]+\+?\)\s*/g, ' ');
  title = title.replace(/\s*[\-\u2010\u2011\u2012\u2013\u2014\u2015]\s*[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g, '');
  title = title.replace(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g, '');
  title = title.replace(/\s+on X:\s*/, ': ');
  title = title.replace(/\s*\/\s*X\s*$/, '');
  return title.trim();
}

function cleanTitle(title, hostname) {
  if (!title || !hostname) return title || '';
  const friendly = friendlyDomain(hostname);
  const domain = hostname.replace(/^www\./, '');
  const separators = [' - ', ' | ', ' — ', ' · ', ' – '];
  for (const sep of separators) {
    const idx = title.lastIndexOf(sep);
    if (idx === -1) continue;
    const suffix = title.slice(idx + sep.length).trim().toLowerCase();
    if (suffix === domain.toLowerCase() || suffix === friendly.toLowerCase() || suffix === domain.replace(/\.\w+$/, '').toLowerCase() || domain.toLowerCase().includes(suffix) || friendly.toLowerCase().includes(suffix)) {
      const cleaned = title.slice(0, idx).trim();
      if (cleaned.length >= 5) return cleaned;
    }
  }
  return title;
}

function smartTitle(title, url) {
  if (!url) return title || '';
  let pathname = '', hostname = '';
  try { const u = new URL(url); pathname = u.pathname; hostname = u.hostname; } catch { return title || ''; }
  const titleIsUrl = !title || title === url || title.startsWith(hostname) || title.startsWith('http');
  if ((hostname === 'x.com' || hostname === 'twitter.com') && pathname.includes('/status/')) {
    const username = pathname.split('/')[1];
    if (username) return titleIsUrl ? `Post by @${username}` : title;
  }
  if (hostname === 'github.com') {
    const parts = pathname.split('/').filter(Boolean);
    if (parts.length >= 2) {
      const [owner, repo] = parts;
      if (parts[2] === 'issues' && parts[3]) return `${owner}/${repo} Issue #${parts[3]}`;
      if (parts[2] === 'pull' && parts[3]) return `${owner}/${repo} PR #${parts[3]}`;
      if (parts[2] === 'blob' || parts[2] === 'tree') return `${owner}/${repo} — ${parts.slice(4).join('/')}`;
      if (titleIsUrl) return `${owner}/${repo}`;
    }
  }
  if (hostname === 'www.youtube.com' && pathname === '/watch' && titleIsUrl) return 'YouTube Video';
  if (hostname === 'www.reddit.com' && pathname.includes('/comments/')) {
    const parts = pathname.split('/').filter(Boolean);
    const subIdx = parts.indexOf('r');
    if (subIdx !== -1 && parts[subIdx + 1] && titleIsUrl) return `r/${parts[subIdx + 1]} post`;
  }
  return title || url;
}

/* ----------------------------------------------------------------
   DASHBOARD RENDERING
   ---------------------------------------------------------------- */

function buildOverflowChips(hiddenTabs, urlCounts = {}) {
  const hiddenChips = hiddenTabs.map(tab => {
    const label = cleanTitle(smartTitle(stripTitleNoise(tab.title || ''), tab.url), '');
    const count = urlCounts[tab.url] || 1;
    const safeUrl = (tab.url || '').replace(/"/g, '&quot;');
    const safeTitle = label.replace(/"/g, '&quot;');
    let domain = ''; try { domain = new URL(tab.url).hostname; } catch {}
    const faviconUrl = domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=16` : '';
    return `<div class="page-chip clickable${count > 1 ? ' chip-has-dupes' : ''}" data-action="focus-tab" data-tab-url="${safeUrl}" title="${safeTitle}">
      ${faviconUrl ? `<img class="chip-favicon" src="${faviconUrl}" alt="" onerror="this.style.display='none'">` : ''}
      <span class="chip-text">${label}</span>${count > 1 ? ` <span class="chip-dupe-badge">(${count}x)</span>` : ''}
      <div class="chip-actions">
        <button class="chip-action chip-save" data-action="defer-single-tab" data-tab-url="${safeUrl}" data-tab-title="${safeTitle}" title="Save for later">${ICONS.archive}</button>
        <button class="chip-action chip-close" data-action="close-single-tab" data-tab-url="${safeUrl}" title="Close this tab">${ICONS.close}</button>
      </div>
    </div>`;
  }).join('');
  return `<div class="page-chips-overflow" style="display:none">${hiddenChips}</div><div class="page-chip page-chip-overflow clickable" data-action="expand-chips"><span class="chip-text">+${hiddenTabs.length} more</span></div>`;
}

function renderDomainCard(group) {
  const tabs = group.tabs || [];
  const tabCount = tabs.length;
  const isLanding = group.domain === '__landing-pages__';
  const urlCounts = {};
  for (const tab of tabs) urlCounts[tab.url] = (urlCounts[tab.url] || 0) + 1;
  const dupeUrls = Object.entries(urlCounts).filter(([, c]) => c > 1);
  const totalExtras = dupeUrls.reduce((s, [, c]) => s + c - 1, 0);

  const seen = new Set(), uniqueTabs = [];
  for (const tab of tabs) { if (!seen.has(tab.url)) { seen.add(tab.url); uniqueTabs.push(tab); } }
  const visibleTabs = uniqueTabs.slice(0, 8);
  const pageChips = visibleTabs.map(tab => {
    let label = cleanTitle(smartTitle(stripTitleNoise(tab.title || ''), tab.url), group.domain);
    try { const u = new URL(tab.url); if (u.hostname === 'localhost' && u.port) label = `${u.port} ${label}`; } catch {}
    const count = urlCounts[tab.url];
    const safeUrl = (tab.url || '').replace(/"/g, '&quot;');
    const safeTitle = label.replace(/"/g, '&quot;');
    let domain = ''; try { domain = new URL(tab.url).hostname; } catch {}
    const faviconUrl = domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=16` : '';
    return `<div class="page-chip clickable${count > 1 ? ' chip-has-dupes' : ''}" data-action="focus-tab" data-tab-url="${safeUrl}" title="${safeTitle}">
      ${faviconUrl ? `<img class="chip-favicon" src="${faviconUrl}" alt="" onerror="this.style.display='none'">` : ''}
      <span class="chip-text">${label}</span>${count > 1 ? ` <span class="chip-dupe-badge">(${count}x)</span>` : ''}
      <div class="chip-actions">
        <button class="chip-action chip-save" data-action="defer-single-tab" data-tab-url="${safeUrl}" data-tab-title="${safeTitle}" title="Save for later">${ICONS.archive}</button>
        <button class="chip-action chip-close" data-action="close-single-tab" data-tab-url="${safeUrl}" title="Close this tab">${ICONS.close}</button>
      </div>
    </div>`;
  }).join('') + (uniqueTabs.length > 8 ? buildOverflowChips(uniqueTabs.slice(8), urlCounts) : '');

  const stableId = 'domain-' + group.domain.replace(/[^a-z0-9]/g, '-');
  return `
    <div class="mission-card domain-card ${dupeUrls.length > 0 ? 'has-amber-bar' : 'has-neutral-bar'}" data-domain-id="${stableId}">
      <div class="mission-content">
        <div class="mission-top">
          <span class="mission-name">${isLanding ? 'Homepages' : friendlyDomain(group.domain)}</span>
          <span class="open-tabs-badge">${ICONS.tabs} ${tabCount} tab${tabCount !== 1 ? 's' : ''} open</span>
          ${dupeUrls.length > 0 ? `<span class="open-tabs-badge" style="color:var(--accent-amber); background:rgba(200, 113, 58, 0.08);">${totalExtras} duplicate${totalExtras !== 1 ? 's' : ''}</span>` : ''}
        </div>
        <div class="mission-pages">${pageChips}</div>
        <div class="actions">
          <button class="action-btn close-tabs" data-action="close-domain-tabs" data-domain-id="${stableId}">${ICONS.close} Close all ${tabCount} tabs</button>
          ${dupeUrls.length > 0 ? `<button class="action-btn" data-action="dedup-keep-one" data-dupe-urls="${dupeUrls.map(([u]) => encodeURIComponent(u)).join(',')}">Close ${totalExtras} duplicates</button>` : ''}
        </div>
      </div>
    </div>`;
}

async function renderDeferredColumn() {
  const column = document.getElementById('deferredColumn'), list = document.getElementById('deferredList'), empty = document.getElementById('deferredEmpty'), countEl = document.getElementById('deferredCount'), archiveEl = document.getElementById('deferredArchive'), archiveCountEl = document.getElementById('archiveCount'), archiveList = document.getElementById('archiveList');
  if (!column) return;
  const items = await getDeferredItems();
  const active = items.filter(i => !i.archived), archived = items.filter(i => i.archived);
  if (active.length === 0 && archived.length === 0) { column.style.display = 'none'; return; }
  column.style.display = 'block';
  if (active.length > 0) {
    countEl.textContent = `${active.length} item${active.length !== 1 ? 's' : ''}`;
    list.innerHTML = active.map(item => {
      let d = ''; try { d = new URL(item.url).hostname.replace(/^www\./, ''); } catch {}
      return `<div class="deferred-item" data-deferred-id="${item.id}">
        <input type="checkbox" class="deferred-checkbox" data-action="check-deferred" data-deferred-id="${item.id}">
        <div class="deferred-info">
          <a href="${item.url}" target="_blank" rel="noopener" class="deferred-title" title="${(item.title || '').replace(/"/g, '&quot;')}">
            <img src="https://www.google.com/s2/favicons?domain=${d}&sz=16" alt="" style="width:14px;height:14px;vertical-align:-2px;margin-right:4px" onerror="this.style.display='none'">${item.title || item.url}
          </a>
          <div class="deferred-meta"><span>${d}</span><span>${timeAgo(item.deferred_at)}</span></div>
        </div>
        <button class="deferred-dismiss" data-action="dismiss-deferred" data-deferred-id="${item.id}" title="Dismiss">${ICONS.close}</button>
      </div>`;
    }).join('');
    list.style.display = 'block'; empty.style.display = 'none';
  } else { list.style.display = 'none'; countEl.textContent = ''; empty.style.display = 'block'; }
  if (archived.length > 0) {
    archiveCountEl.textContent = `(${archived.length})`;
    archiveList.innerHTML = archived.map(item => `<div class="archive-item"><a href="${item.url}" target="_blank" rel="noopener" class="archive-item-title" title="${(item.title || '').replace(/"/g, '&quot;')}">${item.title || item.url}</a><span class="archive-item-date">${timeAgo(item.archived_at)}</span></div>`).join('');
    archiveEl.style.display = 'block';
  } else archiveEl.style.display = 'none';
}

async function renderDashboard() {
  document.getElementById('greeting').textContent = getGreeting();
  document.getElementById('dateDisplay').textContent = getDateDisplay();
  await fetchOpenTabs();
  const realTabs = openTabs.filter(t => !t.url.startsWith('chrome') && !t.url.startsWith('about:') && !t.url.startsWith('edge:') && !t.url.startsWith('brave:'));

  const LANDING_PAGE_PATTERNS = [
    { hostname: 'mail.google.com', test: (p, h) => !h.includes('#inbox/') && !h.includes('#sent/') && !h.includes('#search/') },
    { hostname: 'x.com', pathExact: ['/home'] }, { hostname: 'www.linkedin.com', pathExact: ['/'] }, { hostname: 'github.com', pathExact: ['/'] }, { hostname: 'www.youtube.com', pathExact: ['/'] }
  ];
  function isLandingPage(url) {
    try { const p = new URL(url); return LANDING_PAGE_PATTERNS.some(pat => {
      if (p.hostname !== pat.hostname) return false;
      if (pat.test) return pat.test(p.pathname, url);
      return pat.pathExact ? pat.pathExact.includes(p.pathname) : p.pathname === '/';
    }); } catch { return false; }
  }

  const groupMap = {}, landingTabs = [];
  for (const tab of realTabs) {
    if (isLandingPage(tab.url)) { landingTabs.push(tab); continue; }
    let h = tab.url.startsWith('file://') ? 'local-files' : '';
    try { h = h || new URL(tab.url).hostname; } catch {}
    if (!h) continue;
    if (!groupMap[h]) groupMap[h] = { domain: h, tabs: [] };
    groupMap[h].tabs.push(tab);
  }
  if (landingTabs.length > 0) groupMap['__landing-pages__'] = { domain: '__landing-pages__', tabs: landingTabs };

  const landingHostnames = new Set(LANDING_PAGE_PATTERNS.map(p => p.hostname));
  domainGroups = Object.values(groupMap).sort((a, b) => {
    if ((a.domain === '__landing-pages__') !== (b.domain === '__landing-pages__')) return a.domain === '__landing-pages__' ? -1 : 1;
    if (landingHostnames.has(a.domain) !== landingHostnames.has(b.domain)) return landingHostnames.has(a.domain) ? -1 : 1;
    return b.tabs.length - a.tabs.length;
  });

  const section = document.getElementById('openTabsSection'), missionsEl = document.getElementById('openTabsMissions'), countEl = document.getElementById('openTabsSectionCount');
  if (domainGroups.length > 0) {
    countEl.innerHTML = `${domainGroups.length} domain${domainGroups.length !== 1 ? 's' : ''} &middot; <button class="action-btn close-tabs" data-action="close-all-open-tabs" style="font-size:11px;padding:3px 10px;">${ICONS.close} Close all ${realTabs.length} tabs</button>`;
    missionsEl.innerHTML = domainGroups.map(g => renderDomainCard(g)).join('');
    section.style.display = 'block';
  } else section.style.display = 'none';

  document.getElementById('statTabs').textContent = openTabs.length;
  const tabOutTabs = openTabs.filter(t => t.isTabOut);
  const banner = document.getElementById('tabOutDupeBanner');
  if (banner) {
    if (tabOutTabs.length > 1) { document.getElementById('tabOutDupeCount').textContent = tabOutTabs.length; banner.style.display = 'flex'; }
    else banner.style.display = 'none';
  }
  await renderDeferredColumn();
}

/* ----------------------------------------------------------------
   EVENT HANDLERS
   ---------------------------------------------------------------- */

document.addEventListener('click', async (e) => {
  const actionEl = e.target.closest('[data-action]');
  if (!actionEl) return;
  const action = actionEl.dataset.action;

  if (action === 'close-tabout-dupes') {
    await closeTabOutDupes();
    await fetchOpenTabs();
    playCloseSound();
    const banner = document.getElementById('tabOutDupeBanner');
    if (banner) { banner.style.opacity = '0'; setTimeout(() => { banner.style.display='none'; banner.style.opacity='1'; }, 400); }
    showToast('Closed extra Tab Out tabs');
    return;
  }

  const card = actionEl.closest('.mission-card');

  if (action === 'expand-chips') {
    const container = actionEl.parentElement.querySelector('.page-chips-overflow');
    if (container) { container.style.display = 'contents'; actionEl.remove(); }
    return;
  }

  if (action === 'focus-tab') {
    await focusTabByUrl(actionEl.dataset.tabUrl);
    return;
  }

  if (action === 'close-single-tab') {
    e.stopPropagation();
    const url = actionEl.dataset.tabUrl;
    await closeTabsByUrls([url], true);
    playCloseSound();
    await fetchOpenTabs();
    const chip = actionEl.closest('.page-chip');
    if (chip) {
      const rect = chip.getBoundingClientRect();
      shootConfetti(rect.left + rect.width / 2, rect.top + rect.height / 2);
      chip.style.opacity = '0'; chip.style.transform = 'scale(0.8)';
      setTimeout(() => {
        chip.remove();
        if (card && card.querySelectorAll('.page-chip[data-action="focus-tab"]').length === 0) {
          shootConfetti(card.offsetLeft + card.offsetWidth/2, card.offsetTop + card.offsetHeight/2);
          card.classList.add('closing'); setTimeout(() => { card.remove(); if (document.querySelectorAll('#openTabsMissions .mission-card').length === 0) renderDashboard(); }, 300);
        }
      }, 200);
    }
    showToast('Tab closed');
    return;
  }

  if (action === 'defer-single-tab') {
    e.stopPropagation();
    const url = actionEl.dataset.tabUrl, title = actionEl.dataset.tabTitle || url;
    await saveDeferredItem({ url, title });
    await closeTabsByUrls([url], true);
    await fetchOpenTabs();
    const chip = actionEl.closest('.page-chip');
    if (chip) { chip.style.opacity='0'; chip.style.transform='scale(0.8)'; setTimeout(()=>chip.remove(), 200); }
    showToast('Saved for later');
    await renderDeferredColumn();
    return;
  }

  if (action === 'check-deferred') {
    const id = actionEl.dataset.deferredId;
    await updateDeferredItem(id, { archived: true, checked: true });
    const item = actionEl.closest('.deferred-item');
    if (item) {
      item.classList.add('checked');
      setTimeout(() => { item.classList.add('removing'); setTimeout(() => { item.remove(); renderDeferredColumn(); }, 300); }, 800);
    }
    return;
  }

  if (action === 'dismiss-deferred') {
    const id = actionEl.dataset.deferredId;
    await updateDeferredItem(id, { archived: true, dismissed: true });
    const item = actionEl.closest('.deferred-item');
    if (item) { item.classList.add('removing'); setTimeout(() => { item.remove(); renderDeferredColumn(); }, 300); }
    return;
  }

  if (action === 'close-domain-tabs') {
    const domainId = actionEl.dataset.domainId;
    const group = domainGroups.find(g => 'domain-' + g.domain.replace(/[^a-z0-9]/g, '-') === domainId);
    if (!group) return;
    const urls = group.tabs.map(t => t.url);
    await closeTabsByUrls(urls, group.domain === '__landing-pages__');
    if (card) {
      playCloseSound();
      const r = card.getBoundingClientRect(); shootConfetti(r.left + r.width/2, r.top + r.height/2);
      card.classList.add('closing'); setTimeout(() => { card.remove(); if (document.querySelectorAll('#openTabsMissions .mission-card').length === 0) renderDashboard(); }, 300);
    }
    showToast(`Closed tabs from ${group.domain === '__landing-pages__' ? 'Homepages' : friendlyDomain(group.domain)}`);
    return;
  }

  if (action === 'dedup-keep-one') {
    const urls = (actionEl.dataset.dupeUrls || '').split(',').map(u => decodeURIComponent(u)).filter(Boolean);
    await closeDuplicates(urls, true);
    playCloseSound(); await fetchOpenTabs();
    if (card) {
      card.querySelectorAll('.chip-dupe-badge, .open-tabs-badge').forEach(b => { if (b.textContent.includes('duplicate') || b.classList.contains('chip-dupe-badge')) b.remove(); });
      card.classList.remove('has-amber-bar'); card.classList.add('has-neutral-bar');
    }
    showToast(`Closed duplicates, kept one copy each`);
    return;
  }

  if (action === 'close-all-open-tabs') {
    const allUrls = openTabs.filter(t => t.url && !t.url.startsWith('chrome') && !t.url.startsWith('about:')).map(t => t.url);
    await closeTabsByUrls(allUrls);
    playCloseSound();
    document.querySelectorAll('#openTabsMissions .mission-card').forEach(c => {
      const r = c.getBoundingClientRect(); shootConfetti(r.left + r.width/2, r.top + r.height/2);
      c.classList.add('closing'); setTimeout(() => c.remove(), 300);
    });
    setTimeout(renderDashboard, 400);
    showToast('All tabs closed. Fresh start.');
    return;
  }
});

document.addEventListener('click', (e) => {
  const toggle = e.target.closest('#archiveToggle');
  if (!toggle) return;
  toggle.classList.toggle('open');
  const body = document.getElementById('archiveBody');
  if (body) body.style.display = body.style.display === 'none' ? 'block' : 'none';
});

document.addEventListener('input', async (e) => {
  if (e.target.id !== 'archiveSearch') return;
  const q = e.target.value.trim().toLowerCase();
  const list = document.getElementById('archiveList');
  if (!list) return;
  const items = await getDeferredItems();
  const archived = items.filter(i => i.archived);
  const filtered = q.length < 2 ? archived : archived.filter(i => i.title.toLowerCase().includes(q) || i.url.toLowerCase().includes(q));
  list.innerHTML = filtered.map(item => `<div class="archive-item"><a href="${item.url}" target="_blank" rel="noopener" class="archive-item-title" title="${(item.title || '').replace(/"/g, '&quot;')}">${item.title || item.url}</a><span class="archive-item-date">${timeAgo(item.archived_at)}</span></div>`).join('') || '<div style="font-size:12px;color:var(--muted);padding:8px 0">No results</div>';
});

// Auto-refresh when tabs change
chrome.tabs.onCreated.addListener(renderDashboard);
chrome.tabs.onRemoved.addListener(renderDashboard);
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => { if (changeInfo.status === 'complete') renderDashboard(); });

// Initialize
renderDashboard();
