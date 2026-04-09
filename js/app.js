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
  setupNav();
  setupSearch();
  setupBurger();
  setupPlayerClose();
  setupFilterTabs();
  applyRouteFromHash();
  loadChannels();
  loadIptvChannels();

  // Auto-refresh
  setInterval(() => {
    loadChannels(true);
    loadIptvChannels(true);
  }, CONFIG.refreshInterval);

  window.addEventListener('hashchange', handleHashRoute);
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
        history.replaceState({}, '', '#iptv');
        document.getElementById('iptv-channels-section').scrollIntoView({ behavior: 'smooth' });
      } else {
        state.activeType = filter;
        state.currentPage = 1;
        renderChannels();
        history.replaceState({}, '', filter === 'all' ? '#' : `#${filter}`);
        document.getElementById('all-channels').scrollIntoView({ behavior: 'smooth' });
      }
    });
  });
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
        history.replaceState({}, '', '#iptv');
        document.getElementById('iptv-channels-section').scrollIntoView({ behavior: 'smooth' });
      }
    });
  });
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

function buildWatchPageUrl({ id = '', title = '' } = {}) {
  const params = new URLSearchParams();
  if (id) params.set('channel_id', id);
  if (title) params.set('channel', slugify(title));
  return `/pages/watch.html?${params.toString()}`;
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

  const embedUrl = `${CONFIG.embedBase}${id}`;
  const watchUrl = buildWatchPageUrl({ id, title });

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

  // Update URL for SEO
  const slug = slugify(title);
  history.replaceState({ channelId: id, title }, title, `#watch/${slug}`);
  document.title = `${title} — смотреть онлайн прямой эфир | Smotrim.net`;

  // Update meta for SEO
  updateMeta(`${title} — смотреть онлайн | Smotrim.net`,
    `Смотрите ${title} онлайн бесплатно на Smotrim.net. Прямой эфир без регистрации.`);
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

  const slug = slugify(name);
  history.replaceState({ iptv: true, name }, name, `#iptv/${slug}`);
  document.title = `${name} — IPTV онлайн | Smotrim.net`;
  updateMeta(`${name} — смотреть IPTV онлайн | Smotrim.net`,
    `Смотрите ${name} онлайн бесплатно. Международное телевидение IPTV на Smotrim.net.`);
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
  window.addEventListener('popstate', handleHashRoute);
}

function closePlayer() {
  const overlay = $('#player-overlay');
  const iframe = $('#player-iframe');
  if (!overlay) return;
  overlay.classList.remove('open');
  document.body.style.overflow = '';
  if (iframe) iframe.src = '';
  history.replaceState({}, 'Smotrim.net', '#');
  document.title = 'Smotrim.net — Смотреть ТВ онлайн бесплатно | Прямые эфиры каналов';
  updateMeta(
    'Smotrim.net — Смотреть ТВ онлайн бесплатно',
    'Прямые эфиры более 50 телеканалов без регистрации. Россия 1, НТВ, СТС, ТНТ и другие.'
  );
}

function applyRouteFromHash() {
  handleHashRoute();
}

function handleHashRoute() {
  const hash = window.location.hash.replace(/^#/, '').trim().toLowerCase();
  const cleanHash = hash.split('?')[0];
  const navByFilter = {
    all: '.nav-link[data-filter="all"]',
    tv: '.nav-link[data-filter="tv"]',
    radio: '.nav-link[data-filter="radio"]',
    iptv: '.nav-link[data-filter="iptv"]',
  };

  if (cleanHash === 'tv' || cleanHash === 'radio' || cleanHash === 'all') {
    state.activeType = cleanHash;
    state.activeSource = 'all';
    state.currentPage = 1;
    setActiveNav(navByFilter[cleanHash]);
    renderChannels();
    return;
  }

  if (cleanHash === 'iptv') {
    state.activeType = 'all';
    state.activeSource = 'iptv';
    setActiveNav(navByFilter.iptv);
    renderChannels();
    document.getElementById('iptv-channels-section')?.scrollIntoView({ behavior: 'smooth' });
    return;
  }

  if (!cleanHash || cleanHash === 'watch') {
    state.activeType = 'all';
    state.activeSource = 'all';
    setActiveNav(navByFilter.all);
    renderChannels();
  }
}

function setActiveNav(selector) {
  $$('.nav-link').forEach(l => l.classList.remove('active'));
  const target = $(selector);
  if (target) target.classList.add('active');
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
