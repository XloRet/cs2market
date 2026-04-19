# ═══════════════════════════════════════════════════════════════════
#  CS2 PRO SEARCH — server.py
#  Flask + Steam OpenID 2.0 + SQLite
# ═══════════════════════════════════════════════════════════════════
import os, sqlite3, json, uuid, re, urllib.parse, urllib.request
from datetime import datetime, timezone
from flask import (Flask, request, redirect, session,
                   jsonify, send_from_directory, abort)
import requests as rq
from dotenv import load_dotenv

load_dotenv()

import os
import re
from dotenv import load_dotenv
from flask import Flask

# ── Завантажуємо змінні середовища (має бути на початку) ─────────────────────
load_dotenv()

# ── Config ────────────────────────────────────────────────────────
STEAM_API_KEY = os.environ.get('STEAM_API_KEY', '')

# SECRET_KEY — обов'язково беремо тільки зі змінних середовища
SECRET_KEY = os.environ.get('SECRET_KEY')
if not SECRET_KEY:
    raise RuntimeError("SECRET_KEY is not set! Add it in Render → Environment Variables.")

BASE_URL = os.environ.get('BASE_URL', 'https://cs2market-1.onrender.com')  # ← твій реальний домен
PORT     = int(os.environ.get('PORT', 10000))  # Render зазвичай використовує PORT=10000

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'cs2pro.db')

OPENID_NS    = 'http://specs.openid.net/auth/2.0'
STEAM_OPENID = 'https://steamcommunity.com/openid/login'
STEAM_ID_RE  = re.compile(r'https://steamcommunity\.com/openid/id/(\d+)$')

# ── Flask App ─────────────────────────────────────────────────────
app = Flask(__name__, 
            static_folder='.', 
            static_url_path='')   # щоб style.css і app.js працювали з кореня

app.secret_key = SECRET_KEY

# Налаштування сесій (важливо для Steam авторизації на Render)
app.config['SESSION_COOKIE_SAMESITE']   = 'Lax'
app.config['SESSION_COOKIE_SECURE']     = True      # True, бо Render працює через HTTPS
app.config['SESSION_COOKIE_HTTPONLY']   = True
app.config['PERMANENT_SESSION_LIFETIME'] = 86400 * 7   # 7 днів (можна змінити)

# Додаткові налаштування безпеки
app.config['SESSION_COOKIE_NAME'] = 'cs2market_session'

# ── Weapon type detection ─────────────────────────────────────────
KNIFE_WORDS = ['knife','karambit','bayonet','daggers','talon','ursus',
               'stiletto','falchion','bowie','butterfly','huntsman',
               'gut knife','navaja','shadow','paracord','skeleton',
               'classic knife','nomad','cord']
GLOVE_WORDS = ['gloves','glove','hand wraps','sport gloves','bloodhound',
               'specialist gloves','broken fang']
WEAPON_MAP  = {
    'ak-47':'ak47','m4a4':'m4a4','m4a1-s':'m4a1s','awp':'awp',
    'galil ar':'galil','famas':'famas','aug':'aug','sg 553':'sg553',
    'glock-18':'glock','usp-s':'usp_s','desert eagle':'deagle',
    'p250':'p250','five-seven':'five_seven','tec-9':'tec9',
    'cz75-auto':'cz75','p2000':'p2000','mp5-sd':'mp5_sd',
    'mp7':'mp7','p90':'p90','mac-10':'mac10','ump-45':'ump45',
    'pp-bizon':'bizon','mp9':'mp9','nova':'nova','xm1014':'xm1014',
    'sawed-off':'sawed_off','mag-7':'mag7','m249':'m249','negev':'negev',
}

def detect_weapon(name: str) -> str:
    n = name.lower()
    if '★' in name or any(w in n for w in KNIFE_WORDS):
        return 'knife'
    if any(w in n for w in GLOVE_WORDS):
        return 'gloves'
    for k, v in WEAPON_MAP.items():
        if k in n:
            return v
    return 'other'

# ── Database ──────────────────────────────────────────────────────
def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute('PRAGMA journal_mode=WAL')
    return conn

