import http.server
import ssl
import socketserver

PORT = 443  # Or any other port you prefer, e.g., 8000

Handler = http.server.SimpleHTTPRequestHandler

# Paths to your certificate and key files
CERT_FILE = "/etc/letsencrypt/live/signspace.cloud/fullchain.pem"
KEY_FILE = "/etc/letsencrypt/live/signspace.cloud/privkey.pem"

with socketserver.TCPServer(("", PORT), Handler) as httpd:
    httpd.socket = ssl.wrap_socket(httpd.socket,
                                   keyfile=KEY_FILE,
                                   certfile=CERT_FILE,
                                   server_side=True)
    print(f"serving at port {PORT}")
    httpd.serve_forever()
