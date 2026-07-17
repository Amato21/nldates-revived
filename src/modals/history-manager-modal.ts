import { App, Modal, Setting } from "obsidian";
import type NaturalLanguageDates from "../main";
import moment from "../window-moment";

export default class HistoryManagerModal extends Modal {
  private plugin: NaturalLanguageDates;
  // Two-click confirmation for "Clear all": first click arms it, second
  // click (on the same render) actually clears -- avoids wiping the whole
  // history from a single accidental click, without the complexity of a
  // separate confirmation modal or a timeout to reset the arming state.
  private clearAllArmed = false;

  constructor(app: App, plugin: NaturalLanguageDates) {
    super(app);
    this.plugin = plugin;
  }

  onOpen(): void {
    this.clearAllArmed = false;
    this.render();
  }

  onClose(): void {
    this.contentEl.empty();
  }

  private async render(): Promise<void> {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("nld-history-manager-modal");

    contentEl.createEl("h2", { text: "Manage suggestion history" });

    const entries = await this.plugin.historyManager.getEntriesForManagement();

    if (entries.length === 0) {
      contentEl.createEl("p", { text: "No history yet. Suggestions you select from the autosuggest popup will appear here." });
      return;
    }

    new Setting(contentEl)
      .setName("Clear all history")
      .setDesc(this.clearAllArmed
        ? "Click again to confirm -- this cannot be undone."
        : `Remove all ${entries.length} entries.`)
      .addButton((button) => {
        button.setButtonText(this.clearAllArmed ? "Click again to confirm" : "Clear all");
        if (this.clearAllArmed) {
          button.setWarning();
        }
        button.onClick(async () => {
          if (!this.clearAllArmed) {
            this.clearAllArmed = true;
            await this.render();
            return;
          }
          await this.plugin.historyManager.clearHistory();
          this.clearAllArmed = false;
          await this.render();
        });
      });

    for (const entry of entries) {
      const lastUsedText = moment(entry.lastUsed).fromNow();
      const timesText = entry.count === 1 ? "1 time" : `${entry.count} times`;

      new Setting(contentEl)
        .setName(entry.display)
        .setDesc(`Used ${timesText} · last used ${lastUsedText}`)
        .addButton((button) => {
          button
            .setIcon("trash")
            .setTooltip("Remove this entry")
            .onClick(async () => {
              await this.plugin.historyManager.removeEntry(entry.key);
              await this.render();
            });
        });
    }
  }
}