def init_db():
    with get_db() as db:
        db.executescript('''
        CREATE TABLE IF NOT EXISTS users (
            steam_id   TEXT PRIMARY KEY,
            username   TEXT NOT NULL,
            avatar     TEXT,
            created_at TEXT NOT NULL,
            last_login TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS favorites (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            steam_id    TEXT NOT NULL REFERENCES users(steam_id) ON DELETE CASCADE,
            weapon_type TEXT NOT NULL,
            hash_name   TEXT NOT NULL,
            name        TEXT NOT NULL,
            icon        TEXT,
            price_usd   REAL DEFAULT 0,
            created_at  TEXT NOT NULL,
            UNIQUE(steam_id, hash_name)
        );

        CREATE TABLE IF NOT EXISTS collections (
            id         TEXT PRIMARY KEY,
            steam_id   TEXT NOT NULL REFERENCES users(steam_id) ON DELETE CASCADE,
            name       TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS collection_items (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            collection_id TEXT NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
            hash_name     TEXT NOT NULL,
            name          TEXT NOT NULL,
            icon          TEXT,
            price_usd     REAL DEFAULT 0,
            weapon_type   TEXT NOT NULL DEFAULT 'other',
            UNIQUE(collection_id, hash_name)
        );
        ''')
    print(f'[DB] Initialized at {DB_PATH}')

# ── Helpers ───────────────────────────────────────────────────────
def now_iso():
    return datetime.now(timezone.utc).isoformat()

def current_user():
    return session.get('steam_id')

def require_auth(f):
    from functools import wraps
    @wraps(f)
    def wrapper(*args, **kwargs):
        if not current_user():
            return jsonify({'error': 'Unauthorized'}), 401
        return f(*args, **kwargs)
    return wrapper

# ── Steam OpenID ──────────────────────────────────────────────────
@app.route('/auth/steam')
def auth_steam():
    params = {
        'openid.ns':        OPENID_NS,
        'openid.mode':      'checkid_setup',
        'openid.return_to': f'{BASE_URL}/auth/steam/callback',
        'openid.realm':     BASE_URL,
        'openid.identity':  f'{OPENID_NS}/identifier_select',
        'openid.claimed_id':f'{OPENID_NS}/identifier_select',
    }
    url = STEAM_OPENID + '?' + urllib.parse.urlencode(params)
    return redirect(url)

@app.route('/auth/steam/callback')
def auth_steam_callback():
    args = request.args.to_dict()

    # Verify with Steam
    args['openid.mode'] = 'check_authentication'
    try:
        resp = rq.post(STEAM_OPENID, data=args, timeout=10)
        if 'is_valid:true' not in resp.text:
            return redirect('/?auth=failed')
    except Exception as e:
        print(f'[AUTH] Verification error: {e}')
        return redirect('/?auth=error')

    # Extract Steam ID
    claimed = args.get('openid.claimed_id', '')
    m = STEAM_ID_RE.search(claimed)
    if not m:
        return redirect('/?auth=invalid')
    steam_id = m.group(1)

    # Fetch user profile from Steam API
    try:
        api_url = (f'https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/'
                   f'?key={STEAM_API_KEY}&steamids={steam_id}')
        data = rq.get(api_url, timeout=10).json()
        player = data['response']['players'][0]
        username = player.get('personaname', 'CS2 Player')
        avatar   = player.get('avatarfull', '')
    except Exception as e:
        print(f'[AUTH] Profile fetch error: {e}')
        username, avatar = 'CS2 Player', ''

    # Upsert user in DB
    with get_db() as db:
        existing = db.execute('SELECT steam_id FROM users WHERE steam_id=?',
                              (steam_id,)).fetchone()
        if existing:
            db.execute('UPDATE users SET username=?,avatar=?,last_login=? WHERE steam_id=?',
                       (username, avatar, now_iso(), steam_id))
        else:
            db.execute('INSERT INTO users(steam_id,username,avatar,created_at,last_login) VALUES(?,?,?,?,?)',
                       (steam_id, username, avatar, now_iso(), now_iso()))

    # Set session
    session['steam_id'] = steam_id
    session['username'] = username
    session['avatar']   = avatar
    session.permanent   = True

    return redirect('/?auth=ok')

@app.route('/auth/logout', methods=['POST'])
def auth_logout():
    session.clear()
    return jsonify({'ok': True})

# ── Auth Status ───────────────────────────────────────────────────
@app.route('/api/me')
def api_me():
    sid = current_user()
    if not sid:
        return jsonify({'logged_in': False})
    return jsonify({
        'logged_in': True,
        'steam_id':  sid,
        'username':  session.get('username', ''),
        'avatar':    session.get('avatar', ''),
    })

