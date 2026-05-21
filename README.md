# 📖 Word Meaning - Edge Extension

A browser extension that shows dictionary definitions when you highlight words and lets you save them for later review.

![Extension Demo](https://img.shields.io/badge/version-2.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Platform](https://img.shields.io/badge/platform-Edge-0078D4)

## ✨ Features

- **Instant Definitions**: Highlight text and wait 5 seconds to see definitions
- **Save Words**: Bookmark words with the ★ button
- **Export to CSV**: Download your vocabulary list for Excel or Anki
- **Auto Cleanup**: Words automatically deleted after 7 days
- **Privacy First**: All data stored locally, no tracking
- **Smart UI**: Beautiful tooltips that don't interfere with websites

## 🎯 How to Use

1. Select any word or phrase (up to 3 words)
2. Wait 5 seconds
3. View definition in tooltip
4. Click ★ to save, × to close
5. To show tooltip again, deselect and reselect text
6. Click extension icon to view saved words and export

## 📦 Installation

1. Download or clone this repository
2. Open Edge and go to `edge://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked" and select the extension folder

## 🔧 Quick Customization

Edit `content.js` to customize:
- **Delay time**: Change `5000` to milliseconds desired
- **Cleanup period**: Change `7` days to your preference
- **Max words**: Change `3` to allow more words

## 🐛 Troubleshooting

- **Tooltip not showing**: Wait full 5 seconds, deselect and reselect if previously dismissed
- **Extension not working**: Reload extension at `edge://extensions/` and refresh page
- **Export not working**: Need at least 1 saved word to export

## 📝 Privacy

- ✅ No data collection or tracking
- ✅ All data stored locally on your device
- ✅ Only connects to dictionary API when you select text

## 📄 License

MIT License - Copyright (c) 2026

## 🙏 Credits

- [Free Dictionary API](https://dictionaryapi.dev/) for dictionary data

---

**Made with ❤️ for better reading**
