# NOUR

Application mobile Expo (SDK 58) avec Expo Router, TypeScript et une conception hors ligne d'abord.

## Démarrer

```bash
npm install
npx expo start
```

## Structure

- `src/app/` : routes Expo Router uniquement (écrans et `_layout.tsx`).
- `src/components/` : composants réutilisables. Les composants de base du système de design sont dans `src/components/ui/`.
- `src/theme/` : système de design NOUR (couleurs, typographie, espacements, tailles, effets, thème de navigation).
- `src/hooks/` : hooks partagés.

## Vérifications

```bash
npm run typecheck
npx expo lint
npx expo-doctor
```

`npm run typecheck` génère d'abord les types Expo (`expo-env.d.ts` et types des routes), puis lance `tsc --noEmit`. Ces fichiers sont ignorés par Git : sur un clone neuf, `npx tsc --noEmit` seul échoue tant qu'ils n'existent pas.
