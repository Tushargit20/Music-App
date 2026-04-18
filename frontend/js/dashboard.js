/**
 * dashboard.js — Dashboard UI Logic
 * Handles search, results display, subscription management, and tabs.
 */

// ── Toast Notification ───────────────────────────────────────
function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  const toastMessage = document.getElementById('toast-message');

  toastMessage.textContent = message;
  toast.className = `toast ${type}`;
  toast.style.display = '';
  toast.style.animation = 'toastIn 0.3s ease forwards';

  setTimeout(() => {
    toast.style.animation = 'toastOut 0.3s ease forwards';
    setTimeout(() => {
      toast.style.display = 'none';
    }, 300);
  }, 3000);
}

// Track current subscriptions for UI state
let currentSubscriptions = new Set();

// All songs pagination state
const ALL_SONGS_LIMIT = 10;
let allSongsState = {
  page: 1,
  currentToken: null,
  nextToken: null,
  prevTokens: [],
};

// ═══════════════════════════════════════════════════════════════
// TAB MANAGEMENT
// ═══════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
  const tabBtns = document.querySelectorAll('.tab-btn');

  tabBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;

      // Update active tab button
      tabBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');

      // Show corresponding content
      document.querySelectorAll('.tab-content').forEach((section) => {
        section.style.display = 'none';
      });

      if (tab === 'search') {
        document.getElementById('search-section').style.display = '';
      } else if (tab === 'subscriptions') {
        document.getElementById('subscriptions-section').style.display = '';
        loadSubscriptions();
      } else if (tab === 'all-songs') {
        document.getElementById('all-songs-section').style.display = '';
        loadAllSongs({ reset: true });
      }
    });
  });

  const prevBtn = document.getElementById('all-prev');
  const nextBtn = document.getElementById('all-next');

  if (prevBtn && nextBtn) {
    prevBtn.addEventListener('click', () => {
      if (allSongsState.page <= 1) return;
      allSongsState.page -= 1;
      allSongsState.currentToken = allSongsState.prevTokens.pop() || null;
      loadAllSongs({ token: allSongsState.currentToken });
    });

    nextBtn.addEventListener('click', () => {
      if (!allSongsState.nextToken) return;
      allSongsState.prevTokens.push(allSongsState.currentToken);
      allSongsState.currentToken = allSongsState.nextToken;
      allSongsState.page += 1;
      loadAllSongs({ token: allSongsState.currentToken });
    });
  }
});

// ═══════════════════════════════════════════════════════════════
// SEARCH
// ═══════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
  const searchForm = document.getElementById('search-form');
  const searchResults = document.getElementById('search-results');
  const noResults = document.getElementById('no-results');

  searchForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const title = document.getElementById('search-title').value;
    const artist = document.getElementById('search-artist').value;
    const album = document.getElementById('search-album').value;
    const year = document.getElementById('search-year').value;

    // Validate at least one field
    if (!title && !artist && !album && !year) {
      showToast('Please enter at least one search field', 'error');
      return;
    }

    const btn = document.getElementById('search-btn');
    const btnText = btn.querySelector('.btn-text');
    const btnLoader = btn.querySelector('.btn-loader');

    try {
      btn.disabled = true;
      btnText.style.display = 'none';
      btnLoader.style.display = '';

      const data = await API.searchMusic({ title, artist, album, year });

      if (data.results.length === 0) {
        searchResults.innerHTML = '';
        noResults.style.display = '';
      } else {
        noResults.style.display = 'none';
        renderSearchResults(data.results);
      }
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      btn.disabled = false;
      btnText.style.display = '';
      btnLoader.style.display = 'none';
    }
  });
});

/**
 * Render search results as song cards with subscribe buttons.
 */
function renderSearchResults(songs) {
  const container = document.getElementById('search-results');

  container.innerHTML = songs
    .map((song) => {
      const songId = `${song.artist}#${song.title}`;
      const isSubscribed = currentSubscriptions.has(songId);
      const imgSrc = song.img_url || generatePlaceholder(song.artist);

      return `
        <div class="song-card" data-song-id="${escapeHtml(songId)}">
          <img 
            class="song-card-img" 
            src="${escapeHtml(imgSrc)}" 
            alt="${escapeHtml(song.artist)}" 
            onerror="this.src='${generatePlaceholder(song.artist)}'"
          >
          <div class="song-card-info">
            <div class="song-title" title="${escapeHtml(song.title)}">${escapeHtml(song.title)}</div>
            <div class="song-artist">${escapeHtml(song.artist)}</div>
            <div class="song-meta">${escapeHtml(song.album)} • ${escapeHtml(song.year)}</div>
          </div>
          <div class="song-card-actions">
            ${
              isSubscribed
                ? `<button class="btn-subscribe subscribed" disabled>✓ Subscribed</button>`
                : `<button class="btn-subscribe" onclick="handleSubscribe(this, ${escapeAttr(JSON.stringify(song))})">
                    + Subscribe
                  </button>`
            }
          </div>
        </div>
      `;
    })
    .join('');
}

