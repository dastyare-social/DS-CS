#!/usr/bin/env python3
"""Run an interactive CLI in a real PTY and print the screen it leaves behind.

Two things make this necessary:

* The prompts cannot be exercised without a terminal. Without a pty every check
  would stop at `isInteractive() === false` and test the non-interactive path.
* Raw PTY output is not the screen. A prompt repaints by emitting cursor-up and
  erase sequences, so counting a menu in the byte stream reports how many times
  it was redrawn, not how many copies are visible — which would call a
  correctly-repainting prompt "broken".

So this splits the stream into repaint frames and prints the last one.
"""
import os
import pty
import re
import select
import sys
import time

KEYS = {
    "ENTER": "\r",
    "SPACE": " ",
    "DOWN": "\x1b[B",
    "UP": "\x1b[A",
    "ESC": "\x1b",
    "ALL": "a",
}


def strip_ansi(text):
    return re.sub(r"\x1b\[[0-9;?]*[A-Za-z]", "", text)


def frames(raw):
    """Split a repainting prompt into one frame per redraw.

    A frame is "<erase to end of screen><lines>". The final frame is the screen
    the user is left looking at; earlier frames were overwritten on screen, so
    counting them in the raw stream would wrongly report a correct prompt as one
    that duplicates its menu.
    """
    parts = re.split(r"\x1b\[\d*A\x1b\[0J", raw)
    return [strip_ansi(part).strip("\n") for part in parts if part.strip("\n")]


def run(argv, script, settle=0.4, timeout=45):
    pid, fd = pty.fork()
    if pid == 0:
        os.environ["DS_CS_CONFIG_DIR"] = os.environ.get(
            "DS_CS_TEST_CONFIG_DIR", "/tmp/dscs-pty-test"
        )
        os.environ["COLUMNS"] = os.environ.get("COLUMNS", "100")
        os.environ["LINES"] = os.environ.get("LINES", "40")
        os.execvp(argv[0], argv)

    chunks = []
    alive = True

    def drain(seconds):
        nonlocal alive
        end = time.time() + seconds
        while time.time() < end:
            ready, _, _ = select.select([fd], [], [], 0.1)
            if not ready:
                continue
            try:
                chunk = os.read(fd, 65536)
            except OSError:
                alive = False
                return
            if not chunk:
                alive = False
                return
            chunks.append(chunk.decode("utf-8", "replace"))
            alive = True
        return alive

    drain(settle * 2)
    for key in script:
        try:
            os.write(fd, KEYS.get(key, key).encode())
        except OSError:
            break
        if not drain(settle):
            break

    deadline = time.time() + (timeout if not alive else 1.5)
    while alive and time.time() < deadline:
        if not drain(0.2):
            break

    try:
        os.close(fd)
    except OSError:
        pass
    try:
        os.waitpid(pid, os.WNOHANG)
    except ChildProcessError:
        pass
    drawn = frames("".join(chunks))
    return drawn[-1] if drawn else strip_ansi("".join(chunks))


if __name__ == "__main__":
    keys = [k for k in (sys.argv[1].split(",") if len(sys.argv) > 1 else []) if k]
    print(run(sys.argv[2:], keys))