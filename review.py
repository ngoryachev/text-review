#!/usr/bin/env python3
"""Text review tool: local web UI for annotating text.

Starts an HTTP server, opens the browser, waits until the user clicks
"Send to CLI" in the UI, prints the composed prompt to stdout and exits.
All logs go to stderr, so it is safe to use as feedback=$(review.py plan.md).
"""

import argparse
import json
import os
import subprocess
import sys
import threading
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

HTML_PATH = Path(__file__).resolve().parent / "index.html"

state = {"text": "", "prompt": None}
done = threading.Event()


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):  # logs to stderr; stdout is reserved for the prompt
        sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))

    def _send(self, status, body, content_type="application/json; charset=utf-8"):
        data = body if isinstance(body, bytes) else body.encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        if self.path == "/" or self.path.startswith("/?"):
            try:
                html = HTML_PATH.read_bytes()
            except OSError:
                self._send(500, "index.html not found next to review.py",
                           "text/plain; charset=utf-8")
                return
            self._send(200, html, "text/html; charset=utf-8")
        elif self.path == "/api/text":
            self._send(200, json.dumps({"text": state["text"]}, ensure_ascii=False))
        else:
            self._send(404, '{"error": "not found"}')

    def do_POST(self):
        if self.path != "/api/submit":
            self._send(404, '{"error": "not found"}')
            return
        length = int(self.headers.get("Content-Length") or 0)
        try:
            payload = json.loads(self.rfile.read(length).decode("utf-8"))
            prompt = payload["prompt"]
            if not isinstance(prompt, str):
                raise ValueError("prompt must be a string")
        except (ValueError, KeyError) as exc:
            self._send(400, json.dumps({"error": str(exc)}))
            return
        state["prompt"] = prompt
        self._send(200, '{"ok": true}')
        # the response is fully sent — now it is safe to wake the main thread
        done.set()


def read_text(file_arg):
    if file_arg == "-":
        return sys.stdin.read()
    if file_arg:
        return Path(file_arg).read_text(encoding="utf-8")
    if not sys.stdin.isatty():
        return sys.stdin.read()
    return ""


def open_browser(url):
    # xdg-open / the browser may write to stdout — silence both fds while launching
    if sys.platform.startswith("linux"):
        for opener in ("xdg-open", "sensible-browser", "x-www-browser"):
            try:
                subprocess.Popen([opener, url], stdout=subprocess.DEVNULL,
                                 stderr=subprocess.DEVNULL)
                return
            except OSError:
                continue
    devnull = os.open(os.devnull, os.O_WRONLY)
    saved = (os.dup(1), os.dup(2))
    try:
        os.dup2(devnull, 1)
        os.dup2(devnull, 2)
        webbrowser.open(url)
    finally:
        os.dup2(saved[0], 1)
        os.dup2(saved[1], 2)
        for fd in (*saved, devnull):
            os.close(fd)


def main():
    parser = argparse.ArgumentParser(
        description="Annotate text in the browser and print the feedback prompt to stdout")
    parser.add_argument("file", nargs="?",
                        help="file with the text ('-' for stdin; with no argument: "
                             "stdin if piped, otherwise an empty paste field in the UI)")
    parser.add_argument("--port", type=int, default=0,
                        help="port (default: a free one chosen by the OS)")
    parser.add_argument("--no-open", action="store_true",
                        help="do not open the browser automatically")
    args = parser.parse_args()

    try:
        state["text"] = read_text(args.file).replace("\r\n", "\n")
    except OSError as exc:
        sys.stderr.write(f"Failed to read input: {exc}\n")
        return 1

    server = ThreadingHTTPServer(("127.0.0.1", args.port), Handler)
    port = server.server_address[1]
    url = f"http://127.0.0.1:{port}/"

    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    sys.stderr.write(f"Text review: {url} (Ctrl+C to quit without a result)\n")
    if not args.no_open:
        open_browser(url)

    try:
        done.wait()
    except KeyboardInterrupt:
        sys.stderr.write("\nInterrupted.\n")
        return 130
    finally:
        server.shutdown()

    print(state["prompt"])
    return 0


if __name__ == "__main__":
    sys.exit(main())
