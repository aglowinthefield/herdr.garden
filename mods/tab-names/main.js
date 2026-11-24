// Names each tab after what runs in it: an agent's task, a program, or a folder.
// Tabs you name yourself are left alone; rename one to "" to hand it back.
import { View, div } from "gpui-kit";
import { checking, machines, panes, run, setShared, spaces } from "herdr";
import { decide, nameForTab } from "./naming.js";

const TICK_MS = 2000;

export default class TabNames extends View {
  init(props, cx) {
    try { this.mine = JSON.parse(localStorage.getItem("mine") ?? "{}"); } catch { this.mine = {}; }
    this.seen = {};
    // Block props {"dry_run": true}: write what it would do to
    // shared("tab-names.preview") instead of renaming.
    this.dryRun = props?.dry_run === true;
    if (checking()) return;
    cx.timer.every(TICK_MS, () => this.tick());
  }

  tick() {
    const byTab = {};
    for (const p of panes()) (byTab[p.tab] ??= []).push(p);
    const preview = [];
    let changed = false;
    const live = new Set();
    for (const space of spaces()) {
      for (const tab of space.tabs) {
        live.add(tab.id);
        const candidate = nameForTab(byTab[tab.id] ?? [], space);
        const d = decide(tab, candidate, this.mine[tab.id], this.seen[tab.id]);
        this.seen[tab.id] = d.seen;
        if (this.dryRun) {
          preview.push({ space: space.name, tab: tab.name, named: tab.named, candidate, rename: d.rename });
          continue;
        }
        if (d.rename !== undefined) {
          // Fails while the tab's machine is unreachable; the next tick tries again.
          try { run("tab.rename", { id: tab.id, name: d.rename }); } catch { continue; }
        }
        if (d.mine !== undefined) {
          if (d.mine === null) delete this.mine[tab.id];
          else this.mine[tab.id] = d.mine;
          changed = true;
        }
      }
    }
    // Forget closed tabs, but only when every machine's tabs are known.
    if (machines().every((m) => m.layout === "ready")) {
      for (const id of Object.keys(this.mine)) {
        if (!live.has(id)) { delete this.mine[id]; changed = true; }
      }
    }
    if (changed) localStorage.setItem("mine", JSON.stringify(this.mine));
    if (this.dryRun) {
      // setShared redraws every mod, so only call it when something changed.
      const json = JSON.stringify(preview);
      if (json !== this.lastPreview) { this.lastPreview = json; setShared("tab-names.preview", preview); }
    }
  }

  render() {
    return div();
  }
}
