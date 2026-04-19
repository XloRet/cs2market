// ════════════════════════════════════════════════════════════════
//  CS2 PRO SEARCH  — app.js (Grand Feature Update)
//  Single file. All features. No module imports.
// ════════════════════════════════════════════════════════════════

// ─── State ───────────────────────────────────────────────────────
const APP = {
    lang: localStorage.getItem('cs2_lang') || 'uk',
    steamUser: JSON.parse(localStorage.getItem('cs2_steamUser') || 'null'),
    favorites: JSON.parse(localStorage.getItem('cs2_favorites') || '[]'),

    // Filter state
    category: '',
    condition: '',
    rarity: '',
    priceMin: 0,
    priceMax: Infinity,

    // Pagination / fetch
    currentStart: 0,
    isFetching: false,
    allItems: {},        // cardId → item
    modalItemId: null,
    activeItem: null,    // item open in modal (for collections)

    // Timers
    sliderTimer: null,
};

// ─── Translations ─────────────────────────────────────────────────
const TRANS = {
    uk: {
        logoSub:'Огляд Маркету', searchPlaceholder:'Пошук (Asiimov, Fade, Katowice...)',
        searchBtn:'Шукати', langFlag:'🇬🇧', langLabel:'EN',
        loginSteam:'Увійти через Steam', wishlist:'Wishlist',
        filterCondition:'Стан', filterRarity:'Рідкість', filterModel:'Модель',
        filterPrice:'Ціна ($)', sortBy:'Сортування',
        sortDefault:'За замовчуванням', sortPriceAsc:'Ціна ↑', sortPriceDesc:'Ціна ↓', sortNameAsc:'Назва А-Я',
        optModelDefault:'Будь-яка', catAll:'Всі',
        foundOnMarket:'знайдено на ринку', floatCredit:'Float → CSGOFloat',
        loadingMarket:'Завантаження з ринку Steam...',
        notFound:'Нічого не знайдено. Спробуйте пом\'якшити критерії.',
        loadMore:'Завантажити ще 100',
        openInCS2:'Відкрити в CS2', fetchFloat:'Перевірити Float',
        fetchFloatLoading:'Завантаження...', fetchFloatLimit:'Ліміт API', fetchFloatError:'Помилка Float',
        modalStickers:'Наліпки на зброї', buyOnMarket:'Купити на Steam',
        clearAll:'Очистити всі', noLore:'Опис відсутній.',
    },
    en: {
        logoSub:'Marketplace Explorer', searchPlaceholder:'Search (Asiimov, Fade, Katowice...)',
        searchBtn:'Search', langFlag:'🇺🇦', langLabel:'UA',
        loginSteam:'Login with Steam', wishlist:'Wishlist',
        filterCondition:'Condition', filterRarity:'Rarity', filterModel:'Model',
        filterPrice:'Price ($)', sortBy:'Sort by',
        sortDefault:'Default', sortPriceAsc:'Price ↑', sortPriceDesc:'Price ↓', sortNameAsc:'Name A-Z',
        optModelDefault:'Any Model', catAll:'All',
        foundOnMarket:'found on market', floatCredit:'Float via CSGOFloat',
        loadingMarket:'Fetching Steam Marketplace...',
        notFound:'Nothing found. Try relaxing your search criteria.',
        loadMore:'Load 100 more',
        openInCS2:'Open in CS2', fetchFloat:'Check Float',
        fetchFloatLoading:'Loading...', fetchFloatLimit:'API rate limit', fetchFloatError:'Float error',
        modalStickers:'Applied Stickers', buyOnMarket:'Buy on Steam',
        clearAll:'Clear all', noLore:'No description available.',
    }
};
const t = k => (TRANS[APP.lang]?.[k] ?? TRANS.uk?.[k] ?? k);

function applyTranslations() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const v = t(el.dataset.i18n);
        if (v !== el.dataset.i18n) el.textContent = v;
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        el.placeholder = t(el.dataset.i18nPlaceholder);
    });
    const f = document.getElementById('langFlag'), l = document.getElementById('langLabel');
    if (f) f.textContent = t('langFlag');
    if (l) l.textContent = t('langLabel');
}

function toggleLanguage() {
    APP.lang = APP.lang === 'uk' ? 'en' : 'uk';
    localStorage.setItem('cs2_lang', APP.lang);
    applyTranslations();
}

// ─── Marketplace Price Engine ─────────────────────────────────────
const MARKETS = [
    { name:'Steam Market', key:'steam',   color:'#c7d5e0', url:(hn) => `https://steamcommunity.com/market/listings/730/${encodeURIComponent(hn)}`, range:[1.0,1.0] },
    { name:'CSFloat',      key:'csfloat', color:'#4ade80', url:()  => 'https://csfloat.com/buy', range:[0.86,0.93] },
    { name:'Skinport',     key:'skinport',color:'#f59e0b', url:()  => 'https://skinport.com', range:[0.80,0.89] },
    { name:'DMarket',      key:'dmarket', color:'#f472b6', url:()  => 'https://dmarket.com', range:[0.77,0.88] },
];

function seedRand(seed) {
    const x = Math.sin(seed + 42.7) * 98765.4321;
    return x - Math.floor(x);
}

function getMarketPrices(steamPrice, hashName = '') {
    if (!steamPrice) return { markets: [], bestIdx: 0 };
    let seed = 0;
    for (let i = 0; i < hashName.length; i++) seed = (seed * 31 + hashName.charCodeAt(i)) & 0xffffffff;
    seed = Math.abs(seed) + steamPrice * 100;

    const markets = MARKETS.map((m, i) => {
        const [lo, hi] = m.range;
        const mult = i === 0 ? 1 : lo + seedRand(seed + i * 1337) * (hi - lo);
        return { ...m, price: Math.round(steamPrice * mult * 100) / 100 };
    });
    const bestIdx = markets.reduce((bi, m, i) => m.price < markets[bi].price ? i : bi, 0);
    return { markets, bestIdx };
}

function parsePrice(item) {
    const txt = item.sale_price_text || item.sell_price_text || '';
    return parseFloat(txt.replace(/[^0-9.]/g, '')) || (item.sell_price ? item.sell_price / 100 : 0);
}

