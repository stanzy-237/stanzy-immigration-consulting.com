/**
 * The paid services a Dossier can deliver (GLOSSARY: Accompagnement Entrée
 * Express, Vérification et soumission, EDE, Services documentaires).
 */
export const SERVICE_TYPES = ['ACCOMPAGNEMENT', 'VERIFICATION', 'EDE', 'SERVICE_DOCUMENTAIRE'] as const;
export type ServiceType = (typeof SERVICE_TYPES)[number];

/**
 * Each service's Workflow de service, in order. Keys are stored on the
 * Dossier, so rename a label in `messages/*.json` (`Dossiers.stages.<service>.<key>`),
 * never a key. The last stage means the work is done.
 */
export const WORKFLOWS = {
  // #81
  ACCOMPAGNEMENT: [
    'evaluation',
    'test-langue',
    'ede',
    'profil-ee',
    'bassin',
    'ita',
    'depot',
    'aor',
    'ppr',
    'copr',
  ],
  // #82
  VERIFICATION: [
    'evaluation',
    'collecte',
    'revue',
    'fichiers',
    'formulaires',
    'validation',
    'soumission',
    'aor',
  ],
  // #83
  EDE: ['verification', 'compte', 'etablissement', 'envoi', 'evaluation', 'rapport'],
  // #80
  SERVICE_DOCUMENTAIRE: ['commande', 'en-cours', 'livre'],
} as const satisfies Record<ServiceType, readonly string[]>;

export type StageKey<S extends ServiceType = ServiceType> = (typeof WORKFLOWS)[S][number];
