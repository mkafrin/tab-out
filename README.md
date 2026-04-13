# Tab Out

**Keep tabs on your tabs.**

Tab Out replaces your Chrome new tab page with a dashboard that shows everything you have open -- grouped by domain, with landing pages (Gmail, X, LinkedIn, etc.) pulled into their own group for easy cleanup. Close tabs with a satisfying swoosh + confetti.

Built for people who open too many tabs and never close them.

---

## Features

- **See all your tabs at a glance** -- grouped by domain on a clean grid, no more squinting at 30 tiny tab titles
- **Landing pages group** -- homepages and feeds (Gmail, X, LinkedIn, GitHub, YouTube) are pulled into one card so you can close them all at once
- **Close tabs with style** -- swoosh sound + confetti burst when you clean up a group. Makes tab hygiene feel rewarding
- **Duplicate detection** -- flags when you have the same page open twice, with one-click cleanup
- **Click any tab to jump to it** -- switches to the existing tab, even across windows
- **Save for later** -- bookmark individual tabs to a checklist before closing them
- **Tab Out dupe detection** -- notices when you have extra new tab pages open and offers to close them
- **Expandable groups** -- large groups show the first 8 tabs with a clickable "+N more" to reveal the rest
- **100% local** -- your browsing data never leaves your machine. No AI, no external API calls
- **Zero dependencies** -- no local server or database required. Runs purely within the browser.

---

## Setup

1. Go to `chrome://extensions` in Chrome
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Select the `extension/` folder from this repo

Open a new tab -- you'll see Tab Out.

---

## How it works

```
You open a new tab
  -> Chrome extension loads Tab Out dashboard directly
  -> Dashboard shows your open tabs grouped by domain
  -> Landing pages (Gmail, X, LinkedIn, etc.) get their own group at the top
  -> You close groups you're done with (swoosh + confetti)
  -> Repeat
```

The extension runs entirely in the browser using the Chrome Tabs API and `chrome.storage.local`.

---

## Tech stack

| What | How |
|------|-----|
| Frontend | Pure HTML + CSS + JS |
| Persistence | chrome.storage.local |
| Extension | Chrome Manifest V3 |
| Sound | Web Audio API (synthesized, no files) |
| Animations | CSS transitions + JS confetti particles |

---

## License

MIT

---

Built by [Zara](https://x.com/zarazhangrui)
