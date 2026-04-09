/**
 * SMOTRIM.NET — Main App
 * StreamLiveTV API + IPTV.org + SEO
 */

// =============================================
// CONFIG
// =============================================
const CONFIG = {
  streamApiUrl: 'https://aqeleulwobgamdffkfri.supabase.co/functions/v1/public-channels',
  embedBase: 'https://stlivetv.tatnet.app/embed/',
  embessBase: 'https://embesslivestudio.lovable.app/player?channel=',
  iptvApiBase: 'https://iptv-org.github.io/api',
  iptvPlayerPage: '/pages/iptv-player.html',
  channelsPerPage: 24,
  refreshInterval: 5 * 60 * 1000, // 5 minutes
  streamFetchPageSize: 100,
  streamFetchMaxPages: 50,
  allowedOwners: ['oinktech', 'Twixoff', 'ТВКАНАЛЫ'],
  iptvStatTarget: 8000,
};

// =============================================
// STATE
// =============================================
const state = {
  allChannels: [],       // StreamLiveTV filtered
  iptvChannels: [],      // IPTV.org merged channels+streams
  currentPage: 1,
  iptvPage: 1,
  activeSource: 'all',   // all | streamlivetv | iptv
  activeType: 'all',     // all | tv | radio
  searchQuery: '',
  isLoading: false,
  pendingHashRoute: null,
  activePlayerSource: 'streamlivetv',
  selectedCategory: 'all',
  selectedChannelKey: '',
  profile: {
    liked: {},
    favorites: {},
    lastOpened: null
  },
  restoredOnce: false
};

// =============================================
// DOM HELPERS
// =============================================
const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => c.querySelectorAll(s);

// =============================================
// INIT
// =============================================
document.addEventListener('DOMContentLoaded', () => {
  loadProfile();
  setupNav();
  setupSearch();
  setupBurger();
  setupThemeToggle();
  setupQuickPicker();
  setupMobileNav();
  setupPlayerClose();
  setupPlayerSourceSwitcher();
  setupFilterTabs();
  applyRouteFromLocation();
  loadChannels();
  loadIptvChannels();

  // Auto-refresh
  setInterval(() => {
    loadChannels(true);
    loadIptvChannels(true);
  }, CONFIG.refreshInterval);

  window.addEventListener('popstate', handleRoute);
});

// =============================================
// NAVIGATION
// =============================================
function setupNav() {
  $$('.nav-link').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      $$('.nav-link').forEach(l => l.classList.remove('active'));
      link.classList.add('active');
      const filter = link.dataset.filter;
      if (filter === 'iptv') {
        history.replaceState({}, '', '/iptv');
        document.getElementById('iptv-channels-section').scrollIntoView({ behavior: 'smooth' });
      } else {
        state.activeType = filter;
        state.currentPage = 1;
        renderChannels();
        history.replaceState({}, '', filter === 'all' ? '/' : `/${filter}`);
        document.getElementById('all-channels').scrollIntoView({ behavior: 'smooth' });
        syncMobileNav(filter);
      }
    });
  });
}

function setupMobileNav() {
  $$('.mobile-nav-link[data-filter]').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      const filter = link.dataset.filter || 'all';
      const navLink = $(`.nav-link[data-filter="${filter}"]`);
      if (navLink) navLink.click();
    });
  });
  const favBtn = $('#mobile-open-favorites');
  if (favBtn) {
    favBtn.addEventListener('click', () => {
      state.searchQuery = '';
      const favoriteIds = Object.keys(state.profile.favorites);
      if (!favoriteIds.length) return alert('Пока нет избранных каналов.');
      const channel = getAllSelectableChannels().find(ch => favoriteIds.includes(ch.key));
      if (channel) openAnyChannel(channel);
    });
  }
}

function syncMobileNav(filter) {
  $$('.mobile-nav-link[data-filter]').forEach(item => item.classList.toggle('active', item.dataset.filter === filter));
}

// =============================================
// SEARCH
// =============================================
function setupSearch() {
  const input = $('#search-input');
  if (!input) return;
  let debounce;
  input.addEventListener('input', () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      state.searchQuery = input.value.trim().toLowerCase();
      state.currentPage = 1;
      state.iptvPage = 1;
      renderChannels();
      renderIptvChannels();
    }, 300);
  });
}

function setupThemeToggle() {
  const btn = $('#theme-toggle');
  if (!btn) return;
  applyTheme(state.profile.theme || 'light');
  btn.addEventListener('click', () => {
    const current = document.body.dataset.theme === 'dark' ? 'dark' : 'light';
    const next = current === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    state.profile.theme = next;
    saveProfile();
  });
}

function applyTheme(theme) {
  document.body.dataset.theme = theme;
  const btn = $('#theme-toggle');
  if (btn) btn.textContent = theme === 'dark' ? '☀️' : '🌙';
}

// =============================================
// BURGER
// =============================================
function setupBurger() {
  const btn = $('#burger-btn');
  const nav = $('#main-nav');
  if (!btn || !nav) return;
  btn.addEventListener('click', () => nav.classList.toggle('open'));
}

