"""
Drive a real Chrome window over CDP and capture real GPU frames.

Why this exists: the desktop app's Browser pane only paints while it is
composited and is capped by however wide the pane happens to be, so it cannot
be relied on for screenshots and it drags the user into resizing windows. A
separate Chrome window with its own profile runs its own rAF loop at full
speed, can be sized to anything, and keeps rendering while the user gets on
with something else.

No third-party packages: the WebSocket client is the ~90 lines below.

  python cdp.py --out shot.png --url http://localhost:3000 --scroll 0.45 --wait 3
  python cdp.py --out shot.png --w 390 --h 844 --scroll 1 --wait 5
  python cdp.py --out shot.png --scroll 1 --mouse 900,520 --click
  python cdp.py --out shot.png --scroll 1 --drag "950,450,-420,0"

Two things that look like details and are not. Chrome binds the debug port
on [::1] here, so urllib has to ask for "localhost" — "127.0.0.1" is
refused, and curl reaching it is not evidence that Python will. And scroll
fractions are of documentElement.scrollHeight: the page pulls its sections
up under the canvas with a negative margin, so body.scrollHeight is a whole
viewport short and --scroll 1 stops before the end.
"""

import argparse
import base64
import json
import os
import socket
import struct
import time
import urllib.request
from urllib.parse import urlparse

DEBUG_PORT = 9222


# ---------------------------------------------------------------- websocket


def _recv_exact(sock, n):
    buf = b""
    while len(buf) < n:
        chunk = sock.recv(n - len(buf))
        if not chunk:
            raise ConnectionError("socket closed mid-frame")
        buf += chunk
    return buf


def _send_frame(sock, payload, opcode=0x1):
    data = payload.encode("utf-8") if isinstance(payload, str) else payload
    header = bytearray([0x80 | opcode])
    length = len(data)
    # Client frames must be masked.
    if length < 126:
        header.append(0x80 | length)
    elif length < (1 << 16):
        header.append(0x80 | 126)
        header += struct.pack(">H", length)
    else:
        header.append(0x80 | 127)
        header += struct.pack(">Q", length)
    mask = os.urandom(4)
    header += mask
    masked = bytes(b ^ mask[i % 4] for i, b in enumerate(data))
    sock.sendall(bytes(header) + masked)


def _recv_frame(sock):
    """One logical message, reassembling continuation frames."""
    out = b""
    while True:
        b1, b2 = _recv_exact(sock, 2)
        fin = b1 & 0x80
        opcode = b1 & 0x0F
        masked = b2 & 0x80
        length = b2 & 0x7F
        if length == 126:
            length = struct.unpack(">H", _recv_exact(sock, 2))[0]
        elif length == 127:
            length = struct.unpack(">Q", _recv_exact(sock, 8))[0]
        mask = _recv_exact(sock, 4) if masked else None
        payload = _recv_exact(sock, length) if length else b""
        if mask:
            payload = bytes(b ^ mask[i % 4] for i, b in enumerate(payload))
        if opcode == 0x8:
            raise ConnectionError("closed by peer")
        if opcode == 0x9:
            _send_frame(sock, payload, opcode=0xA)
            continue
        if opcode == 0xA:
            continue
        out += payload
        if fin:
            return out


def ws_connect(url, timeout=60):
    parts = urlparse(url)
    sock = socket.create_connection((parts.hostname, parts.port or 80), timeout=timeout)
    sock.settimeout(timeout)
    key = base64.b64encode(os.urandom(16)).decode()
    path = parts.path + ("?" + parts.query if parts.query else "")
    handshake = (
        f"GET {path} HTTP/1.1\r\n"
        f"Host: {parts.hostname}:{parts.port}\r\n"
        "Upgrade: websocket\r\n"
        "Connection: Upgrade\r\n"
        f"Sec-WebSocket-Key: {key}\r\n"
        "Sec-WebSocket-Version: 13\r\n\r\n"
    )
    sock.sendall(handshake.encode())
    # Read headers up to the blank line.
    buf = b""
    while b"\r\n\r\n" not in buf:
        chunk = sock.recv(1)
        if not chunk:
            raise ConnectionError("handshake failed")
        buf += chunk
    if b"101" not in buf.split(b"\r\n")[0]:
        raise ConnectionError(f"handshake rejected: {buf.splitlines()[0]!r}")
    return sock


# ---------------------------------------------------------------------- cdp


class Page:
    def __init__(self, ws_url):
        self.sock = ws_connect(ws_url)
        self.next_id = 0

    def send(self, method, **params):
        self.next_id += 1
        mid = self.next_id
        _send_frame(self.sock, json.dumps({"id": mid, "method": method, "params": params}))
        while True:
            msg = json.loads(_recv_frame(self.sock))
            if msg.get("id") == mid:
                if "error" in msg:
                    raise RuntimeError(f"{method}: {msg['error']}")
                return msg.get("result", {})
            # Anything else is an event; we do not subscribe to any.

    def evaluate(self, expression):
        r = self.send(
            "Runtime.evaluate",
            expression=expression,
            returnByValue=True,
            awaitPromise=True,
        )
        if r.get("exceptionDetails"):
            raise RuntimeError(r["exceptionDetails"].get("text", "eval failed"))
        return r.get("result", {}).get("value")

    def close(self):
        try:
            self.sock.close()
        except OSError:
            pass


