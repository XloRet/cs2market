// DOM Elements
const itemsGrid = document.getElementById('itemsGrid');
const resultsCount = document.getElementById('resultsCount');
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const loadMoreBtn = document.getElementById('loadMoreBtn');

// Select Elements
const catSelect = document.getElementById('categorySelect');
const wpnSelect = document.getElementById('weaponSelect');
const condSelect = document.getElementById('conditionSelect');
const raritySelect = document.getElementById('raritySelect');
const featureSelect = document.getElementById('featureSelect');
const stickerSelect = document.getElementById('stickerSelect');
const tournSelect = document.getElementById('tournamentSelect');
const yearSelect = document.getElementById('yearSelect');
const minPriceInput = document.getElementById('minPrice');
const maxPriceInput = document.getElementById('maxPrice');

const WEAPONS = {
    'rifle': ['AK-47', 'M4A4', 'M4A1-S', 'AUG', 'FAMAS', 'Galil AR', 'SG 553'],
    'sniper': ['AWP', 'SSG 08', 'G3SG1', 'SCAR-20'],
    'pistol': ['Glock-18', 'USP-S', 'P2000', 'Desert Eagle', 'P250', 'Five-SeveN', 'Tec-9', 'CZ75-Auto', 'R8 Revolver', 'Dual Berettas'],
    'knife': ['Karambit', 'Butterfly Knife', 'M9 Bayonet', 'Bayonet', 'Skeleton Knife', 'Talon Knife', 'Nomad Knife', 'Bowie Knife', 'Huntsman Knife', 'Flip Knife', 'Gut Knife'],
    'gloves': ['Sport Gloves', 'Specialist Gloves', 'Moto Gloves', 'Hand Wraps', 'Driver Gloves', 'Bloodhound Gloves'],
    'smg': ['MAC-10', 'MP9', 'MP7', 'MP5-SD', 'UMP-45', 'P90', 'PP-Bizon'],
    'shotgun': ['Nova', 'XM1014', 'MAG-7', 'Sawed-Off'],
    'machinegun': ['Negev', 'M249']
};

let currentFetchedItems = [];
let currentStart = 0;
let isFetching = false;
window.allItems = {}; // Сховище для прив'язки карток до об'єктів

// Populate Weapons Dropdown intelligently
catSelect.addEventListener('change', () => {
    const val = catSelect.value;
    wpnSelect.innerHTML = '<option value="">Модель (Будь-яка)</option>';
    if (val && WEAPONS[val]) {
        wpnSelect.disabled = false;
        WEAPONS[val].forEach(w => wpnSelect.innerHTML += `<option value="${w}">${w}</option>`);
    } else {
        wpnSelect.disabled = true;
    }
    handleSearch();
});

[wpnSelect, condSelect, raritySelect, featureSelect, stickerSelect, tournSelect, yearSelect].forEach(el => {
    if (el) el.addEventListener('change', () => handleSearch(false));
});

let priceTimeout;
const onPriceChange = () => { clearTimeout(priceTimeout); priceTimeout = setTimeout(() => applyLocalFilters(), 500); };
minPriceInput.addEventListener('input', onPriceChange);
maxPriceInput.addEventListener('input', onPriceChange);

const handleSearch = (append = false) => {
    if (isFetching) return;
    
    if (!append) {
        currentStart = 0;
        currentFetchedItems = [];
        loadMoreBtn.style.display = 'none';
        itemsGrid.innerHTML = '<div style="grid-column: 1/-1;text-align:center;padding:40px;color:var(--text-secondary);">Звертаємось до торгового майданчика Steam...</div>';
    } else {
        loadMoreBtn.innerHTML = "Завантаження...";
        loadMoreBtn.disabled = true;
    }

    let queryArgs = [];
    
    let hasSticker = (stickerSelect && stickerSelect.value) || tournSelect.value || yearSelect.value;
    
    // 1. Точна зброя (Конфліктує зі стікерами у Steam API, тому не даємо в запит якщо є стікер)
    if (wpnSelect.value) {
        if (!hasSticker) queryArgs.push(`"${wpnSelect.value}"`);
    } else if (catSelect.value) {
        if (!hasSticker) queryArgs.push(catSelect.value);
    }

    // 2. Стан
    if (condSelect.value) queryArgs.push(`"${condSelect.value}"`);
    
    // 2.5 Рідкість
    if (raritySelect.value) queryArgs.push(`"${raritySelect.value}"`);
    
    // 3. Особливість (StatTrak / Souvenir)
    if (featureSelect.value && featureSelect.value !== 'Normal') {
        queryArgs.push(`"${featureSelect.value}"`);
    }

    // 4. Стікер, Турнір та Рік
    if ((stickerSelect && stickerSelect.value) || tournSelect.value || yearSelect.value) {
        let stickerQuery = [];
        if (stickerSelect && stickerSelect.value) stickerQuery.push(stickerSelect.value);
        if (tournSelect.value) stickerQuery.push(tournSelect.value);
        if (yearSelect.value) stickerQuery.push(yearSelect.value);
        queryArgs.push(`"${stickerQuery.join(' ')}"`); // Напр: "Titan Katowice 2014"
    }

    // 5. Текст користувача 
    let textQuery = searchInput.value.trim();
    if (textQuery) queryArgs.push(textQuery);

    let finalQuery = queryArgs.join(' ');
    fetchSteamItems(finalQuery, currentStart, append);
};