// =============================================
// FILTER TABS
// =============================================
function setupFilterTabs() {
  $$('.ftab').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.ftab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.activeSource = btn.dataset.source;
      state.currentPage = 1;
      renderChannels();
      if (state.activeSource === 'iptv') {
        history.replaceState({}, '', '/iptv');
        document.getElementById('iptv-channels-section').scrollIntoView({ behavior: 'smooth' });
      }
    });
  });
}

function setupQuickPicker() {
  const categoriesWrap = $('#category-select');
  const channelsWrap = $('#channel-select');
  const openBtn = $('#open-selected-channel');
  if (!categoriesWrap || !channelsWrap || !openBtn) return;

  categoriesWrap.addEventListener('click', (event) => {
    const btn = event.target.closest('.quick-chip');
    if (!btn) return;
    const selectedCategory = btn.dataset.category || 'all';
    if (selectedCategory === state.selectedCategory) return;
    state.selectedCategory = selectedCategory;
    renderQuickPickerCategories();
    renderQuickPickerChannels();
  });

  channelsWrap.addEventListener('click', (event) => {
    const btn = event.target.closest('.quick-channel-btn');
    if (!btn) return;
    state.selectedChannelKey = btn.dataset.channelKey || '';
    renderQuickPickerChannels();
  });

  openBtn.addEventListener('click', () => {
    const channel = getAllSelectableChannels().find(ch => ch.key === state.selectedChannelKey);
    if (channel) openAnyChannel(channel);
  });
}

function refreshQuickPicker() {
  const categoriesWrap = $('#category-select');
  if (!categoriesWrap) return;
  renderQuickPickerCategories();
  renderQuickPickerChannels();
}

function renderQuickPickerCategories() {
  const categoriesWrap = $('#category-select');
  if (!categoriesWrap) return;

  const channels = getAllSelectableChannels();
  const categories = ['all', ...Array.from(new Set(channels.map(ch => ch.category).filter(Boolean)))];
  if (!categories.includes(state.selectedCategory)) state.selectedCategory = 'all';

  categoriesWrap.innerHTML = categories.map(cat => {
    const title = cat === 'all' ? 'Все' : escapeAttr(cat);
    const active = state.selectedCategory === cat ? ' active' : '';
    return `<button type="button" class="quick-chip${active}" data-category="${escapeAttr(cat)}">${title}</button>`;
  }).join('');
}

function renderQuickPickerChannels() {
  const channelsWrap = $('#channel-select');
  if (!channelsWrap) return;

  const channels = getAllSelectableChannels().filter(ch => state.selectedCategory === 'all' || ch.category === state.selectedCategory);
  if (!channels.length) {
    channelsWrap.innerHTML = '<span class="quick-channel-empty">Нет каналов</span>';
    state.selectedChannelKey = '';
    return;
  }

  const hasCurrent = channels.some(ch => ch.key === state.selectedChannelKey);
  state.selectedChannelKey = hasCurrent ? state.selectedChannelKey : channels[0].key;

  channelsWrap.innerHTML = channels.map(ch => {
    const active = state.selectedChannelKey === ch.key ? ' active' : '';
    return `<button type="button" class="quick-channel-btn${active}" data-channel-key="${escapeAttr(ch.key)}">${escapeAttr(ch.title)}</button>`;
  }).join('');
}

// =============================================
// LOAD STREAMLIVETV CHANNELS
// =============================================
async function loadChannels(silent = false) {
  if (!silent) showLoading(true);

  try {
    // Load all pages
    let allData = [];
    let page = 1;
    let totalPages = 1;

    while (page <= totalPages && page <= CONFIG.streamFetchMaxPages) {
      const res = await fetch(`${CONFIG.streamApiUrl}?page=${page}&limit=${CONFIG.streamFetchPageSize}`);
      const json = await res.json();

      if (json.data) {
        allData = [...allData, ...json.data];
        totalPages = json.pagination?.total_pages || 1;
      }
      page++;
    }

    // Filter: only oinktech, Twixoff, ТВКАНАЛЫ owners
    state.allChannels = allData.filter(ch => {
      const owner = ch.owner?.username || '';
      return CONFIG.allowedOwners.some(allowed =>
        owner.toLowerCase() === allowed.toLowerCase()
      );
    });

    // Update stats
    updateStats();
    renderFeatured();
    renderChannels();
    refreshQuickPicker();
    tryRestoreLastOpened();
    tryApplyPendingHashRoute();
    showLoading(false);

  } catch (err) {
    console.error('StreamLiveTV load error:', err);
    if (!silent) showError(true);
    showLoading(false);
  }
}