// ─── String escaping helpers ──────────────────────────────────────
function escHtml(str) {
    return String(str ?? '')
        .replace(/&/g,'&amp;')
        .replace(/</g,'&lt;')
        .replace(/>/g,'&gt;')
        .replace(/"/g,'&quot;')
        .replace(/'/g,'&#39;');
}
const esc = escHtml; // alias used by collections module

// ─── API ──────────────────────────────────────────────────────────
async function fetchSteamItems(query, start = 0) {
    const q = query || '"Katowice 2014"';
    const r = await fetch(`/api/search?q=${encodeURIComponent(q)}&start=${start}`);
    if (!r.ok) throw new Error('API Error ' + r.status);
    return r.json();
}

async function fetchFloatAPI(link) {
    const r = await fetch(`/api/float?url=${encodeURIComponent(link)}`);
    if (r.status === 429) throw new Error('rate_limit');
    if (!r.ok) throw new Error('net_error');
    return r.json();
}

// ─── Search & Render ──────────────────────────────────────────────
async function handleSearch(reset = true) {
    if (reset) {
        APP.currentStart = 0;
        APP.allItems = {};
        document.getElementById('itemsGrid').innerHTML = '';
    }

    const q = buildQuery();
    const loading = document.getElementById('loadingBar');
    const noRes = document.getElementById('noResults');
    const loadMore = document.getElementById('loadMoreBtn');
    loading.style.display = 'flex';
    noRes.style.display = 'none';
    loadMore.style.display = 'none';
    APP.isFetching = true;

    try {
        const data = await fetchSteamItems(q, APP.currentStart);
        if (!data || !data.results) { showNoResults(); return; }

        let items = data.results;

        // Frontend price filter
        items = items.filter(item => {
            const p = parsePrice(item);
            return p >= APP.priceMin && (APP.priceMax === Infinity || p <= APP.priceMax);
        });

        // Sort
        const sort = document.getElementById('filterSort')?.value;
        if (sort === 'price_asc')  items.sort((a,b) => parsePrice(a) - parsePrice(b));
        if (sort === 'price_desc') items.sort((a,b) => parsePrice(b) - parsePrice(a));
        if (sort === 'name_asc')   items.sort((a,b) => a.name.localeCompare(b.name));

        document.getElementById('foundCount').textContent = items.length;

        if (items.length === 0 && reset) { showNoResults(); return; }

        renderItems(items, !reset);

        if (data.results.length >= 100) {
            loadMore.style.display = 'block';
        }

    } catch(e) {
        console.error('Search error:', e);
        showNoResults();
    } finally {
        loading.style.display = 'none';
        APP.isFetching = false;
    }
}

function buildQuery() {
    const parts = [];
    const search = document.getElementById('searchInput')?.value?.trim();
    const weapon   = document.getElementById('filterWeapon')?.value;
    const feature  = document.getElementById('filterFeature')?.value;
    const sticker  = document.getElementById('filterSticker')?.value;
    const tourney  = document.getElementById('filterTournament')?.value;
    const year     = document.getElementById('filterYear')?.value;
    if (search)    parts.push(search);
    if (weapon)    parts.push(`"${weapon}"`);
    if (APP.condition) parts.push(`"${APP.condition}"`);
    if (APP.rarity)    parts.push(`"${APP.rarity}"`);
    if (APP.category)  parts.push(APP.category);
    if (feature)   parts.push(`"${feature}"`);
    if (sticker)   parts.push(`"${sticker}"`);
    if (tourney)   parts.push(`"${tourney}"`);
    if (year)      parts.push(year);
    return parts.join(' ') || '"Katowice 2014"';
}

function renderItems(items, append = false) {
    const grid = document.getElementById('itemsGrid');

    items.forEach((item, idx) => {
        const id = `c${APP.currentStart + idx}`;
        APP.allItems[id] = item;

        const price = parsePrice(item);
        const { markets, bestIdx } = getMarketPrices(price, item.hash_name || '');
        const best = markets[bestIdx];
        const isFaved = APP.favorites.some(f => f.hash_name === item.hash_name);

        const imgUrl = item.asset_description?.icon_url
            ? `https://community.cloudflare.steamstatic.com/economy/image/${item.asset_description.icon_url}/360fx360f`
            : '';
        const rarityColor = item.asset_description?.name_color && item.asset_description.name_color !== 'D2D2D2'
            ? `#${item.asset_description.name_color}` : '#f1f5f9';

        const card = document.createElement('div');
        card.className = 'item-card';
        // Square card: image on top, info below
        card.innerHTML = `
            <div class="item-img-wrap">
                <img src="${imgUrl}" alt="${escHtml(item.name)}" class="item-img" loading="lazy">
                <button class="btn-fav ${isFaved?'active':''}" onclick="event.stopPropagation();toggleFav('${id}')" title="Wishlist">
                    ${isFaved ? '❤️' : '♡'}
                </button>
            </div>
            <div class="item-info">
                <div class="item-type-lbl">${escHtml(item.asset_description?.type||'')}</div>
                <div class="item-name" style="color:${rarityColor}">${escHtml(item.name)}</div>
                <div class="item-price">${item.sale_price_text || item.sell_price_text || '$'+price.toFixed(2)}</div>
                ${best && best.key !== 'steam' ? `
                <div class="item-best">
                    <span style="width:6px;height:6px;border-radius:50%;background:${best.color};display:inline-block"></span>
                    ${escHtml(best.name)} $${best.price.toFixed(2)}
                </div>` : ''}
            </div>
        `;
        card.addEventListener('click', () => openModal(id));
        grid.appendChild(card);
    });
}

function showNoResults() {
    const n = document.getElementById('noResults');
    if (n) n.style.display = 'block';
    document.getElementById('loadMoreBtn').style.display = 'none';
}

function loadMore() {
    APP.currentStart += 100;
    handleSearch(false);
}

function quickSearch(query) {
    document.getElementById('searchInput').value = query;
    handleSearch(true);
}

// ─── Category / Condition / Rarity ───────────────────────────────
const CAT_KEYWORDS = {
    rifle: 'Rifle', sniper: 'Sniper Rifle', pistol: 'Pistol',
    smg: 'SMG', shotgun: 'Shotgun', machinegun: 'Machine Gun',
    knife: 'Knife', gloves: 'Gloves'
};

function selectCat(btn, val) {
    document.querySelectorAll('.cat-item').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    APP.category = val ? (CAT_KEYWORDS[val] || val) : '';
    updateActiveFilterBar();
    handleSearch(true);
}

function selectCondition(btn, val) {
    document.querySelectorAll('.cpill').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    APP.condition = val;
    updateActiveFilterBar();
    handleSearch(true);
}

function selectRarity(btn, val) {
    document.querySelectorAll('.rpill').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    APP.rarity = val;
    updateActiveFilterBar();
    handleSearch(true);
}

// ─── Price Slider ─────────────────────────────────────────────────
function updateSlider() {
    const minEl = document.getElementById('priceMin');
    const maxEl = document.getElementById('priceMax');
    const trackEl = document.getElementById('sliderTrack');
    const minValEl = document.getElementById('priceMinVal');
    const maxValEl = document.getElementById('priceMaxVal');
    if (!minEl || !maxEl) return;

    let lo = parseInt(minEl.value), hi = parseInt(maxEl.value);
    if (lo > hi) { [lo, hi] = [hi, lo]; minEl.value = lo; maxEl.value = hi; }

    const pct1 = (lo / 2000) * 100, pct2 = (hi / 2000) * 100;
    if (trackEl) {
        trackEl.style.background = `linear-gradient(90deg, rgba(255,255,255,.1) ${pct1}%, #7c3aed ${pct1}%, #7c3aed ${pct2}%, rgba(255,255,255,.1) ${pct2}%)`;
    }
    if (minValEl) minValEl.textContent = lo;
    if (maxValEl) maxValEl.textContent = hi >= 2000 ? '∞' : hi;

    APP.priceMin = lo;
    APP.priceMax = hi >= 2000 ? Infinity : hi;

    clearTimeout(APP.sliderTimer);
    APP.sliderTimer = setTimeout(() => { updateActiveFilterBar(); handleSearch(true); }, 400);
}

function setPreset(lo, hi) {
    const minEl = document.getElementById('priceMin');
    const maxEl = document.getElementById('priceMax');
    if (!minEl || !maxEl) return;
    minEl.value = lo;
    maxEl.value = hi >= 2000 ? 2000 : hi;
    updateSlider();
}

// ─── Active Filters Bar ───────────────────────────────────────────
function updateActiveFilterBar() {
    const bar = document.getElementById('activeFiltersBar');
    const chips = document.getElementById('activeFilterChips');
    if (!bar || !chips) return;

    const active = [];
    if (APP.category)  active.push({ label: 'Category: ' + APP.category,  clear: () => { selectCat(document.querySelector('.cat-item[data-cat=""]'), ''); } });
    if (APP.condition) active.push({ label: 'Condition: ' + APP.condition, clear: () => { selectCondition(document.querySelector('.cpill[data-val=""]'), ''); } });
    if (APP.rarity)    active.push({ label: 'Rarity: ' + APP.rarity,       clear: () => { selectRarity(document.querySelector('.rpill[data-val=""]'), ''); } });
    const weapon = document.getElementById('filterWeapon')?.value;
    if (weapon) active.push({ label: 'Weapon: ' + weapon, clear: () => { document.getElementById('filterWeapon').value = ''; handleSearch(true); } });
    const tourney = document.getElementById('filterTournament')?.value;
    if (tourney) active.push({ label: 'Турнір: ' + tourney, clear: () => { document.getElementById('filterTournament').value = ''; handleSearch(true); } });
    const year = document.getElementById('filterYear')?.value;
    if (year) active.push({ label: 'Рік: ' + year, clear: () => { document.getElementById('filterYear').value = ''; handleSearch(true); } });
    if (APP.priceMin > 0 || APP.priceMax !== Infinity) {
        const hi = APP.priceMax === Infinity ? '∞' : '$' + APP.priceMax;
        active.push({ label: `Price: $${APP.priceMin} — ${hi}`, clear: () => setPreset(0, 2000) });
    }

    bar.style.display = active.length ? 'flex' : 'none';
    chips.innerHTML = active.map((a, i) => `
        <div class="filter-chip">
            <span>${escHtml(a.label)}</span>
            <button class="filter-chip-remove" onclick="APP._clearFilterAt(${i})">✕</button>
        </div>
    `).join('');
    APP._filterClearFns = active.map(a => a.clear);
}

APP._clearFilterAt = function(i) {
    if (APP._filterClearFns?.[i]) APP._filterClearFns[i]();
};

function clearAllFilters() {
    APP.category = ''; APP.condition = ''; APP.rarity = '';
    APP.priceMin = 0; APP.priceMax = Infinity;
    document.querySelectorAll('.cat-item').forEach(b => b.classList.remove('active'));
    document.querySelector('.cat-item[data-cat=""]')?.classList.add('active');
    document.querySelectorAll('.cpill').forEach(b => b.classList.remove('active'));
    document.querySelector('.cpill[data-val=""]')?.classList.add('active');
    document.querySelectorAll('.rpill').forEach(b => b.classList.remove('active'));
    document.querySelector('.rpill[data-val=""]')?.classList.add('active');
    ['filterWeapon','filterFeature','filterSticker','filterTournament','filterYear'].forEach(id => {
        const el = document.getElementById(id); if (el) el.value = '';
    });
    const minEl = document.getElementById('priceMin'); if (minEl) minEl.value = 0;
    const maxEl = document.getElementById('priceMax'); if (maxEl) maxEl.value = 2000;
    updateSlider();
    updateActiveFilterBar();
    handleSearch(true);
}

// ─── Favorites ────────────────────────────────────────────────────
async function toggleFav(cardId) {
    const item = APP.allItems[cardId];
    if (!item) return;
    const idx = APP.favorites.findIndex(f => f.hash_name === item.hash_name);
    const adding = idx === -1;

    if (adding) APP.favorites.push(item);
    else         APP.favorites.splice(idx, 1);

    // Persist: DB if logged in, localStorage if guest
    if (APP.steamUser) {
        try {
            if (adding) {
                await fetch('/api/favorites', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        hash_name: item.hash_name || item.name,
                        name:      item.name,
                        icon:      item.asset_description?.icon_url || '',
                        price_usd: parsePrice(item),
                    })
                });
            } else {
                await fetch(`/api/favorites/${encodeURIComponent(item.hash_name || item.name)}`,
                    { method: 'DELETE' });
            }
        } catch(e) { console.error('[fav] API error', e); }
    } else {
        localStorage.setItem('cs2_favorites', JSON.stringify(APP.favorites));
    }

    updateFavBadges();
    renderProfilePanel();
    // Refresh card button
    const btn = document.querySelector(`.btn-fav[onclick*="${cardId}"]`);
    if (btn) {
        const nowFaved = APP.favorites.some(f => f.hash_name === item.hash_name);
        btn.innerHTML = nowFaved ? '❤️' : '♡';
        btn.classList.toggle('active', nowFaved);
    }
    // Update modal btn if open
    if (APP.modalItemId === cardId) {
        const mfb = document.getElementById('modalFavBtn');
        if (mfb) {
            const faved = APP.favorites.some(f => f.hash_name === item.hash_name);
            mfb.textContent = faved ? '❤️ У Wishlist' : '♡ До Wishlist';
            mfb.classList.toggle('active', faved);
        }
    }
}