const fetchSteamItems = async (query, start, append) => {
    isFetching = true;
    try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(query)}&start=${start}`);
        if (!response.ok) throw new Error(`Помилка серверу`);
        const data = await response.json();
        
        if (data && data.results && data.results.length > 0) {
            if (append) {
                currentFetchedItems = currentFetchedItems.concat(data.results);
            } else {
                currentFetchedItems = data.results;
            }
            
            // ЯкщоSteam віддав рівно 100 (ліміт), можливо є ще
            if (data.results.length === 100) {
                loadMoreBtn.style.display = 'inline-block';
            } else {
                loadMoreBtn.style.display = 'none';
            }
            applyLocalFilters();
        } else {
            if (!append) {
                itemsGrid.innerHTML = '<div style="grid-column: 1/-1;text-align:center;padding:40px;color:var(--text-secondary);">Нічого не знайдено на ринку. Спробуйте пом\'якшити критерії пошуку.</div>';
            }
            loadMoreBtn.style.display = 'none';
        }
    } catch (error) {
        if (!append) {
            itemsGrid.innerHTML = `<div style="grid-column: 1/-1;text-align:center;padding:40px;color:var(--danger);">Помилка сервера: ${error.message}</div>`;
        }
    } finally {
        isFetching = false;
        loadMoreBtn.innerHTML = "Завантажити ще 100";
        loadMoreBtn.disabled = false;
    }
};

const applyLocalFilters = () => {
    let filtered = [...currentFetchedItems];

    let hasSticker = (stickerSelect && stickerSelect.value) || tournSelect.value || yearSelect.value;

    // Local Type Filter fallback 
    if (wpnSelect.value && hasSticker) {
        // Оскільки Steam API відкидає стікери + точну зброю, ми перевіняємо зброю локально
        filtered = filtered.filter(item => item.name.toLowerCase().includes(wpnSelect.value.toLowerCase()));
    } else if (catSelect.value && !wpnSelect.value) {
        filtered = filtered.filter(item => {
            const t = item.asset_description?.type?.toLowerCase() || '';
            const c = catSelect.value;
            if (c==='rifle') return t.includes('rifle') || t.includes('sniper');
            if (c==='pistol') return t.includes('pistol');
            if (c==='knife') return t.includes('knife') || item.name.toLowerCase().includes('knife') || item.name.toLowerCase().includes('karambit');
            if (c==='smg') return t.includes('smg');
            if (c==='gloves') return t.includes('gloves') || t.includes('wraps');
            return true;
        });
    }
    
    // Normal (Не StatTrak і Не Souvenir) фільтр
    if (featureSelect.value === 'Normal') {
        filtered = filtered.filter(item => !item.name.includes("StatTrak") && !item.name.includes("Souvenir"));
    }

    const minPrice = Number(minPriceInput.value) || 0;
    const maxPrice = Number(maxPriceInput.value) || Infinity;

    filtered = filtered.filter(item => {
        const itemPrice = item.sell_price ? item.sell_price / 100 : 0;
        return itemPrice >= minPrice && itemPrice <= maxPrice;
    });

    renderItems(filtered);
};

// Екстрактор наліпок із Steam HTML
const extractStickersHtml = (item) => {
    let stickersHtml = '';
    if (item.asset_description && item.asset_description.descriptions) {
        item.asset_description.descriptions.forEach(desc => {
            if (desc.value && (desc.value.toLowerCase().includes('sticker') || desc.value.toLowerCase().includes('наклейка'))) {
                const imgRegex = /<img[^>]+src="([^">]+)"/g;
                let match;
                while ((match = imgRegex.exec(desc.value)) !== null) {
                    stickersHtml += `<img src="${match[1]}" alt="Sticker" class="sticker-img" title="Прикріплена наліпка">`;
                }
            }
        });
    }
    return stickersHtml;
};

// Запит на Float API
window.fetchFloat = async (btn, inspectLink, cardId) => {
    btn.innerHTML = "Завантаження...";
    btn.disabled = true;
    
    try {
        const response = await fetch(`/api/float?url=${encodeURIComponent(inspectLink)}`);
        
        if (response.status === 429) {
            btn.innerHTML = "Помилка (Ліміт API)";
            return;
        }
        
        if (!response.ok) throw new Error("Помилка CSGOFloat");
        
        const data = await response.json();
        const floatValue = data.iteminfo.floatvalue;
        const paintSeed = data.iteminfo.paintseed;
        
        // Візуалізація 
        btn.style.display = 'none'; // Ховаємо кнопку
        
        const floatContainer = document.getElementById(`float-bar-${cardId}`);
        const floatText = document.getElementById(`float-val-${cardId}`);
        
        floatContainer.style.display = 'block';
        floatText.innerHTML = `Float: <b>${floatValue.toFixed(5)}</b> <span style="color:#aaa; font-size: 0.8rem">(Pattern: ${paintSeed})</span>`;
        
        // Встановлення маркера (Флот від 0 до 1)
        const marker = floatContainer.querySelector('.float-marker');
        marker.style.left = `${(floatValue * 100)}%`;
        
    } catch (error) {
        btn.innerHTML = "Не вдалося отримати";
        btn.disabled = false;
    }
};

// --- Modal Logic ---
window.openModal = (cardId) => {
    const item = window.allItems[cardId];
    if (!item) return;

    const modal = document.getElementById('itemModal');
    const modalLeft = document.getElementById('modalLeft');
    const modalTitle = document.getElementById('modalTitle');
    const modalType = document.getElementById('modalType');
    const modalPrice = document.getElementById('modalPrice');
    const modalLore = document.getElementById('modalLore');
    const modalStickersContainer = document.getElementById('modalStickers');
    const modalStickersSection = document.getElementById('modalStickersSection');
    const modalActions = document.getElementById('modalActions');

    // Отримання правильного кольору рідкості
    const rarityColor = (item.asset_description && item.asset_description.name_color && item.asset_description.name_color !== 'D2D2D2') 
        ? `#${item.asset_description.name_color}` 
        : '#f8fafc';

    modalTitle.style.color = rarityColor;
    modalTitle.style.textShadow = `0 0 15px ${rarityColor}40`;
    modalTitle.textContent = item.name;
    modalType.textContent = item.asset_description?.type || 'Відсутній тип';
    modalPrice.textContent = item.sale_price_text || item.sell_price_text || "Немає ціни";

    // Пошук Lore або художнього опису
    let loreText = "Опис відсутній.";
    if (item.asset_description && item.asset_description.descriptions) {
        // Зазвичай Steam зберігає флейвор текст як рядок без HTML або з мінімумом
        const descs = item.asset_description.descriptions;
        const textParts = [];
        descs.forEach(d => {
            if (d.value && !d.value.includes('<img') && !d.value.includes('sticker_info') && !d.value.includes('class="')) {
                // Видаляємо зайві HTML теги від Steam (напр. <br>)
                let clean = d.value.replace(/<[^>]*>?/gm, ' ').trim();
                if (clean.length > 5) textParts.push(clean);
            }
        });
        if (textParts.length > 0) loreText = textParts.join('<br><br>');
    }
    modalLore.innerHTML = loreText;

    // Стікери
    const stickersHtml = extractStickersHtml(item);
    if (stickersHtml) {
        modalStickersContainer.innerHTML = stickersHtml;
        modalStickersSection.style.display = 'block';
    } else {
        modalStickersSection.style.display = 'none';
        modalStickersContainer.innerHTML = '';
    }

    // Inspect Link
    let inspectLink = null;
    if (item.asset_description && item.asset_description.actions && item.asset_description.actions.length > 0) {
        let tempLink = item.asset_description.actions[0].link;
        if (tempLink.includes('%assetid%')) {
            tempLink = tempLink.replace('%assetid%', item.asset_description.id || '');
        }
        if (!tempLink.includes('%listingid%')) {
            inspectLink = tempLink;
        }
    }

    // Візуал лівої панелі (3D або Картинка)
    if (inspectLink) {
        modalLeft.innerHTML = `
            <iframe src="https://csgofloat.com/3d?url=${encodeURIComponent(inspectLink)}" allow="fullscreen" sandbox="allow-scripts allow-same-origin allow-popups"></iframe>
        `;
    } else {
        const imgUrl = item.asset_description && item.asset_description.icon_url 
            ? `https://community.cloudflare.steamstatic.com/economy/image/${item.asset_description.icon_url}/512fx512f` 
            : item.app_icon;
        modalLeft.innerHTML = `<img src="${imgUrl}" class="modal-fallback-img">`;
    }

    // Кнопки дій і Float API
    const marketLink = `https://steamcommunity.com/market/listings/730/${encodeURIComponent(item.hash_name)}`;
    
    let floatHtml = inspectLink 
        ? `<div class="float-block" style="margin-bottom: 20px;">
                <button class="btn-float" onclick="fetchFloat(this, '${inspectLink}', 'modal')">Відсканувати Float / Знос</button>
                <div id="float-val-modal" style="margin-top:5px; font-size:1.1rem;"></div>
                <div class="float-bar-container" id="float-bar-modal">
                <div class="float-marker"></div>
                </div>
            </div>` 
        : ``;

    modalActions.innerHTML = `
        ${floatHtml}
        <div style="display:flex; gap:10px;">
            ${inspectLink ? `<a href="${inspectLink}" class="btn-inspect" style="flex:1">Відкрити в CS2</a>` : ''}
            <a href="${marketLink}" target="_blank" class="btn-market" style="flex:1">Купити на Market</a>
        </div>
    `;

    modal.style.display = 'flex';
};