// ──────────────────────────────────────────────────────────────────────────────
// ALL SONGS (PAGINATED)
// ──────────────────────────────────────────────────────────────────────────────

function resetAllSongsState() {
  allSongsState = {
    page: 1,
    currentToken: null,
    nextToken: null,
    prevTokens: [],
  };
}

async function loadAllSongs({ reset = false, token = null } = {}) {
  const list = document.getElementById('all-songs-list');
  const empty = document.getElementById('no-all-songs');
  const countEl = document.getElementById('all-songs-count');
  const pageEl = document.getElementById('all-page');
  const prevBtn = document.getElementById('all-prev');
  const nextBtn = document.getElementById('all-next');

  if (!list || !countEl || !pageEl || !prevBtn || !nextBtn || !empty) {
    return;
  }

  if (reset) {
    resetAllSongsState();
    token = null;
  }

  countEl.textContent = 'Loading songs...';
  prevBtn.disabled = allSongsState.page <= 1;
  nextBtn.disabled = true;

  try {
    const data = await API.getAllSongs({
      limit: ALL_SONGS_LIMIT,
      next: token,
    });

    allSongsState.currentToken = token;
    allSongsState.nextToken = data.nextToken || null;

    if (!data.results || data.results.length === 0) {
      list.innerHTML = '';
      empty.style.display = '';
    } else {
      empty.style.display = 'none';
      renderAllSongs(data.results);
    }

    const count = data.results ? data.results.length : 0;
    countEl.textContent = `${count} song${count !== 1 ? 's' : ''} on this page`;
    pageEl.textContent = `Page ${allSongsState.page}`;
    prevBtn.disabled = allSongsState.page <= 1;
    nextBtn.disabled = !allSongsState.nextToken;
  } catch (error) {
    showToast(error.message || 'Failed to load songs', 'error');
  }
}

function renderAllSongs(songs) {
  const container = document.getElementById('all-songs-list');

  container.innerHTML = songs
    .map((song) => {
      const songId = `${song.artist}#${song.title}`;
      const isSubscribed = currentSubscriptions.has(songId);
      const imgSrc = song.img_url || generatePlaceholder(song.artist);

      return `
        <div class="song-card" data-song-id="${escapeHtml(songId)}">
          <img 
            class="song-card-img" 
            src="${escapeHtml(imgSrc)}" 
            alt="${escapeHtml(song.artist)}" 
            onerror="this.src='${generatePlaceholder(song.artist)}'"
          >
          <div class="song-card-info">
            <div class="song-title" title="${escapeHtml(song.title)}">${escapeHtml(song.title)}</div>
            <div class="song-artist">${escapeHtml(song.artist)}</div>
            <div class="song-meta">${escapeHtml(song.album)} • ${escapeHtml(song.year)}</div>
          </div>
          <div class="song-card-actions">
            ${
              isSubscribed
                ? `<button class="btn-subscribe subscribed" disabled>✓ Subscribed</button>`
                : `<button class="btn-subscribe" onclick="handleSubscribe(this, ${escapeAttr(JSON.stringify(song))})">
                    + Subscribe
                  </button>`
            }
          </div>
        </div>
      `;
    })
    .join('');
}

// ═══════════════════════════════════════════════════════════════
// SUBSCRIPTIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Load user's subscriptions from the API.
 */
async function loadSubscriptions() {
  try {
    const data = await API.getSubscriptions();
    const subs = data.subscriptions || [];

    // Update the tracked subscription set
    currentSubscriptions = new Set(subs.map((s) => s.song_id));

    // Update count
    document.getElementById('subs-count').textContent =
      `${subs.length} song${subs.length !== 1 ? 's' : ''} in your library`;

    const subsList = document.getElementById('subs-list');
    const noSubs = document.getElementById('no-subs');

    if (subs.length === 0) {
      subsList.innerHTML = '';
      noSubs.style.display = '';
    } else {
      noSubs.style.display = 'none';
      renderSubscriptions(subs);
    }

    syncSubscribeButtons();
  } catch (error) {
    console.error('Failed to load subscriptions:', error);
  }
}

