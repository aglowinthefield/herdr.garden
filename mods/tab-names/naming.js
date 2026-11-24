// Pure naming rules for tab-names: no Herdr imports, so `node --test` can run them.

export const MAX_LENGTH = 28;

const basename = (path) => (path ?? "").replace(/\/+$/, "").split("/").pop() ?? "";

// Spinners, status dots and other symbols agents put in front of their titles.
const LEADING_SYMBOLS = /^[^\p{L}\p{N}~/.]+/u;

/** What a terminal title says beyond the program name and folder, or null. */
export function taskFromTitle(title, { program, cwd, space } = {}) {
  let t = (title ?? "").trim().replace(LEADING_SYMBOLS, "").trim();
  // pi: "π - <session> - <project>" or "π - <project>".
  t = t.replace(/^π\s*[-—]\s*/u, "");
  const folder = basename(cwd);
  for (const tail of [folder, space]) {
    if (tail) t = t.replace(new RegExp(`\\s+[-—|]\\s+${escape(tail)}$`), "");
  }
  // Vim: "main.rs (~/c/app) - NVIM".
  t = t.replace(/\s+-\s+N?VIM$/, "").replace(/\s*\([~/][^)]*\)$/, "");
  // fish and other shells: "<command> ~/c/app" or a bare path.
  t = t.replace(/\s+(~|\/)\S*$/, "").trim();
  if (!t || /^(~|\/)/.test(t)) return null;
  const boring = [program, folder, space, "shell", "zsh", "bash", "fish"]
    .filter(Boolean)
    .map((s) => s.toLowerCase());
  if (boring.includes(t.toLowerCase())) return null;
  return t;
}

function escape(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function truncate(name, max = MAX_LENGTH) {
  return name.length <= max ? name : name.slice(0, max - 1).trimEnd() + "…";
}

const RANK = { blocked: 0, working: 1, done: 2, idle: 3 };

/** The pane a tab's name should describe: busy agents first, then any agent,
 *  then a running program, then the focused pane. */
export function mainPane(panes) {
  const terminals = panes.filter((p) => p.terminal);
  const score = (p) => {
    if (p.program?.agent || p.status) return RANK[p.status] ?? 3;
    if (p.program && !p.program.shell) return 10;
    return p.focused ? 20 : 30;
  };
  return terminals.slice().sort((a, b) => score(a) - score(b))[0] ?? null;
}

/** The name a tab should have, or null to leave Herdr's automatic one. */
export function nameForTab(panes, space) {
  const p = mainPane(panes);
  if (!p) return null;
  const program = p.program?.name;
  const task = taskFromTitle(p.title, { program, cwd: p.cwd, space: space?.name });
  if (task) return truncate(task);
  // An agent that hasn't said what it's doing: "pi" says less than the tab's number.
  if (p.program?.agent || p.status) return null;
  if (p.program && !p.program.shell) return truncate(program);
  const folder = basename(p.cwd);
  if (folder && folder !== space?.name && p.cwd !== "~") return truncate(folder);
  return null;
}

/**
 * Decides what to do with one tab.
 * `mine` is the name this mod last gave it (or undefined); `seen` the candidate
 * from the previous tick, so a name must hold for two ticks before it's used.
 * Returns { rename?: string, mine?: string | null, seen }.
 */
export function decide(tab, candidate, mine, seen) {
  // Someone else named it: leave it alone until they give it back (rename to "").
  if (tab.named && tab.name !== mine) return { mine: null, seen: undefined };
  if (candidate !== seen) return { seen: candidate };
  if (candidate === null) {
    return tab.named ? { rename: "", mine: null, seen } : { seen };
  }
  if (tab.named && tab.name === candidate) return { seen };
  return { rename: candidate, mine: candidate, seen };
}