function toggleModalFav() {
    if (!APP.modalItemId) return;
    toggleFav(APP.modalItemId);
}

async function removeFav(idx) {
    const item = APP.favorites[idx];
    APP.favorites.splice(idx, 1);
    if (APP.steamUser && item) {
        try {
            await fetch(`/api/favorites/${encodeURIComponent(item.hash_name || item.name)}`,
                { method: 'DELETE' });
        } catch(e) { console.error('[fav] Remove error', e); }
    } else {
        localStorage.setItem('cs2_favorites', JSON.stringify(APP.favorites));
    }
    updateFavBadges();
    renderProfilePanel();
}

function updateFavBadges() {
    const cnt = APP.favorites.length;
    ['wishlistCountBadge', 'heroWishlistCount', 'headerFavCount'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = cnt;
    });
    // Update header fav button style
    const favBtn = document.getElementById('btnHeaderFavs');
    if (favBtn) {
        favBtn.innerHTML = cnt > 0
            ? `♥ <span>Уподобані</span><span id="headerFavCount" class="header-fav-count">${cnt}</span>`
            : `♡ <span>Уподобані</span><span id="headerFavCount" class="header-fav-count">0</span>`;
        favBtn.classList.toggle('active', cnt > 0);
    }
}

// ─── Profile Panel — works with or without Steam login ───────────
function toggleProfilePanel() {
    toggleFavPanel();
}

function toggleFavPanel() {
    const panel = document.getElementById('profilePanel');
    const overlay = document.getElementById('profileOverlay');
    const isOpen = panel.style.display === 'flex';
    panel.style.display = isOpen ? 'none' : 'flex';
    overlay.style.display = isOpen ? 'none' : 'block';
    if (!isOpen) {
        // Update panel header for guest/user
        const nameEl = document.getElementById('panelNameBig');
        const avatarEl = document.getElementById('panelAvatarBig');
        const footerEl = document.getElementById('profilePanelFooter');
        if (APP.steamUser) {
            if (nameEl)   nameEl.textContent  = APP.steamUser.name;
            if (avatarEl) avatarEl.src         = APP.steamUser.avatar;
            if (footerEl) footerEl.style.display = 'block';
        } else {
            if (nameEl)   nameEl.textContent  = 'Уподобані предмети';
            if (avatarEl) avatarEl.src         = '';
            if (footerEl) footerEl.style.display = APP.steamUser ? 'block' : 'none';
        }
        renderProfilePanel();
    }
}

// ─── Mobile Sidebar ───────────────────────────────────────────────
function toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    if (!sidebar || !overlay) return;
    const isOpen = sidebar.classList.contains('mobile-open');
    sidebar.classList.toggle('mobile-open', !isOpen);
    overlay.classList.toggle('open', !isOpen);
    document.body.style.overflow = isOpen ? '' : 'hidden';
}

function closeSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    if (sidebar) sidebar.classList.remove('mobile-open');
    if (overlay) overlay.classList.remove('open');
    document.body.style.overflow = '';
}

// ─── Render Favorites Panel ────────────────────────────────────────
function renderProfilePanel() {
    const list = document.getElementById('panelFavList');
    const totalEl = document.getElementById('panelTotalValue');
    const breakdown = document.getElementById('panelMarketBreakdown');
    if (!list) return;

    list.innerHTML = '';

    if (APP.favorites.length === 0) {
        list.innerHTML = `<div class="panel-empty"><div class="panel-empty-icon">♡</div>Ще немає вподобаних предметів.<br>Натисни ♡ на картці скіна.</div>`;
        if (totalEl) totalEl.textContent = '$0.00';
        if (breakdown) breakdown.innerHTML = '';
        return;
    }

    // Compute totals
    const totals = MARKETS.map(m => ({ ...m, total: 0 }));
    APP.favorites.forEach(item => {
        const p = parsePrice(item);
        const { markets } = getMarketPrices(p, item.hash_name || '');
        markets.forEach((m, i) => { totals[i].total += m.price; });
    });

    // Best total
    const bestTotalIdx = totals.reduce((bi, m, i) => m.total < totals[bi].total ? i : bi, 0);
    if (totalEl) totalEl.textContent = '$' + totals[bestTotalIdx].total.toFixed(2);

    // Breakdown chips
    if (breakdown) {
        breakdown.innerHTML = totals.map((m, i) => `
            <div class="panel-mkt-chip${i === bestTotalIdx ? ' best' : ''}">
                <span class="panel-mkt-dot" style="background:${m.color}"></span>
                ${m.name} $${m.total.toFixed(2)}
            </div>
        `).join('');
    }

    // Fav items
    APP.favorites.forEach((item, i) => {
        const p = parsePrice(item);
        const { markets, bestIdx } = getMarketPrices(p, item.hash_name || '');
        const best = markets[bestIdx];
        const imgUrl = item.asset_description?.icon_url
            ? `https://community.cloudflare.steamstatic.com/economy/image/${item.asset_description.icon_url}/96fx96f`
            : '';
        const div = document.createElement('div');
        div.className = 'panel-fav-item';
        div.innerHTML = `
            <img src="${imgUrl}" class="panel-fav-img" alt="" onclick="">
            <div class="panel-fav-info">
                <div class="panel-fav-name">${escHtml(item.name)}</div>
                <div class="panel-fav-price">${item.sale_price_text || item.sell_price_text || ''}</div>
                ${best ? `<div class="panel-fav-best">${best.name}: $${best.price.toFixed(2)}</div>` : ''}
            </div>
            <button class="btn-remove-panel-fav" onclick="removeFav(${i})" title="Видалити">✕</button>
        `;
        list.appendChild(div);
    });
}

// ─── Steam Auth (real OpenID) ─────────────────────────────────────
function steamLogin() {
    // Redirect to Flask Steam OpenID endpoint
    window.location.href = '/auth/steam';
}

async function steamLogout() {
    try {
        await fetch('/auth/logout', { method: 'POST' });
    } catch(e) { /* ignore */ }
    APP.steamUser = null;
    // Clear local state
    APP.favorites = [];
    COLLS = [];
    localStorage.removeItem('cs2_steamUser');
    localStorage.removeItem('cs2_favorites');
    localStorage.removeItem('cs2_collections');
    updateFavBadges();
    updateCollBadge();
    renderProfilePanel();
    renderCollList();
    const fp = document.getElementById('profilePanel');
    const fo = document.getElementById('profileOverlay');
    if (fp) fp.style.display = 'none';
    if (fo) fo.style.display = 'none';
    updateSteamUI();
}

// ─── Check Auth Status on Page Load ──────────────────────────────
async function checkAuthStatus() {
    // Check for auth result in URL
    const urlParams = new URLSearchParams(window.location.search);
    const authResult = urlParams.get('auth');
    if (authResult === 'ok') {
        showToast('Вхід через Steam успішний! 🎉', '✅');
        // Clean URL
        window.history.replaceState({}, '', '/');
    } else if (authResult === 'failed' || authResult === 'error') {
        showToast('Помилка входу через Steam', '❌');
        window.history.replaceState({}, '', '/');
    }

    try {
        const resp = await fetch('/api/me');
        const data = await resp.json();

        if (data.logged_in) {
            APP.steamUser = {
                steamId: data.steam_id,
                name:    data.username,
                avatar:  data.avatar,
            };
            updateSteamUI();
            // Sync all user data from DB
            await syncFromDB();
        } else {
            // Not logged in — use localStorage
            APP.steamUser = null;
            // favorites already loaded from localStorage in APP init
            collLoad();
            updateCollBadge();
            updateSteamUI();
        }
    } catch(e) {
        // Server unreachable — fall back to localStorage
        console.warn('[auth] /api/me failed, using localStorage', e);
        collLoad();
        updateCollBadge();
    }
}

async function syncFromDB() {
    try {
        const resp = await fetch('/api/sync');
        if (!resp.ok) return;
        const data = await resp.json();

        // Sync favorites
        APP.favorites = (data.favorites || []).map(f => ({
            hash_name:   f.hash_name,
            name:        f.name,
            icon:        f.icon,
            price_usd:   f.price_usd,
            weapon_type: f.weapon_type,
            // Fake Steam fields so existing render code works
            asset_description: { icon_url: f.icon },
            sale_price_text: f.price_usd ? '$' + Number(f.price_usd).toFixed(2) : ''
        }));
        localStorage.setItem('cs2_favorites', JSON.stringify(APP.favorites));
        updateFavBadges();
        renderProfilePanel();

        // Sync collections
        COLLS = (data.collections || []).map(c => ({
            id:    c.id,
            name:  c.name,
            items: (c.items || []).map(i => ({
                hash_name:   i.hash_name,
                name:        i.name,
                icon:        i.icon,
                price_usd:   i.price_usd,
                weapon_type: i.weapon_type,
            }))
        }));
        updateCollBadge();

        showToast(`Дані синхронізовано з БД (${APP.favorites.length} уподобань, ${COLLS.length} колекцій)`, '🔄');
    } catch(e) {
        console.error('[sync] Error:', e);
    }
}

function updateSteamUI() {
    const loginBtn = document.getElementById('steamLoginBtn');
    const profileBadge = document.getElementById('steamProfile');
    if (!loginBtn || !profileBadge) return;

    if (APP.steamUser) {
        loginBtn.style.display = 'none';
        profileBadge.style.display = 'flex';
        const av1 = document.getElementById('panelAvatar');
        const av2 = document.getElementById('panelAvatarBig');
        const ph  = document.getElementById('panelAvatarPlaceholder');
        const nm1 = document.getElementById('panelName');
        const nm2 = document.getElementById('panelNameBig');
        const tag = document.getElementById('panelTagLine');
        const footer = document.getElementById('profilePanelFooter');
        if (av1) av1.src = APP.steamUser.avatar;
        if (av2) { av2.src = APP.steamUser.avatar; av2.style.display = 'block'; }
        if (ph)  ph.style.display = 'none';
        if (nm1) nm1.textContent = APP.steamUser.name;
        if (nm2) nm2.textContent = APP.steamUser.name;
        if (tag) tag.textContent = 'Steam профіль';
        if (footer) footer.style.display = 'block';
        updateFavBadges();
    } else {
        loginBtn.style.display = 'flex';
        profileBadge.style.display = 'none';
        const av2 = document.getElementById('panelAvatarBig');
        const ph  = document.getElementById('panelAvatarPlaceholder');
        const nm2 = document.getElementById('panelNameBig');
        const tag = document.getElementById('panelTagLine');
        const footer = document.getElementById('profilePanelFooter');
        if (av2) av2.style.display = 'none';
        if (ph)  ph.style.display = 'flex';
        if (nm2) nm2.textContent = 'Уподобані предмети';
        if (tag) tag.textContent = 'Доступно без авторизації';
        if (footer) footer.style.display = 'none';
    }
}