/**
 * Render subscription cards with remove buttons.
 */
function renderSubscriptions(subs) {
  const container = document.getElementById('subs-list');

  container.innerHTML = subs
    .map((sub) => {
      const imgSrc = sub.img_url || generatePlaceholder(sub.artist);

      return `
        <div class="song-card" data-song-id="${escapeHtml(sub.song_id)}">
          <img 
            class="song-card-img" 
            src="${escapeHtml(imgSrc)}" 
            alt="${escapeHtml(sub.artist)}"
            onerror="this.src='${generatePlaceholder(sub.artist)}'"
          >
          <div class="song-card-info">
            <div class="song-title" title="${escapeHtml(sub.title)}">${escapeHtml(sub.title)}</div>
            <div class="song-artist">${escapeHtml(sub.artist)}</div>
            <div class="song-meta">${escapeHtml(sub.album || '')} • ${escapeHtml(sub.year || '')}</div>
          </div>
          <div class="song-card-actions">
            <button class="btn-remove" onclick="handleRemove('${escapeAttr(sub.song_id)}')">
              ✕ Remove
            </button>
          </div>
        </div>
      `;
    })
    .join('');
}

// ═══════════════════════════════════════════════════════════════
// ACTION HANDLERS
// ═══════════════════════════════════════════════════════════════

/**
 * Handle subscribing to a song.
 */
async function handleSubscribe(btnElement, song) {
  try {
    btnElement.disabled = true;
    btnElement.textContent = '⏳';

    await API.subscribe({
      title: song.title,
      artist: song.artist,
      year: song.year,
      album: song.album,
      img_url: song.img_url || '',
    });

    const songId = `${song.artist}#${song.title}`;
    currentSubscriptions.add(songId);

    btnElement.textContent = '✓ Subscribed';
    btnElement.classList.add('subscribed');

    syncSubscribeButtons();
    showToast(`Subscribed to "${song.title}"!`, 'success');
  } catch (error) {
    btnElement.disabled = false;
    btnElement.textContent = '+ Subscribe';
    showToast(error.message, 'error');
  }
}

/**
 * Handle removing a subscription.
 */
async function handleRemove(songId) {
  try {
    await API.unsubscribe(songId);
    currentSubscriptions.delete(songId);

    syncSubscribeButtons();
    // Remove the card from the DOM with animation
    const card = document.querySelector(`.song-card[data-song-id="${CSS.escape(songId)}"]`);
    if (card) {
      card.style.transition = '0.3s ease';
      card.style.opacity = '0';
      card.style.transform = 'scale(0.95)';
      setTimeout(() => card.remove(), 300);
    }

    // Reload subscriptions to update count
    setTimeout(() => loadSubscriptions(), 350);

    showToast('Subscription removed', 'success');
  } catch (error) {
    showToast(error.message, 'error');
  }
}

// ═══════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════

function syncSubscribeButtons() {
  document.querySelectorAll('.song-card').forEach((card) => {
    const songId = card.getAttribute('data-song-id');
    const btn = card.querySelector('.btn-subscribe');
    if (!btn || !songId) return;

    if (currentSubscriptions.has(songId)) {
      btn.textContent = '✓ Subscribed';
      btn.classList.add('subscribed');
      btn.disabled = true;
    } else {
      btn.textContent = '+ Subscribe';
      btn.classList.remove('subscribed');
      btn.disabled = false;
    }
  });
}

/**
 * Generate a data URI placeholder image with the artist's initials.
 */
function generatePlaceholder(name) {
  const initials = (name || '?')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  // Generate a unique-ish color based on the name
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="80" height="80">
      <rect width="80" height="80" rx="12" fill="hsl(${hue}, 50%, 25%)"/>
      <text x="40" y="44" font-family="Inter,Arial" font-size="24" font-weight="600" 
            fill="hsl(${hue}, 80%, 75%)" text-anchor="middle" dominant-baseline="middle">
        ${initials}
      </text>
    </svg>`;

  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/**
 * Escape HTML to prevent XSS.
 */
function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = String(str);
  return div.innerHTML;
}

/**
 * Escape for HTML attribute context.
 */
function escapeAttr(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/'/g, '&#39;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