// =============================================
// LOAD IPTV.ORG CHANNELS
// =============================================
async function loadIptvChannels(silent = false) {
  const loadingEl = $('#iptv-loading');
  if (!silent && loadingEl) loadingEl.classList.remove('hidden');

  try {
    const [streamsRes, channelsRes] = await Promise.all([
      fetch(`${CONFIG.iptvApiBase}/streams.json`),
      fetch(`${CONFIG.iptvApiBase}/channels.json`)
    ]);

    const streams = await streamsRes.json();
    const channels = await channelsRes.json();
    const channelMap = new Map(channels.map(ch => [ch.id, ch]));

    const seen = new Set();
    state.iptvChannels = streams
      .filter(s => s.channel && s.url)
      .filter(s => /^https?:\/\//i.test(s.url))
      .filter(s => {
        const key = `${s.channel}__${s.url}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map(s => {
        const meta = channelMap.get(s.channel) || {};
        return {
          channel: s.channel,
          channel_name: meta.name || s.channel,
          url: s.url,
          logo: meta.logo || '',
          country: meta.country || '',
          categories: meta.categories || [],
          languages: meta.languages || [],
          website: meta.website || '',
          isIptv: true
        };
      });

  } catch (err) {
    console.error('IPTV.org load error:', err);
    state.iptvChannels = [];
  }

  if (!silent && loadingEl) loadingEl.classList.add('hidden');
  updateStats();
  renderIptvChannels();
  refreshQuickPicker();
  tryApplyPendingHashRoute();
}

// =============================================
// STATS
// =============================================
function updateStats() {
  const tvCount = state.allChannels.filter(c => c.channel_type === 'tv').length;
  const radioCount = state.allChannels.filter(c => c.channel_type === 'radio').length;

  animateNumber('#stat-tv', tvCount);
  animateNumber('#stat-radio', radioCount);
  const iptvCount = Math.max(state.iptvChannels.length, CONFIG.iptvStatTarget);
  animateNumber('#stat-iptv', iptvCount);
}

function animateNumber(selector, target) {
  const el = $(selector);
  if (!el) return;
  if (typeof target === 'string') { el.textContent = target; return; }
  let current = 0;
  const step = Math.ceil(target / 30);
  const timer = setInterval(() => {
    current = Math.min(current + step, target);
    el.textContent = current;
    if (current >= target) clearInterval(timer);
  }, 30);
}

// =============================================
// RENDER FEATURED (top channels scroll)
// =============================================
function renderFeatured() {
  const grid = $('#featured-grid');
  if (!grid) return;

  const featured = state.allChannels
    .filter(c => c.channel_type === 'tv')
    .slice(0, 12);

  grid.innerHTML = featured.map(ch => `
    <div class="featured-card" onclick="openChannel('${ch.id}', '${escapeAttr(ch.title)}', '${escapeAttr(ch.description || '')}', '${ch.channel_type}', '${escapeAttr(ch.owner?.username || '')}')" role="button" aria-label="Смотреть ${ch.title}">
      <div class="featured-thumb">
        ${ch.thumbnail_url
          ? `<img src="${ch.thumbnail_url}" alt="${escapeAttr(ch.title)}" loading="lazy" onerror="this.style.display='none'">`
          : getChannelEmoji(ch.title, ch.channel_type)
        }
        <div class="live-dot-wrap">
          <span class="ch-live-badge"><span class="live-dot"></span>LIVE</span>
        </div>
      </div>
      <div class="featured-info">
        <div class="featured-name">${ch.title}</div>
        <div class="featured-owner">${ch.owner?.username || ''}</div>
      </div>
    </div>
  `).join('');
}

// =============================================
// RENDER CHANNELS GRID
// =============================================
function renderChannels() {
  const grid = $('#channels-grid');
  const pag = $('#pagination');
  if (!grid) return;

  let channels = [...state.allChannels];

  // Type filter
  if (state.activeType !== 'all') {
    channels = channels.filter(c => c.channel_type === state.activeType);
  }

  // Source filter
  if (state.activeSource === 'iptv') {
    grid.innerHTML = '';
    return;
  }

  // Search
  if (state.searchQuery) {
    channels = channels.filter(c =>
      c.title.toLowerCase().includes(state.searchQuery) ||
      (c.description || '').toLowerCase().includes(state.searchQuery)
    );
  }

  // Update title
  const titleEl = $('#channels-title');
  if (titleEl) {
    titleEl.textContent = state.searchQuery
      ? `Результаты поиска: "${state.searchQuery}" (${channels.length})`
      : `Все каналы (${channels.length})`;
  }

  // Pagination
  const total = channels.length;
  const totalPages = Math.ceil(total / CONFIG.channelsPerPage);
  const start = (state.currentPage - 1) * CONFIG.channelsPerPage;
  const pageChannels = channels.slice(start, start + CONFIG.channelsPerPage);

  if (pageChannels.length === 0) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <div class="empty-icon">📺</div>
        <h3>Каналы не найдены</h3>
        <p>Попробуйте изменить запрос</p>
      </div>
    `;
    if (pag) pag.innerHTML = '';
    return;
  }

  grid.innerHTML = pageChannels.map(ch => buildChannelCard(ch, 'stream')).join('');

  // Render pagination
  if (pag) renderPagination(pag, totalPages, state.currentPage, (p) => {
    state.currentPage = p;
    renderChannels();
    document.getElementById('all-channels').scrollIntoView({ behavior: 'smooth' });
  });
}

// =============================================
// RENDER IPTV CHANNELS
// =============================================
function renderIptvChannels() {
  const grid = $('#iptv-grid');
  const pag = $('#iptv-pagination');
  if (!grid) return;

  let channels = [...state.iptvChannels];

  // Search
  if (state.searchQuery) {
    channels = channels.filter(c => {
      const name = (c.channel_name || c.channel || '').toLowerCase();
      return name.includes(state.searchQuery);
    });
  }

  if (channels.length === 0) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="empty-icon">🌐</div><h3>IPTV каналы не найдены</h3></div>`;
    return;
  }

  const totalPages = Math.ceil(channels.length / CONFIG.channelsPerPage);
  const start = (state.iptvPage - 1) * CONFIG.channelsPerPage;
  const page = channels.slice(start, start + CONFIG.channelsPerPage);

  grid.innerHTML = page.map(ch => buildIptvCard(ch)).join('');

  if (pag) renderPagination(pag, totalPages, state.iptvPage, (p) => {
    state.iptvPage = p;
    renderIptvChannels();
    document.getElementById('iptv-channels-section').scrollIntoView({ behavior: 'smooth' });
  });
}

// =============================================
// BUILD CHANNEL CARD HTML
// =============================================
function buildChannelCard(ch, source) {
  const slug = slugify(ch.title);
  const desc = ch.description || '';
  const owner = ch.owner?.username || '';
  const isRadio = ch.channel_type === 'radio';
  const emoji = getChannelEmoji(ch.title, ch.channel_type);
  const typeLabel = isRadio ? 'radio' : 'tv';
  const typeClass = isRadio ? 'ch-type-radio' : 'ch-type-tv';
  const typeText = isRadio ? '📻 Радио' : '📺 ТВ';
  const favKey = `stream:${ch.id}`;
  const isFav = Boolean(state.profile.favorites[favKey]);

  return `
    <article class="channel-card" 
      onclick="openChannel('${ch.id}', '${escapeAttr(ch.title)}', '${escapeAttr(desc)}', '${typeLabel}', '${escapeAttr(owner)}')"
      aria-label="Смотреть ${ch.title} онлайн"
      itemscope itemtype="https://schema.org/BroadcastChannel">
      <meta itemprop="name" content="${escapeAttr(ch.title)}">
      <meta itemprop="description" content="${escapeAttr(desc)}">
      <div class="channel-thumb">
        ${ch.thumbnail_url
          ? `<img src="${ch.thumbnail_url}" alt="${escapeAttr(ch.title)} — смотреть онлайн" loading="lazy" itemprop="image" onerror="this.style.display='none'">`
          : emoji
        }
        <span class="ch-live-badge"><span class="live-dot"></span>LIVE</span>
        <span class="ch-type-badge ${typeClass}">${typeText}</span>
        <button class="fav-btn ${isFav ? 'active' : ''}" type="button" onclick="event.stopPropagation();toggleFavorite('${favKey}', {title:'${escapeAttr(ch.title)}', type:'stream'})" aria-label="Добавить в избранное">${isFav ? '★' : '☆'}</button>
      </div>
      <div class="channel-info">
        <h3 class="channel-name" itemprop="broadcastDisplayName">${ch.title}</h3>
        ${desc ? `<p class="channel-desc">${desc}</p>` : ''}
        <div class="channel-footer">
          <span class="channel-owner">${owner}</span>
          <span class="play-icon">▶</span>
        </div>
      </div>
    </article>
  `;
}

function buildIptvCard(ch) {
  const name = ch.channel_name || ch.channel || 'IPTV Channel';
  const logo = ch.logo || ch.icon || '';
  const country = ch.country || '';
  const url = ch.url || '';
  const categories = Array.isArray(ch.categories) ? ch.categories.slice(0, 2).join(', ') : '';
  const favKey = `iptv:${slugify(name)}`;
  const isFav = Boolean(state.profile.favorites[favKey]);

  return `
    <article class="channel-card"
      onclick="openIptvChannel('${escapeAttr(name)}', '${escapeAttr(url)}', '${escapeAttr(logo)}')"
      aria-label="Смотреть ${name}"
      itemscope itemtype="https://schema.org/BroadcastChannel">
      <meta itemprop="name" content="${escapeAttr(name)}">
      <div class="channel-thumb">
        ${logo
          ? `<img src="${logo}" alt="${escapeAttr(name)}" loading="lazy" onerror="this.style.display='none';this.parentElement.innerHTML+='🌐'">`
          : '🌐'
        }
        <span class="ch-type-badge ch-type-iptv">🌐 IPTV</span>
        <button class="fav-btn ${isFav ? 'active' : ''}" type="button" onclick="event.stopPropagation();toggleFavorite('${favKey}', {title:'${escapeAttr(name)}', type:'iptv'})" aria-label="Добавить в избранное">${isFav ? '★' : '☆'}</button>
        ${country ? `<span style="position:absolute;bottom:6px;right:6px;font-size:0.65rem;background:rgba(0,0,0,0.6);padding:2px 5px;border-radius:3px;color:#fff;">${country}</span>` : ''}
      </div>
      <div class="channel-info">
        <h3 class="channel-name">${name}</h3>
        ${categories ? `<p class="channel-desc">${categories}</p>` : ''}
        <div class="channel-footer">
          <span class="channel-owner" style="color:var(--iptv);">IPTV.org</span>
          <span class="play-icon">▶</span>
        </div>
      </div>
    </article>
  `;
}

// =============================================
// PAGINATION
// =============================================
function renderPagination(container, totalPages, current, onPage) {
  if (totalPages <= 1) { container.innerHTML = ''; return; }

  let html = '';

  // Prev
  html += `<button class="pag-btn" ${current === 1 ? 'disabled' : ''} onclick="(${onPage.toString()})(${current - 1})">← Назад</button>`;

  // Pages
  const pages = getPagesRange(current, totalPages);
  pages.forEach(p => {
    if (p === '...') {
      html += `<button class="pag-btn" disabled>…</button>`;
    } else {
      html += `<button class="pag-btn ${p === current ? 'active' : ''}" onclick="(${onPage.toString()})(${p})">${p}</button>`;
    }
  });

  // Next
  html += `<button class="pag-btn" ${current === totalPages ? 'disabled' : ''} onclick="(${onPage.toString()})(${current + 1})">Вперёд →</button>`;

  container.innerHTML = html;
}

function getPagesRange(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = [];
  pages.push(1);
  if (current > 3) pages.push('...');
  for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) {
    pages.push(i);
  }
  if (current < total - 2) pages.push('...');
  pages.push(total);
  return pages;
}


function normalizeSlug(value) {
  return decodeURIComponent((value || '').toString().trim().toLowerCase())
    .replace(/[^a-z0-9а-яё]+/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function slugsMatch(a, b) {
  const na = normalizeSlug(a);
  const nb = normalizeSlug(b);
  if (!na || !nb) return false;
  return na === nb || na.replace(/-/g, '') === nb.replace(/-/g, '');
}

function buildWatchPageUrl({ id = '', title = '' } = {}) {
  const slug = title ? slugify(title) : id;
  return `/watch/${encodeURIComponent(slug || id)}`;
}

// =============================================
// PLAYER — StreamLiveTV
// =============================================
function openChannel(id, title, desc, type, owner) {
  const overlay = $('#player-overlay');
  const iframe = $('#player-iframe');
  const titleEl = $('#player-title');
  const descEl = $('#player-desc');
  const metaEl = $('#player-meta');
  const fullBtn = $('#player-fullpage-btn');

  if (!overlay || !iframe) return;

  const embedUrl = getStreamEmbedUrl(id);
  const watchUrl = `${buildWatchPageUrl({ id, title })}?source=${encodeURIComponent(state.activePlayerSource)}`;

  iframe.src = embedUrl;
  if (titleEl) titleEl.textContent = title;
  if (descEl) descEl.textContent = desc || 'Прямой эфир';
  if (metaEl) metaEl.innerHTML = `
    <span>👤 ${owner}</span>
    <span>📺 ${type === 'radio' ? 'Радио' : 'ТВ'}</span>
    <span>🔴 Прямой эфир</span>
  `;
  if (fullBtn) { fullBtn.href = watchUrl; }

  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
  state.profile.lastOpened = { key: `stream:${id}` };
  saveProfile();

  // Update URL for SEO
  const slug = slugify(title);
  history.replaceState({ channelId: id, title }, title, `/watch/${slug}`);
  document.title = `${title} — смотреть онлайн прямой эфир | Smotrim.net`;

  // Update meta for SEO
  updateMeta(`${title} — смотреть онлайн | Smotrim.net`,
    `Смотрите ${title} онлайн бесплатно на Smotrim.net. Прямой эфир без регистрации.`);
  syncPlayerFavoriteButton();
}

// =============================================
// PLAYER — IPTV.org
// =============================================
function openIptvChannel(name, url, logo) {
  const overlay = $('#player-overlay');
  const iframe = $('#player-iframe');
  const titleEl = $('#player-title');
  const descEl = $('#player-desc');
  const metaEl = $('#player-meta');
  const fullBtn = $('#player-fullpage-btn');

  if (!overlay || !iframe) return;

  if (!url || !/^https?:\/\//i.test(url)) {
    alert('Поток IPTV недоступен или имеет некорректный URL.');
    return;
  }

  const embedUrl = `${CONFIG.iptvPlayerPage}?src=${encodeURIComponent(url)}&title=${encodeURIComponent(name)}`;

  iframe.src = embedUrl;
  if (titleEl) titleEl.textContent = name;
  if (descEl) descEl.textContent = 'IPTV.org — международный канал';
  if (metaEl) metaEl.innerHTML = `<span>🌐 IPTV.org</span><span>📡 Прямой эфир</span>`;
  if (fullBtn) { fullBtn.href = embedUrl; }

  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
  state.profile.lastOpened = { key: `iptv:${slugify(name)}` };
  saveProfile();

  const slug = slugify(name);
  history.replaceState({ iptv: true, name }, name, `/iptv/${slug}`);
  document.title = `${name} — IPTV онлайн | Smotrim.net`;
  updateMeta(`${name} — смотреть IPTV онлайн | Smotrim.net`,
    `Смотрите ${name} онлайн бесплатно. Международное телевидение IPTV на Smotrim.net.`);
  syncPlayerFavoriteButton();
}

// =============================================
// CLOSE PLAYER
// =============================================
function setupPlayerClose() {
  const overlay = $('#player-overlay');
  const closeBtn = $('#player-close');
  const iframe = $('#player-iframe');

  if (closeBtn) {
    closeBtn.addEventListener('click', closePlayer);
  }

  if (overlay) {
    overlay.addEventListener('click', e => {
      if (e.target === overlay) closePlayer();
    });
  }

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closePlayer();
  });

  // Back button
  window.addEventListener('popstate', handleRoute);
}

function setupPlayerSourceSwitcher() {
  const switcher = $('#player-source-switcher');
  if (!switcher) return;

  switcher.innerHTML = `
    <button class="player-source-btn active" type="button" data-source="streamlivetv">StreamLiveTV</button>
    <button class="player-source-btn" type="button" data-source="embess">EmbessLiveStudio</button>
  `;

  switcher.querySelectorAll('.player-source-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const source = btn.dataset.source;
      state.activePlayerSource = source;
      switcher.querySelectorAll('.player-source-btn')
        .forEach(item => item.classList.toggle('active', item.dataset.source === source));

      const overlay = $('#player-overlay');
      const iframe = $('#player-iframe');
      if (!overlay || !iframe || !overlay.classList.contains('open')) return;

      const historyState = window.history.state || {};
      if (!historyState.channelId) return;
      iframe.src = getStreamEmbedUrl(historyState.channelId);

      const fullBtn = $('#player-fullpage-btn');
      if (fullBtn) {
        fullBtn.href = `${buildWatchPageUrl({ id: historyState.channelId, title: historyState.title || '' })}?source=${encodeURIComponent(state.activePlayerSource)}`;
      }
    });
  });
  syncPlayerSourceSwitcher();
}

function getStreamEmbedUrl(channelId) {
  if (!channelId) return '';
  if (state.activePlayerSource === 'embess') {
    return `${CONFIG.embessBase}${encodeURIComponent(channelId)}`;
  }
  return `${CONFIG.embedBase}${channelId}`;
}

function closePlayer() {
  const overlay = $('#player-overlay');
  const iframe = $('#player-iframe');
  if (!overlay) return;
  overlay.classList.remove('open');
  document.body.style.overflow = '';
  if (iframe) iframe.src = '';
  history.replaceState({}, 'Smotrim.net', getFilterPath());
  document.title = 'Smotrim.net — Смотреть ТВ онлайн бесплатно | Прямые эфиры каналов';
  updateMeta(
    'Smotrim.net — Смотреть ТВ онлайн бесплатно',
    'Прямые эфиры более 50 телеканалов без регистрации. Россия 1, НТВ, СТС, ТНТ и другие.'
  );
}

function applyRouteFromLocation() {
  handleRoute();
}

function openStreamChannelBySlug(slug) {
  if (!slug || !state.allChannels.length) return false;
  const normalizedSlug = normalizeSlug(slug);
  const channel = state.allChannels.find(ch => {
    const titleSlug = slugify(ch.title || '');
    return slugsMatch(titleSlug, normalizedSlug)
      || slugsMatch(ch.id || '', normalizedSlug);
  });
  if (!channel) return false;
  openChannel(
    channel.id,
    channel.title,
    channel.description || '',
    channel.channel_type || 'tv',
    channel.owner?.username || ''
  );
  return true;
}

function openIptvChannelBySlug(slug) {
  if (!slug || !state.iptvChannels.length) return false;
  const channel = state.iptvChannels.find(ch => {
    const name = ch.channel_name || ch.channel || '';
    return slugify(name) === slug;
  });
  if (!channel) return false;
  openIptvChannel(
    channel.channel_name || channel.channel || '',
    channel.url || '',
    channel.logo || ''
  );
  return true;
}

function tryApplyPendingHashRoute() {
  if (!state.pendingHashRoute) return;
  const route = state.pendingHashRoute;
  if (route.type === 'watch' && openStreamChannelBySlug(route.slug)) {
    state.pendingHashRoute = null;
    return;
  }
  if (route.type === 'iptv' && openIptvChannelBySlug(route.slug)) {
    state.pendingHashRoute = null;
  }
}

function handleRoute() {
  const sourceParam = (new URLSearchParams(window.location.search).get('source') || '').toLowerCase();
  if (sourceParam === 'streamlivetv' || sourceParam === 'embess') {
    state.activePlayerSource = sourceParam;
    syncPlayerSourceSwitcher();
  }

  const path = window.location.pathname.toLowerCase().replace(/\/+$/, '') || '/';
  const hash = window.location.hash.replace(/^#/, '').trim().toLowerCase();
  const cleanHash = hash.split('?')[0];
  const navByFilter = {
    all: '.nav-link[data-filter="all"]',
    tv: '.nav-link[data-filter="tv"]',
    radio: '.nav-link[data-filter="radio"]',
    iptv: '.nav-link[data-filter="iptv"]',
  };

  if (path === '/tv' || path === '/radio' || path === '/all' || cleanHash === 'tv' || cleanHash === 'radio' || cleanHash === 'all') {
    const activeType = (path === '/tv' || cleanHash === 'tv')
      ? 'tv'
      : ((path === '/radio' || cleanHash === 'radio') ? 'radio' : 'all');
    state.activeType = activeType;
    state.activeSource = 'all';
    state.currentPage = 1;
    setActiveNav(navByFilter[activeType]);
    renderChannels();
    return;
  }

  if (path === '/iptv' || cleanHash === 'iptv') {
    state.activeType = 'all';
    state.activeSource = 'iptv';
    setActiveNav(navByFilter.iptv);
    renderChannels();
    document.getElementById('iptv-channels-section')?.scrollIntoView({ behavior: 'smooth' });
    return;
  }

  if (path.startsWith('/watch/') || cleanHash.startsWith('watch/')) {
    const slug = normalizeSlug(path.startsWith('/watch/')
      ? path.replace(/^\/watch\//, '').trim()
      : cleanHash.replace(/^watch\//, '').trim());
    applyWatchSeoFallback(slug);
    state.activeType = 'all';
    state.activeSource = 'all';
    setActiveNav(navByFilter.all);
    renderChannels();
    if (!openStreamChannelBySlug(slug)) {
      state.pendingHashRoute = { type: 'watch', slug };
    } else {
      state.pendingHashRoute = null;
    }
    return;
  }

  if (path.startsWith('/iptv/') || cleanHash.startsWith('iptv/')) {
    const slug = normalizeSlug(path.startsWith('/iptv/')
      ? path.replace(/^\/iptv\//, '').trim()
      : cleanHash.replace(/^iptv\//, '').trim());
    state.activeType = 'all';
    state.activeSource = 'iptv';
    setActiveNav(navByFilter.iptv);
    renderChannels();
    if (!openIptvChannelBySlug(slug)) {
      state.pendingHashRoute = { type: 'iptv', slug };
    } else {
      state.pendingHashRoute = null;
    }
    return;
  }

  if (path === '/' || !cleanHash || cleanHash === 'watch') {
    state.activeType = 'all';
    state.activeSource = 'all';
    state.pendingHashRoute = null;
    setActiveNav(navByFilter.all);
    renderChannels();
  }
}

function syncPlayerSourceSwitcher() {
  const switcher = $('#player-source-switcher');
  if (!switcher) return;
  switcher.querySelectorAll('.player-source-btn')
    .forEach(item => item.classList.toggle('active', item.dataset.source === state.activePlayerSource));
}

function applyWatchSeoFallback(slug) {
  if (!slug) return;
  const channelName = slug.split('-').filter(Boolean).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  const normalizedName = channelName || 'Телеканал';
  const title = `${normalizedName} — смотреть онлайн прямой эфир | Smotrim.net`;
  const description = `Смотрите ${normalizedName} онлайн бесплатно на Smotrim.net. Прямой эфир без регистрации.`;
  updateMeta(title, description);
}

function getFilterPath() {
  if (state.activeSource === 'iptv') return '/iptv';
  if (state.activeType === 'tv') return '/tv';
  if (state.activeType === 'radio') return '/radio';
  return '/';
}

function setActiveNav(selector) {
  $$('.nav-link').forEach(l => l.classList.remove('active'));
  const target = $(selector);
  if (target) target.classList.add('active');
  const filter = target?.dataset?.filter || 'all';
  syncMobileNav(filter);
}

// =============================================
// SEO HELPERS
// =============================================
function updateMeta(title, desc) {
  document.title = title;
  const metaDesc = $('meta[name="description"]');
  if (metaDesc) metaDesc.content = desc;
  const ogTitle = $('meta[property="og:title"]');
  if (ogTitle) ogTitle.content = title;
  const ogDesc = $('meta[property="og:description"]');
  if (ogDesc) ogDesc.content = desc;
}

function loadProfile() {
  try {
    const raw = localStorage.getItem('smotrim_profile_v1');
    if (!raw) return;
    const data = JSON.parse(raw);
    state.profile = {
      liked: data.liked || {},
      favorites: data.favorites || {},
      lastOpened: data.lastOpened || null,
      theme: data.theme || 'light'
    };
  } catch (e) {
    console.warn('profile load error', e);
  }
}

function saveProfile() {
  localStorage.setItem('smotrim_profile_v1', JSON.stringify(state.profile));
}

function getAllSelectableChannels() {
  const stream = state.allChannels.map(ch => ({
    key: `stream:${ch.id}`,
    id: ch.id,
    title: ch.title,
    type: 'stream',
    category: resolveCategory(ch.title, ch.channel_type),
    payload: ch
  }));
  const iptv = state.iptvChannels.slice(0, 2000).map(ch => ({
    key: `iptv:${ch.channel || slugify(ch.channel_name || '')}`,
    title: ch.channel_name || ch.channel || 'IPTV',
    type: 'iptv',
    category: resolveCategory(ch.channel_name || ch.channel || '', 'iptv'),
    payload: ch
  }));
  return [...stream, ...iptv];
}

function resolveCategory(title, type) {
  const t = (title || '').toLowerCase();
  if (type === 'radio') return 'Радио';
  if (t.includes('спорт')) return 'Спорт';
  if (t.includes('новост') || t.includes('news')) return 'Новости';
  if (t.includes('кино') || t.includes('film') || t.includes('movie')) return 'Кино';
  if (t.includes('дет') || t.includes('kids') || t.includes('мульт')) return 'Детские';
  if (type === 'iptv') return 'IPTV';
  return 'Общие';
}

function openAnyChannel(ch) {
  if (ch.type === 'iptv') {
    openIptvChannel(ch.payload.channel_name || ch.payload.channel || '', ch.payload.url || '', ch.payload.logo || '');
    return;
  }
  openChannel(
    ch.payload.id,
    ch.payload.title,
    ch.payload.description || '',
    ch.payload.channel_type || 'tv',
    ch.payload.owner?.username || ''
  );
}

function tryRestoreLastOpened() {
  if (state.restoredOnce) return;
  const path = window.location.pathname.toLowerCase();
  if (path !== '/') return;
  const saved = state.profile.lastOpened;
  if (!saved) return;
  const channel = getAllSelectableChannels().find(ch => ch.key === saved.key);
  if (!channel) return;
  state.restoredOnce = true;
  openAnyChannel(channel);
}

function toggleFavorite(key, payload = {}) {
  if (!key) return;
  if (state.profile.favorites[key]) {
    delete state.profile.favorites[key];
  } else {
    state.profile.favorites[key] = {
      title: payload.title || '',
      type: payload.type || '',
      savedAt: Date.now()
    };
  }
  saveProfile();
  renderChannels();
  renderIptvChannels();
  syncPlayerFavoriteButton();
}

function syncPlayerFavoriteButton() {
  const btn = $('#player-fav-btn');
  if (!btn) return;
  const active = history.state || {};
  const key = active.channelId ? `stream:${active.channelId}` : (active.iptv ? `iptv:${slugify(active.name || '')}` : '');
  const selected = Boolean(key && state.profile.favorites[key]);
  btn.classList.toggle('active', selected);
  btn.textContent = selected ? '★ В избранном' : '☆ В избранное';
  btn.onclick = () => {
    if (!key) return;
    toggleFavorite(key, { title: active.title || active.name || '', type: active.iptv ? 'iptv' : 'stream' });
  };
}

// =============================================
// LOADING / ERROR STATE
// =============================================
function showLoading(show) {
  const el = $('#loading-state');
  if (!el) return;
  el.style.display = show ? 'flex' : 'none';
}

function showError(show) {
  const el = $('#error-state');
  if (!el) return;
  el.classList.toggle('hidden', !show);
}

// =============================================
// UTILITIES
// =============================================
function slugify(str) {
  return str
    .toLowerCase()
    .replace(/[а-яёА-ЯЁ]/g, ch => {
      const map = {
        'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ё':'yo',
        'ж':'zh','з':'z','и':'i','й':'y','к':'k','л':'l','м':'m',
        'н':'n','о':'o','п':'p','р':'r','с':'s','т':'t','у':'u',
        'ф':'f','х':'h','ц':'ts','ч':'ch','ш':'sh','щ':'sch',
        'ъ':'','ы':'y','ь':'','э':'e','ю':'yu','я':'ya'
      };
      return map[ch] || ch;
    })
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function escapeAttr(str) {
  return (str || '').replace(/'/g, '&#39;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function getChannelEmoji(title, type) {
  if (type === 'radio') return '📻';
  const t = (title || '').toLowerCase();
  if (t.includes('детям') || t.includes('карусель') || t.includes('мульт') || t.includes('nick')) return '🎠';
  if (t.includes('музык') || t.includes('муз') || t.includes('radio') || t.includes('fm')) return '🎵';
  if (t.includes('новост') || t.includes('news') || t.includes('24')) return '📰';
  if (t.includes('спорт') || t.includes('sport')) return '⚽';
  if (t.includes('фильм') || t.includes('кино') || t.includes('сериал')) return '🎬';
  if (t.includes('природ') || t.includes('планет') || t.includes('галакт')) return '🌍';
  if (t.includes('россия') || t.includes('russia') || t.includes('рос')) return '🇷🇺';
  if (t.includes('беларус') || t.includes('бел')) return '🇧🇾';
  if (t.includes('казахст')) return '🇰🇿';
  return '📺';
}
