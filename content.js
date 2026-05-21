// Word Meaning Extension - Content Script
(function() {
  'use strict';

  let tooltip = null;
  let shadowRoot = null;
  let currentSelection = null;
  let hideTimeout = null;
  let showTimeout = null;
  let tooltipDismissed = false;
  let currentWordData = null;

  // Create tooltip with Shadow DOM for style isolation
  function createTooltip() {
    if (tooltip) return;

    tooltip = document.createElement('div');
    tooltip.id = 'word-meaning-tooltip-host';
    
    // Attach shadow DOM
    shadowRoot = tooltip.attachShadow({ mode: 'open' });
    
    // Add styles
    const style = document.createElement('style');
    style.textContent = `
      :host {
        all: initial;
        position: fixed;
        z-index: 2147483647;
        display: none;
      }
      
      .tooltip-container {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 16px;
        border-radius: 12px;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
        max-width: 350px;
        min-width: 250px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        line-height: 1.6;
        animation: fadeIn 0.2s ease-out;
      }
      
      @keyframes fadeIn {
        from {
          opacity: 0;
          transform: translateY(-10px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      
      .tooltip-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;
        padding-bottom: 12px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.2);
      }
      
      .tooltip-word {
        font-size: 18px;
        font-weight: 700;
        margin: 0;
      }
      
      .tooltip-phonetic {
        font-size: 13px;
        opacity: 0.9;
        font-style: italic;
        margin-top: 4px;
      }
      
      .tooltip-buttons {
        display: flex;
        gap: 8px;
      }
      
      .tooltip-close, .tooltip-bookmark {
        background: rgba(255, 255, 255, 0.2);
        border: none;
        color: white;
        width: 28px;
        height: 28px;
        border-radius: 50%;
        cursor: pointer;
        font-size: 16px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s;
      }
      
      .tooltip-close:hover, .tooltip-bookmark:hover {
        background: rgba(255, 255, 255, 0.3);
        transform: scale(1.1);
      }
      
      .tooltip-bookmark.saved {
        background: rgba(255, 215, 0, 0.3);
      }
      
      .tooltip-bookmark.saved:hover {
        background: rgba(255, 215, 0, 0.4);
      }
      
      .tooltip-content {
        margin: 0;
      }
      
      .meaning-item {
        margin-bottom: 12px;
      }
      
      .meaning-item:last-child {
        margin-bottom: 0;
      }
      
      .part-of-speech {
        font-weight: 600;
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        opacity: 0.8;
        margin-bottom: 4px;
      }
      
      .definition {
        margin-left: 8px;
      }
      
      .example {
        margin-left: 16px;
        margin-top: 4px;
        font-style: italic;
        opacity: 0.85;
        font-size: 13px;
      }
      
      .loading {
        text-align: center;
        padding: 8px;
      }
      
      .error {
        color: #ffebee;
        background: rgba(244, 67, 54, 0.2);
        padding: 8px;
        border-radius: 6px;
        font-size: 13px;
      }
      
      .spinner {
        border: 2px solid rgba(255, 255, 255, 0.3);
        border-top: 2px solid white;
        border-radius: 50%;
        width: 20px;
        height: 20px;
        animation: spin 0.8s linear infinite;
        margin: 0 auto;
      }
      
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `;
    
    shadowRoot.appendChild(style);
    document.body.appendChild(tooltip);
  }

  // Show tooltip with content
  function showTooltip(x, y, content) {
    if (!tooltip) createTooltip();
    
    clearTimeout(hideTimeout);
    
    const container = document.createElement('div');
    container.className = 'tooltip-container';
    container.innerHTML = content;
    
    // Add close button handler
    const closeBtn = container.querySelector('.tooltip-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', hideTooltip);
    }
    
    // Add bookmark button handler
    const bookmarkBtn = container.querySelector('.tooltip-bookmark');
    if (bookmarkBtn) {
      bookmarkBtn.addEventListener('click', () => toggleBookmark(bookmarkBtn));
    }
    
    // Clear previous content
    const oldContainer = shadowRoot.querySelector('.tooltip-container');
    if (oldContainer) {
      oldContainer.remove();
    }
    
    shadowRoot.appendChild(container);
    tooltip.style.display = 'block';
    
    // Position tooltip
    positionTooltip(x, y);
  }

  // Position tooltip near selection
  function positionTooltip(x, y) {
    const container = shadowRoot.querySelector('.tooltip-container');
    if (!container) return;
    
    const rect = container.getBoundingClientRect();
    const padding = 10;
    
    let left = x;
    let top = y + padding; // Default to bottom (below selection)
    
    // Adjust horizontal position if tooltip goes off screen
    if (left + rect.width > window.innerWidth - padding) {
      left = window.innerWidth - rect.width - padding;
    }
    if (left < padding) {
      left = padding;
    }
    
    // If not enough space at bottom, position above
    if (top + rect.height > window.innerHeight - padding) {
      top = y - rect.height - padding;
    }
    
    // If still not enough space at top, keep at bottom
    if (top < padding) {
      top = y + padding;
    }
    
    tooltip.style.left = left + 'px';
    tooltip.style.top = top + 'px';
  }

  // Hide tooltip
  function hideTooltip() {
    if (tooltip) {
      tooltip.style.display = 'none';
    }
    // Mark that tooltip was manually dismissed
    tooltipDismissed = true;
    currentSelection = null;
    // Clear any pending show timeout
    clearTimeout(showTimeout);
  }

  // Show loading state
  function showLoading(x, y, word) {
    const content = `
      <div class="tooltip-header">
        <div>
          <h3 class="tooltip-word">${escapeHtml(word)}</h3>
        </div>
        <button class="tooltip-close" aria-label="Close">×</button>
      </div>
      <div class="tooltip-content loading">
        <div class="spinner"></div>
      </div>
    `;
    showTooltip(x, y, content);
  }

  // Show error
  function showError(x, y, word, message) {
    const content = `
      <div class="tooltip-header">
        <div>
          <h3 class="tooltip-word">${escapeHtml(word)}</h3>
        </div>
        <button class="tooltip-close" aria-label="Close">×</button>
      </div>
      <div class="tooltip-content">
        <div class="error">${escapeHtml(message)}</div>
      </div>
    `;
    showTooltip(x, y, content);
    
    // Auto-hide error after 3 seconds
    hideTimeout = setTimeout(hideTooltip, 3000);
  }

  // Fetch word meaning from dictionary API
  async function fetchMeaning(word) {
    const url = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`;
    
    try {
      const response = await fetch(url);
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('No definition found');
        }
        throw new Error('Failed to fetch definition');
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      throw error;
    }
  }

  // Format meaning data for display
  async function formatMeaning(data) {
    if (!data || !data[0]) {
      return null;
    }
    
    const entry = data[0];
    const word = entry.word;
    const phonetic = entry.phonetic || '';
    
    let meaningsHtml = '';
    
    // Limit to first 3 meanings for brevity
    const meanings = entry.meanings.slice(0, 3);
    
    meanings.forEach(meaning => {
      const partOfSpeech = meaning.partOfSpeech;
      const definitions = meaning.definitions.slice(0, 2); // Max 2 definitions per part of speech
      
      definitions.forEach(def => {
        meaningsHtml += `
          <div class="meaning-item">
            <div class="part-of-speech">${escapeHtml(partOfSpeech)}</div>
            <div class="definition">${escapeHtml(def.definition)}</div>
            ${def.example ? `<div class="example">"${escapeHtml(def.example)}"</div>` : ''}
          </div>
        `;
      });
    });
    
    // Check if word is already saved
    const isSaved = await isWordSaved(word);
    const bookmarkClass = isSaved ? 'saved' : '';
    const bookmarkIcon = isSaved ? '★' : '☆';
    
    return `
      <div class="tooltip-header">
        <div>
          <h3 class="tooltip-word">${escapeHtml(word)}</h3>
          ${phonetic ? `<div class="tooltip-phonetic">${escapeHtml(phonetic)}</div>` : ''}
        </div>
        <div class="tooltip-buttons">
          <button class="tooltip-bookmark ${bookmarkClass}" aria-label="Save word" title="Save word">${bookmarkIcon}</button>
          <button class="tooltip-close" aria-label="Close">×</button>
        </div>
      </div>
      <div class="tooltip-content">
        ${meaningsHtml}
      </div>
    `;
  }

  // Escape HTML to prevent XSS
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Save word to storage
  async function saveWord(wordData) {
    try {
      const result = await chrome.storage.local.get(['savedWords']);
      const savedWords = result.savedWords || {};
      
      // Save with timestamp
      savedWords[wordData.word.toLowerCase()] = {
        word: wordData.word,
        phonetic: wordData.phonetic,
        meanings: wordData.meanings,
        timestamp: Date.now()
      };
      
      await chrome.storage.local.set({ savedWords });
      return true;
    } catch (error) {
      console.error('Error saving word:', error);
      return false;
    }
  }

  // Check if word is saved
  async function isWordSaved(word) {
    try {
      const result = await chrome.storage.local.get(['savedWords']);
      const savedWords = result.savedWords || {};
      return !!savedWords[word.toLowerCase()];
    } catch (error) {
      console.error('Error checking saved word:', error);
      return false;
    }
  }

  // Remove word from storage
  async function removeWord(word) {
    try {
      const result = await chrome.storage.local.get(['savedWords']);
      const savedWords = result.savedWords || {};
      delete savedWords[word.toLowerCase()];
      await chrome.storage.local.set({ savedWords });
      return true;
    } catch (error) {
      console.error('Error removing word:', error);
      return false;
    }
  }

  // Clean up words older than 7 days
  async function cleanupOldWords() {
    try {
      const result = await chrome.storage.local.get(['savedWords', 'lastCleanup']);
      const savedWords = result.savedWords || {};
      const lastCleanup = result.lastCleanup || 0;
      
      // Only clean up once per day
      const oneDayMs = 24 * 60 * 60 * 1000;
      if (Date.now() - lastCleanup < oneDayMs) {
        return;
      }
      
      const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
      const now = Date.now();
      let cleaned = false;
      
      for (const key in savedWords) {
        if (now - savedWords[key].timestamp > sevenDaysMs) {
          delete savedWords[key];
          cleaned = true;
        }
      }
      
      if (cleaned) {
        await chrome.storage.local.set({ savedWords, lastCleanup: now });
      } else {
        await chrome.storage.local.set({ lastCleanup: now });
      }
    } catch (error) {
      console.error('Error cleaning up words:', error);
    }
  }

  // Toggle bookmark for current word
  async function toggleBookmark(button) {
    if (!currentWordData) return;
    
    const isSaved = button.classList.contains('saved');
    
    if (isSaved) {
      // Remove bookmark
      const success = await removeWord(currentWordData.word);
      if (success) {
        button.classList.remove('saved');
        button.textContent = '☆';
      }
    } else {
      // Add bookmark
      const success = await saveWord(currentWordData);
      if (success) {
        button.classList.add('saved');
        button.textContent = '★';
      }
    }
  }

  // Handle text selection
  async function handleSelection() {
    const selection = window.getSelection();
    const selectedText = selection.toString().trim();
    
    // Hide tooltip if no text selected
    if (!selectedText) {
      return;
    }
    
    // Only process single words or short phrases (max 3 words)
    const words = selectedText.split(/\s+/);
    if (words.length > 3 || selectedText.length > 50) {
      return;
    }
    
    // Don't show tooltip for same selection
    if (currentSelection === selectedText) {
      return;
    }
    
    // Don't show tooltip if it was dismissed (wait for deselect first)
    if (tooltipDismissed) {
      return;
    }
    
    // Clear any pending show timeout
    clearTimeout(showTimeout);
    
    currentSelection = selectedText;
    
    // Get selection position
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    const x = rect.left + (rect.width / 2);
    const y = rect.top + window.scrollY;
    
    // Add 3-second delay before showing tooltip
    showTimeout = setTimeout(async () => {
      // Verify selection is still active
      const currentSelectionText = window.getSelection().toString().trim();
      if (currentSelectionText !== selectedText) {
        return;
      }
      
      // Show loading state
      showLoading(x, y, selectedText);
      
      try {
        // Fetch meaning
        const data = await fetchMeaning(selectedText);
        
        // Store word data for bookmarking
        if (data && data[0]) {
          const entry = data[0];
          currentWordData = {
            word: entry.word,
            phonetic: entry.phonetic || '',
            meanings: entry.meanings.slice(0, 3).map(meaning => ({
              partOfSpeech: meaning.partOfSpeech,
              definitions: meaning.definitions.slice(0, 2).map(def => ({
                definition: def.definition,
                example: def.example || ''
              }))
            }))
          };
        }
        
        // Format and show meaning
        const content = await formatMeaning(data);
        if (content) {
          showTooltip(x, y, content);
        } else {
          showError(x, y, selectedText, 'Could not parse definition');
        }
      } catch (error) {
        showError(x, y, selectedText, error.message);
      }
    }, 5000); // 5-second delay
  }

  // Event listeners
  document.addEventListener('mouseup', (e) => {
    // Small delay to allow selection to complete
    setTimeout(handleSelection, 100);
  });

  document.addEventListener('selectionchange', () => {
    const selection = window.getSelection();
    if (!selection.toString().trim()) {
      // Clear dismissed flag when text is deselected
      tooltipDismissed = false;
      currentSelection = null;
      if (tooltip) {
        tooltip.style.display = 'none';
      }
      clearTimeout(showTimeout);
    }
  });

  // Hide tooltip when clicking outside
  document.addEventListener('mousedown', (e) => {
    if (tooltip && tooltip.style.display === 'block') {
      // Check if click is inside the tooltip's shadow DOM
      const clickedInside = e.composedPath().includes(tooltip);
      
      if (!clickedInside) {
        const selection = window.getSelection();
        if (!selection.toString().trim()) {
          hideTooltip();
        }
      }
    }
  });

  // Hide tooltip on scroll
  let scrollTimeout;
  window.addEventListener('scroll', () => {
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
      if (tooltip && tooltip.style.display === 'block') {
        const selection = window.getSelection();
        if (selection.toString().trim()) {
          const range = selection.getRangeAt(0);
          const rect = range.getBoundingClientRect();
          const x = rect.left + (rect.width / 2);
          const y = rect.top + window.scrollY;
          positionTooltip(x, y);
        }
      }
    }, 100);
  });

  // Initialize
  createTooltip();
  
  // Clean up old saved words on page load
  cleanupOldWords();
})();
