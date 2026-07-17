# Instructions permanentes pour ce projet

## Règle n°1 : toute modification doit couvrir les 11 langues supportées

Ce plugin supporte 11 langues (voir `src/settings.ts` et `src/lang/*.ts`) :
`en`, `fr`, `es`, `it`, `de`, `pt`, `ru`, `uk`, `ja`, `nl`, `zh.hant`.

Quand l'utilisateur demande une correction de bug ou une nouvelle fonctionnalité
touchant au parsing, à l'autosuggest, ou à toute logique liée aux dates/mots :

- La modification doit s'appliquer aux 11 langues, pas seulement à l'anglais
  (ou à la langue dans laquelle l'exemple a été donné).
- Avant de dire qu'une tâche est terminée, **vérifier empiriquement** (tests ou
  script rapide) que ça fonctionne dans chaque langue — ne pas se contenter de
  lire le code et de supposer que ça marche parce que la logique semble
  générique.
- Si une langue ne peut objectivement pas bénéficier de la même façon (ex :
  le chinois/japonais ne se tapent pas lettre par lettre, donc la tolérance
  aux fautes de frappe ne s'applique pas de la même manière), le dire
  clairement et explicitement à l'utilisateur — ne jamais l'oublier
  silencieusement ou le laisser deviner.
- Si une limitation réelle est découverte et n'est pas corrigée immédiatement,
  la documenter (issue GitHub ou CHANGELOG) plutôt que de la laisser non
  tracée.

Ne jamais considérer une fonctionnalité comme livrée si elle ne couvre que
l'anglais/le français sans vérification explicite des 9 autres langues.
