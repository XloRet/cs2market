// ─── Translations ────────────────────────────────────────────────────────────
const translations = {
    uk: {
        logoSub: 'Огляд Маркету',
        searchPlaceholder: 'Пошук (Asiimov, Fade, Katowice...)',
        searchBtn: 'Шукати',
        langFlag: '🇬🇧', langLabel: 'EN',

        filterCategory: 'Категорія', filterModel: 'Модель', filterCondition: 'Стан',
        filterRarity: 'Рідкість', filterFeature: 'Особливість', filterSticker: 'Наліпка',
        filterTournament: 'Турнір', filterYear: 'Рік', filterPrice: 'Ціна ($)',
        priceFrom: 'Від', priceTo: 'До',

        optAllItems: 'Всі предмети', optRifle: 'Гвинтівки', optSniper: 'Снайперська',
        optPistol: 'Пістолети', optSmg: 'СМГ', optShotgun: 'Дробовики',
        optMachinegun: 'Кулемети', optKnife: 'Ножі', optGloves: 'Рукавиці',
        optModelDefault: 'Модель (Будь-яка)',
        optAnyCondition: 'Будь-який стан', optAnyRarity: 'Будь-яка рідкість',
        optConsumer: 'Ширпотреб', optIndustrial: 'Промислове', optMilSpec: 'Армійське',
        optRestricted: 'Заборонене', optClassified: 'Засекречене', optCovert: 'Таємне', optContraband: 'Контрабанда',
        optAnyFeature: 'Будь-яка', optSouvenir: 'Сувенірна', optNormal: 'Звичайна',
        optAnySticker: 'Будь-яка наліпка', optAnyTournament: 'Всі турніри', optAnyYear: 'Будь-який рік',

        foundOnMarket: 'Знайдено на ринку',
        floatCredit: 'Float перевіряється через CSGOFloat',
        loadMore: 'Завантажити ще 100',

        modalDescription: 'Опис предмету',
        modalStickers: 'Наліпки на зброї',

        loadingMarket: 'Звертаємось до торгового майданчика Steam...',
        loadingMore: 'Завантаження...',
        notFound: 'Нічого не знайдено на ринку. Спробуйте пом\'якшити критерії пошуку.',
        noMatch: 'Знайдено 0 ідеальних співпадінь серед поточних результатів. Натисніть «Завантажити ще 100» для розширення бази.',
        noResults: 'Нічого не відповідає цим критеріям.',
        serverError: 'Помилка сервера',

        fetchFloat: 'Перевірити Float / Знос',
        fetchFloatLoading: 'Завантаження...',
        fetchFloatLimit: 'Ліміт CSGOFloat API',
        fetchFloatError: 'Не вдалося отримати Float',
        openInCS2: 'Відкрити в CS2',
        buyOnMarket: 'Купити на Market',
        inspectHint: 'Натисніть для 3D-огляду →',
        noPrice: 'Немає ціни',
        noType: 'Відсутній тип',
        noLore: 'Опис відсутній.',
        inStock: 'В наявності',
    },
    en: {
        logoSub: 'Marketplace Explorer',
        searchPlaceholder: 'Search (Asiimov, Fade, Katowice...)',
        searchBtn: 'Search',
        langFlag: '🇺🇦', langLabel: 'UA',

        filterCategory: 'Category', filterModel: 'Model', filterCondition: 'Condition',
        filterRarity: 'Rarity', filterFeature: 'Feature', filterSticker: 'Sticker',
        filterTournament: 'Tournament', filterYear: 'Year', filterPrice: 'Price ($)',
        priceFrom: 'Min', priceTo: 'Max',

        optAllItems: 'All Items', optRifle: 'Rifles', optSniper: 'Sniper Rifles',
        optPistol: 'Pistols', optSmg: 'SMGs', optShotgun: 'Shotguns',
        optMachinegun: 'Machine Guns', optKnife: 'Knives', optGloves: 'Gloves',
        optModelDefault: 'Any Model',
        optAnyCondition: 'Any Condition', optAnyRarity: 'Any Rarity',
        optConsumer: 'Consumer Grade', optIndustrial: 'Industrial Grade', optMilSpec: 'Mil-Spec Grade',
        optRestricted: 'Restricted', optClassified: 'Classified', optCovert: 'Covert', optContraband: 'Contraband',
        optAnyFeature: 'Any', optSouvenir: 'Souvenir', optNormal: 'Normal',
        optAnySticker: 'Any Sticker', optAnyTournament: 'All Tournaments', optAnyYear: 'Any Year',

        foundOnMarket: 'Found on Market',
        floatCredit: 'Float powered by CSGOFloat',
        loadMore: 'Load 100 more',

        modalDescription: 'Item Description',
        modalStickers: 'Applied Stickers',

        loadingMarket: 'Fetching Steam Marketplace...',
        loadingMore: 'Loading...',
        notFound: 'Nothing found on the market. Try relaxing your search criteria.',
        noMatch: 'No exact matches in current results. Click "Load 100 more" to expand.',
        noResults: 'Nothing matches these criteria.',
        serverError: 'Server error',

        fetchFloat: 'Check Float / Wear',
        fetchFloatLoading: 'Loading...',
        fetchFloatLimit: 'CSGOFloat API rate limit',
        fetchFloatError: 'Failed to get Float',
        openInCS2: 'Open in CS2',
        buyOnMarket: 'Buy on Market',
        inspectHint: 'Click for 3D inspect →',
        noPrice: 'No price',
        noType: 'No type',
        noLore: 'No description.',
        inStock: 'In stock',
    }
};

