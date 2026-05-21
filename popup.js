// Popup script for Word Meaning Extension
(function() {
  'use strict';

  // Tab switching
  const tabs = document.querySelectorAll('.tab');
  const tabContents = document.querySelectorAll('.tab-content');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const tabName = tab.dataset.tab;
      
      // Update active tab
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      // Show corresponding content
      tabContents.forEach(content => {
        content.classList.remove('active');
        if (content.id === `${tabName}-tab`) {
          content.classList.add('active');
        }
      });
    });
  });

  // Format time ago
  function timeAgo(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;
    
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  }

  // Delete word
  async function deleteWord(word) {
    try {
      const result = await chrome.storage.local.get(['savedWords']);
      const savedWords = result.savedWords || {};
      delete savedWords[word.toLowerCase()];
      await chrome.storage.local.set({ savedWords });
      loadSavedWords(); // Refresh display
    } catch (error) {
      console.error('Error deleting word:', error);
    }
  }

  // Render word card
  function renderWordCard(wordData) {
    const card = document.createElement('div');
    card.className = 'word-card';
    
    let meaningsHtml = '';
    wordData.meanings.forEach(meaning => {
      meaning.definitions.forEach(def => {
        meaningsHtml += `
          <div class="meaning">
            <div class="part-of-speech">${escapeHtml(meaning.partOfSpeech)}</div>
            <div class="definition">${escapeHtml(def.definition)}</div>
          </div>
        `;
      });
    });
    
    card.innerHTML = `
      <div class="word-header">
        <div class="word-title">
          <div class="word-name">${escapeHtml(wordData.word)}</div>
          ${wordData.phonetic ? `<div class="word-phonetic">${escapeHtml(wordData.phonetic)}</div>` : ''}
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
          <div class="word-time">${timeAgo(wordData.timestamp)}</div>
          <button class="delete-btn" aria-label="Delete word">×</button>
        </div>
      </div>
      <div class="word-meanings">
        ${meaningsHtml}
      </div>
    `;
    
    // Add delete handler
    const deleteBtn = card.querySelector('.delete-btn');
    deleteBtn.addEventListener('click', () => {
      if (confirm(`Delete "${wordData.word}" from saved words?`)) {
        deleteWord(wordData.word);
      }
    });
    
    return card;
  }

  // Escape HTML
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Load and display saved words
  async function loadSavedWords() {
    try {
      const result = await chrome.storage.local.get(['savedWords']);
      const savedWords = result.savedWords || {};
      
      const wordList = document.getElementById('word-list');
      const emptyState = document.getElementById('empty-state');
      const stats = document.getElementById('stats');
      const exportSection = document.getElementById('export-section');
      const wordCount = document.getElementById('word-count');
      const thisWeekCount = document.getElementById('this-week');
      
      const words = Object.values(savedWords);
      
      if (words.length === 0) {
        wordList.innerHTML = '';
        emptyState.style.display = 'block';
        stats.style.display = 'none';
        exportSection.style.display = 'none';
      } else {
        emptyState.style.display = 'none';
        stats.style.display = 'flex';
        exportSection.style.display = 'block';
        
        // Sort by timestamp (newest first)
        words.sort((a, b) => b.timestamp - a.timestamp);
        
        // Calculate stats
        const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
        const now = Date.now();
        const thisWeek = words.filter(w => now - w.timestamp < oneWeekMs).length;
        
        wordCount.textContent = words.length;
        thisWeekCount.textContent = thisWeek;
        
        // Render word cards
        wordList.innerHTML = '';
        words.forEach(wordData => {
          const card = renderWordCard(wordData);
          wordList.appendChild(card);
        });
      }
    } catch (error) {
      console.error('Error loading saved words:', error);
    }
  }

  // Export saved words to CSV
  async function exportToCSV() {
    try {
      const result = await chrome.storage.local.get(['savedWords']);
      const savedWords = result.savedWords || {};
      const words = Object.values(savedWords);
      
      if (words.length === 0) {
        return;
      }
      
      // Sort by timestamp (newest first)
      words.sort((a, b) => b.timestamp - a.timestamp);
      
      // Create CSV content
      let csv = 'Word,Phonetic,Part of Speech,Definition,Example,Date Saved\n';
      
      words.forEach(wordData => {
        const date = new Date(wordData.timestamp).toLocaleDateString();
        
        wordData.meanings.forEach(meaning => {
          meaning.definitions.forEach(def => {
            const word = escapeCSV(wordData.word);
            const phonetic = escapeCSV(wordData.phonetic);
            const pos = escapeCSV(meaning.partOfSpeech);
            const definition = escapeCSV(def.definition);
            const example = escapeCSV(def.example);
            
            csv += `${word},${phonetic},${pos},${definition},${example},${date}\n`;
          });
        });
      });
      
      // Create and download file
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const filename = `word-meanings-${new Date().toISOString().split('T')[0]}.csv`;
      
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      // Visual feedback
      const btn = document.getElementById('export-btn');
      const originalText = btn.innerHTML;
      btn.innerHTML = '<span>✓</span><span>Exported!</span>';
      btn.disabled = true;
      
      setTimeout(() => {
        btn.innerHTML = originalText;
        btn.disabled = false;
      }, 2000);
      
    } catch (error) {
      console.error('Error exporting words:', error);
      alert('Error exporting words. Please try again.');
    }
  }

  // Escape CSV fields
  function escapeCSV(text) {
    if (!text) return '';
    // Escape quotes and wrap in quotes if contains comma, quote, or newline
    const escaped = text.replace(/"/g, '""');
    if (escaped.includes(',') || escaped.includes('"') || escaped.includes('\n')) {
      return `"${escaped}"`;
    }
    return escaped;
  }

  // Initialize
  loadSavedWords();

  // Export button event listener
  document.getElementById('export-btn').addEventListener('click', exportToCSV);

  // Listen for storage changes
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes.savedWords) {
      loadSavedWords();
    }
  });
})();