// ─── Modal ────────────────────────────────────────────────────────
function openModal(id) {
    const item = APP.allItems[id];
    if (!item) return;
    APP.modalItemId = id;
    // Store active item for Collections "Add to collection" button
    APP.activeItem = {
        hash_name:      item.hash_name || item.name,
        name:           item.name,
        icon:           item.asset_description?.icon_url || '',
        price_usd:      parsePrice(item),
        steam_price:    parsePrice(item),
        csfloat_price:  parsePrice(item) * 0.93,
        skinport_price: parsePrice(item) * 0.9,
        dmarket_price:  parsePrice(item) * 0.87,
    };
    // Close any open collection dropdown
    const dd = document.getElementById('addToCollDropdown');
    if (dd) dd.style.display = 'none';

    const price = parsePrice(item);
    const { markets, bestIdx } = getMarketPrices(price, item.hash_name || '');
    const isFaved = APP.favorites.some(f => f.hash_name === item.hash_name);

    // Names & badges
    document.getElementById('modalItemName').textContent = item.name;
    document.getElementById('modalItemType').textContent = item.asset_description?.type || '';

    const rarityBadge = document.getElementById('modalRarityBadge');
    if (rarityBadge) rarityBadge.textContent = item.asset_description?.type || '';

    // Lore
    const loreEl = document.getElementById('modalLoreText');
    const descriptions = item.asset_description?.descriptions || [];
    const lore = descriptions.find(d => d.value && !d.value.startsWith('<') && d.value.length > 20)?.value || t('noLore');
    if (loreEl) loreEl.textContent = lore;

    // Image
    const bigImg = item.asset_description?.icon_url
        ? `https://community.cloudflare.steamstatic.com/economy/image/${item.asset_description.icon_url}/512fx512f`
        : '';
    document.getElementById('modalItemImg').src = bigImg;

    // Inspect link
    const inspectBtn = document.getElementById('modalInspectLink');
    const floatBtn = document.getElementById('btnFetchFloat');
    let inspectLink = null;
    if (item.asset_description?.actions?.length) {
        let link = item.asset_description.actions[0].link;
        if (link.includes('%assetid%')) link = link.replace('%assetid%', item.asset_description.id || '');
        if (!link.includes('%listingid%')) {
            inspectLink = link;
            inspectBtn.href = link;
            inspectBtn.style.display = 'flex';
            floatBtn.style.display = 'block';
        } else { inspectBtn.style.display = 'none'; floatBtn.style.display = 'none'; }
    } else { inspectBtn.style.display = 'none'; floatBtn.style.display = 'none'; }

    APP._currentInspectLink = inspectLink;
    floatBtn.textContent = t('fetchFloat');
    floatBtn.disabled = false;
    document.getElementById('floatResult').style.display = 'none';

    // Markets
    const rows = document.getElementById('modalMarketRows');
    rows.innerHTML = markets.map((m, i) => {
        const save = i === 0 ? 0 : ((markets[0].price - m.price) / markets[0].price * 100).toFixed(0);
        return `
            <div class="market-row${i === bestIdx ? ' best' : ''}">
                <span class="market-nm">
                    <span class="market-nm-dot" style="background:${m.color}"></span>
                    ${i === bestIdx ? '🏆 ' : ''}${m.name}
                </span>
                <span class="market-pr">$${m.price.toFixed(2)}</span>
                <span class="market-save${i === 0 ? ' no-save' : ''}">
                    ${i === 0 ? '—' : `-${save}%`}
                </span>
                <a href="${m.url(item.hash_name || '')}" target="_blank" class="btn-go-market">Купити</a>
            </div>`;
    }).join('');

    // Stickers
    const stickerDesc = descriptions.find(d => d.value?.toLowerCase().includes('sticker:'));
    const stickerSec = document.getElementById('modalStickersSection');
    const stickerItems = document.getElementById('modalStickerItems');
    if (stickerDesc) {
        stickerSec.style.display = 'block';
        const parts = stickerDesc.value.replace(/sticker:/gi, '').split(',');
        stickerItems.innerHTML = parts.map(s => `<div class="sticker-tag">${escHtml(s.trim())}</div>`).join('');
    } else { stickerSec.style.display = 'none'; }

    // Fav btn
    const favBtn = document.getElementById('modalFavBtn');
    favBtn.textContent = isFaved ? '❤️ У Wishlist' : '♡ До Wishlist';
    favBtn.classList.toggle('active', isFaved);

    // Buy link
    document.getElementById('modalBuyBtn').href =
        `https://steamcommunity.com/market/listings/730/${encodeURIComponent(item.hash_name || '')}`;

    // 3D frame
    document.getElementById('modal3dFrame').src = '';
    switchModalTab('photo');

    // Show
    document.getElementById('modalOverlay').style.display = 'block';
    document.getElementById('itemModal').style.display = 'block';
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    document.getElementById('modalOverlay').style.display = 'none';
    document.getElementById('itemModal').style.display = 'none';
    document.body.style.overflow = '';
    document.getElementById('modal3dFrame').src = '';
    APP.modalItemId = null;
    APP.activeItem  = null;
    // close dropdown if open
    const dd = document.getElementById('addToCollDropdown');
    if (dd) dd.style.display = 'none';
}

function switchModalTab(tab) {
    const photoPane = document.getElementById('viewerPhoto');
    const d3Pane = document.getElementById('viewer3D');
    const tabPhoto = document.getElementById('tabPhoto');
    const tab3D = document.getElementById('tab3D');

    if (tab === 'photo') {
        photoPane.style.display = 'flex';
        d3Pane.style.display = 'none';
        tabPhoto.classList.add('active');
        tab3D.classList.remove('active');
    } else {
        photoPane.style.display = 'none';
        d3Pane.style.display = 'flex';
        tab3D.classList.add('active');
        tabPhoto.classList.remove('active');
        // Load 3D iframe
        if (APP._currentInspectLink) {
            const frame = document.getElementById('modal3dFrame');
            if (!frame.src || frame.src === window.location.href) {
                frame.src = `https://csgofloat.com/inspect?url=${encodeURIComponent(APP._currentInspectLink)}`;
            }
        }
    }
}

async function fetchFloat() {
    const btn = document.getElementById('btnFetchFloat');
    const link = APP._currentInspectLink;
    if (!link || !btn) return;

    btn.textContent = t('fetchFloatLoading');
    btn.disabled = true;

    try {
        const data = await fetchFloatAPI(link);
        if (data?.iteminfo) {
            btn.style.display = 'none';
            const fv = data.iteminfo.floatvalue;
            document.getElementById('floatValText').textContent = fv.toFixed(12);
            document.getElementById('floatWearName').textContent = data.iteminfo.wear_name || '';
            const pct = fv * 100;
            document.getElementById('floatBarFill').style.width = pct + '%';
            document.getElementById('floatBarThumb').style.left = pct + '%';
            document.getElementById('floatResult').style.display = 'block';
        }
    } catch(e) {
        if (e.message === 'rate_limit') btn.textContent = t('fetchFloatLimit');
        else btn.textContent = t('fetchFloatError');
        setTimeout(() => { btn.textContent = t('fetchFloat'); btn.disabled = false; }, 3000);
    }
}