// ─── Language Handling ───────────────────────────────────────────────────────
let currentLang = localStorage.getItem('cs2_lang') || 'uk';
const t = (key) => (translations[currentLang][key] || translations['uk'][key] || key);

function applyTranslations() {
    const lang = currentLang;
    const tr = translations[lang];

    // Static text nodes
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (tr[key] !== undefined) el.textContent = tr[key];
    });

    // Placeholders
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        if (tr[key] !== undefined) el.placeholder = tr[key];
    });

    // Select options
    document.querySelectorAll('option[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (tr[key] !== undefined) el.textContent = tr[key];
    });

    // Lang toggle button
    document.getElementById('langFlag').textContent = tr.langFlag;
    document.getElementById('langLabel').textContent = tr.langLabel;
}

window.toggleLanguage = () => {
    currentLang = currentLang === 'uk' ? 'en' : 'uk';
    localStorage.setItem('cs2_lang', currentLang);
    applyTranslations();
};

// ─── DOM Elements ────────────────────────────────────────────────────────────
const itemsGrid       = document.getElementById('itemsGrid');
const resultsCount    = document.getElementById('resultsCount');
const searchInput     = document.getElementById('searchInput');
const searchBtn       = document.getElementById('searchBtn');
const loadMoreBtn     = document.getElementById('loadMoreBtn');
const catSelect       = document.getElementById('categorySelect');
const wpnSelect       = document.getElementById('weaponSelect');
const condSelect      = document.getElementById('conditionSelect');
const raritySelect    = document.getElementById('raritySelect');
const featureSelect   = document.getElementById('featureSelect');
const stickerSelect   = document.getElementById('stickerSelect');
const tournSelect     = document.getElementById('tournamentSelect');
const yearSelect      = document.getElementById('yearSelect');
const minPriceInput   = document.getElementById('minPrice');
const maxPriceInput   = document.getElementById('maxPrice');

