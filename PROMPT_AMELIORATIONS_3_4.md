# Prompt pour implémenter les améliorations #3 et #4

Je veux implémenter deux améliorations majeures dans le plugin Obsidian "Natural Language Dates":

## CONTEXTE DU PROJET:
- Plugin Obsidian qui parse des dates en langage naturel (ex: "tomorrow", "in 2 weeks", "next Monday")
- Fichier principal du parser: `src/parser.ts` avec la classe `NLDParser`
- Structure actuelle: gestion d'erreurs basique avec try/catch et console.warn/error
- Tests: 95 tests unitaires qui passent tous (ne pas casser)

## AMÉLIORATION #3: GESTION D'ERREURS AMÉLIORÉE

### État actuel:
- Try/catch dans `src/main.ts` ligne 97-103 pour l'initialisation du parser avec fallback vers anglais
- Try/catch dans `src/chrono.ts` lignes 32-46 et 51-62 pour l'initialisation des langues avec console.warn/error
- Try/catch dans `src/parser.ts` lignes 741-750 et 760-768 pour les opérations chrono avec console.warn
- Validation des settings avec valeurs par défaut dans `src/main.ts` lignes 120-122
- **Problème**: Beaucoup de try/catch silencieux avec seulement console.warn (pas de feedback utilisateur)
- **Problème**: Pas de notifications Obsidian pour les erreurs critiques
- **Problème**: Pas de logging structuré avec niveaux

### À implémenter:

1. **Classe d'erreur personnalisée `NLDParseError`**
   - Créer `src/errors.ts` avec une classe `NLDParseError` qui étend `Error`
   - Propriétés: `code: string`, `context?: any`, `severity: 'debug' | 'warn' | 'error'`
   - Méthodes: constructeur avec message, code, contexte optionnel, sévérité
   - Export: `NLDParseError`, et peut-être des codes d'erreur constants

2. **Système de logging structuré**
   - Créer `src/logger.ts` avec une classe `Logger` ou fonctions utilitaires
   - Niveaux: debug, info, warn, error
   - Utiliser `console.debug`, `console.info`, `console.warn`, `console.error` selon le niveau
   - Format structuré: inclure timestamp, niveau, message, contexte
   - Optionnel: possibilité d'activer/désactiver les logs via settings (pour plus tard)

3. **Notifications Obsidian pour erreurs critiques**
   - Dans `src/main.ts`: utiliser `this.app.notifications` pour les erreurs critiques
   - Erreurs critiques à notifier:
     - Échec d'initialisation du parser (déjà géré avec fallback, mais notifier l'utilisateur)
     - Erreur lors du chargement des settings (si critique)
   - Format: notification courte et claire pour l'utilisateur
   - Ne pas notifier pour les erreurs non-critiques (ex: une langue non supportée)

4. **Refactoring des try/catch existants**
   - Remplacer les console.warn/error par le système de logging
   - Utiliser NLDParseError pour les erreurs de parsing
   - Conserver le comportement existant (fallbacks, etc.) mais améliorer le logging
   - Localisations à modifier:
     - `src/main.ts`: resetParser() ligne 96-109
     - `src/chrono.ts`: getChronos() lignes 25-66
     - `src/parser.ts`: getParsedDateResult() ligne 741-750, getParsedResult() ligne 760-768

### Contraintes:
- Ne pas casser les tests existants (95 tests doivent passer)
- Ne pas changer le comportement utilisateur (fallbacks doivent rester identiques)
- Les notifications doivent être discrètes (pas de spam)
- Le logging doit être compatible avec Obsidian (utiliser console.*)

## AMÉLIORATION #4: SÉPARATION DES RESPONSABILITÉS

### État actuel:
- `src/parser.ts` contient à la fois:
  - La logique de parsing des dates (méthode principale: `getParsedDate()`)
  - La détection d'heure (méthode `hasTimeComponent()` lignes 774-843)
  - La logique de formatage utilisée indirectement via `getFormattedDate()` de `utils.ts`
- Logique métier mélangée avec la détection de patterns

### À implémenter:

1. **Module `src/time-detector.ts`**
   - Extraire la méthode `hasTimeComponent()` de `NLDParser`
   - Créer une classe `TimeDetector` ou une fonction exportée
   - Si classe: prendre en paramètre les regex et keywords nécessaires (ou une instance de parser)
   - Si fonction: prendre en paramètres tous les dépendances nécessaires
   - **Recommandation**: Classe `TimeDetector` qui prend les regex/keywords en paramètres ou via le parser
   - Conserver exactement la même logique (lignes 774-843 de parser.ts)
   - Importer dans `parser.ts` et utiliser dans `NLDParser.hasTimeComponent()`

2. **Module `src/date-formatter.ts`**
   - Extraire la fonction `getFormattedDate()` de `src/utils.ts` (ligne 62-64)
   - Créer une classe `DateFormatter` ou améliorer la fonction
   - **Recommandation**: Classe `DateFormatter` avec méthodes statiques ou instance
   - Fonctionnalités:
     - Formatage de date simple: `format(date: Date, format: string): string`
     - Optionnel: formatage de plage de dates, formatage avec heure, etc.
   - Conserver la compatibilité avec `getFormattedDate()` existant
   - Mettre à jour les imports dans tous les fichiers qui utilisent `getFormattedDate()`

3. **Refactoring de `NLDParser`**
   - Retirer `hasTimeComponent()` de `NLDParser` et utiliser `TimeDetector`
   - Conserver toutes les autres méthodes intactes
   - La méthode `hasTimeComponent()` de `NLDParser` doit maintenant déléguer à `TimeDetector`

### Contraintes:
- Ne pas casser les tests existants (95 tests doivent passer)
- Ne pas changer le comportement (même résultats pour hasTimeComponent)
- Maintenir la compatibilité avec les imports existants (ex: getFormattedDate dans utils.ts peut devenir un wrapper)
- Garder la structure modulaire et testable

### Fichiers concernés:
- **Nouveaux**: `src/errors.ts`, `src/logger.ts`, `src/time-detector.ts`, `src/date-formatter.ts`
- **Modifiés**: `src/parser.ts`, `src/main.ts`, `src/chrono.ts`, `src/utils.ts`, fichiers utilisant getFormattedDate

## PRIORITÉS:
1. **Performance**: Ne pas dégrader les performances (le cache existe déjà)
2. **Fiabilité**: Tous les tests doivent passer (95/95)
3. **Maintenabilité**: Code modulaire et bien organisé
4. **Compatibilité**: Ne pas casser les fonctionnalités existantes

## TESTS:
- Le projet a 95 tests unitaires qui passent tous (`tests/parser.test.ts`)
- S'assurer que l'implémentation ne casse pas les tests existants
- Optionnel: ajouter des tests pour les nouveaux modules (logger, time-detector, etc.)

## NOTES IMPORTANTES:
- TypeScript strict: respecter les types existants
- Obsidian API: utiliser les APIs standard d'Obsidian (notifications via `this.app.notifications`)
- Moment.js: le plugin utilise `window.moment` (moment.js bundlé avec Obsidian)
- Ne pas introduire de nouvelles dépendances externes
- Garder le code simple et lisible (pas de sur-ingénierie)

