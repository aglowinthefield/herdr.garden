#!/usr/bin/env python3
"""Build themes/*.json and previews/*.svg from iTerm2-Color-Schemes.

Usage: scripts/build-themes.py [path/to/iTerm2-Color-Schemes]

Without a path, it clones the pinned commit into a temporary folder.
"""

import json
import pathlib
import subprocess
import sys
import tempfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
UPSTREAM = "https://github.com/mbadolato/iTerm2-Color-Schemes"
COMMIT = "72a504c56196a4bf14cfa8ff5718128dcd62b646"

# herdr name -> name in iTerm2-Color-Schemes/ghostty
THEMES = {
    "catppuccin-latte": "Catppuccin Latte",
    "catppuccin-mocha": "Catppuccin Mocha",
    "dracula": "Dracula",
    "everforest-dark": "Everforest Dark Med",
    "gruvbox-dark": "Gruvbox Dark",
    "kanagawa": "Kanagawa Wave",
    "nord": "Nord",
    "rose-pine": "Rose Pine",
    "rose-pine-dawn": "Rose Pine Dawn",
    "solarized-light": "iTerm2 Solarized Light",
    "tokyo-night": "TokyoNight",
}

# Herdr draws selected text in its own colour over `selection`, so a
# selection colour meant for inverted text (light on dark) hides the text.
# These use each theme's own non-inverted selection colour instead.
SELECTION = {
    "catppuccin-latte": "#acb0be",  # Surface 2
    "catppuccin-mocha": "#585b70",  # Surface 2
    "kanagawa": "#2d4f67",  # waveBlue2
    "nord": "#434c5e",  # nord2
}


def fetch() -> pathlib.Path:
    tmp = pathlib.Path(tempfile.mkdtemp()) / "ics"
    run = lambda *a: subprocess.run(a, check=True, cwd=tmp if tmp.exists() else None)
    run("git", "clone", "-q", "--filter=blob:none", "--no-checkout", UPSTREAM, str(tmp))
    run("git", "sparse-checkout", "set", "ghostty")
    run("git", "checkout", "-q", COMMIT)
    return tmp


def parse(path: pathlib.Path) -> dict:
    out = {"ansi": [None] * 16}
    for line in path.read_text().splitlines():
        if "=" not in line:
            continue
        key, value = (s.strip() for s in line.split("=", 1))
        if key == "palette":
            i, color = value.split("=")
            out["ansi"][int(i)] = color.lower()
        else:
            out[key] = value.lower()
    return out


def luminance(hex_: str) -> float:
    def ch(c):
        c = int(c, 16) / 255
        return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4

    r, g, b = (ch(hex_[i : i + 2]) for i in (1, 3, 5))
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def contrast(a: str, b: str) -> float:
    la, lb = sorted((luminance(a), luminance(b)), reverse=True)
    return (la + 0.05) / (lb + 0.05)


def convert(name: str, src: dict) -> dict:
    theme = {
        "background": src["background"],
        "foreground": src["foreground"],
        "selection": SELECTION.get(name, src["selection-background"]),
        "cursor": src.get("cursor-color", src["foreground"]),
        "ansi": src["ansi"],
    }
    if contrast(theme["foreground"], theme["selection"]) < 3:
        sys.exit(f"{name}: foreground is unreadable on selection {theme['selection']}; add it to SELECTION")
    return theme


def preview(name: str, t: dict) -> str:
    a, bg, fg = t["ansi"], t["background"], t["foreground"]
    dim = a[8]
    lines = [
        [(a[2], "~/code/app"), (a[5], " main"), (fg, " $ "), (fg, "git diff --stat")],
        [(fg, " src/server.rs "), (dim, "| "), (fg, "12 "), (a[2], "++++++++"), (a[1], "----")],
        [(fg, " README.md     "), (dim, "| "), (fg, " 3 "), (a[2], "+++")],
        [(a[2], "~/code/app"), (a[5], " main"), (fg, " $ "), (fg, "cargo test")],
        [(a[2], "   Compiling"), (fg, " app v0.4.0")],
        [(fg, "test parse ... "), (a[2], "ok"), (fg, "   test fetch ... "), (a[1], "FAILED")],
        [(a[3], "warning"), (fg, ": unused variable "), (a[6], "`retries`"), (dim, "  # src/net.rs:41")],
        [(a[4], "fn "), (a[3], "main"), (fg, "() { "), (a[5], "let"), (fg, " n = "), (a[6], "42"), (fg, "; }")],
    ]
    w, h, lh, x0, y0, cw = 640, 300, 22, 20, 56, 8.4
    out = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}">',
        f'<rect width="{w}" height="{h}" rx="10" fill="{bg}"/>',
        f'<rect x="0.5" y="0.5" width="{w - 1}" height="{h - 1}" rx="10" fill="none" stroke="{dim}" stroke-opacity="0.5"/>',
    ]
    for i, c in enumerate(("#ff5f57", "#febc2e", "#28c840")):
        out.append(f'<circle cx="{22 + i * 20}" cy="20" r="6" fill="{c}"/>')
    out.append(
        f'<text x="{w / 2}" y="25" fill="{dim}" font-family="ui-sans-serif,-apple-system,sans-serif" '
        f'font-size="13" text-anchor="middle">{name}</text>'
    )
    out.append('<g font-family="ui-monospace,SFMono-Regular,Menlo,monospace" font-size="14">')
    for row, spans in enumerate(lines):
        y = y0 + row * lh
        # Selection on the 'cargo test' command shows how selected text reads.
        if row == 3:
            out.append(f'<rect x="{x0 + 18 * cw - 2}" y="{y - 15}" width="{10 * cw + 4}" height="{lh - 2}" fill="{t["selection"]}"/>')
        # Each word sits on a fixed character grid, so every viewer's
        # monospace font lines up with the selection box.
        col = 0
        for c, s in spans:
            for word in s.split(" "):
                if word:
                    out.append(
                        f'<text x="{x0 + col * cw:.1f}" y="{y}" fill="{c}" textLength="{len(word) * cw:.1f}" '
                        f'lengthAdjust="spacingAndGlyphs">{word.replace("&", "&amp;").replace("<", "&lt;")}</text>'
                    )
                col += len(word) + 1
            col -= 1
    cy = y0 + len(lines) * lh - 15
    out.append(f'<rect x="{x0}" y="{cy}" width="{cw}" height="{lh - 2}" fill="{t["cursor"]}"/>')
    out.append("</g>")
    sw = (w - 2 * x0) / 8
    for i, c in enumerate(a):
        x = x0 + (i % 8) * sw
        y = h - 52 + (i // 8) * 18
        out.append(f'<rect x="{x:.1f}" y="{y}" width="{sw - 4:.1f}" height="14" rx="3" fill="{c}"/>')
    out.append("</svg>")
    return "\n".join(out) + "\n"


def main():
    src = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else fetch()
    for name, upstream in THEMES.items():
        theme = convert(name, parse(src / "ghostty" / upstream))
        (ROOT / "themes" / f"{name}.json").write_text(json.dumps(theme, indent=2) + "\n")
        (ROOT / "previews" / f"{name}.svg").write_text(preview(name, theme))
        print(name)


if __name__ == "__main__":
    main()
