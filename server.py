import http.server
import socketserver
import urllib.request
import json
import urllib.parse
import os

PORT = int(os.environ.get('PORT', 8000))

class SteamProxyHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        # API пошуку Market
        if self.path.startswith('/api/search'):
            query = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
            search_query = query.get('q', ['"Katowice 2014"'])[0]
            start_idx = query.get('start', ['0'])[0]
            
            print(f"Отримано запит Steam: {search_query} (start={start_idx})")
            
            steam_url = f'https://steamcommunity.com/market/search/render/?query={urllib.parse.quote(search_query)}&search_descriptions=1&appid=730&norender=1&count=100&start={start_idx}&l=english'
            
            try:
                req = urllib.request.Request(steam_url, headers={'User-Agent': 'Mozilla/5.0'})
                with urllib.request.urlopen(req) as response:
                    data = response.read()
                
                self.send_response(200)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(data)
                
            except Exception as e:
                print(f"Помилка Steam API: {e}")
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                error_response = json.dumps({'error': str(e)})
                self.wfile.write(error_response.encode())
                
        # API отримання Float (CSGOFloat API)
        elif self.path.startswith('/api/float'):
            query = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
            target_url = query.get('url', [''])[0]
            
            if not target_url:
                self.send_response(400)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(b'{"error": "Missing url parameter"}')
                return

            print(f"Запит Float...")
            float_api_url = f"https://api.csgofloat.com/?url={urllib.parse.quote(target_url)}"
            
            try:
                req = urllib.request.Request(float_api_url, headers={'User-Agent': 'Mozilla/5.0'})
                with urllib.request.urlopen(req, timeout=10) as response:
                    data = response.read()
                    
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(data)
            except urllib.error.HTTPError as e:
                self.send_response(e.code)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'error': str(e), 'code': e.code}).encode())
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'error': str(e)}).encode())
        else:
            # Віддача статичних файлів (index.html, style.css, app.js)
            super().do_GET()

if __name__ == '__main__':
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), SteamProxyHandler) as httpd:
        print(f"Локальний сервер успішно запущено!")
        print(f"Перейдіть у браузері за посиланням: http://localhost:{PORT}")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nСервер зупинено.")