// ─── Weapon Map ──────────────────────────────────────────────────────────────
const WEAPONS = {
    rifle:      ['AK-47','M4A4','M4A1-S','AUG','FAMAS','Galil AR','SG 553'],
    sniper:     ['AWP','SSG 08','G3SG1','SCAR-20'],
    pistol:     ['Glock-18','USP-S','P2000','Desert Eagle','P250','Five-SeveN','Tec-9','CZ75-Auto','R8 Revolver','Dual Berettas'],
    knife:      ['Karambit','Butterfly Knife','M9 Bayonet','Bayonet','Skeleton Knife','Talon Knife','Nomad Knife','Bowie Knife','Huntsman Knife','Flip Knife','Gut Knife'],
    gloves:     ['Sport Gloves','Specialist Gloves','Moto Gloves','Hand Wraps','Driver Gloves','Bloodhound Gloves'],
    smg:        ['MAC-10','MP9','MP7','MP5-SD','UMP-45','P90','PP-Bizon'],
    shotgun:    ['Nova','XM1014','MAG-7','Sawed-Off'],
    machinegun: ['Negev','M249']
};

// ─── State ───────────────────────────────────────────────────────────────────
let currentFetchedItems = [];
let currentStart = 0;
let isFetching = false;
window.allItems = {};

// ─── Filter Events ─────────────────────────────────────────────────────────
catSelect.addEventListener('change', () => {
    const val = catSelect.value;
    wpnSelect.innerHTML = `<option value="">${t('optModelDefault')}</option>`;
    if (val && WEAPONS[val]) {
        wpnSelect.disabled = false;
        WEAPONS[val].forEach(w => wpnSelect.innerHTML += `<option value="${w}">${w}</option>`);
    } else {
        wpnSelect.disabled = true;
    }
    handleSearch(false);
});

[wpnSelect, condSelect, raritySelect, featureSelect, stickerSelect, tournSelect, yearSelect].forEach(el => {
    if (el) el.addEventListener('change', () => handleSearch(false));
});

let priceTimeout;
const onPriceChange = () => { clearTimeout(priceTimeout); priceTimeout = setTimeout(() => applyLocalFilters(), 500); };
minPriceInput.addEventListener('input', onPriceChange);
maxPriceInput.addEventListener('input', onPriceChange);

// ─── Search Logic ────────────────────────────────────────────────────────────
const showLoadingState = (append) => {
    if (append) {
        loadMoreBtn.textContent = t('loadingMore');
        loadMoreBtn.disabled = true;
    } else {
        itemsGrid.innerHTML = `
            <div class="state-message">
                <div class="spinner"></div>
                <div class="state-text">${t('loadingMarket')}</div>
            </div>`;
    }
};

const handleSearch = (append = false) => {
    if (isFetching) return;
    if (!append) {
        currentStart = 0;
        currentFetchedItems = [];
        loadMoreBtn.style.display = 'none';
        showLoadingState(false);
    } else {
        showLoadingState(true);
    }

    let queryArgs = [];
    const hasSticker = (stickerSelect && stickerSelect.value) || tournSelect.value || yearSelect.value;

    if (wpnSelect.value) {
        if (!hasSticker) queryArgs.push(`"${wpnSelect.value}"`);
    } else if (catSelect.value) {
        if (!hasSticker) queryArgs.push(catSelect.value);
    }
    if (condSelect.value)   queryArgs.push(`"${condSelect.value}"`);
    if (raritySelect.value) queryArgs.push(`"${raritySelect.value}"`);
    if (featureSelect.value && featureSelect.value !== 'Normal') queryArgs.push(`"${featureSelect.value}"`);

    if ((stickerSelect && stickerSelect.value) || tournSelect.value || yearSelect.value) {
        let sq = [];
        if (stickerSelect && stickerSelect.value) sq.push(stickerSelect.value);
        if (tournSelect.value) sq.push(tournSelect.value);
        if (yearSelect.value)  sq.push(yearSelect.value);
        queryArgs.push(`"${sq.join(' ')}"`);
    }

    const textQuery = searchInput.value.trim();
    if (textQuery) queryArgs.push(textQuery);

    fetchSteamItems(queryArgs.join(' '), currentStart, append);
};