# ── Sync — pull all data after login ─────────────────────────────
@app.route('/api/sync')
@require_auth
def api_sync():
    sid = current_user()
    with get_db() as db:
        favs = db.execute(
            'SELECT hash_name,name,icon,price_usd,weapon_type FROM favorites WHERE steam_id=?',
            (sid,)
        ).fetchall()
        colls = db.execute(
            'SELECT id,name,created_at,updated_at FROM collections WHERE steam_id=? ORDER BY created_at',
            (sid,)
        ).fetchall()
        coll_items = {}
        for c in colls:
            items = db.execute(
                'SELECT hash_name,name,icon,price_usd,weapon_type FROM collection_items WHERE collection_id=?',
                (c['id'],)
            ).fetchall()
            coll_items[c['id']] = [dict(i) for i in items]

    return jsonify({
        'favorites': [dict(f) for f in favs],
        'collections': [
            {**dict(c), 'items': coll_items.get(c['id'], [])}
            for c in colls
        ]
    })

# ── Favorites ─────────────────────────────────────────────────────
@app.route('/api/favorites', methods=['GET'])
@require_auth
def get_favorites():
    sid = current_user()
    with get_db() as db:
        rows = db.execute(
            'SELECT hash_name,name,icon,price_usd,weapon_type FROM favorites WHERE steam_id=? ORDER BY created_at DESC',
            (sid,)
        ).fetchall()
    return jsonify([dict(r) for r in rows])

@app.route('/api/favorites', methods=['POST'])
@require_auth
def add_favorite():
    sid  = current_user()
    data = request.get_json(silent=True) or {}
    hash_name   = data.get('hash_name', '')
    name        = data.get('name', '')
    icon        = data.get('icon', '')
    price_usd   = float(data.get('price_usd', 0))
    weapon_type = data.get('weapon_type') or detect_weapon(name)

    if not hash_name or not name:
        return jsonify({'error': 'hash_name and name required'}), 400

    with get_db() as db:
        db.execute('''
            INSERT INTO favorites(steam_id,weapon_type,hash_name,name,icon,price_usd,created_at)
            VALUES(?,?,?,?,?,?,?)
            ON CONFLICT(steam_id,hash_name) DO UPDATE SET
                weapon_type=excluded.weapon_type,
                name=excluded.name,
                icon=excluded.icon,
                price_usd=excluded.price_usd
        ''', (sid, weapon_type, hash_name, name, icon, price_usd, now_iso()))

    return jsonify({'ok': True})

@app.route('/api/favorites/<path:hash_name>', methods=['DELETE'])
@require_auth
def delete_favorite(hash_name):
    sid = current_user()
    with get_db() as db:
        db.execute('DELETE FROM favorites WHERE steam_id=? AND hash_name=?', (sid, hash_name))
    return jsonify({'ok': True})

# ── Collections ───────────────────────────────────────────────────
@app.route('/api/collections', methods=['GET'])
@require_auth
def get_collections():
    sid = current_user()
    with get_db() as db:
        colls = db.execute(
            'SELECT id,name,created_at,updated_at FROM collections WHERE steam_id=? ORDER BY created_at',
            (sid,)
        ).fetchall()
        result = []
        for c in colls:
            items = db.execute(
                'SELECT hash_name,name,icon,price_usd,weapon_type FROM collection_items WHERE collection_id=?',
                (c['id'],)
            ).fetchall()
            result.append({**dict(c), 'items': [dict(i) for i in items]})
    return jsonify(result)

@app.route('/api/collections', methods=['POST'])
@require_auth
def create_collection():
    sid  = current_user()
    data = request.get_json(silent=True) or {}
    name  = data.get('name', '').strip()
    items = data.get('items', [])
    if not name:
        return jsonify({'error': 'name required'}), 400

    coll_id = 'c_' + str(uuid.uuid4()).replace('-','')[:16]
    ts = now_iso()
    with get_db() as db:
        db.execute('INSERT INTO collections(id,steam_id,name,created_at,updated_at) VALUES(?,?,?,?,?)',
                   (coll_id, sid, name, ts, ts))
        for item in items:
            _insert_coll_item(db, coll_id, item)

    return jsonify({'ok': True, 'id': coll_id})

@app.route('/api/collections/<coll_id>', methods=['PUT'])
@require_auth
def update_collection(coll_id):
    sid  = current_user()
    data = request.get_json(silent=True) or {}
    # Verify ownership
    with get_db() as db:
        row = db.execute('SELECT id FROM collections WHERE id=? AND steam_id=?', (coll_id, sid)).fetchone()
        if not row:
            return jsonify({'error': 'Not found'}), 404

        if 'name' in data:
            db.execute('UPDATE collections SET name=?,updated_at=? WHERE id=?',
                       (data['name'].strip(), now_iso(), coll_id))
        if 'items' in data:
            db.execute('DELETE FROM collection_items WHERE collection_id=?', (coll_id,))
            for item in data['items']:
                _insert_coll_item(db, coll_id, item)

    return jsonify({'ok': True})