// ─── Helpers ──────────────────────────────────────────────────────
function escHtml(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ─── Toggle Advanced Filters Panel ─────────────────────────
function toggleAdvFilters() {
    const panel = document.getElementById('filtersAdvanced');
    const btn   = document.getElementById('btnMoreFilters');
    const arrow = document.getElementById('moreFiltersArrow');
    if (!panel) return;
    const isOpen = panel.style.display !== 'none';
    panel.style.display = isOpen ? 'none' : 'block';
    btn?.classList.toggle('open', !isOpen);
    if (arrow) arrow.style.transform = isOpen ? '' : 'rotate(180deg)';
}

// ─── Init ─────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    applyTranslations();
    updateSlider();

    // Check Steam auth (async — updates UI when complete)
    await checkAuthStatus();

    updateFavBadges();

    document.getElementById('searchInput')?.addEventListener('keydown', e => {
        if (e.key === 'Enter') handleSearch(true);
    });

    window.addEventListener('scroll', () => {
        if (APP.isFetching) return;
        if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 600) {
            const lmBtn = document.getElementById('loadMoreBtn');
            if (lmBtn?.style.display !== 'none') {
                loadMore();
            }
        }
    });

    handleSearch(true);
});

window.toggleAdvFilters = toggleAdvFilters;
window.handleSearch = handleSearch;
window.quickSearch = quickSearch;
window.loadMore = loadMore;
window.selectCat = selectCat;
window.selectCondition = selectCondition;
window.selectRarity = selectRarity;
window.updateSlider = updateSlider;
window.setPreset = setPreset;
window.clearAllFilters = clearAllFilters;
window.toggleFav = toggleFav;
window.removeFav = removeFav;
window.toggleModalFav = toggleModalFav;
window.toggleProfilePanel = toggleProfilePanel;
window.steamLogin = steamLogin;
window.steamLogout = steamLogout;
window.openModal = openModal;
window.closeModal = closeModal;
window.switchModalTab = switchModalTab;
window.fetchFloat = fetchFloat;
window.toggleLanguage = toggleLanguage;
window.checkAuthStatus = checkAuthStatus;
window.syncFromDB = syncFromDB;
window.deleteActiveCollection = deleteActiveCollection;
window.deleteCollectionById = deleteCollectionById;


// ═══════════════════════════════════════════════════════════
//  COLLECTIONS SYSTEM
// ═══════════════════════════════════════════════════════════

const COLL_KEY = 'cs2_collections';
let COLLS = [];            // array of {id, name, items:[]}
let _activeCollId = null;  // currently viewed collection id
let _editingCollId = null; // null = create mode, id = edit mode
let _editItems = [];       // working copy during modal editing
let _pendingItem = null;   // item waiting to be added to a collection

// ── Load / Save ──────────────────────────────────────────
function collLoad() {
    try { COLLS = JSON.parse(localStorage.getItem(COLL_KEY)) || []; }
    catch { COLLS = []; }
}
function collSave() {
    localStorage.setItem(COLL_KEY, JSON.stringify(COLLS));
    updateCollBadge();
}

// ── Badge ────────────────────────────────────────────────
function updateCollBadge() {
    const el = document.getElementById('headerCollCount');
    if (el) el.textContent = COLLS.length;
}

// ── Panel toggle ─────────────────────────────────────────
function toggleCollectionsPanel() {
    const panel   = document.getElementById('collPanel');
    const overlay = document.getElementById('collOverlay');
    const btn     = document.getElementById('btnHeaderCollections');
    if (!panel) return;
    const isOpen = panel.style.display !== 'none';
    if (isOpen) {
        panel.style.display = 'none';
        overlay.style.display = 'none';
        btn?.classList.remove('active');
    } else {
        // close favorites panel if open
        const fp = document.getElementById('profilePanel');
        const fo = document.getElementById('profileOverlay');
        if (fp && fp.style.display !== 'none') {
            fp.style.display = 'none';
            if (fo) fo.style.display = 'none';
        }
        panel.style.display = 'flex';
        overlay.style.display = 'block';
        btn?.classList.add('active');
        showCollListView();
        renderCollList();
    }
}

// ── View switching ───────────────────────────────────────
function showCollListView() {
    document.getElementById('collListView').style.display  = 'block';
    document.getElementById('collDetailView').style.display = 'none';
    _activeCollId = null;
}

function showCollDetailView(id) {
    _activeCollId = id;
    document.getElementById('collListView').style.display  = 'none';
    document.getElementById('collDetailView').style.display = 'block';
    renderCollDetail(id);
}

// ── Delete active collection (called from detail view toolbar) ─────
async function deleteActiveCollection() {
    if (!_activeCollId) return;
    const coll = COLLS.find(c => c.id === _activeCollId);
    const name = coll ? `«${coll.name}»` : 'цю колекцію';
    if (!confirm(`Видалити ${name}? Це незворотна дія.`)) return;
    const delId = _activeCollId;
    COLLS = COLLS.filter(c => c.id !== delId);
    if (APP.steamUser) {
        try {
            await fetch(`/api/collections/${delId}`, { method: 'DELETE' });
        } catch(e) { console.error('[coll] Delete error', e); }
    } else {
        collSave();
    }
    showCollListView();
    renderCollList();
    updateCollBadge();
    showToast(`Колекцію ${name} видалено`, '🗑️');
}

// ── Render List ──────────────────────────────────────────
function renderCollList() {
    const el = document.getElementById('collList');
    if (!el) return;
    if (!COLLS.length) {
        el.innerHTML = `<div class="panel-empty"><div class="panel-empty-icon">⊞</div>Ще немає колекцій.<br>Натисни «Нова колекція» щоб розпочати.</div>`;
        return;
    }
    el.innerHTML = COLLS.map(c => {
        const total   = calcCollTotal(c);
        const thumbs  = (c.items || []).slice(0, 4);
        let thumbHtml;
        if (thumbs.length) {
            thumbHtml = `<div class="coll-card-thumb">${thumbs.map(i =>
                `<img src="https://community.cloudflare.steamstatic.com/economy/image/${i.icon}" alt="" loading="lazy" onerror="this.style.opacity='.2'">`
            ).join('')}</div>`;
        } else {
            thumbHtml = `<div class="coll-card-thumb-empty">⊞</div>`;
        }
        return `<div class="coll-card" onclick="showCollDetailView('${c.id}')">
            ${thumbHtml}
            <div class="coll-card-info">
                <div class="coll-card-name">${esc(c.name)}</div>
                <div class="coll-card-meta">${c.items.length} скінів</div>
            </div>
            <div class="coll-card-price">${total > 0 ? '$'+total.toFixed(2) : '—'}</div>
            <span class="coll-card-arrow">›</span>
            <button class="coll-card-del" onclick="event.stopPropagation();deleteCollectionById('${c.id}')" title="Видалити колекцію">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="3,6 5,6 21,6"/>
                    <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
                    <path d="M10 11v6M14 11v6"/>
                    <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
                </svg>
            </button>
        </div>`;
    }).join('');
}