const fetchSteamItems = async (query, start, append) => {
    isFetching = true;
    try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(query)}&start=${start}`);
        if (!response.ok) throw new Error(`Server error ${response.status}`);
        const data = await response.json();

        if (data && data.results && data.results.length > 0) {
            currentFetchedItems = append
                ? currentFetchedItems.concat(data.results)
                : data.results;

            loadMoreBtn.style.display = data.results.length === 100 ? 'inline-flex' : 'none';
            applyLocalFilters();
        } else {
            if (!append) {
                itemsGrid.innerHTML = `
                    <div class="state-message">
                        <div class="state-icon">🔍</div>
                        <div class="state-text">${t('notFound')}</div>
                    </div>`;
            }
            loadMoreBtn.style.display = 'none';
        }
    } catch (error) {
        if (!append) {
            itemsGrid.innerHTML = `
                <div class="state-message">
                    <div class="state-icon">⚠️</div>
                    <div class="state-text">${t('serverError')}: ${error.message}</div>
                </div>`;
        }
    } finally {
        isFetching = false;
        loadMoreBtn.textContent = t('loadMore');
        loadMoreBtn.disabled = false;
    }
};

const applyLocalFilters = () => {
    let filtered = [...currentFetchedItems];
    const hasSticker = (stickerSelect && stickerSelect.value) || tournSelect.value || yearSelect.value;

    if (wpnSelect.value && hasSticker) {
        filtered = filtered.filter(item => item.name.toLowerCase().includes(wpnSelect.value.toLowerCase()));
    } else if (catSelect.value && !wpnSelect.value) {
        filtered = filtered.filter(item => {
            const tp = item.asset_description?.type?.toLowerCase() || '';
            const c  = catSelect.value;
            if (c === 'rifle')  return tp.includes('rifle') || tp.includes('sniper');
            if (c === 'pistol') return tp.includes('pistol');
            if (c === 'knife')  return tp.includes('knife') || item.name.toLowerCase().includes('knife') || item.name.toLowerCase().includes('karambit');
            if (c === 'smg')    return tp.includes('smg');
            if (c === 'gloves') return tp.includes('gloves') || tp.includes('wraps');
            return true;
        });
    }

    if (featureSelect.value === 'Normal') {
        filtered = filtered.filter(item => !item.name.includes('StatTrak') && !item.name.includes('Souvenir'));
    }

    const minPrice = Number(minPriceInput.value) || 0;
    const maxPrice = Number(maxPriceInput.value) || Infinity;
    filtered = filtered.filter(item => {
        const p = item.sell_price ? item.sell_price / 100 : 0;
        return p >= minPrice && p <= maxPrice;
    });

    renderItems(filtered);
};

// ─── Sticker Extractor ───────────────────────────────────────────────────────
const extractStickersHtml = (item) => {
    let html = '';
    if (item.asset_description?.descriptions) {
        item.asset_description.descriptions.forEach(desc => {
            if (desc.value && (desc.value.toLowerCase().includes('sticker') || desc.value.toLowerCase().includes('наклейка'))) {
                const rx = /<img[^>]+src="([^">]+)"/g;
                let m;
                while ((m = rx.exec(desc.value)) !== null) {
                    html += `<img src="${m[1]}" alt="Sticker" class="sticker-img" title="Applied sticker">`;
                }
            }
        });
    }
    return html;
};

// ─── Float API ───────────────────────────────────────────────────────────────
window.fetchFloat = async (btn, inspectLink, cardId) => {
    btn.textContent = t('fetchFloatLoading');
    btn.disabled = true;
    try {
        const response = await fetch(`/api/float?url=${encodeURIComponent(inspectLink)}`);
        if (response.status === 429) { btn.textContent = t('fetchFloatLimit'); return; }
        if (!response.ok) throw new Error('CSGOFloat error');
        const data = await response.json();
        const floatValue = data.iteminfo.floatvalue;
        const paintSeed  = data.iteminfo.paintseed;

        btn.style.display = 'none';
        const floatContainer = document.getElementById(`float-bar-${cardId}`);
        const floatText      = document.getElementById(`float-val-${cardId}`);
        floatContainer.style.display = 'block';
        floatText.innerHTML = `Float: <b>${floatValue.toFixed(5)}</b> <span style="color:#aaa;font-size:0.78rem">(Pattern: ${paintSeed})</span>`;
        floatContainer.querySelector('.float-marker').style.left = `${floatValue * 100}%`;
    } catch {
        btn.textContent = t('fetchFloatError');
        btn.disabled = false;
    }
};

// ─── Modal ────────────────────────────────────────────────────────────────────
window.openModal = (cardId) => {
    const item = window.allItems[cardId];
    if (!item) return;

    const modal               = document.getElementById('itemModal');
    const modalLeft           = document.getElementById('modalLeft');
    const modalTitle          = document.getElementById('modalTitle');
    const modalType           = document.getElementById('modalType');
    const modalPrice          = document.getElementById('modalPrice');
    const modalLore           = document.getElementById('modalLore');
    const modalStickersWrap   = document.getElementById('modalStickers');
    const modalStickersSection= document.getElementById('modalStickersSection');
    const modalActions        = document.getElementById('modalActions');

    const rarityColor = (item.asset_description?.name_color && item.asset_description.name_color !== 'D2D2D2')
        ? `#${item.asset_description.name_color}` : '#f1f5f9';

    modalTitle.style.color      = rarityColor;
    modalTitle.style.textShadow = `0 0 20px ${rarityColor}30`;
    modalTitle.textContent      = item.name;
    modalType.textContent       = item.asset_description?.type || t('noType');
    modalPrice.textContent      = item.sale_price_text || item.sell_price_text || t('noPrice');

    // Lore
    let loreText = t('noLore');
    if (item.asset_description?.descriptions) {
        const parts = [];
        item.asset_description.descriptions.forEach(d => {
            if (d.value && !d.value.includes('<img') && !d.value.includes('sticker_info') && !d.value.includes('class="')) {
                const clean = d.value.replace(/<[^>]*>?/gm, ' ').trim();
                if (clean.length > 5) parts.push(clean);
            }
        });
        if (parts.length) loreText = parts.join('<br><br>');
    }
    modalLore.innerHTML = loreText;

    // Stickers
    const stickersHtml = extractStickersHtml(item);
    if (stickersHtml) {
        modalStickersWrap.innerHTML = stickersHtml;
        modalStickersSection.style.display = 'block';
    } else {
        modalStickersSection.style.display = 'none';
        modalStickersWrap.innerHTML = '';
    }

    // Inspect link
    let inspectLink = null;
    if (item.asset_description?.actions?.length > 0) {
        let link = item.asset_description.actions[0].link;
        if (link.includes('%assetid%')) link = link.replace('%assetid%', item.asset_description.id || '');
        if (!link.includes('%listingid%')) inspectLink = link;
    }

    // Left panel
    if (inspectLink) {
        modalLeft.innerHTML = `<iframe src="https://csgofloat.com/3d?url=${encodeURIComponent(inspectLink)}" allow="fullscreen" sandbox="allow-scripts allow-same-origin allow-popups"></iframe>`;
    } else {
        const imgUrl = item.asset_description?.icon_url
            ? `https://community.cloudflare.steamstatic.com/economy/image/${item.asset_description.icon_url}/512fx512f`
            : item.app_icon;
        modalLeft.innerHTML = `<img src="${imgUrl}" class="modal-fallback-img" alt="${item.name}">`;
    }

    // Actions
    const marketLink = `https://steamcommunity.com/market/listings/730/${encodeURIComponent(item.hash_name)}`;
    const floatHtml  = inspectLink
        ? `<div class="float-block" style="margin-bottom:16px;">
               <button class="btn-float" onclick="fetchFloat(this,'${inspectLink}','modal')">${t('fetchFloat')}</button>
               <div id="float-val-modal" style="margin-top:6px;font-size:0.95rem;"></div>
               <div class="float-bar-container" id="float-bar-modal"><div class="float-marker"></div></div>
           </div>` : '';

    modalActions.innerHTML = `
        ${floatHtml}
        <div style="display:flex;gap:10px;">
            ${inspectLink ? `<a href="${inspectLink}" class="btn-inspect" style="flex:1">${t('openInCS2')}</a>` : ''}
            <a href="${marketLink}" target="_blank" class="btn-market" style="flex:1">${t('buyOnMarket')}</a>
        </div>`;

    // Run i18n on freshly injected elements
    modal.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        const val = translations[currentLang][key];
        if (val) el.textContent = val;
    });

    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
};

