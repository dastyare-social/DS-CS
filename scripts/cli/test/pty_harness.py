#!/usr/bin/env python3
"""Drive an interactive CLI in a real PTY and print the transcript.

The interactive prompts cannot be exercised without a terminal — every check
would otherwise stop at `isInteractive() === false` and exercise the
non-interactive path instead. This spawns the command under a pty, sends the
keys the test asks for, and dumps what the user would actually have seen.
"""
import os
import pty
import select
import sys
import time

KEYS = {
    "ENTER": "\r",
    "SPACE": " ",
    "DOWN": "\x1b[B",
    "UP": "\x1b[A",
    "ESC": "\x1b",
    "TAB": "\t",
}


def run(argv, script, settle=0.45, timeout=45):
    pid, fd = pty.fork()
    if pid == 0:
        # Isolated so a run never writes the developer's real preferences,
        # and never installs into their real global skills directory by accident.
        os.environ["DS_CS_CONFIG_DIR"] = os.environ.get(
            "DS_CS_TEST_CONFIG_DIR", "/tmp/dscs-pty-test"
        )
        os.environ["COLUMNS"] = "100"
        os.environ["LINES"] = "40"
        os.execvp(argv[0], argv)

    transcript = []

    def drain(seconds):
        end = time.time() + seconds
        while time.time() < end:
            ready, _, _ = select.select([fd], [], [], 0.1)
            if not ready:
                continue
            try:
                chunk = os.read(fd, 65536)
            except OSError:
                return False
            if not chunk:
                return False
            transcript.append(chunk.decode("utf-8", "replace"))
        return True

    drain(settle * 2)
    for step in script:
        os.write(fd, KEYS.get(step, step).encode())
        if not drain(settle):
            break

    deadline = time.time() + timeout
    while time.time() < deadline:
        if not drain(0.3):
            break

    try:
        os.close(fd)
    except OSError:
        pass
    os.waitpid(pid, os.WNOHANG)
    return "".join(transcript)


if __name__ == "__main__":
    keys = sys.argv[1].split(",") if len(sys.argv) > 1 and sys.argv[1] else []
    command = sys.argv[2:] if len(sys.argv) > 2 else []
    print(run(command, keys))
