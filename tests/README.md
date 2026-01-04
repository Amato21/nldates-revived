# Tests unitaires pour Natural Language Dates

## Configuration

Cette suite de tests utilise **Vitest** comme framework de test pour TypeScript.

### Installation

Les dépendances sont déjà installées via `npm install`. Les packages suivants sont nécessaires :
- `vitest` : Framework de test
- `@vitest/ui` : Interface utilisateur pour les tests
- `@vitest/coverage-v8` : Outil de couverture de code
- `moment` : Bibliothèque de manipulation de dates (pour les tests)

### Structure

```
tests/
├── __mocks__/           # Mocks pour les dépendances externes
│   ├── obsidian.ts
│   └── obsidian-daily-notes-interface.ts
├── pre-setup.ts         # Configuration initiale (définit window.moment)
├── setup.ts             # Setup pour chaque suite de tests
├── global-setup.ts      # Setup global
├── parser.test.ts       # Suite de tests principale pour le parser
└── README.md            # Ce fichier
```

## Exécution des tests

```bash
# Exécuter tous les tests
npm test

# Mode watch (relance automatique lors des modifications)
npm run test:watch

# Interface utilisateur interactive
npm run test:ui

# Avec rapport de couverture
npm run test:coverage
```

## Configuration des tests

### Vitest

La configuration se trouve dans `vitest.config.ts`. Points importants :
- **Environment** : Node.js
- **Setup files** : `pre-setup.ts` est chargé en premier pour définir `window.moment` avant l'importation des modules
- **Aliases** : Les modules Obsidian sont mockés via des alias
- **Coverage** : Seuil de 80% pour lines, functions, branches et statements

### Mocks

1. **window.moment** : Défini dans `pre-setup.ts` car il est nécessaire dès l'importation de `chrono.ts`
2. **obsidian** : Mocké pour éviter les dépendances réelles à Obsidian
3. **obsidian-daily-notes-interface** : Mocké de la même manière

## Suite de tests

La suite de tests dans `parser.test.ts` couvre :

### Priorité 1 : Expressions de base
- `today`, `tomorrow`, `yesterday`, `now`
- Support multilingue (en, fr, de, pt, nl, es, it, ja)

### Priorité 1 : Expressions relatives simples
- `in 2 days`, `in 2 weeks`, `in 3 months`, etc.
- Support de toutes les unités de temps
- Support multilingue

### Priorité 2 : Combinaisons
- `in 2 weeks and 3 days`
- Combinaisons de différentes unités
- Support multilingue

### Priorité 3 : Jours de semaine
- `next Monday`, `last Friday`, `this Wednesday`
- Avec horaire : `next Monday at 3pm`
- Support multilingue

### Plages de dates
- `from Monday to Friday`
- `next week`
- Support multilingue

### Cas limites et gestion d'erreurs
- Chaînes vides
- Expressions invalides
- Variantes de casse
- Espaces supplémentaires
- Détection de composante temporelle

## Notes importantes

⚠️ **Problème connu** : Certains tests peuvent échouer car :
- Les comparaisons de dates peuvent être sensibles au timing
- Certaines fonctionnalités de chrono-node peuvent nécessiter une configuration supplémentaire
- Les tests multilingues dépendent de la configuration de chrono-node

### Pour déboguer les tests

1. Exécuter un test spécifique :
```bash
npm test -- --reporter=verbose parser.test.ts
```

2. Voir les erreurs détaillées :
```bash
npm test 2>&1 | more
```

3. Mode watch pour développement :
```bash
npm run test:watch
```

## Améliorations réalisées

✅ **Assertions de dates avec tolérance** : Tous les tests utilisent maintenant `expectSameDate()` du fichier `test-helpers.ts` qui gère automatiquement les tolérances de temps selon la précision demandée (jour, heure, minute, etc.)

✅ **Cas limites additionnels** : Plusieurs nouveaux tests ont été ajoutés pour couvrir :
- Expressions avec des nombres grands
- Expressions avec 0 jours
- Expressions mixtes (caractères spéciaux, espaces)
- Plages de dates avec le même jour
- Expressions avec temps 24h
- Nombres ordinaux
- Expressions avec "ago"

✅ **Tests d'intégration** : Nouvelle section de tests qui vérifie :
- La cohérence entre différentes méthodes du parser
- Le fonctionnement avec toutes les langues configurées
- La détection de composante temporelle
- La cohérence entre `getParsedDate` et `getParsedDateRange`

## Helpers de test

Le fichier `tests/test-helpers.ts` fournit des fonctions utilitaires :
- `expectSameDate()` : Compare deux dates avec tolérance automatique
- `expectDateInRange()` : Vérifie qu'une date est dans une plage
- `expectFutureDate()` : Vérifie qu'une date est dans le futur
- `expectPastDate()` : Vérifie qu'une date est dans le passé