def attach(port=DEBUG_PORT, match=None):
    """The first page target, or one whose url contains `match`."""
    with urllib.request.urlopen(f"http://localhost:{port}/json", timeout=10) as fh:
        targets = json.load(fh)
    pages = [t for t in targets if t.get("type") == "page" and t.get("webSocketDebuggerUrl")]
    if match:
        hit = [t for t in pages if match in t.get("url", "")]
        if hit:
            pages = hit
    if not pages:
        raise SystemExit("no page target on the debug port; is Chrome running with --remote-debugging-port?")
    return Page(pages[0]["webSocketDebuggerUrl"])


# -------------------------------------------------------------------- main


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True)
    ap.add_argument("--url")
    ap.add_argument("--scroll", type=float, help="fraction of max scroll, 0..1")
    ap.add_argument("--wait", type=float, default=2.5, help="seconds of real frames before capture")
    ap.add_argument("--w", type=int, default=1440)
    ap.add_argument("--h", type=int, default=900)
    ap.add_argument("--dpr", type=float, default=1.0)
    ap.add_argument("--eval", dest="expr", help="run an expression after settling and print the value")
    ap.add_argument("--mouse", help="X,Y to move the pointer to just before capture")
    ap.add_argument("--click", action="store_true", help="press and release at --mouse")
    ap.add_argument("--drag", help="X,Y,DX,DY: press at X,Y and drag by DX,DY")
    args = ap.parse_args()

    page = attach(match="localhost:3000")
    page.send("Page.enable")
    page.send("Runtime.enable")
    # A hidden page has its rAF throttled to about one frame a second, which
    # makes every timed thing in the scene crawl and makes any fps number
    # meaningless. Raise the window and tell the page it is focused.
    try:
        page.send("Page.bringToFront")
    except RuntimeError:
        pass
    try:
        page.send("Emulation.setFocusEmulationEnabled", enabled=True)
    except RuntimeError:
        pass
    # Pin the viewport: the window drifts between runs otherwise, and page
    # height changes with it, so the same scroll fraction points somewhere
    # different and the numbers stop being comparable.
    page.send(
        "Emulation.setDeviceMetricsOverride",
        width=args.w,
        height=args.h,
        deviceScaleFactor=args.dpr,
        mobile=False,
    )

    if args.url:
        page.send("Page.navigate", url=args.url)
        # Wait for the document to be usable.
        for _ in range(120):
            time.sleep(0.25)
            try:
                if page.evaluate("document.readyState") == "complete":
                    break
            except RuntimeError:
                pass
        for _ in range(60):
            time.sleep(0.25)
            try:
                if page.evaluate("(()=>{const c=document.querySelector('canvas');return !!c && c.width>200;})()"):
                    break
            except RuntimeError:
                pass
        time.sleep(2.0)

    if args.scroll is not None:
        page.evaluate(
            "(() => {"
            "document.documentElement.style.scrollBehavior='auto';"
            "history.scrollRestoration='manual';"
            "const max = document.documentElement.scrollHeight - window.innerHeight;"
            f"window.scrollTo(0, Math.round(max * {args.scroll}));"
            "return window.scrollY; })()"
        )

    # A real window runs rAF at full speed, so settling is just waiting.
    time.sleep(args.wait)

    # Re-assert it. Focus emulation and bringToFront can pull a focused link
    # into view during the settle, which quietly moves the shot somewhere else.
    if args.scroll is not None:
        page.evaluate(
            "(() => {"
            "const max = document.documentElement.scrollHeight - window.innerHeight;"
            f"window.scrollTo(0, Math.round(max * {args.scroll}));"
            "return window.scrollY; })()"
        )
        time.sleep(1.2)

    if args.drag:
        dx0, dy0, ddx, ddy = (float(v) for v in args.drag.split(","))
        page.send("Input.dispatchMouseEvent", type="mouseMoved", x=dx0, y=dy0, button="none", buttons=0)
        page.send("Input.dispatchMouseEvent", type="mousePressed", x=dx0, y=dy0, button="left", buttons=1, clickCount=1)
        steps = 14
        for i in range(1, steps + 1):
            page.send(
                "Input.dispatchMouseEvent",
                type="mouseMoved",
                x=dx0 + ddx * i / steps,
                y=dy0 + ddy * i / steps,
                button="left",
                buttons=1,
            )
            time.sleep(0.02)
        page.send("Input.dispatchMouseEvent", type="mouseReleased", x=dx0 + ddx, y=dy0 + ddy, button="left", buttons=0, clickCount=1)
        time.sleep(1.4)

    if args.mouse:
        mx, my = (float(v) for v in args.mouse.split(","))
        # Two moves: the first can land while the scene is still settling and
        # r3f only re-raycasts on movement, so the second is the one that sticks.
        page.send("Input.dispatchMouseEvent", type="mouseMoved", x=mx, y=my, button="none", buttons=0)
        time.sleep(0.3)
        page.send("Input.dispatchMouseEvent", type="mouseMoved", x=mx + 1, y=my, button="none", buttons=0)
        if args.click:
            page.send("Input.dispatchMouseEvent", type="mousePressed", x=mx + 1, y=my, button="left", buttons=1, clickCount=1)
            page.send("Input.dispatchMouseEvent", type="mouseReleased", x=mx + 1, y=my, button="left", buttons=0, clickCount=1)
        time.sleep(1.6)

    if args.expr:
        print("EVAL:", json.dumps(page.evaluate(args.expr)))

    shot = page.send("Page.captureScreenshot", format="png", captureBeyondViewport=False)
    raw = base64.b64decode(shot["data"])
    with open(args.out, "wb") as fh:
        fh.write(raw)
    print(f"saved {args.out} ({len(raw)} bytes) at scroll {page.evaluate('window.scrollY')}")
    page.close()


if __name__ == "__main__":
    main()