window.closeModal = () => {
    const modal = document.getElementById('itemModal');
    modal.style.display = 'none';
    document.getElementById('modalLeft').innerHTML = ''; // Знищуємо iframe щоб зупинити WebGL
};

const renderItems = (items) => {
    resultsCount.textContent = items.length;
    itemsGrid.innerHTML = '';
    window.allItems = {}; // Очищення кешу карток


    if (items.length === 0) {
        if (currentFetchedItems.length > 0) {
            itemsGrid.innerHTML = '<div style="grid-column: 1/-1;text-align:center;padding:40px;color:var(--text-secondary);">Знайдено 0 ідеальних співпадінь серед поточної сотні результатів. Натисніть "Завантажити ще 100" нижче для розширення бази для фільтрації.</div>';
        } else {
            itemsGrid.innerHTML = '<div style="grid-column: 1/-1;text-align:center;padding:40px;color:var(--text-secondary);">Нічого не відповідає цим критеріям.</div>';
        }
        return;
    }
    items.forEach((item, index) => {
        const cardId = index + Math.random().toString(36).substr(2, 5);
        window.allItems[cardId] = item;

        const card = document.createElement('div');
        card.className = 'item-card glass-panel';
        card.style.cursor = 'pointer';
        card.onclick = (e) => {
            // Перевіряємо, щоб клік по внутрішнім кнопкам не відкривав модалку, хоча кнопок на обкладинці більше не треба для Float.
            if(e.target.tagName !== 'A' && e.target.tagName !== 'BUTTON') {
                openModal(cardId);
            }
        };
        
        const imgUrl = item.asset_description && item.asset_description.icon_url 
            ? `https://community.cloudflare.steamstatic.com/economy/image/${item.asset_description.icon_url}/360fx360f` 
            : item.app_icon;

        const typeStr = item.asset_description?.type || 'Відсутній тип';
        const marketLink = `https://steamcommunity.com/market/listings/730/${encodeURIComponent(item.hash_name)}`;
        const priceText = item.sale_price_text || item.sell_price_text || "Немає ціни";
        const sellListings = item.sell_listings || 0;
        
        // Отримання правильного кольору рідкості
        const rarityColor = (item.asset_description && item.asset_description.name_color && item.asset_description.name_color !== 'D2D2D2') 
            ? `#${item.asset_description.name_color}` 
            : '#f8fafc'; // Default white if normal

        const stickersHtml = extractStickersHtml(item);

        card.innerHTML = `
            <div class="item-card-bg"></div>
            <div class="item-image-wrapper">
                <img src="${imgUrl}" alt="${item.name}" class="item-image" loading="lazy">
            </div>
            <div class="item-details">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <span class="item-type">${typeStr}</span>
                    <span style="font-size: 0.75rem; color: var(--text-muted);">В наявності: ${sellListings} шт.</span>
                </div>
                <h3 class="item-name" style="color: ${rarityColor}; text-shadow: 0 0 12px ${rarityColor}40;">${item.name}</h3>
                <div class="item-price">${priceText}</div>
                ${stickersHtml ? `<div class="stickers-container">${stickersHtml}</div>` : ''}
            </div>
            <div style="margin-top:auto; padding-top:10px; font-size: 0.8rem; color: var(--accent-primary); font-weight:bold; text-align:center;">
                Натисніть для 3D огляду
            </div>
        `;
        
        // Каскадна затримка анімації (щоб картки виїжджали по черзі)
        card.style.animationDelay = `${(index % 25) * 0.05}s`;
        
        itemsGrid.appendChild(card);
    });
};

loadMoreBtn.addEventListener('click', () => {
    currentStart += 100;
    handleSearch(true);
});

searchBtn.addEventListener('click', () => handleSearch(false));
searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleSearch(false);
});

document.addEventListener("DOMContentLoaded", () => handleSearch(false));
