# 🔮 Améliorations Futures Potentielles - Natural Language Dates (Revived)

> **📊 Statut d'implémentation :** Ce document a été mis à jour pour refléter les améliorations déjà implémentées. Les améliorations marquées ✅ sont complètes, 🔄 sont partiellement faites, et ❌ restent à faire.

## 📋 Table des Matières
1. [Architecture & Code Quality](#architecture--code-quality)
2. [Fonctionnalités](#fonctionnalités)
3. [Performance](#performance)
4. [Expérience Utilisateur](#expérience-utilisateur)
5. [Internationalisation](#internationalisation)
6. [Tests & Qualité](#tests--qualité)
7. [Documentation](#documentation)
8. [Sécurité & Robustesse](#sécurité--robustesse)
9. [Intégrations](#intégrations)
10. [Nouvelles Améliorations Identifiées](#-nouvelles-améliorations-identifiées-janvier-2025)

---

## 🏗️ Architecture & Code Quality

### 1. **Refactoring du système de langues** 🔄 PARTIELLEMENT FAIT
**Statut :** Une fonction `syncLanguageFlags()` a été ajoutée pour synchroniser automatiquement les flags avec le tableau `languages[]`, mais le double système persiste toujours.

**Problème actuel :**
- Double système de flags (`english`, `french`, etc.) et tableau `languages[]`
- Synchronisation automatique via `syncLanguageFlags()` dans `main.ts` (ligne 129)
- Les flags sont toujours nécessaires pour l'interface des settings

**Amélioration restante :**
```typescript
// Utiliser uniquement le tableau languages[] et supprimer les flags booléens
// Créer une fonction utilitaire pour vérifier si une langue est activée
private isLanguageEnabled(lang: string): boolean {
  return this.settings.languages.includes(lang);
}
```

### 2. **Exposer le parser publiquement** ✅ FAIT
**Statut :** Le parser est maintenant public dans `main.ts` (ligne 18).

**Implémentation :**
```18:18:src/main.ts
  public parser: NLDParser;
```

Le parser est accessible publiquement et typé, éliminant le besoin de `(plugin as any).parser`.

### 3. **Gestion d'erreurs améliorée** ✅ FAIT
**Statut :** Système de gestion d'erreurs complet avec logging structuré et notifications Obsidian.

**Implémentation :**
- ✅ Classe d'erreur personnalisée `NLDParseError` dans `src/errors.ts`
  - Propriétés : `code`, `context`, `severity` ('debug' | 'warn' | 'error')
  - Codes d'erreur constants exportés (`ErrorCodes`)
- ✅ Système de logging structuré dans `src/logger.ts`
  - Niveaux : debug, info, warn, error
  - Format structuré avec timestamp et contexte
  - Utilise `console.debug`, `console.info`, `console.warn`, `console.error`
- ✅ Notifications Obsidian pour erreurs critiques dans `src/main.ts`
  - Notification lors de l'échec d'initialisation du parser (avec fallback anglais)
  - Notification en cas d'échec critique du fallback
  - Durées configurées (5s pour erreur normale, 10s pour erreur critique)
- ✅ Refactorisation de tous les try/catch :
  - `src/main.ts` : utilise logger et notifications (ligne 96-124)
  - `src/chrono.ts` : utilise logger au lieu de console.warn/error (lignes 32-63)
  - `src/parser.ts` : utilise logger dans getParsedDateResult() et getParsedResult() (lignes 741-783)

**Fichiers créés :**
- `src/errors.ts` - Classe NLDParseError et codes d'erreur
- `src/logger.ts` - Système de logging structuré

**Fichiers modifiés :**
- `src/main.ts` - Logger et notifications Obsidian
- `src/chrono.ts` - Logger structuré
- `src/parser.ts` - Logger structuré

**Résultat :**
- ✅ Tous les tests passent (95/95)
- ✅ Logging structuré pour faciliter le débogage
- ✅ Notifications utilisateur pour les erreurs critiques
- ✅ Gestion d'erreurs cohérente dans tout le plugin

### 4. **Séparation des responsabilités** ✅ FAIT
**Statut :** Architecture modulaire avec séparation claire des responsabilités.

**Implémentation :**
- ✅ Module `src/time-detector.ts` créé
  - Classe `TimeDetector` pour la détection de composante d'heure
  - Interface `TimeDetectorDependencies` pour les dépendances
  - Méthode `hasTimeComponent()` extraite de `NLDParser`
  - Logique de détection d'heure complètement isolée
- ✅ Module `src/date-formatter.ts` créé
  - Classe `DateFormatter` avec méthode statique `format()`
  - Méthode `formatWithTime()` pour dates avec heure
  - Formatage de dates isolé dans un module dédié
- ✅ Refactorisation de `NLDParser` :
  - `hasTimeComponent()` délègue maintenant à `TimeDetector` (ligne 785-787)
  - Instance de `TimeDetector` créée dans le constructeur (ligne 62-71)
  - Code plus modulaire et maintenable
- ✅ Compatibilité rétroactive maintenue :
  - `getFormattedDate()` dans `utils.ts` est maintenant un wrapper vers `DateFormatter.format()`
  - Tous les imports existants continuent de fonctionner

**Fichiers créés :**
- `src/time-detector.ts` - Détection de composante d'heure
- `src/date-formatter.ts` - Formatage de dates

**Fichiers modifiés :**
- `src/parser.ts` - Utilise TimeDetector au lieu de méthode intégrée
- `src/utils.ts` - Wrapper pour compatibilité avec getFormattedDate()

**Résultat :**
- ✅ Tous les tests passent (95/95)
- ✅ Code plus modulaire et testable
- ✅ Séparation claire des responsabilités
- ✅ Compatibilité rétroactive maintenue

### 5. **TypeScript strict mode** 🔄 PARTIELLEMENT CONFIGURÉ
**Statut :** Configuration TypeScript relativement bonne, quelques améliorations possibles.

**État actuel :**
- ✅ `noImplicitAny: true` activé dans `tsconfig.json`
- ✅ Pas de `@ts-ignore` trouvé dans le code (grep ne trouve que des commentaires normaux)
- ✅ Utilisation minimale de `any` (seulement dans les configurations chrono où nécessaire)
- ✅ Types bien définis pour la plupart des interfaces (`NLDResult`, `NLDRangeResult`, `NLDSettings`)
- ✅ Interface `ChronoConfiguration` définie localement dans `chrono.ts` (ligne 8-11)

**Améliorations possibles :**
- Activer `strict: true` dans `tsconfig.json` (actuellement seulement `noImplicitAny: true`)
- Vérifier tous les casts `as` et les remplacer par des types plus stricts si possible
- Améliorer le typage des configurations chrono si les types sont disponibles dans chrono-node
- Ajouter `strictNullChecks: true` pour une meilleure sécurité de type
- Ajouter `strictFunctionTypes: true` pour une meilleure vérification des signatures de fonctions

### 5.1. **JSDoc pour toutes les fonctions publiques** ❌ À FAIRE
**Problème actuel :**
- Manque de documentation JSDoc pour les méthodes publiques
- Seulement quelques commentaires basiques dans le code
- Pas de documentation des paramètres et valeurs de retour

**Amélioration :**
- Ajouter JSDoc complet pour toutes les méthodes publiques de `NaturalLanguageDates`
- Documenter les paramètres, types de retour, et exemples d'utilisation
- Générer une documentation API automatique

**Exemple :**
```typescript
/**
 * Parse une date en langage naturel et retourne un résultat formaté
 * @param dateString - La chaîne contenant la date en langage naturel (ex: "tomorrow", "in 2 days")
 * @param format - Le format de sortie Moment.js (ex: "YYYY-MM-DD")
 * @returns Un objet NLDResult contenant la date, un Moment cloné et la chaîne formatée
 * @example
 * const result = plugin.parse("tomorrow", "YYYY-MM-DD");
 * console.log(result.formattedString); // "2025-01-15"
 */
parse(dateString: string, format: string): NLDResult
```

### 5.2. **Refactoring des dépendances circulaires potentielles** ❌ À VÉRIFIER
**Problème actuel :**
- Risque de dépendances circulaires entre modules
- `main.ts` importe plusieurs modules qui pourraient avoir besoin de `main.ts`

**Amélioration :**
- Analyser les dépendances entre modules
- Extraire les interfaces communes dans un fichier `types.d.ts` dédié
- Utiliser des interfaces plutôt que des imports directs quand possible

---

## ✨ Fonctionnalités

### 6. **Support des fuseaux horaires**
**Fonctionnalité manquante :**
- Pas de gestion des fuseaux horaires
- Les dates sont toujours dans le fuseau local

**Amélioration :**
```typescript
// Ajouter dans settings.ts
timezone: string; // "UTC", "Europe/Paris", etc.

// Utiliser moment-timezone pour le support complet
```

### 7. **Support des dates relatives avancées** ✅ FAIT
**Statut :** Implémenté dans `parser.ts` avec des regex dynamiques multi-langues.

**Fonctionnalités implémentées :**
- ✅ Support pour "in 2 weeks and 3 days" via `regexRelativeCombined` (ligne 156)
- ✅ Support pour "next Monday at 3pm" via `regexWeekdayWithTime` (ligne 168)
- ✅ Fonctionne dans toutes les langues supportées avec traductions natives
- ✅ Gestion des combinaisons de durées (lignes 309-347)
- ✅ Parsing des jours de semaine avec heure (lignes 407-434)

**Exemples supportés :**
- `@in 2 weeks and 3 days` / `@dans 2 semaines et 3 jours`
- `@next Monday at 3pm` / `@prochain lundi à 15h`

### 8. **Rappels et événements**
**Nouvelle fonctionnalité :**
- Parser les dates avec rappels : "@tomorrow at 9am reminder"
- Intégration avec des plugins de calendrier Obsidian

### 9. **Support des plages de dates** ✅ FAIT
**Statut :** Implémenté dans `parser.ts` avec la méthode `getParsedDateRange()` et intégré dans `commands.ts`.

**Fonctionnalités implémentées :**
- ✅ Parser "from Monday to Friday" via `regexDateRange` (ligne 174)
- ✅ Parser "next week" comme plage (lignes 569-607)
- ✅ Génération de liste de dates pour les plages (`dateList` dans `NLDRangeResult`)
- ✅ Génération de liens multiples dans `commands.ts` (lignes 19-66)
- ✅ Support multi-langues avec traductions natives

**Exemples supportés :**
- `@from Monday to Friday` / `@de lundi à vendredi`
- `@next week` / `@semaine prochaine`

### 10. **Mode batch/parsing multiple**
**Nouvelle fonctionnalité :**
- Commande pour parser toutes les dates dans un document
- Remplacer toutes les occurrences d'un pattern

### 11. **Templates de dates**
**Nouvelle fonctionnalité :**
- Templates prédéfinis : "@meeting", "@deadline"
- Configuration de templates personnalisés

### 12. **Support des dates récurrentes**
**Nouvelle fonctionnalité :**
- Parser "every Monday"
- Parser "every 2 weeks"
- Générer des séries de dates

### 13. **Intégration avec Daily Notes**
**Amélioration :**
- Détection automatique du format de Daily Notes
- Support des formats personnalisés (pas seulement YYYY-MM-DD)
- Création automatique de notes manquantes avec template

### 14. **Suggestions contextuelles intelligentes** ✅ FAIT
**Statut :** Implémenté avec `HistoryManager` et `ContextAnalyzer`, intégré dans les settings.

**Fonctionnalités implémentées :**
- ✅ Apprentissage des patterns fréquents via `HistoryManager` (`history-manager.ts`)
  - Enregistrement des sélections (ligne 89)
  - Cache des suggestions les plus fréquentes (ligne 142)
  - Limite de taille avec nettoyage automatique (ligne 119)
- ✅ Suggestions basées sur l'historique (`getTopSuggestionsSync`, ligne 159)
- ✅ Suggestions basées sur le contexte via `ContextAnalyzer` (`context-analyzer.ts`)
  - Détection des dates dans ±10 lignes autour du curseur (ligne 155)
  - Patterns dynamiques multi-langues (ligne 32)
  - Cache temporaire pour performance (ligne 17)
- ✅ Settings pour activer/désactiver chaque fonctionnalité (`settings.ts`, lignes 40-42, 214-256)
- ✅ Support multi-langues pour la détection contextuelle

---

## ⚡ Performance

### 15. **Cache de parsing** ✅ FAIT
**Statut :** Implémenté dans `parser.ts` avec un système de cache intelligent incluant l'invalidation quotidienne automatique.

**Fonctionnalités implémentées :**
- ✅ Cache `Map<string, Date>` stockant les résultats parsés (ligne 50)
- ✅ Clé de cache incluant `selectedText`, `weekStartPreference` et le jour actuel pour l'invalidation automatique (lignes 291-296)
- ✅ Invalidation automatique quotidienne via `cacheDay` (lignes 308-313)
- ✅ Vérification du cache avant le parsing (lignes 319-323)
- ✅ Stockage des résultats via `cacheAndReturn()` (lignes 298-304)
- ✅ Réinitialisation automatique lors de la création d'un nouveau parser (constructeur, ligne 58-59)
- ✅ Gestion des caractères spéciaux : "tomorrow" et "tomorrow!!!" partagent la même clé de cache (texte nettoyé)
- ✅ Isolation des instances : retourne de nouvelles instances de Date pour éviter les références partagées

**Implémentation :**
```49:59:src/parser.ts
  // Cache for parsed dates
  private cache: Map<string, Date>;
  private cacheDay: number; // Day of year for cache invalidation

  constructor(languages: string[]) {
    this.languages = languages;
    this.chronos = getChronos(languages);
    this.initializeRegex();
    this.initializeKeywords();
    this.cache = new Map<string, Date>();
    this.cacheDay = this.getDayOfYear();
  }
```

**Avantages :**
- 🚀 Performance : Les expressions fréquentes sont mises en cache et réutilisées
- 🔄 Fiabilité : Tous les tests passent (95/95) - aucune régression
- 🎯 Invalidation intelligente : Le cache est automatiquement invalidé chaque jour
- 🔧 Simplicité : Solution simple et maintenable
- 🛡️ Isolation : Nouvelle instance de Date à chaque retour pour éviter les références partagées

### 16. **Lazy loading des langues** ❌ À FAIRE
**Problème actuel :**
- Toutes les langues activées sont chargées au démarrage du plugin
- Les parsers chrono sont initialisés même si non utilisés
- Impact sur le temps de démarrage avec plusieurs langues

**Amélioration :**
- Charger les parsers chrono seulement quand nécessaire (lazy loading)
- Initialiser les langues à la première utilisation
- Désactiver les langues non utilisées pour améliorer les performances
- Cache des parsers initialisés pour éviter les réinitialisations

**Implémentation suggérée :**
```typescript
// Dans parser.ts
private chronosCache: Map<string, Chrono[]> = new Map();

private getChronosForLanguage(lang: string): Chrono[] {
  if (!this.chronosCache.has(lang)) {
    this.chronosCache.set(lang, getChronos([lang]));
  }
  return this.chronosCache.get(lang)!;
}
```

### 17. **Debouncing des suggestions** ❌ À FAIRE
**Problème actuel :**
- Les suggestions sont recalculées à chaque frappe
- Pas de debouncing dans `DateSuggest.getSuggestions()`
- Calculs potentiellement coûteux (analyse de contexte, historique) à chaque frappe

**Amélioration :**
- Debounce les requêtes de suggestions pendant la frappe (200-300ms)
- Réduire les calculs inutiles
- Améliorer la réactivité de l'interface

**Implémentation suggérée :**
```typescript
// Dans date-suggest.ts
private debounceTimer: number | null = null;

getSuggestions(context: EditorSuggestContext): string[] {
  // Annuler le timer précédent
  if (this.debounceTimer) {
    clearTimeout(this.debounceTimer);
  }
  
  // Debounce de 250ms
  return new Promise((resolve) => {
    this.debounceTimer = window.setTimeout(() => {
      const suggestions = this.getDateSuggestions(context);
      resolve(suggestions.length ? suggestions : [context.query]);
    }, 250);
  });
}
```

### 17.1. **Optimisation du cache de contexte** 🔄 PARTIELLEMENT FAIT
**Statut :** Cache temporaire implémenté mais peut être optimisé.

**État actuel :**
- ✅ Cache temporaire de 5 secondes dans `ContextAnalyzer` (ligne 18)
- ✅ Nettoyage automatique du cache après timeout
- ⚠️ Cache par fichier + ligne, pourrait être plus intelligent

**Amélioration :**
- Utiliser un cache basé sur le hash du contenu du document plutôt que la ligne
- Invalider le cache seulement si le contenu a changé
- Réduire la taille du cache avec un LRU (Least Recently Used)

### 18. **Optimisation des regex** ✅ FAIT
**Statut :** Les regex sont compilées une seule fois dans `initializeRegex()` et stockées comme propriétés de classe.

**Implémentation :**
- ✅ Regex compilées dans le constructeur via `initializeRegex()` (ligne 52)
- ✅ Stockées comme propriétés de classe (lignes 38-42) :
  - `regexRelative` (ligne 150)
  - `regexRelativeCombined` (ligne 156)
  - `regexWeekday` (ligne 162)
  - `regexWeekdayWithTime` (ligne 168)
  - `regexDateRange` (ligne 174)
- ✅ Génération dynamique depuis les traductions multi-langues
- ✅ Réinitialisation lors du changement de langues via `resetParser()`

---

## 🎨 Expérience Utilisateur

### 19. **Prévisualisation en temps réel**
**Amélioration :**
- Afficher un tooltip avec la date formatée pendant la frappe
- Afficher la date dans plusieurs formats

### 20. **Raccourcis clavier personnalisables**
**Problème actuel :**
- Pas de raccourcis par défaut pour les commandes
- Pas de personnalisation dans les settings

**Amélioration :**
- Ajouter des raccourcis par défaut
- Permettre la personnalisation dans les settings

### 21. **Mode sombre pour le date picker**
**Amélioration :**
- Adapter le date picker au thème Obsidian
- Support des thèmes personnalisés

### 22. **Feedback visuel amélioré**
**Amélioration :**
- Animation lors de l'insertion de date
- Indicateur visuel quand une date est détectée
- Highlight des dates dans le document

### 23. **Undo/Redo intelligent**
**Amélioration :**
- Grouper les opérations de remplacement dans un seul undo
- Préserver l'historique lors des remplacements multiples

### 24. **Support des formats de date alternatifs**
**Amélioration :**
- Permettre plusieurs formats de sortie
- Format conditionnel selon le contexte
- Support des formats locaux (DD/MM/YYYY vs MM/DD/YYYY)

---

## 🌍 Internationalisation

### 25. **Plus de langues** 🔄 PARTIELLEMENT FAIT
**Statut :** L'espagnol et l'italien ont été ajoutés. Le russe et le chinois restent à faire.

**Langues actuellement supportées :**
- ✅ Anglais (en) - **Support complet**
- ✅ Français (fr) - **Support complet**
- 🔄 Allemand (de) - **Partiellement supporté** (voir explication ci-dessous)
- ✅ Japonais (ja) - **Support complet**
- 🔄 Néerlandais (nl) - **En développement** (voir explication ci-dessous)
- 🔄 Portugais (pt) - **Partiellement supporté** (voir explication ci-dessous)
- ✅ Espagnol (es) - **AJOUTÉ - Support complet**
- ✅ Italien (it) - **AJOUTÉ - Support complet**

**Explication du statut "partiellement supporté" / "en développement" :**

Les fichiers de traduction du plugin sont **complets** pour toutes les langues (de, pt, nl). Cependant, ces langues sont marquées comme partiellement supportées car :

1. **Dépendance à chrono-node :** Le plugin utilise la bibliothèque `chrono-node` pour le parsing avancé des dates. Cette bibliothèque peut avoir un support limité ou incomplet pour certaines langues (de, pt, nl).

2. **Fonctionnalités de base vs avancées :**
   - ✅ **Fonctionnel :** Les expressions simples fonctionnent grâce aux traductions du plugin (ex: `@demain`, `@in 2 Minuten`, `@over 2 minuten`)
   - ⚠️ **Limité :** Certaines expressions complexes peuvent ne pas être parsées correctement par chrono-node pour ces langues
   - ⚠️ **En développement :** Le néerlandais (nl) nécessite probablement plus de tests et d'ajustements

3. **Ce qui fonctionne :**
   - Toutes les traductions de base sont présentes dans les fichiers `src/lang/de.ts`, `src/lang/pt.ts`, `src/lang/nl.ts`
   - Les regex dynamiques génèrent correctement les patterns pour ces langues
   - Les expressions simples et relatives fonctionnent

4. **Ce qui peut être limité :**
   - Certaines expressions complexes peuvent ne pas être reconnues par chrono-node
   - Le parsing de dates absolues peut varier en qualité selon la langue

**À faire :**
- ❌ Russe
- ❌ Chinois
- ❌ Support des variantes régionales (fr-CA, en-GB, etc.)
- 🔄 Améliorer le support chrono-node pour de, pt, nl (ou créer des parsers personnalisés)

### 26. **Détection automatique de langue**
**Amélioration :**
- Détecter la langue du document
- Adapter les suggestions à la langue détectée
- Fallback intelligent entre langues

### 27. **Localisation complète de l'interface**
**Problème actuel :**
- Interface en anglais uniquement
- Pas de traduction des settings

**Amélioration :**
- Utiliser le système i18n d'Obsidian
- Traduire tous les textes de l'interface

### 28. **Support des calendriers non-grégoriens**
**Nouvelle fonctionnalité :**
- Support du calendrier lunaire
- Support d'autres calendriers culturels

---

## 🧪 Tests & Qualité

### 29. **Suite de tests unitaires** ✅ COMPLET - TOUS LES TESTS PASSENT
**Statut :** Les tests sont maintenant fonctionnels ! Configuration corrigée, **95 tests sur 95 passent (100% de réussite)**.

**Ce qui existe :**
- ✅ Fichier de tests `tests/parser.test.ts` avec ~700 lignes de tests complets
  - Tests pour toutes les langues supportées (en, fr, de, pt, nl, es, it, ja)
  - Tests pour expressions de base (today, tomorrow, yesterday, now)
  - Tests pour expressions relatives (in 2 days, in 2 weeks)
  - Tests pour combinaisons (in 2 weeks and 3 days)
  - Tests pour jours de semaine (next Monday, next Monday at 3pm)
  - Tests pour plages de dates (from Monday to Friday, next week)
  - Tests de cas limites et gestion d'erreurs
- ✅ Helpers de test (`tests/test-helpers.ts`) avec fonctions utilitaires
- ✅ Mocks pour Obsidian (`tests/__mocks__/`)
- ✅ **Configuration vitest corrigée** (`vitest.config.ts`)
- ✅ **Setup des tests corrigé** (`tests/setup.ts`) avec initialisation de `window.moment`
- ✅ **Imports corrigés** : utilisation de `import moment from 'moment'` au lieu de `import * as moment`

**Corrections apportées (Janvier 2025) :**
- ✅ Correction de l'import de moment dans `setup.ts` et les tests
- ✅ Correction de l'initialisation de `window.moment` pour l'environnement de test
- ✅ Correction du parsing de "next week" et "semaine prochaine" (ordre inverse)
- ✅ Correction du parsing de "next month" et "next year"
- ✅ Ajout de `expectPastDate` dans les imports des tests
- ✅ **Correction du parsing des expressions combinées avec 2 unités** (changement de `parts.length > 2` en `parts.length >= 2`)
- ✅ **Correction de la regex pour supporter les caractères accentués** (changement de `\w+` en `[^\s]+` pour les unités comme "días")

**Résultats actuels :**
- ✅ **95 tests passent** sur 95 (100% de réussite)
- ✅ **Tous les tests sont maintenant fonctionnels !**

**Amélioration future :**
- Ajouter des tests pour les commandes
- Tests d'intégration pour les commandes
- Tests de régression automatisés
- Tests de performance/benchmarks

### 30. **Tests de performance**
**Amélioration :**
- Benchmark des opérations de parsing
- Profiling pour identifier les goulots d'étranglement

### 31. **Linting amélioré**
**Problème actuel :**
- ESLint configuré mais peut-être pas utilisé activement
- Pas de Prettier dans le workflow

**Amélioration :**
- Pre-commit hooks avec linting
- CI/CD avec vérifications automatiques

### 32. **Validation des formats** ✅ FAIT
**Statut :** Implémenté avec validation en temps réel et prévisualisation dans les settings.

**Implémentation :**
- ✅ Fonction `validateMomentFormat()` dans `src/utils.ts` (lignes 202-235)
  - Valide les formats Moment.js avec test réel
  - Retourne un objet avec `valid`, `error` optionnel et `preview` optionnel
  - Limite la longueur des formats (100 caractères max)
  - Détecte les caractères dangereux pour éviter les injections
- ✅ Validation en temps réel dans les settings (`src/settings.ts`)
  - Validation pour le format de date (lignes 104-120)
  - Validation pour le format de temps (lignes 145-161)
  - Prévisualisation du format avec date d'exemple
  - Affichage d'erreurs claires si le format est invalide
  - Les formats invalides ne sont pas sauvegardés
- ✅ Validation dans le modal date-picker (`src/modals/date-picker.ts`, lignes 195-220)
  - Validation du format `modalMomentFormat` avec prévisualisation
  - Protection contre les formats invalides lors de l'utilisation
- ✅ Validation dans les méthodes de parsing (`src/main.ts`)
  - `parse()` : valide le format avant utilisation (lignes 285-323)
  - `parseDate()` : valide les formats de date et temps (lignes 329-376)
  - `parseTime()` : valide le format de temps (lignes 389-407)
  - Utilisation de formats par défaut en cas d'erreur

**Résultat :**
- ✅ Formats invalides détectés immédiatement
- ✅ Prévisualisation en temps réel dans les settings
- ✅ Protection contre les erreurs silencieuses
- ✅ Protection contre les injections dans les formats

### 32.1. **Gestion des erreurs de parsing silencieuses** ❌ À FAIRE
**Problème actuel :**
- Certaines erreurs de parsing sont ignorées silencieusement
- Pas de feedback utilisateur quand une date ne peut pas être parsée
- `getParseCommand` retourne simplement sans action si parsing échoue (ligne 71-77)

**Amélioration :**
- Afficher une notification Obsidian si le parsing échoue
- Logger les erreurs de parsing pour le débogage
- Option pour afficher un message d'erreur dans l'éditeur
- Mode verbose pour les développeurs

---

## 📚 Documentation

### 33. **Documentation API complète** ✅ FAIT
**Statut :** Documentation API professionnelle complète en anglais avec JSDoc et guide développeur.

**Implémentation :**
- ✅ JSDoc complet en anglais pour toutes les méthodes publiques (`src/main.ts`, `src/parser.ts`)
  - `parse()` : Documentation complète avec exemples
  - `parseDate()` : Documentation avec détection automatique du temps
  - `parseDateRange()` : Documentation avec exemples de plages
  - `parseTime()` : Documentation pour parsing de temps
  - `hasTimeComponent()` : Documentation pour détection de temps
  - Méthodes du parser : `getParsedDate()`, `getParsedDateRange()`, `hasTimeComponent()`
- ✅ JSDoc pour toutes les interfaces et types exportés (`src/parser.ts`, `src/settings.ts`)
  - `NLDResult` : Interface documentée avec exemples
  - `NLDRangeResult` : Interface documentée avec exemples
  - `NLDSettings` : Interface documentée
  - `DayOfWeek` : Type documenté
- ✅ Fichier `API.md` professionnel créé avec :
  - Table des matières complète
  - Guide de démarrage pour développeurs
  - Documentation complète de toutes les méthodes publiques
  - Exemples de code pour chaque méthode
  - Documentation des types et interfaces
  - Section d'exemples avancés
  - Guide d'intégration avec d'autres plugins
  - Référence des formats Moment.js
- ✅ Section API ajoutée dans `README.md` :
  - Lien vers la documentation complète
  - Exemples de démarrage rapide
  - Support TypeScript documenté
  - Exemples de code pratiques

**Fichiers créés/modifiés :**
- `API.md` - Documentation API complète (nouveau fichier)
- `src/main.ts` - JSDoc ajouté pour toutes les méthodes publiques
- `src/parser.ts` - JSDoc ajouté pour interfaces et méthodes publiques
- `src/settings.ts` - JSDoc ajouté pour types et interfaces
- `README.md` - Section API ajoutée avec exemples

**Résultat :**
- ✅ Documentation professionnelle en anglais
- ✅ JSDoc complet pour IntelliSense et autocomplétion
- ✅ Guide complet pour développeurs de plugins tiers
- ✅ Exemples de code pratiques et avancés
- ✅ Support TypeScript documenté

### 34. **Guide utilisateur amélioré**
**Amélioration :**
- Exemples interactifs
- Vidéos de démonstration
- FAQ complète
- Guide de migration depuis l'ancien plugin

### 35. **Documentation des formats**
**Amélioration :**
- Référence complète des formats supportés
- Exemples pour chaque langue
- Guide de formatage personnalisé

---

## 🔒 Sécurité & Robustesse

### 36. **Validation des entrées** ✅ FAIT
**Statut :** Implémenté avec sanitization complète des entrées utilisateur et validation des paramètres URI.

**Implémentation :**
- ✅ Fonction `sanitizeInput()` dans `src/utils.ts` (lignes 237-260)
  - Limite la longueur des entrées (200 caractères par défaut, configurable)
  - Valide les caractères autorisés (lettres, chiffres, espaces, tirets, caractères accentués, ponctuation)
  - Rejette les entrées vides ou null
  - Protection contre les injections de caractères malveillants
- ✅ Fonction `validateUriParam()` dans `src/utils.ts` (lignes 262-265)
  - Validation spécialisée pour les paramètres URI
  - Limite de 100 caractères par défaut pour les paramètres URI
- ✅ Validation dans `actionHandler()` (`src/main.ts`, lignes 350-365)
  - Validation et sanitization du paramètre `day` avant utilisation
  - Logging des tentatives d'injection
  - Retour anticipé si le paramètre est invalide
- ✅ Validation dans toutes les méthodes de parsing (`src/main.ts`)
  - `parse()` : sanitization de l'entrée utilisateur (lignes 285-323)
  - `parseDate()` : validation de l'entrée (lignes 329-376)
  - `parseTime()` : validation de l'entrée (lignes 389-407)
  - `parseDateRange()` : validation de l'entrée (lignes 382-395)
  - Retour de dates invalides plutôt que de planter en cas d'entrée invalide

**Résultat :**
- ✅ Protection contre les injections dans les formats Moment.js
- ✅ Validation stricte des paramètres URI
- ✅ Protection contre les entrées malveillantes
- ✅ Limitation de la longueur des chaînes d'entrée
- ✅ Validation des caractères spéciaux
- ✅ Gestion gracieuse des erreurs avec logging

### 36.1. **Protection contre les attaques par déni de service** ❌ À FAIRE
**Problème actuel :**
- Pas de limite sur la taille des entrées
- Expressions regex complexes peuvent être exploitées (ReDoS)
- Pas de timeout sur les opérations de parsing

**Amélioration :**
- Limiter la longueur des chaînes d'entrée (ex: 200 caractères max)
- Timeout sur les opérations de parsing longues
- Validation des patterns regex pour éviter ReDoS
- Limitation du nombre de suggestions retournées

### 37. **Gestion des edge cases** 🔄 PARTIELLEMENT FAIT
**Statut :** Certains edge cases sont gérés, mais d'autres peuvent être améliorés.

**État actuel :**
- ✅ Moment.js gère automatiquement les années bissextiles
- ✅ Les dates invalides retournent `Invalid date` (ligne 208 dans main.ts)
- ⚠️ Pas de gestion explicite des changements d'heure (DST)
- ⚠️ Pas de gestion des dates très anciennes ou très futures

**Amélioration :**
- Gérer explicitement les changements d'heure (DST) avec moment-timezone
- Valider les plages de dates raisonnables (ex: 1900-2100)
- Gérer les dates invalides avec des messages d'erreur clairs
- Gérer les cas limites comme "in 0 days" ou "in -1 days"
- Gérer les expressions ambiguës (ex: "next week" le dimanche)

**Cas limites à gérer :**
- Dates très anciennes (< 1900) ou très futures (> 2100)
- Expressions avec valeurs négatives ("in -1 day")
- Expressions avec zéro ("in 0 days")
- Plages de dates invalides ("from Friday to Monday" dans le passé)
- Changements de mois/année lors de calculs relatifs

### 38. **Fallbacks robustes** ✅ PARTIELLEMENT FAIT
**Statut :** Des fallbacks existent mais peuvent être améliorés.

**État actuel :**
- ✅ Fallback vers l'anglais si l'initialisation du parser échoue (ligne 119-134 dans main.ts)
- ✅ Fallback vers l'anglais si aucune langue ne peut être initialisée (ligne 56-75 dans chrono.ts)
- ✅ Notifications utilisateur pour les erreurs critiques
- ⚠️ Pas de mode dégradé si chrono-node échoue complètement
- ⚠️ Pas de fallback pour les expressions non parsées

**Amélioration :**
- Mode dégradé avec parsing basique si chrono-node échoue
- Fallback vers parsing manuel pour expressions simples
- Cache des fallbacks pour éviter les recalculs
- Option pour désactiver chrono-node et utiliser uniquement le parsing manuel
- Fallback intelligent entre langues (essayer toutes les langues activées)

**Implémentation suggérée :**
```typescript
// Mode dégradé dans parser.ts
private fallbackParse(text: string): Date {
  // Parsing basique sans chrono-node
  const lower = text.toLowerCase().trim();
  if (lower === "today" || lower === "aujourd'hui") {
    return new Date();
  }
  // ... autres cas simples
  return new Date(); // Dernier recours
}
```

### 39. **Migration des settings** ❌ À FAIRE
**Problème actuel :**
- Pas de système de migration automatique des settings
- Pas de validation des settings au chargement
- Pas de versioning des settings
- Risque de corruption des settings

**Amélioration :**
- Système de migration automatique des settings avec versioning
- Validation des settings au chargement
- Reset aux valeurs par défaut si corrompus
- Backup automatique des settings avant migration
- Migration progressive (v0.8 → v0.9 → v1.0)

**Implémentation suggérée :**
```typescript
// Dans settings.ts
interface NLDSettingsV1 extends NLDSettings {
  _version?: number; // Version des settings
}

async loadSettings(): Promise<void> {
  const loadedData = await this.loadData();
  const version = loadedData._version || 0;
  
  // Migration selon la version
  if (version < 1) {
    loadedData = migrateFromV0ToV1(loadedData);
  }
  
  // Validation
  const validated = validateSettings(loadedData);
  this.settings = Object.assign({}, DEFAULT_SETTINGS, validated);
}
```

### 39.1. **Validation des settings au démarrage** ❌ À FAIRE
**Problème actuel :**
- Pas de validation des settings chargés
- Settings corrompus peuvent causer des erreurs silencieuses
- Pas de récupération automatique

**Amélioration :**
- Valider tous les champs des settings au chargement
- Vérifier les types et plages de valeurs
- Réinitialiser les champs invalides aux valeurs par défaut
- Logger les problèmes de validation pour le débogage

### 40. **Logging structuré** ✅ FAIT
**Statut :** Système de logging structuré implémenté.

**Implémentation :**
- ✅ Système de logging avec niveaux (debug, info, warn, error) dans `src/logger.ts`
- ✅ Format structuré avec timestamp et contexte optionnel
- ✅ Utilisation cohérente dans tout le plugin (`main.ts`, `chrono.ts`, `parser.ts`)
- ✅ Compatible avec Obsidian (utilise console.*)

**Note :** Option pour activer/désactiver les logs peut être ajoutée plus tard dans les settings si nécessaire.

---

## 🔌 Intégrations

### 41. **API publique améliorée** 🔄 PARTIELLEMENT FAIT
**Statut :** L'API de base existe mais peut être améliorée.

**État actuel :**
- ✅ Parser exposé publiquement (`plugin.parser`)
- ✅ Méthodes de parsing publiques (`parse`, `parseDate`, `parseDateRange`)
- ✅ Settings accessibles publiquement
- ⚠️ Pas de documentation complète de l'API
- ⚠️ Pas de types TypeScript exportés pour les utilisateurs
- ⚠️ Pas d'événements ou callbacks pour les plugins tiers

**Amélioration :**
- Exposer plus de méthodes publiques (ex: `getAvailableLanguages()`, `isLanguageEnabled()`)
- Documentation complète de l'API (voir #33)
- Types TypeScript exportés dans un fichier `api.d.ts`
- Événements pour notifier les changements (ex: `onDateParsed`, `onLanguageChanged`)
- Callbacks pour personnaliser le comportement
- Exemples d'utilisation dans la documentation

**Méthodes à ajouter :**
```typescript
// Dans main.ts
public getAvailableLanguages(): string[] {
  return ['en', 'fr', 'de', 'ja', 'nl', 'pt', 'es', 'it'];
}

public isLanguageEnabled(lang: string): boolean {
  return this.settings.languages.includes(lang);
}

public on(event: 'dateParsed' | 'languageChanged', callback: Function): void {
  // Système d'événements
}
```

### 42. **Intégration avec Templater**
**Amélioration :**
- Fonctions helper pour Templater
- Support des dates dans les templates

### 43. **Intégration avec Calendar**
**Amélioration :**
- Créer des événements directement depuis les dates parsées
- Synchronisation bidirectionnelle

### 44. **Webhooks/API externe**
**Nouvelle fonctionnalité :**
- Envoyer des dates parsées à des services externes
- Intégration avec Google Calendar, Outlook, etc.

---

## 🎯 Priorités Suggérées

### 🔴 Haute Priorité
1. **Fixer les tests unitaires** (#29) ✅ **95/95 PASSENT** - **TOUS LES TESTS PASSENT**
2. **Refactoring du système de langues** (#1) 🔄 Partiellement fait
3. **Exposer le parser publiquement** (#2) ✅ **FAIT**
4. **Cache de parsing** (#15) ✅ **FAIT**
5. **Validation des formats** (#32) ✅ **FAIT** - **Important pour la stabilité**
6. **Validation des entrées** (#36) ✅ **FAIT** - **Important pour la sécurité**
7. **Migration des settings** (#39) ❌ À faire - **Important pour la compatibilité**

### 🟡 Priorité Moyenne
8. **Gestion d'erreurs améliorée** (#3) ✅ **FAIT**
9. **Séparation des responsabilités** (#4) ✅ **FAIT**
10. **Support des dates relatives avancées** (#7) ✅ **FAIT**
11. **Optimisation des regex** (#18) ✅ **FAIT**
12. **Debouncing des suggestions** (#17) ❌ À faire - **Améliore les performances**
13. **Lazy loading des langues** (#16) ❌ À faire - **Améliore le temps de démarrage**
14. **Raccourcis clavier personnalisables** (#20) ❌ À faire
15. **Documentation API** (#33) ✅ **FAIT** - **Important pour les développeurs**
16. **Support des fuseaux horaires** (#6) ❌ À faire

### 🟢 Basse Priorité
17. **Plus de langues** (#25) 🔄 Partiellement fait (es, it ajoutés)
18. **Templates de dates** (#11) ❌ À faire
19. **Support des plages de dates** (#9) ✅ **FAIT**
20. **Mode batch** (#10) ❌ À faire
21. **JSDoc pour toutes les fonctions** (#5.1) ❌ À faire
22. **Tests d'intégration** (#46) ❌ À faire
23. **Optimisation de la mémoire** (#45) ❌ À faire

---

## 📝 Notes Finales

Ce document liste les améliorations potentielles identifiées après une analyse complète du code. Les priorités peuvent être ajustées selon les besoins des utilisateurs et les retours de la communauté.

**Recommandation :** Commencer par les améliorations de haute priorité qui améliorent la stabilité et la maintenabilité du code, puis progresser vers les nouvelles fonctionnalités.

---

## 📈 Résumé des Améliorations Implémentées

**Dernière mise à jour :** Janvier 2025

### ✅ Complètement Implémentées
- **#2** - Exposer le parser publiquement
- **#3** - Gestion d'erreurs améliorée (logging structuré, notifications Obsidian, NLDParseError)
- **#4** - Séparation des responsabilités (TimeDetector, DateFormatter)
- **#7** - Support des dates relatives avancées (combinaisons, jours avec heure)
- **#9** - Support des plages de dates (from/to, next week)
- **#14** - Suggestions contextuelles intelligentes (historique + contexte)
- **#15** - Cache de parsing (invalidation quotidienne automatique)
- **#18** - Optimisation des regex (compilation unique, dynamique)
- **#29** - Suite de tests unitaires (95/95 tests passent - 100% de réussite) ✅ **COMPLET**
- **#32** - Validation des formats (validation en temps réel avec prévisualisation) ✅ **FAIT**
- **#33** - Documentation API complète (JSDoc + API.md professionnel en anglais) ✅ **FAIT**
- **#36** - Validation des entrées (sanitization complète et protection contre les injections) ✅ **FAIT**
- **#40** - Logging structuré (système de logging avec niveaux)
- **#56** - Support complet des expressions passées (Past Expressions) ✅ **TERMINÉ** (Janvier 2025)
- **#57** - Optimisation du formatage : omission intelligente de la date ✅ **TERMINÉ** (Janvier 2025)

### 🔄 Partiellement Implémentées
- **#1** - Refactoring du système de langues (synchronisation automatique ajoutée, mais double système persiste)
- **#25** - Plus de langues (espagnol et italien ajoutés, russe et chinois restent)

### ❌ Restent à Faire
- Toutes les autres améliorations listées dans ce document

---

## 🐛 Problèmes Critiques Identifiés (Janvier 2025)

### 1. **Tests fonctionnent maintenant** ✅ RÉSOLU COMPLÈTEMENT (Janvier 2025)
**Statut :** Les tests sont maintenant fonctionnels ! **95 tests sur 95 passent (100% de réussite)**.

**Corrections apportées :**
- ✅ Configuration `vitest.config.ts` complète avec alias pour Obsidian
- ✅ Configuration `tests/setup.ts` avec initialisation correcte de `window.moment`
- ✅ Correction des imports : utilisation de `import moment from 'moment'` (import par défaut)
- ✅ Correction du parsing de "next week" et "semaine prochaine" (ordre inverse)
- ✅ Correction du parsing de "next month" et "next year"
- ✅ Ajout de `expectPastDate` dans les imports
- ✅ **Correction du parsing des expressions combinées avec 2 unités** (changement de `parts.length > 2` en `parts.length >= 2` dans `parser.ts`)
- ✅ **Correction de la regex pour supporter les caractères accentués** (changement de `/^(\d+)\s+(\w+)$/i` en `/^(\d+)\s+([^\s]+)$/i` pour les unités comme "días")

**Tous les tests passent maintenant !** ✅

---

## 📊 Statut Global du Code (Analyse Complète - Janvier 2025)

### Points Positifs ✅
- Code bien structuré avec séparation des responsabilités ✅ **AMÉLIORÉ**
- Support multi-langues complet (8 langues)
- Fonctionnalités avancées implémentées (plages, combinaisons, suggestions intelligentes)
- Gestion d'erreurs améliorée avec logging structuré et notifications Obsidian ✅ **AMÉLIORÉ**
- Types TypeScript bien définis
- Regex optimisées (compilation unique)
- Architecture modulaire (TimeDetector, DateFormatter, Logger, Errors) ✅ **NOUVEAU**
- Tests complets écrits et **tous les tests passent (95/95 - 100%)** ✅

### Points à Améliorer ⚠️
- Double système de langues (flags + array) - **#1**
- Pas de support fuseaux horaires - **#6**
- Pas de debouncing des suggestions - **#17**
- Manque de documentation JSDoc - **#5.1, #33**
- Pas de migration automatique des settings - **#39**
- Pas de lazy loading des langues - **#16**
- Pas de protection contre ReDoS - **#36.1**
- Pas de gestion explicite des edge cases (DST, dates limites) - **#37**
- Pas de tests d'intégration - **#46**
- Pas d'optimisation de la mémoire - **#45**

---

## 🆕 Nouvelles Améliorations Identifiées (Janvier 2025)

### 56. **Support complet des expressions passées (Past Expressions)** ✅ TERMINÉ
**Statut :** Implémenté avec support complet dans toutes les langues et suggestions intelligentes.

**Problème initial :**
- Les expressions passées comme "il y a 3 min" fonctionnaient pour le parsing mais n'apparaissaient pas dans les suggestions
- Manquait les traductions `minutesago` et `hoursago` dans tous les fichiers de langue
- Le parser ne gérait que "ago" en anglais, pas les autres langues

**Implémentation :**
- ✅ Ajout des traductions `minutesago` et `hoursago` dans toutes les langues (fr, en, de, pt, nl, es, it, ja)
  - Français : "il y a %{timeDelta} minutes/heures"
  - Anglais : "%{timeDelta} minutes/hours ago"
  - Allemand : "vor %{timeDelta} Minuten/Stunden"
  - Portugais : "há %{timeDelta} minutos/horas"
  - Néerlandais : "%{timeDelta} minuten/uren geleden"
  - Espagnol : "hace %{timeDelta} minutos/horas"
  - Italien : "%{timeDelta} minuti/ore fa"
  - Japonais : "%{timeDelta}分前/%{timeDelta}時間前"
- ✅ Amélioration du parser pour gérer "il y a X minutes/heures" dans toutes les langues (`src/parser.ts`)
  - Génération dynamique de regex depuis les traductions
  - Support multi-langues pour toutes les expressions passées
  - Fonctionne avec "il y a 3 min", "vor 2 Stunden", "hace 5 minutos", etc.
- ✅ Ajout des suggestions `minutesago` et `hoursago` dans `date-suggest.ts`
  - Les suggestions incluent maintenant les expressions passées
  - Quand vous tapez "3", vous voyez "il y a 3 minutes", "il y a 3 heures", etc.

**Fichiers modifiés :**
- `src/lang/*.ts` - Ajout des traductions `minutesago` et `hoursago`
- `src/parser.ts` - Amélioration du parsing des expressions passées multi-langues
- `src/suggest/date-suggest.ts` - Ajout des suggestions pour expressions passées

**Résultat :**
- ✅ Toutes les expressions passées fonctionnent dans toutes les langues
- ✅ Les suggestions incluent maintenant les expressions passées
- ✅ Parsing robuste et multi-langues

### 57. **Optimisation du formatage : omission intelligente de la date** ✅ TERMINÉ
**Statut :** Implémenté avec détection automatique des expressions relatives courtes.

**Problème initial :**
- Quand on tape "@dans 15 min", le résultat était `[[2024-01-15]] 14:30`
- C'est redondant car on sait que c'est aujourd'hui
- L'affichage était moins lisible avec la date complète

**Implémentation :**
- ✅ Fonction helper `shouldOmitDateForShortRelative()` créée dans `src/utils.ts`
  - Détecte les expressions relatives courtes (minutes/heures) dans toutes les langues
  - Génère dynamiquement des patterns regex depuis les traductions
  - Fonctionne avec toutes les langues supportées
- ✅ Logique d'optimisation dans `src/commands.ts`
  - Détecte si c'est aujourd'hui ET si c'est une expression relative courte
  - Affiche seulement l'heure si les conditions sont remplies
- ✅ Logique d'optimisation dans `src/suggest/date-suggest.ts`
  - Même logique appliquée aux suggestions
  - Cohérence entre commandes et suggestions

**Fichiers modifiés :**
- `src/utils.ts` - Fonction helper `shouldOmitDateForShortRelative()`
- `src/commands.ts` - Logique d'optimisation pour le formatage
- `src/suggest/date-suggest.ts` - Logique d'optimisation pour les suggestions

**Résultats attendus :**
- `@dans 15 min` → `14:30` (au lieu de `[[2024-01-15]] 14:30`)
- `@in 2 hours` → `16:30` (au lieu de `[[2024-01-15]] 16:30`)
- `@dans 2 jours` → `[[2024-01-17]]` (comportement inchangé, car ce n'est pas aujourd'hui)
- `@demain à 14h` → `[[2024-01-16]] 14:00` (comportement inchangé, car ce n'est pas aujourd'hui)

**Avantages :**
- ✅ Affichage plus propre et lisible pour les expressions courtes
- ✅ Moins de redondance dans les liens
- ✅ Comportement intelligent qui s'adapte au contexte
- ✅ Fonctionne dans toutes les langues supportées

### 45. **Optimisation de la mémoire** ✅ TERMINÉ
**Problème actuel :**
- Cache de parsing peut grandir indéfiniment (pas de limite de taille)
- Cache de contexte utilise un timeout mais pas de limite de taille
- Historique limité à 100 entrées mais pas de nettoyage périodique

**Amélioration :**
- ✅ Limiter la taille du cache de parsing (500 entrées max avec LRU)
- ✅ Nettoyage périodique des caches inutilisés
- ✅ Limite de mémoire pour l'historique (nettoyage périodique toutes les 5 minutes)
- ✅ Monitoring de l'utilisation mémoire (logging toutes les 10 minutes)

**Implémentation :**
- Création d'une classe `LRUCache` pour gérer les caches avec limite de taille
- Cache de parsing : LRU avec 500 entrées max
- Cache de contexte : LRU avec 200 entrées max + nettoyage toutes les 30 secondes
- Historique : nettoyage périodique toutes les 5 minutes
- Monitoring : logging automatique des statistiques des caches toutes les 10 minutes

### 46. **Tests d'intégration** ✅ TERMINÉ
**Problème actuel :**
- Seulement des tests unitaires pour le parser
- Pas de tests d'intégration pour les commandes
- Pas de tests pour l'interface utilisateur (date picker, suggestions)

**Amélioration :**
- ✅ Tests d'intégration pour les commandes (`getParseCommand`, etc.)
- ✅ Tests pour le date picker modal
- ✅ Tests pour le système de suggestions
- ✅ Tests end-to-end avec Obsidian mocké

**Implémentation :**
- **commands.test.ts** : Tests d'intégration pour toutes les commandes
  - `getParseCommand` avec différents modes (replace, link, clean, time)
  - Gestion des plages de dates
  - Gestion des dates avec composant temporel
  - `getNowCommand`, `getCurrentDateCommand`, `getCurrentTimeCommand`
  - Gestion des erreurs et cas limites
  
- **date-picker.test.ts** : Tests pour le modal de sélection de date
  - Initialisation et détection du mode sombre
  - Rendu du calendrier et des boutons rapides
  - Sélection de dates et mise à jour de l'input
  - Navigation par mois/année
  - Raccourcis clavier
  - Insertion de dates formatées
  
- **date-suggest.test.ts** : Tests pour le système de suggestions
  - Génération de suggestions basiques
  - Suggestions intelligentes (historique + contexte)
  - Support multilingue
  - Suggestions temporelles et relatives
  - Enregistrement des sélections dans l'historique
  
- **Mocks améliorés** : Mock d'Obsidian étendu pour supporter Modal, EditorSuggest, Setting, etc.

### 47. **Amélioration de l'accessibilité** ❌ À FAIRE
**Problème actuel :**
- Pas de support clavier complet pour le date picker
- Pas d'ARIA labels pour les éléments interactifs
- Pas de support pour les lecteurs d'écran

**Amélioration :**
- Support clavier complet (Tab, Enter, Escape)
- ARIA labels pour tous les éléments interactifs
- Support pour les lecteurs d'écran
- Contraste des couleurs respectant WCAG

### 48. **Gestion des erreurs de réseau/storage** ❌ À FAIRE
**Problème actuel :**
- Pas de gestion d'erreur si le vault est en lecture seule
- Pas de gestion d'erreur si le stockage de l'historique échoue
- Erreurs silencieuses dans `HistoryManager.saveHistory()` (ligne 64)

**Amélioration :**
- Vérifier si le vault est en écriture avant de sauvegarder
- Gérer les erreurs de stockage gracieusement
- Notifier l'utilisateur si la sauvegarde échoue
- Mode dégradé si le stockage n'est pas disponible

### 49. **Support des formats de date personnalisés par langue** ❌ À FAIRE
**Problème actuel :**
- Un seul format de date global pour toutes les langues
- Pas de support des formats locaux (DD/MM/YYYY vs MM/DD/YYYY)

**Amélioration :**
- Format de date par langue dans les settings
- Détection automatique du format préféré selon la langue
- Support des formats locaux (DD/MM/YYYY pour FR, MM/DD/YYYY pour EN-US)

### 50. **Optimisation des performances du parsing** ❌ À FAIRE
**Problème actuel :**
- Parsing séquentiel de toutes les langues activées
- Pas de parallélisation possible
- Regex complexes peuvent être lentes pour de longues chaînes

**Amélioration :**
- Parsing parallèle des langues (Web Workers si disponible)
- Optimisation des regex (utiliser des regex plus simples quand possible)
- Early exit si une langue trouve un match parfait
- Profiling pour identifier les goulots d'étranglement

### 51. **Support des expressions de date complexes** ❌ À FAIRE
**Problème actuel :**
- Pas de support pour "the 15th of next month"
- Pas de support pour "last day of month"
- Pas de support pour "first Monday of month"

**Amélioration :**
- Parser "the Xth of next month"
- Parser "last day of month"
- Parser "first/last weekday of month"
- Support multi-langues pour ces expressions

### 52. **Amélioration de l'interface du date picker** ✅ TERMINÉ
**Problème actuel :**
- Interface basique sans calendrier visuel
- Pas de navigation par mois/année
- Pas de sélection rapide de dates courantes

**Amélioration :**
- ✅ Calendrier visuel dans le modal avec grille de dates
- ✅ Navigation par mois/année (boutons précédent/suivant + sélecteurs dropdown)
- ✅ Boutons rapides (Today, Tomorrow, Yesterday, Next Week, Next Month, Next Year)
- ✅ Support du mode sombre avec détection automatique et adaptation des couleurs
- ✅ Raccourcis clavier pour navigation (flèches, Home, Escape)

**Implémentation :**
- Calendrier visuel avec grille 7x7 affichant les jours du mois
- Navigation intuitive avec boutons et sélecteurs d'année/mois
- Boutons rapides traduits selon la langue principale du plugin
- Styles CSS adaptatifs pour le mode sombre/clair
- Raccourcis clavier : ←/→ (mois), ↑/↓ (mois), Home (aujourd'hui), Escape (fermer)
- Conservation de toutes les fonctionnalités existantes (format personnalisé, lien, saisie manuelle)

### 53. **Support des expressions de temps relatives complexes** ❌ À FAIRE
**Problème actuel :**
- Support limité pour "in 2 hours and 30 minutes"
- Pas de support pour "at noon", "at midnight"
- Pas de support pour "end of day", "start of day"

**Amélioration :**
- Parser "in X hours and Y minutes" (déjà partiellement fait)
- Parser "at noon", "at midnight" dans toutes les langues
- Parser "end of day", "start of day"
- Support des expressions comme "in half an hour"

### 54. **Export/Import des settings** ❌ À FAIRE
**Problème actuel :**
- Pas de moyen d'exporter les settings
- Pas de moyen d'importer des settings
- Difficile de partager la configuration entre appareils

**Amélioration :**
- Bouton "Export settings" dans les settings
- Bouton "Import settings" dans les settings
- Format JSON pour l'export/import
- Validation des settings importés
- Option pour exporter uniquement certains settings

### 55. **Support des raccourcis clavier pour les suggestions** ❌ À FAIRE
**Problème actuel :**
- Seulement Shift+Enter pour garder l'alias
- Pas de raccourcis pour naviguer dans les suggestions
- Pas de raccourcis pour sélectionner rapidement

**Amélioration :**
- Raccourcis clavier personnalisables pour les suggestions
- Navigation au clavier dans la liste (flèches haut/bas)
- Raccourci pour sélectionner la première suggestion
- Raccourci pour fermer les suggestions

### 58. **Support des formats de date courts et longs** ❌ À FAIRE
**Demande utilisateur :**
> "Is it possible to have short and long date formats? Like sometimes I want the fully spelled out date like "Tuesday January 13, 2025" and sometimes I want the shorter date format"

**Problème actuel :**
- Un seul format de date configuré dans les settings
- Pas de moyen de choisir entre format court et format long selon le contexte
- Format fixe pour toutes les utilisations

**Amélioration :**
- Ajouter un format de date "long" (ex: "dddd MMMM D, YYYY" → "Tuesday January 13, 2025")
- Ajouter un format de date "short" (ex: "YYYY-MM-DD" → "2025-01-13")
- Option dans les settings pour choisir le format par défaut
- Possibilité de basculer entre format court/long via commande ou raccourci
- Support multi-langues pour les formats longs (noms de jours/mois localisés)
- Format conditionnel selon le contexte (ex: format long pour dates futures importantes, format court pour dates proches)

**Implémentation suggérée :**
- Ajouter `dateFormatLong` et `dateFormatShort` dans les settings
- Commande pour basculer entre formats (ou choix dans le modal de suggestions)
- Utiliser moment.js avec locale pour les formats longs localisés
- Exemples de formats longs par langue :
  - Anglais : "dddd MMMM D, YYYY" → "Tuesday January 13, 2025"
  - Français : "dddd D MMMM YYYY" → "mardi 13 janvier 2025"
  - Allemand : "dddd, D. MMMM YYYY" → "Dienstag, 13. Januar 2025"