@app.route('/api/collections/<coll_id>', methods=['DELETE'])
@require_auth
def delete_collection(coll_id):
    sid = current_user()
    with get_db() as db:
        db.execute('DELETE FROM collections WHERE id=? AND steam_id=?', (coll_id, sid))
    return jsonify({'ok': True})

@app.route('/api/collections/<coll_id>/items', methods=['POST'])
@require_auth
def add_collection_item(coll_id):
    sid  = current_user()
    data = request.get_json(silent=True) or {}
    with get_db() as db:
        row = db.execute('SELECT id FROM collections WHERE id=? AND steam_id=?', (coll_id, sid)).fetchone()
        if not row:
            return jsonify({'error': 'Not found'}), 404
        _insert_coll_item(db, coll_id, data)
        db.execute('UPDATE collections SET updated_at=? WHERE id=?', (now_iso(), coll_id))
    return jsonify({'ok': True})

@app.route('/api/collections/<coll_id>/items/<path:hash_name>', methods=['DELETE'])
@require_auth
def delete_collection_item(coll_id, hash_name):
    sid = current_user()
    with get_db() as db:
        row = db.execute('SELECT id FROM collections WHERE id=? AND steam_id=?', (coll_id, sid)).fetchone()
        if not row:
            return jsonify({'error': 'Not found'}), 404
        db.execute('DELETE FROM collection_items WHERE collection_id=? AND hash_name=?',
                   (coll_id, hash_name))
    return jsonify({'ok': True})

def _insert_coll_item(db, coll_id, item):
    hash_name   = item.get('hash_name', item.get('name', ''))
    name        = item.get('name', '')
    icon        = item.get('icon', '')
    price_usd   = float(item.get('price_usd', 0) or 0)
    weapon_type = item.get('weapon_type') or detect_weapon(name)
    if not hash_name:
        return
    db.execute('''
        INSERT INTO collection_items(collection_id,hash_name,name,icon,price_usd,weapon_type)
        VALUES(?,?,?,?,?,?)
        ON CONFLICT(collection_id,hash_name) DO UPDATE SET
            name=excluded.name, icon=excluded.icon,
            price_usd=excluded.price_usd, weapon_type=excluded.weapon_type
    ''', (coll_id, hash_name, name, icon, price_usd, weapon_type))

# ── Steam Market Proxy ────────────────────────────────────────────
@app.route('/api/search')
def api_search():
    q     = request.args.get('q', '"Katowice 2014"')
    start = request.args.get('start', '0')
    print(f'[SEARCH] {q!r} start={start}')
    url = (f'https://steamcommunity.com/market/search/render/'
           f'?query={urllib.parse.quote(q)}&search_descriptions=1'
           f'&appid=730&norender=1&count=100&start={start}&l=english')
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=15) as r:
            data = r.read()
        return app.response_class(data, mimetype='application/json')
    except Exception as e:
        print(f'[SEARCH] Error: {e}')
        return jsonify({'error': str(e)}), 500

# ── CSGOFloat Proxy ───────────────────────────────────────────────
@app.route('/api/float')
def api_float():
    target = request.args.get('url', '')
    if not target:
        return jsonify({'error': 'Missing url'}), 400
    float_url = f'https://api.csgofloat.com/?url={urllib.parse.quote(target)}'
    try:
        req = urllib.request.Request(float_url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=10) as r:
            data = r.read()
            status = r.status
        return app.response_class(data, status=status, mimetype='application/json')
    except urllib.error.HTTPError as e:
        return jsonify({'error': str(e), 'code': e.code}), e.code
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ── Static files ──────────────────────────────────────────────────
@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/<path:filename>')
def static_files(filename):
    return send_from_directory('.', filename)

# ── Main ──────────────────────────────────────────────────────────
if __name__ == '__main__':
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    init_db()
    print(f'[SERVER] Starting on http://127.0.0.1:{PORT}')
    print(f'[SERVER] Steam API Key: {"[OK] Set" if STEAM_API_KEY else "[!!] MISSING!"}')
    app.run(host='0.0.0.0', port=PORT, debug=False)
