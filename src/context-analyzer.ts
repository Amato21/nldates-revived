import { App, MarkdownView, Editor } from "obsidian";
import type NaturalLanguageDates from "./main";

const CONTEXT_LINES = 10; // Nombre de lignes à analyser avant et après le curseur
const MAX_DATES_TO_EXTRACT = 10; // Nombre maximum de dates à extraire du contexte

export interface ContextInfo {
  datesInContext: string[]; // Dates trouvées dans le contexte (formats naturels détectés)
  title?: string; // Titre de la note
  tags: string[]; // Tags de la note
}

export default class ContextAnalyzer {
  private app: App;
  private plugin: NaturalLanguageDates;
  private cache: Map<string, ContextInfo> = new Map(); // Cache temporaire par fichier
  private cacheTimeout: number = 5000; // 5 secondes de cache

  constructor(app: App, plugin: NaturalLanguageDates) {
    this.app = app;
    this.plugin = plugin;
  }

  /**
   * Analyse le contexte autour du curseur de manière synchrone (utilise le cache)
   */
  analyzeContextSync(editor: Editor, cursorLine: number): ContextInfo {
    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!activeView) {
      return { datesInContext: [], tags: [] };
    }

    const file = activeView.file;
    if (!file) {
      return { datesInContext: [], tags: [] };
    }

    // Vérifier le cache (avec timeout)
    const cacheKey = `${file.path}-${cursorLine}`;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const context: ContextInfo = {
      datesInContext: [],
      tags: [],
    };

    try {
      // Extraire les tags depuis les métadonnées
      const metadata = this.app.metadataCache.getFileCache(file);
      if (metadata) {
        if (metadata.tags) {
          context.tags = metadata.tags.map(tag => tag.tag);
        }

        // Extraire le titre depuis les frontmatter ou le premier titre
        if (metadata.frontmatter?.title) {
          context.title = metadata.frontmatter.title;
        } else if (metadata.headings && metadata.headings.length > 0) {
          context.title = metadata.headings[0].heading;
        }
      }

      // Analyser le contexte autour du curseur
      const content = editor.getValue();
      const lines = content.split("\n");
      
      const startLine = Math.max(0, cursorLine - CONTEXT_LINES);
      const endLine = Math.min(lines.length - 1, cursorLine + CONTEXT_LINES);
      
      const contextLines = lines.slice(startLine, endLine + 1);
      const contextText = contextLines.join("\n");

      // Extraire les dates du contexte
      context.datesInContext = this.extractDatesFromContext(contextText);

      // Mettre en cache (avec nettoyage périodique)
      this.cache.set(cacheKey, context);
      setTimeout(() => {
        this.cache.delete(cacheKey);
      }, this.cacheTimeout);

    } catch (error) {
      console.error("Erreur lors de l'analyse du contexte:", error);
    }

    return context;
  }

  /**
   * Analyse le contexte autour du curseur dans le document actuel (async, pour compatibilité)
   */
  async analyzeContext(editor: Editor, cursorLine: number): Promise<ContextInfo> {
    return this.analyzeContextSync(editor, cursorLine);
  }

  /**
   * Extrait les expressions de dates potentielles du texte
   * Utilise des patterns simples pour détecter les dates naturelles
   */
  private extractDatesFromContext(text: string): string[] {
    const dates: string[] = [];
    const seen = new Set<string>();

    // Patterns pour détecter les dates naturelles (simples et rapides)
    // On cherche des mots-clés de dates qui pourraient être utilisés dans les suggestions
    const datePatterns = [
      // Jours de la semaine
      /\b(lundi|monday|mardi|tuesday|mercredi|wednesday|jeudi|thursday|vendredi|friday|samedi|saturday|dimanche|sunday)\b/gi,
      // Mots temporels courants
      /\b(aujourd'hui|today|demain|tomorrow|hier|yesterday)\b/gi,
      // Expressions relatives
      /\b(dans|in)\s+\d+\s+(jour|jours|day|days|semaine|semaines|week|weeks|mois|month|months|année|années|year|years)\b/gi,
      // Expressions "prochain/dernier"
      /\b(prochain|next|dernier|last)\s+(lundi|monday|mardi|tuesday|mercredi|wednesday|jeudi|thursday|vendredi|friday|samedi|saturday|dimanche|sunday|semaine|week|mois|month|année|year)\b/gi,
    ];

    for (const pattern of datePatterns) {
      const matches = text.match(pattern);
      if (matches) {
        for (const match of matches) {
          const normalized = match.toLowerCase().trim();
          if (!seen.has(normalized) && dates.length < MAX_DATES_TO_EXTRACT) {
            seen.add(normalized);
            dates.push(match.trim());
          }
        }
      }
    }

    return dates;
  }

  /**
   * Nettoie le cache (peut être appelé périodiquement)
   */
  clearCache(): void {
    this.cache.clear();
  }
}
