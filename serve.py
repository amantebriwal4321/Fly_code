"""Dev server: threaded + never caches, so parallel fetches work and edits show."""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

class H(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, max-age=0")
        super().end_headers()

httpd = ThreadingHTTPServer(("", 8080), H)
print("serving on 8080 (threaded, no-store)")
httpd.serve_forever()