window.closeModal = () => {
    const modal = document.getElementById('itemModal');
    modal.style.display = 'none';
    document.getElementById('modalLeft').innerHTML = '';
    document.body.style.overflow = '';
};

window.handleModalOverlayClick = (e) => {
    if (e.target === document.getElementById('itemModal')) closeModal();
};

// ─── Render ───────────────────────────────────────────────────────────────────
const renderItems = (items) => {
    resultsCount.textContent = items.length;
    itemsGrid.innerHTML = '';
    window.allItems = {};

    if (items.length === 0) {
        itemsGrid.innerHTML = `
            <div class="state-message">
                <div class="state-icon">${currentFetchedItems.length > 0 ? '📭' : '🔎'}</div>
                <div class="state-text">${currentFetchedItems.length > 0 ? t('noMatch') : t('noResults')}</div>
            </div>`;
        return;
    }

    items.forEach((item, index) => {
        const cardId = `card_${index}_${Math.random().toString(36).substr(2, 5)}`;
        window.allItems[cardId] = item;

        const card = document.createElement('div');
        card.className = 'item-card glass-panel';
        card.onclick = (e) => {
            if (e.target.tagName !== 'A' && e.target.tagName !== 'BUTTON') openModal(cardId);
        };

        const imgUrl = item.asset_description?.icon_url
            ? `https://community.cloudflare.steamstatic.com/economy/image/${item.asset_description.icon_url}/360fx360f`
            : item.app_icon;

        const rarityColor  = (item.asset_description?.name_color && item.asset_description.name_color !== 'D2D2D2')
            ? `#${item.asset_description.name_color}` : '#f1f5f9';
        const stickersHtml = extractStickersHtml(item);
        const priceText    = item.sale_price_text || item.sell_price_text || t('noPrice');
        const typeStr      = item.asset_description?.type || t('noType');
        const sellListings = item.sell_listings || 0;

        card.innerHTML = `
            <div class="item-card-bg"></div>
            <div class="item-image-wrapper">
                <img src="${imgUrl}" alt="${item.name}" class="item-image" loading="lazy">
            </div>
            <div class="item-details">
                <div class="item-meta">
                    <span class="item-type">${typeStr}</span>
                    <span class="item-stock">${t('inStock')}: ${sellListings}</span>
                </div>
                <h3 class="item-name" style="color:${rarityColor};text-shadow:0 0 12px ${rarityColor}28">${item.name}</h3>
                <div class="item-price">${priceText}</div>
                ${stickersHtml ? `<div class="stickers-container">${stickersHtml}</div>` : ''}
            </div>
            <div class="card-cta">${t('inspectHint')}</div>
        `;

        card.style.animationDelay = `${(index % 25) * 0.045}s`;
        itemsGrid.appendChild(card);
    });
};

// ─── Bootstrap ─────────────────────────────────────────────────────────────────
loadMoreBtn.addEventListener('click', () => {
    currentStart += 100;
    handleSearch(true);
});

searchBtn.addEventListener('click', () => handleSearch(false));
searchInput.addEventListener('keypress', e => { if (e.key === 'Enter') handleSearch(false); });

document.addEventListener('DOMContentLoaded', () => {
    applyTranslations();
    handleSearch(false);
});