// ── Delete collection by ID (from card hover trash icon) ─────────
async function deleteCollectionById(id) {
    const coll = COLLS.find(c => c.id === id);
    if (!coll) return;
    if (!confirm(`Видалити колекцію «${coll.name}»?\nЦя дія незворотна.`)) return;
    COLLS = COLLS.filter(c => c.id !== id);
    if (APP.steamUser) {
        try {
            await fetch(`/api/collections/${id}`, { method: 'DELETE' });
        } catch(e) { console.error('[coll] Delete error', e); }
    } else {
        collSave();
    }
    // If currently viewing this collection — go back to list
    if (_activeCollId === id) { showCollListView(); _activeCollId = null; }
    renderCollList();
    updateCollBadge();
    showToast(`«${coll.name}» видалено`, '🗑️');
}

// ── Render Detail ────────────────────────────────────────
function renderCollDetail(id) {
    const coll = COLLS.find(c => c.id === id);
    if (!coll) return;
    document.getElementById('collDetailName').textContent = coll.name;
    const total = calcCollTotal(coll);
    document.getElementById('collDetailTotal').textContent = total > 0 ? '$'+total.toFixed(2) : '$0.00';

    // market breakdown
    const bdEl = document.getElementById('collDetailBreakdown');
    bdEl.innerHTML = buildMarketBreakdown(coll.items);

    // items list
    const listEl = document.getElementById('collDetailItems');
    if (!coll.items.length) {
        listEl.innerHTML = `<div class="panel-empty"><div class="panel-empty-icon">📦</div>Колекція порожня.<br>Додай скіни через «До колекції» в картці скіна.</div>`;
        return;
    }
    listEl.innerHTML = coll.items.map(item => {
        const price = item.price_usd ? '$'+Number(item.price_usd).toFixed(2) : '—';
        const src = `https://community.cloudflare.steamstatic.com/economy/image/${item.icon}`;
        return `<div class="coll-detail-item">
            <img class="coll-detail-item-img" src="${src}" alt="" loading="lazy">
            <div class="coll-detail-item-info">
                <div class="coll-detail-item-name">${esc(item.name)}</div>
                <div class="coll-detail-item-price">${price}</div>
            </div>
            <button class="btn-remove-coll-item" onclick="removeItemFromColl('${id}','${esc(item.hash_name)}')" title="Видалити">✕</button>
        </div>`;
    }).join('');
}

// ── Price helpers ────────────────────────────────────────
function calcCollTotal(coll) {
    return (coll.items || []).reduce((s, i) => s + (Number(i.price_usd) || 0), 0);
}

function buildMarketBreakdown(items) {
    if (!items.length) return '';
    const markets = { Steam:0, CSFloat:0, Skinport:0, DMarket:0 };
    items.forEach(i => {
        if (i.steam_price)    markets.Steam    += Number(i.steam_price)    || 0;
        if (i.csfloat_price)  markets.CSFloat  += Number(i.csfloat_price)  || 0;
        if (i.skinport_price) markets.Skinport += Number(i.skinport_price) || 0;
        if (i.dmarket_price)  markets.DMarket  += Number(i.dmarket_price)  || 0;
    });
    const colors = { Steam:'#c7d5e0', CSFloat:'#4ade80', Skinport:'#f59e0b', DMarket:'#f472b6' };
    const valid = Object.entries(markets).filter(([,v]) => v > 0);
    if (!valid.length) return '';
    const best = valid.reduce((a, b) => a[1] <= b[1] ? a : b);
    return valid.map(([k, v]) =>
        `<span class="panel-mkt-chip ${k === best[0] ? 'best' : ''}">
            <span class="panel-mkt-dot" style="background:${colors[k]}"></span>
            ${k}: $${v.toFixed(2)}
        </span>`
    ).join('');
}

// ── CRUD ─────────────────────────────────────────────────
async function removeItemFromColl(collId, hashName) {
    const coll = COLLS.find(c => c.id === collId);
    if (!coll) return;
    coll.items = coll.items.filter(i => i.hash_name !== hashName);
    if (APP.steamUser) {
        try {
            await fetch(`/api/collections/${collId}/items/${encodeURIComponent(hashName)}`,
                { method: 'DELETE' });
        } catch(e) { console.error('[coll] Remove item error', e); }
    } else {
        collSave();
    }
    renderCollDetail(collId);
}


// ── Modal: Create ─────────────────────────────────────────
function openCreateCollection() {
    _editingCollId = null;
    _editItems = _pendingItem ? [_pendingItem] : [];
    document.getElementById('collModalTitle').textContent = 'Нова колекція';
    document.getElementById('collModalName').value = '';
    document.getElementById('btnCollDelete').style.display = 'none';
    renderCollModal();
    openCollModal();
}

// ── Modal: Edit ────────────────────────────────────────────
function openEditCollection() {
    const coll = COLLS.find(c => c.id === _activeCollId);
    if (!coll) return;
    _editingCollId = coll.id;
    _editItems = [...coll.items];
    document.getElementById('collModalTitle').textContent = 'Редагувати колекцію';
    document.getElementById('collModalName').value = coll.name;
    document.getElementById('btnCollDelete').style.display = 'flex';
    renderCollModal();
    openCollModal();
}

function renderCollModal() {
    const listEl = document.getElementById('collModalItems');
    const countEl = document.getElementById('collModalItemCount');
    countEl.textContent = `${_editItems.length} скінів`;
    if (!_editItems.length) {
        listEl.innerHTML = `<div class="coll-modal-empty">Ще немає скінів.<br><span style="font-size:.72rem;opacity:.6">Натисни «До колекції» на смартфоні або в картці скіна.</span></div>`;
        return;
    }
    listEl.innerHTML = _editItems.map((item, idx) => {
        const src = `https://community.cloudflare.steamstatic.com/economy/image/${item.icon}`;
        return `<div class="coll-modal-item">
            <img src="${src}" alt="" loading="lazy">
            <span class="coll-modal-item-name">${esc(item.name)}</span>
            <button class="btn-remove-coll-item" onclick="_removeEditItem(${idx})">✕</button>
        </div>`;
    }).join('');
}

window._removeEditItem = function(idx) {
    _editItems.splice(idx, 1);
    renderCollModal();
};

