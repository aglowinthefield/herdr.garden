import { test } from "node:test";
import assert from "node:assert/strict";
import { decide, nameForTab, taskFromTitle, truncate } from "./naming.js";

const shell = { name: "fish", shell: true, agent: false };
const pi = { name: "pi", shell: false, agent: true };
const claude = { name: "Claude Code", shell: false, agent: true };
const nvim = { name: "Neovim", shell: false, agent: false };
const space = { name: "mu" };

test("pi session titles give the session name", () => {
  assert.equal(taskFromTitle("π - Artist page layout exploration - mu", { program: "pi", cwd: "/Users/me", space: "mu" }), "Artist page layout exploration");
  assert.equal(taskFromTitle("π - mu", { program: "pi", cwd: "/code/mu", space: "mu" }), null);
});

test("agent spinners and status symbols are dropped", () => {
  assert.equal(taskFromTitle("✳ Fix login redirect", { program: "Claude Code" }), "Fix login redirect");
  assert.equal(taskFromTitle("⠐ Fix login redirect", { program: "Claude Code" }), "Fix login redirect");
  assert.equal(taskFromTitle("✳ Claude Code", { program: "Claude Code" }), null);
});

test("shell titles without a command say nothing", () => {
  assert.equal(taskFromTitle("~/c/mu", { program: "fish", cwd: "/code/mu" }), null);
  assert.equal(taskFromTitle("cargo test ~/c/mu", { program: "fish", cwd: "/code/mu" }), "cargo test");
});

test("a busy agent names the tab over a shell beside it", () => {
  const panes = [
    { terminal: "t1", title: "~/c/mu", program: shell, cwd: "/code/mu", focused: true },
    { terminal: "t2", title: "✳ Fix login redirect", program: claude, status: "working", cwd: "/code/mu" },
  ];
  assert.equal(nameForTab(panes, space), "Fix login redirect");
});

test("an agent without a task keeps the automatic name", () => {
  assert.equal(nameForTab([{ terminal: "t1", title: "π - mu", program: pi, status: "idle", cwd: "/code/mu" }], space), null);
});

test("a program is named by its title, else its name", () => {
  assert.equal(nameForTab([{ terminal: "t1", title: "main.rs (~/c/mu) - NVIM", program: nvim, cwd: "/code/mu" }], space), "main.rs");
  assert.equal(nameForTab([{ terminal: "t1", title: "", program: nvim, cwd: "/code/mu" }], space), "Neovim");
});

test("an idle shell in the space's own folder keeps the automatic name", () => {
  assert.equal(nameForTab([{ terminal: "t1", title: "~/c/mu", program: shell, cwd: "/code/mu" }], space), null);
  assert.equal(nameForTab([{ terminal: "t1", title: "~/c/api", program: shell, cwd: "/code/api" }], space), "api");
});

test("mod panes are ignored", () => {
  assert.equal(nameForTab([{ terminal: null, mod: "files", title: "Files" }], space), null);
});

test("long names are cut with an ellipsis", () => {
  assert.equal(truncate("a".repeat(40)).length, 28);
  assert.ok(truncate("a".repeat(40)).endsWith("…"));
});

test("a name must hold for two ticks before it is used", () => {
  const tab = { name: "1", named: false };
  const first = decide(tab, "Fix login", undefined, undefined);
  assert.equal(first.rename, undefined);
  const second = decide(tab, "Fix login", undefined, first.seen);
  assert.equal(second.rename, "Fix login");
  assert.equal(second.mine, "Fix login");
});

test("a tab someone else named is left alone", () => {
  const d = decide({ name: "release", named: true }, "Fix login", "Fix login", "Fix login");
  assert.equal(d.rename, undefined);
  assert.equal(d.mine, null);
});

test("a tab handed back with an empty name is named again", () => {
  const d = decide({ name: "1", named: false }, "Fix login", undefined, "Fix login");
  assert.equal(d.rename, "Fix login");
});

test("when nothing is happening, its own name goes back to automatic", () => {
  assert.equal(decide({ name: "Fix login", named: true }, null, "Fix login", null).rename, "");
  assert.equal(decide({ name: "2", named: false }, null, undefined, null).rename, undefined);
});