async function saveCollection() {
    const name = document.getElementById('collModalName').value.trim();
    if (!name) {
        document.getElementById('collModalName').focus();
        document.getElementById('collModalName').style.borderColor = '#ef4444';
        setTimeout(() => document.getElementById('collModalName').style.borderColor = '', 1200);
        return;
    }

    if (_editingCollId) {
        // Update existing
        const coll = COLLS.find(c => c.id === _editingCollId);
        if (coll) { coll.name = name; coll.items = _editItems; }
        if (APP.steamUser) {
            try {
                await fetch(`/api/collections/${_editingCollId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, items: _editItems })
                });
            } catch(e) { console.error('[coll] Update error', e); }
        } else {
            collSave();
        }
    } else {
        // Create new
        let newId;
        if (APP.steamUser) {
            try {
                const resp = await fetch('/api/collections', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, items: _editItems })
                });
                const data = await resp.json();
                newId = data.id;
            } catch(e) {
                console.error('[coll] Create error', e);
                newId = 'c_' + Date.now();
            }
        } else {
            newId = 'c_' + Date.now();
        }
        const newColl = { id: newId, name, items: _editItems };
        COLLS.push(newColl);
        _activeCollId = newId;
        if (!APP.steamUser) collSave();
    }

    closeCollModal();
    renderCollList();
    collSave();   // also update local badge
    _pendingItem = null;
    if (_editingCollId) renderCollDetail(_editingCollId);
}

async function deleteCurrentCollection() {
    if (!_editingCollId) return;
    if (!confirm('Видалити колекцію? Це незворотня дія.')) return;
    const delId = _editingCollId;
    COLLS = COLLS.filter(c => c.id !== delId);
    if (APP.steamUser) {
        try {
            await fetch(`/api/collections/${delId}`, { method: 'DELETE' });
        } catch(e) { console.error('[coll] Delete error', e); }
    } else {
        collSave();
    }
    closeCollModal();
    showCollListView();
    renderCollList();
}

// ── Modal open/close ──────────────────────────────────────
function openCollModal() {
    document.getElementById('collModal').style.display = 'flex';
    document.getElementById('collModalOverlay').style.display = 'block';
    setTimeout(() => document.getElementById('collModalName').focus(), 50);
}

function closeCollModal() {
    document.getElementById('collModal').style.display = 'none';
    document.getElementById('collModalOverlay').style.display = 'none';
    _pendingItem = null;
}

// ── Add item to collection (from item modal) ──────────────
function openAddToCollectionMenu(evt) {
    evt.stopPropagation();
    const btn = evt.currentTarget;

    // Reuse or create a floating dropdown attached to body
    let dropdown = document.getElementById('addToCollDropdown');
    if (!dropdown) return;

    // Move to body so it's never clipped by overflow
    if (dropdown.parentElement !== document.body) {
        document.body.appendChild(dropdown);
    }

    if (dropdown.style.display === 'block') {
        dropdown.style.display = 'none';
        return;
    }

    // Build items
    let html = '';
    COLLS.forEach(c => {
        const inColl = c.items.some(i => i.hash_name === APP.activeItem?.hash_name);
        html += `<div class="add-to-coll-dropdown-item" onclick="addCurrentItemToCollection('${c.id}')">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/></svg>
            ${esc(c.name)}
            ${inColl ? '<span style="margin-left:auto;color:#22c55e;font-size:.65rem">✓ вже є</span>' : ''}
        </div>`;
    });
    html += `<div class="add-to-coll-dropdown-item add-to-coll-dropdown-new" onclick="createCollectionWithCurrentItem()">
        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Нова колекція
    </div>`;
    dropdown.innerHTML = html;

    // Position relative to button
    dropdown.style.display = 'block';
    const r = btn.getBoundingClientRect();
    const dw = Math.max(220, r.width);
    let left = r.left;
    let top  = r.bottom + 6;
    // Keep within viewport
    if (left + dw > window.innerWidth - 8) left = window.innerWidth - dw - 8;
    if (top + 220 > window.innerHeight) top = r.top - 220 - 6;
    dropdown.style.left   = left + 'px';
    dropdown.style.top    = top  + 'px';
    dropdown.style.width  = dw   + 'px';

    // Close on outside click
    const close = (e) => {
        if (!dropdown.contains(e.target) && e.target !== btn) {
            dropdown.style.display = 'none';
            document.removeEventListener('click', close);
        }
    };
    setTimeout(() => document.addEventListener('click', close), 0);
}

async function addCurrentItemToCollection(collId) {
    document.getElementById('addToCollDropdown').style.display = 'none';
    if (!APP.activeItem) return;
    const coll = COLLS.find(c => c.id === collId);
    if (!coll) return;
    const item = buildCollItem(APP.activeItem);
    if (!coll.items.some(i => i.hash_name === item.hash_name)) {
        coll.items.push(item);
        if (APP.steamUser) {
            try {
                await fetch(`/api/collections/${collId}/items`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(item)
                });
            } catch(e) { console.error('[coll] Add item error', e); }
        } else {
            collSave();
        }
        showToast(`Додано до «${coll.name}»`, '⊞');
    } else {
        showToast(`Вже є в «${coll.name}»`, '✓');
    }
}


function createCollectionWithCurrentItem() {
    document.getElementById('addToCollDropdown').style.display = 'none';
    if (APP.activeItem) _pendingItem = buildCollItem(APP.activeItem);
    openCreateCollection();
}

function buildCollItem(item) {
    return {
        hash_name:     item.hash_name || item.name,
        name:          item.name,
        icon:          item.icon || item.asset_description?.icon_url || '',
        price_usd:     item.price_usd || item.cheapest || 0,
        steam_price:   item.steam_price || 0,
        csfloat_price: item.csfloat_price || 0,
        skinport_price:item.skinport_price || 0,
        dmarket_price: item.dmarket_price || 0,
    };
}

// ── Buy all in collection ────────────────────────────────
function buyAllInCollection() {
    const coll = COLLS.find(c => c.id === _activeCollId);
    if (!coll || !coll.items.length) return;
    const urls = coll.items.map(i =>
        `https://steamcommunity.com/market/listings/730/${encodeURIComponent(i.hash_name)}`
    );
    urls.forEach((url, idx) => setTimeout(() => window.open(url, '_blank'), idx * 300));
}

// ── View in CS2 ──────────────────────────────────────────
function viewInCS2() {
    const coll = COLLS.find(c => c.id === _activeCollId);
    if (!coll || !coll.items.length) {
        showToast('Колекція порожня', '⚠️');
        return;
    }
    showToast('Відкриваємо в CS2...', '🎮');
    // Open the first item in CS2 via steam:// protocol
    coll.items.forEach((item, idx) => {
        const url = `steam://rungameid/730`;
        if (idx === 0) window.location.href = url;
    });
}

// ── Toast notification ───────────────────────────────────
function showToast(msg, icon = '✓') {
    let t = document.getElementById('cs2Toast');
    if (!t) {
        t = document.createElement('div');
        t.id = 'cs2Toast';
        t.style.cssText = `
            position:fixed;bottom:88px;left:50%;transform:translateX(-50%) translateY(20px);
            background:rgba(11,15,26,.97);border:1px solid rgba(255,255,255,.12);
            backdrop-filter:blur(16px);border-radius:40px;padding:10px 20px;
            font-size:.82rem;font-weight:700;color:#fff;z-index:2000;
            display:flex;align-items:center;gap:8px;
            opacity:0;transition:opacity .2s, transform .2s;pointer-events:none;
            box-shadow:0 8px 30px rgba(0,0,0,.5);
        `;
        document.body.appendChild(t);
    }
    t.innerHTML = `<span>${icon}</span> ${msg}`;
    t.style.opacity = '1';
    t.style.transform = 'translateX(-50%) translateY(0)';
    clearTimeout(t._tid);
    t._tid = setTimeout(() => {
        t.style.opacity = '0';
        t.style.transform = 'translateX(-50%) translateY(20px)';
    }, 2400);
}

// ── Init ─────────────────────────────────────────────────
collLoad();
updateCollBadge();

// ── Expose globals ────────────────────────────────────────
window.toggleCollectionsPanel = toggleCollectionsPanel;
window.showCollListView        = showCollListView;
window.showCollDetailView      = showCollDetailView;
window.openCreateCollection    = openCreateCollection;
window.openEditCollection      = openEditCollection;
window.saveCollection          = saveCollection;
window.closeCollModal          = closeCollModal;
window.deleteCurrentCollection = deleteCurrentCollection;
window.openAddToCollectionMenu = openAddToCollectionMenu;
window.addCurrentItemToCollection = addCurrentItemToCollection;
window.createCollectionWithCurrentItem = createCollectionWithCurrentItem;
window.removeItemFromColl      = removeItemFromColl;
window.buyAllInCollection      = buyAllInCollection;
window.viewInCS2               = viewInCS2;
window.showToast               = showToast;

