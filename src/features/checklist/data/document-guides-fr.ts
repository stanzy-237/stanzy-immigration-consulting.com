import type { DocumentGuides } from '@/features/checklist/data/document-guides';
import { FUNDS_PER_EXTRA_PERSON, FUNDS_TABLE } from '@/features/budget/data/fees';
import { TCF_ACADEMY_URL } from '@/features/shared/data/links';

const IRCC = 'https://www.canada.ca/fr/immigration-refugies-citoyennete';
const EE_DOCUMENTS = `${IRCC}/services/immigrer-canada/entree-express/documents.html`;
const cad = (amount: number) => `${amount.toLocaleString('fr-CA')} $ CA`;

/**
 * The Checklist's « En savoir plus » guides, in French. Written in Stanzy's
 * own words from IRCC's pages, which each guide links to; IRCC's personalized
 * checklist after the ITA remains the reference.
 */
export const DOCUMENT_GUIDES_FR: DocumentGuides = {
  passport: {
    name: 'Passeport',
    summary: 'Les pages d’identité, en couleur, pour chaque personne de la demande.',
    blocks: [
      { kind: 'text', text: 'IRCC vérifie votre identité et votre nationalité avec votre passeport. Vous téléversez une copie couleur lisible de la page d’informations personnelles (photo, nom, date de naissance, numéro, dates de délivrance et d’expiration).' },
      { kind: 'list', title: 'À préparer', items: [
        'La page d’identité de chaque passeport valide, en couleur et en entier (les 4 coins visibles).',
        'Les pages avec un visa, un tampon ou une mention, si vous avez voyagé ou vécu à l’étranger : elles confirment votre historique de voyages.',
        'Si votre nom a changé (mariage, jugement), le document qui le prouve.',
      ] },
      { kind: 'note', text: 'Renouvelez votre passeport s’il expire dans moins de 6 mois. Le visa de résident permanent ne peut pas être valide plus longtemps que le passeport : un passeport qui expire bientôt peut retarder la fin de votre dossier.' },
      { kind: 'text', text: 'Conseil Stanzy : le renouvellement prend parfois plusieurs mois dans certains pays. Vérifiez la date d’expiration de chaque passeport de la famille dès maintenant.' },
      { kind: 'link', label: 'Documents Entrée Express (IRCC)', href: EE_DOCUMENTS },
    ],
  },
  photo: {
    name: 'Photo numérique',
    summary: 'Une photo récente au format d’IRCC, pour chaque personne.',
    blocks: [
      { kind: 'text', text: 'La demande de résidence permanente demande une photo numérique de chaque personne. Elle servira aussi à votre carte de résident permanent : une photo refusée retarde la carte.' },
      { kind: 'list', title: 'Ce qu’IRCC vérifie', items: [
        'Une photo récente, prise par un photographe qui connaît les exigences d’IRCC.',
        'Fond uni et clair, visage de face, expression neutre, yeux ouverts, bouche fermée.',
        'Pas de lunettes, ni de couvre-chef sauf pour motif religieux (le visage doit rester entièrement visible).',
        'Une image nette, sans retouche ni filtre.',
      ] },
      { kind: 'text', text: 'Conseil Stanzy : montrez au photographe les spécifications de photo d’IRCC pour la résidence permanente et demandez le fichier numérique, pas seulement le tirage.' },
      { kind: 'link', label: 'Documents Entrée Express (IRCC)', href: EE_DOCUMENTS },
    ],
  },
  birthCertificate: {
    name: 'Acte de naissance',
    summary: 'Obligatoire pour les enfants ; utile pour vous et votre conjoint.',
    blocks: [
      { kind: 'text', text: 'L’acte de naissance prouve l’identité et, pour un enfant, le lien avec ses parents. IRCC l’exige pour chaque enfant à charge ; pour vous et votre conjoint, il confirme votre date de naissance et le nom de vos parents.' },
      { kind: 'list', title: 'À préparer', items: [
        'Une copie intégrale de l’acte, qui indique le nom des deux parents.',
        'Pour un acte récent (reconstitué ou jugement supplétif), gardez aussi le jugement.',
        'Une traduction certifiée si l’acte n’est ni en français ni en anglais.',
      ] },
      { kind: 'note', text: 'Si un enfant vient au Canada sans l’autre parent, préparez le consentement écrit de ce parent ou le jugement de garde : IRCC le demande.' },
      { kind: 'text', text: 'Conseil Stanzy : vérifiez que l’orthographe des noms et les dates sont identiques sur l’acte, le passeport et vos diplômes. Une différence se corrige mieux avant l’ITA, ou s’explique dans une lettre.' },
    ],
  },
  marriageCertificate: {
    name: 'Acte de mariage',
    summary: 'La preuve de votre mariage.',
    blocks: [
      { kind: 'text', text: 'Si vous êtes marié, IRCC demande la preuve du mariage, même si votre conjoint ne vient pas au Canada. Un mariage religieux ou coutumier doit être reconnu par la loi du pays où il a eu lieu.' },
      { kind: 'list', title: 'À préparer', items: [
        'L’acte de mariage délivré par l’état civil.',
        'Une traduction certifiée s’il n’est ni en français ni en anglais.',
      ] },
      { kind: 'note', text: 'Séparé mais toujours marié ? Le mariage existe encore pour IRCC : déclarez-le et gardez l’acte, avec une lettre qui explique la séparation.' },
      { kind: 'text', text: 'Conseil Stanzy : votre état civil doit être le même partout (profil, formulaires, documents). Un mariage célébré après la création du profil doit y être déclaré tout de suite.' },
    ],
  },
  commonLawProof: {
    name: 'Preuve d’union de fait',
    summary: 'Formulaire IMM 5409 et preuves de 12 mois de vie commune.',
    blocks: [
      { kind: 'text', text: 'Une union de fait, pour IRCC, c’est vivre ensemble comme un couple depuis au moins 12 mois de suite. Vous le prouvez avec une déclaration et des documents.' },
      { kind: 'list', title: 'À préparer', items: [
        'Le formulaire IMM 5409 (Déclaration solennelle de l’union de fait), signé par les deux partenaires.',
        'Des preuves d’une adresse commune depuis 12 mois : bail ou titre de propriété à vos deux noms, factures, courrier officiel à la même adresse.',
        'Des preuves de vie de couple : compte bancaire commun, assurance où l’un est bénéficiaire de l’autre, photos, voyages ensemble.',
      ] },
      { kind: 'text', text: 'Conseil Stanzy : réunissez des preuves qui couvrent toute la période, mois après mois. Quelques documents bien datés valent mieux que beaucoup de photos.' },
      { kind: 'link', label: 'Formulaire IMM 5409 (IRCC)', href: `${IRCC}/services/demande/formulaires-demande-guides/imm5409.html` },
    ],
  },
  previousUnionProof: {
    name: 'Fin d’une union précédente',
    summary: 'Divorce, décès ou annulation d’un mariage ou d’une union de fait.',
    blocks: [
      { kind: 'text', text: 'Si vous avez déjà été marié ou en union de fait, IRCC veut savoir comment cette union a pris fin. Sans ce document, un nouveau mariage peut être mis en doute.' },
      { kind: 'list', title: 'Selon votre situation', items: [
        'Divorce : le jugement ou le certificat de divorce définitif.',
        'Veuvage : l’acte de décès de l’ex-conjoint.',
        'Annulation : le jugement d’annulation.',
        'Fin d’une union de fait : une déclaration ou des preuves de la séparation (adresses différentes, par exemple).',
      ] },
      { kind: 'text', text: 'Conseil Stanzy : déclarez toutes vos unions précédentes dans les formulaires, même courtes. Une union oubliée est une fausse déclaration.' },
    ],
  },
  personalHistory: {
    name: 'Historique personnel et adresses (10 ans)',
    summary: 'Activités et adresses mois par mois, sans période vide.',
    blocks: [
      { kind: 'text', text: 'Après l’ITA, vous remplissez en ligne l’Annexe A (Antécédents / Déclaration). Elle demande ce que vous avez fait et où vous avez vécu au cours des 10 dernières années (ou depuis vos 18 ans), sans aucun trou.' },
      { kind: 'list', title: 'À préparer dès maintenant', items: [
        'Chaque activité, avec les dates de début et de fin (mois et année) : études, emplois, chômage, recherche d’emploi, voyages, congé…',
        'Chaque adresse où vous avez vécu, avec les dates.',
        'Les voyages hors de votre pays de résidence.',
        'Votre appartenance éventuelle à des organisations, votre service militaire, vos emplois au gouvernement.',
      ] },
      { kind: 'note', text: 'Une période sans activité doit quand même être déclarée (« sans emploi », « recherche d’emploi »). Les dates doivent correspondre exactement à vos lettres d’emploi et diplômes.' },
      { kind: 'text', text: 'Conseil Stanzy : faites ce tableau dans un fichier dès aujourd’hui. C’est la partie qui prend le plus de temps après l’ITA, et la source la plus fréquente d’incohérences.' },
    ],
  },
  familyInformation: {
    name: 'Renseignements sur la famille',
    summary: 'Parents, frères et sœurs, enfants : noms, dates de naissance, adresses.',
    blocks: [
      { kind: 'text', text: 'Le formulaire Renseignements additionnels sur la famille (IMM 5406) demande des informations sur toute votre famille proche, qu’elle vienne au Canada ou non.' },
      { kind: 'list', title: 'Pour chaque personne', items: [
        'Vos parents, votre conjoint, vos enfants (même adultes ou mariés), vos frères et sœurs (y compris demi-frères et demi-sœurs).',
        'Nom complet, date et pays de naissance, état civil, adresse actuelle, profession.',
        'Pour une personne décédée : la date et le lieu du décès.',
      ] },
      { kind: 'text', text: 'Conseil Stanzy : demandez ces informations à votre famille avant l’ITA, surtout les dates de naissance exactes. N’oubliez aucun enfant : un enfant non déclaré ne pourra plus être parrainé plus tard.' },
    ],
  },
  representativeForm: {
    name: 'Recours aux services d’un représentant',
    summary: 'Formulaire IMM 5476, si un consultant ou un avocat vous représente.',
    blocks: [
      { kind: 'text', text: 'Si un consultant réglementé (CRIC) ou un avocat agit pour vous auprès d’IRCC, le formulaire IMM 5476 l’autorise. Il est signé par vous et par le représentant.' },
      { kind: 'note', text: 'Un représentant payé doit être autorisé (membre du Collège des consultants en immigration et en citoyenneté, ou d’un barreau). Vérifiez son numéro de membre.' },
      { kind: 'link', label: 'Formulaire IMM 5476 (IRCC)', href: `${IRCC}/services/demande/formulaires-demande-guides/imm5476.html` },
    ],
  },
  languageResults: {
    name: 'Résultats du test de langue',
    summary: 'TEF Canada, TCF Canada, IELTS General, CELPIP General ou PTE Core, de moins de 2 ans.',
    blocks: [
      { kind: 'text', text: 'Vos résultats prouvent votre niveau en français ou en anglais. Ils doivent dater de moins de 2 ans le jour où vous créez votre profil et le jour où vous déposez la demande de résidence permanente.' },
      { kind: 'list', title: 'Tests acceptés', items: [
        'Français : TEF Canada ou TCF Canada.',
        'Anglais : IELTS General Training, CELPIP General ou PTE Core.',
      ] },
      { kind: 'list', title: 'À préparer', items: [
        'L’attestation de résultats, avec le numéro de formulaire ou de certificat.',
        'Pour le TEF Canada, utilisez les scores de la colonne « Équivalence ancien score ».',
      ] },
      { kind: 'note', text: 'Des résultats expirés au dépôt font refuser la demande. Si les vôtres expirent bientôt, repassez le test ou refusez l’invitation pour revenir dans le bassin.' },
      { kind: 'link', label: 'Calculer mon niveau NCLC / CLB', href: '/outils/nclc-clb' },
      { kind: 'cta', label: 'Préparer le TCF Canada avec TCF Express Academy', href: TCF_ACADEMY_URL },
      { kind: 'link', label: 'Tests de langue (IRCC)', href: `${IRCC}/services/immigrer-canada/entree-express/documents/examen-linguistique.html` },
    ],
  },
  secondLanguageResults: {
    name: 'Résultats dans la seconde langue officielle',
    summary: 'Le test de l’autre langue (français ou anglais), s’il donne des points.',
    blocks: [
      { kind: 'text', text: 'Si vous déclarez des points pour la seconde langue officielle, IRCC demande ces résultats aussi, avec les mêmes règles : un test accepté, de moins de 2 ans au dépôt.' },
      { kind: 'text', text: 'Conseil Stanzy : un bon niveau en français donne des points supplémentaires, et des tirages réservés aux francophones ont lieu régulièrement.' },
      { kind: 'link', label: 'Calculer mon niveau NCLC / CLB', href: '/outils/nclc-clb' },
    ],
  },
  eca: {
    name: 'Évaluation des diplômes d’études (EDE)',
    summary: 'Un rapport EDE pour votre diplôme obtenu hors du Canada, de moins de 5 ans.',
    blocks: [
      { kind: 'text', text: 'L’EDE dit à quel diplôme canadien correspond votre diplôme étranger. Elle est obligatoire pour le Programme des travailleurs qualifiés (fédéral) et pour obtenir des points pour des études faites hors du Canada.' },
      { kind: 'list', title: 'Organismes désignés', items: [
        'World Education Services (WES)',
        'International Qualifications Assessment Service (IQAS)',
        'International Credential Assessment Service of Canada (ICAS)',
        'Comparative Education Service (Université de Toronto)',
        'International Credential Evaluation Service (BCIT)',
        'Médecins et pharmaciens : le Conseil médical du Canada ou le Bureau des examinateurs en pharmacie du Canada.',
      ] },
      { kind: 'note', text: 'Le rapport doit dater de moins de 5 ans au dépôt de la demande. Faites évaluer votre diplôme le plus élevé ; avec deux diplômes (pour des points de transférabilité), faites évaluer les deux.' },
      { kind: 'text', text: 'Conseil Stanzy : l’EDE prend souvent plusieurs semaines, car l’université doit envoyer vos relevés directement à l’organisme. Lancez la demande tôt.' },
      { kind: 'cta', label: 'Stanzy s’occupe de votre EDE (WES, IQAS)', href: '/services/ede' },
      { kind: 'link', label: 'Évaluation des diplômes (IRCC)', href: `${IRCC}/services/immigrer-canada/entree-express/documents/evaluer-diplomes-etudes.html` },
    ],
  },
  foreignDiplomas: {
    name: 'Diplômes et relevés de notes',
    summary: 'Les diplômes évalués par l’EDE, avec leurs relevés.',
    blocks: [
      { kind: 'text', text: 'L’EDE suffit pour les points, mais l’agent peut vouloir voir les diplômes eux-mêmes. Les avoir prêts évite un délai si on vous les demande.' },
      { kind: 'list', title: 'À préparer', items: [
        'Une copie de chaque diplôme évalué.',
        'Les relevés de notes de toutes les années.',
        'Une traduction certifiée si les documents ne sont ni en français ni en anglais.',
      ] },
    ],
  },
  canadianDiploma: {
    name: 'Diplôme canadien',
    summary: 'Diplôme et relevés d’un établissement canadien.',
    blocks: [
      { kind: 'text', text: 'Un diplôme canadien ne demande pas d’EDE. Vous prouvez vos études au Canada avec les documents de l’établissement.' },
      { kind: 'list', title: 'À préparer', items: [
        'Le diplôme ou le certificat.',
        'Les relevés de notes officiels, qui montrent la durée du programme et que vous l’avez terminé.',
        'Pour des points d’études au Canada : la preuve que vous avez étudié à temps plein au Canada (les relevés suffisent souvent).',
      ] },
    ],
  },
  referenceLetters: {
    name: 'Lettres de référence des employeurs',
    summary: 'Une lettre par emploi déclaré, avec les mentions qu’IRCC exige.',
    blocks: [
      { kind: 'text', text: 'C’est la preuve principale de votre expérience de travail. Il faut une lettre pour chaque emploi qui vous donne des points ou vous rend admissible. Une lettre incomplète est l’une des premières causes de refus.' },
      { kind: 'list', title: 'Ce que la lettre doit contenir', items: [
        'Le papier à en-tête de l’entreprise, avec son adresse, son téléphone et son courriel.',
        'Le nom, le titre et la signature de votre supérieur ou du responsable des ressources humaines.',
        'Vos dates exactes d’emploi (début et fin, ou « à ce jour »).',
        'Chaque poste occupé dans l’entreprise, avec ses dates.',
        'Vos principales tâches et responsabilités dans chaque poste.',
        'Le nombre d’heures de travail par semaine.',
        'Votre salaire annuel et vos avantages.',
      ] },
      { kind: 'note', text: 'Vos tâches doivent correspondre à la description principale et à la plupart des fonctions de votre code CNP. Elles doivent être écrites avec vos propres mots ou ceux de l’employeur : ne copiez pas le texte de la CNP mot pour mot.' },
      { kind: 'text', text: 'Conseil Stanzy : demandez vos lettres maintenant, même pour d’anciens emplois. Une entreprise fermée, un supérieur parti ou un employeur lent peuvent bloquer votre dossier pendant les 60 jours. Si un employeur refuse, gardez la preuve de vos démarches et ajoutez une lettre d’explication avec d’autres preuves (contrat, fiches de paie).' },
      { kind: 'cta', label: 'Faire vérifier mes lettres par Stanzy', href: '/services/verification' },
      { kind: 'link', label: 'Documents Entrée Express (IRCC)', href: EE_DOCUMENTS },
    ],
  },
  selfEmployedProof: {
    name: 'Preuves d’activité de travailleur autonome',
    summary: 'Registre de commerce, contrats, factures, déclarations fiscales.',
    blocks: [
      { kind: 'text', text: 'Si vous travaillez à votre compte, personne ne peut vous écrire une lettre d’employeur. Vous prouvez votre activité avec des documents officiels et des tiers. Une description que vous écrivez vous-même ne suffit pas.' },
      { kind: 'list', title: 'À préparer', items: [
        'L’immatriculation de l’entreprise (registre du commerce, numéro d’identification fiscale).',
        'Les contrats et factures avec vos clients, sur toute la période déclarée.',
        'Des lettres de clients qui décrivent le travail fait pour eux.',
        'Les déclarations et quittances fiscales de l’activité.',
        'Les relevés bancaires où arrivent les paiements des clients.',
      ] },
      { kind: 'note', text: 'Attention : l’expérience comme travailleur autonome au Canada ne compte pas pour la Catégorie de l’expérience canadienne.' },
    ],
  },
  workPermit: {
    name: 'Permis de travail canadien',
    summary: 'Vos permis de travail, pour toute l’expérience au Canada.',
    blocks: [
      { kind: 'text', text: 'Votre expérience au Canada doit avoir été faite avec une autorisation de travail. IRCC vérifie que vous aviez le droit de travailler pendant toute la période déclarée.' },
      { kind: 'list', title: 'À préparer', items: [
        'Chaque permis de travail (et ses prolongations) qui couvre la période déclarée.',
        'Si vous êtes en statut maintenu, la preuve de la demande de prolongation.',
      ] },
      { kind: 'note', text: 'Le travail fait pendant des études à temps plein ne compte pas comme expérience pour la Catégorie de l’expérience canadienne.' },
      { kind: 'link', label: 'Catégorie de l’expérience canadienne (IRCC)', href: `${IRCC}/services/immigrer-canada/entree-express/qui-presenter-demande/categorie-experience-canadienne.html` },
    ],
  },
  payslips: {
    name: 'Fiches de paie',
    summary: 'Quelques bulletins de salaire par emploi, sur toute la période.',
    blocks: [
      { kind: 'text', text: 'Les fiches de paie confirment ce que dit votre lettre de référence : le poste, l’employeur, le salaire et les dates. Elles rendent l’expérience difficile à contester.' },
      { kind: 'list', title: 'À préparer', items: [
        'Des bulletins répartis sur toute la période : le premier mois, quelques mois au milieu, le dernier mois.',
        'Le même nom d’employeur et le même salaire que dans la lettre.',
      ] },
      { kind: 'text', text: 'Conseil Stanzy : si l’entreprise ne donne pas de fiches de paie, les relevés du compte où arrive le salaire et l’attestation de sécurité sociale les remplacent.' },
    ],
  },
  employmentContract: {
    name: 'Contrat de travail',
    summary: 'Le contrat ou l’attestation d’embauche, et les avenants.',
    blocks: [
      { kind: 'text', text: 'Le contrat confirme la date d’embauche, le poste et le salaire de départ. Il complète la lettre de référence, surtout si l’employeur a changé de nom ou si le supérieur est parti.' },
      { kind: 'list', title: 'À préparer', items: [
        'Le contrat de travail ou la lettre d’offre signée.',
        'Les avenants ou lettres de promotion, s’ils changent le poste ou le salaire.',
        'Le certificat de travail, si l’emploi est terminé.',
      ] },
    ],
  },
  socialSecurity: {
    name: 'Attestation de sécurité sociale',
    summary: 'Au Cameroun, l’attestation ou le relevé de la CNPS ; ailleurs, l’organisme équivalent.',
    blocks: [
      { kind: 'text', text: 'L’attestation de l’organisme de sécurité sociale prouve, par une institution publique, que vous avez été déclaré et que des cotisations ont été versées pour votre emploi.' },
      { kind: 'list', title: 'Exemples', items: [
        'Cameroun : l’attestation d’immatriculation et le relevé des cotisations de la CNPS.',
        'Côte d’Ivoire : CNPS ; Sénégal : IPRES / CSS ; France : relevé de carrière (Assurance retraite).',
        'Au Canada : les relevés T4 et les avis de cotisation (voir « Documents fiscaux canadiens »).',
      ] },
      { kind: 'text', text: 'Conseil Stanzy : c’est l’une des preuves les plus solides de votre expérience à l’étranger. Si vos cotisations ne couvrent pas toute la période, expliquez-le dans une lettre.' },
    ],
  },
  salaryStatements: {
    name: 'Relevés du compte de salaire',
    summary: 'Les relevés bancaires où apparaissent vos virements de salaire.',
    blocks: [
      { kind: 'text', text: 'Les relevés du compte où votre salaire est versé montrent des paiements réguliers de votre employeur. Ils confirment les fiches de paie et la lettre de référence.' },
      { kind: 'list', title: 'À préparer', items: [
        'Les relevés de quelques mois répartis sur chaque emploi.',
        'Les virements doivent porter le nom de l’employeur et correspondre au salaire déclaré.',
      ] },
    ],
  },
  canadianTaxRecords: {
    name: 'Documents fiscaux canadiens',
    summary: 'Feuillets T4 et avis de cotisation de l’ARC.',
    blocks: [
      { kind: 'text', text: 'Pour l’expérience au Canada, les feuillets T4 de chaque employeur et les avis de cotisation de l’Agence du revenu du Canada (ARC) confirment vos revenus année par année.' },
      { kind: 'list', title: 'À préparer', items: [
        'Les feuillets T4 de chaque année de travail déclarée.',
        'Les avis de cotisation correspondants (téléchargeables dans « Mon dossier » de l’ARC).',
      ] },
    ],
  },
  resume: {
    name: 'Curriculum vitæ',
    summary: 'Un CV qui reprend exactement vos dates et vos postes.',
    blocks: [
      { kind: 'text', text: 'IRCC ne l’exige pas toujours, mais un CV clair aide l’agent à suivre votre parcours. Il doit dire la même chose que votre profil, vos lettres et l’historique personnel.' },
      { kind: 'list', title: 'À vérifier', items: [
        'Les mêmes dates (mois et année) que dans les lettres de référence.',
        'Les mêmes titres de poste.',
        'Aucune période vide, comme dans l’historique personnel.',
      ] },
    ],
  },
  bankLetter: {
    name: 'Lettre officielle de la banque (preuve de fonds)',
    summary: 'Une lettre de chaque banque, avec le solde moyen des 6 derniers mois.',
    blocks: [
      { kind: 'text', text: 'Pour le Programme des travailleurs qualifiés (fédéral ou métiers spécialisés), vous devez prouver que vous avez assez d’argent pour vous installer. L’argent doit être disponible au dépôt de la demande et à la délivrance du visa.' },
      { kind: 'table', caption: 'Fonds minimums (IRCC)', head: ['Taille de la famille', 'Montant'], rows: [
        ...FUNDS_TABLE.map((amount, i): [string, string] => [`${i + 1} personne${i ? 's' : ''}`, cad(amount)]),
        ['Par personne en plus', cad(FUNDS_PER_EXTRA_PERSON)],
      ] },
      { kind: 'list', title: 'Ce que la lettre doit contenir', items: [
        'Le papier à en-tête de la banque, avec son adresse, son téléphone et son courriel.',
        'Votre nom.',
        'Vos dettes en cours (prêts, cartes de crédit).',
        'Pour chaque compte : le numéro, la date d’ouverture, le solde actuel et le solde moyen des 6 derniers mois.',
      ] },
      { kind: 'note', text: 'La taille de la famille compte votre conjoint et vos enfants à charge, même s’ils ne viennent pas. Un bien immobilier ou de l’argent emprunté à une personne ne compte pas.' },
      { kind: 'text', text: 'Conseil Stanzy : faites grandir le solde régulièrement plutôt qu’avec un gros dépôt juste avant l’ITA, et gardez la preuve de l’origine de chaque gros montant.' },
      { kind: 'link', label: 'Voir les fonds à prouver pour ma famille', href: '/outils/budget' },
      { kind: 'link', label: 'Preuve de fonds (IRCC)', href: `${IRCC}/services/immigrer-canada/entree-express/documents/preuve-fonds-suffisants.html` },
    ],
  },
  fundsExemptionLetter: {
    name: 'Lettre d’exemption de la preuve de fonds',
    summary: 'Une lettre qui explique pourquoi vous n’avez pas à prouver de fonds.',
    blocks: [
      { kind: 'text', text: 'Vous n’avez pas à prouver de fonds si vous êtes invité au titre de la Catégorie de l’expérience canadienne, ou si vous êtes autorisé à travailler au Canada et avez une offre d’emploi valide. Le portail demande quand même un document dans le champ « preuve de fonds ».' },
      { kind: 'list', title: 'La lettre dit', items: [
        'Le programme au titre duquel vous êtes invité.',
        'La raison de l’exemption (expérience canadienne, ou permis de travail et offre d’emploi).',
        'Votre nom, la date et votre signature.',
      ] },
      { kind: 'note', text: 'Si vous pouvez être invité au titre d’un autre programme (travailleurs qualifiés), gardez quand même une lettre de la banque prête.' },
    ],
  },
  bankStatements: {
    name: 'Relevés bancaires des 6 derniers mois',
    summary: 'Les relevés qui montrent l’historique de vos fonds.',
    blocks: [
      { kind: 'text', text: 'La lettre de la banque donne un solde moyen ; les relevés montrent comment l’argent s’est accumulé. Ils permettent de répondre vite si l’agent pose une question sur un dépôt.' },
      { kind: 'list', title: 'À préparer', items: [
        'Les relevés des 6 derniers mois de chaque compte déclaré.',
        'Pour chaque gros dépôt : sa preuve (vente d’un bien, épargne, prime, don avec la preuve du donneur).',
      ] },
    ],
  },
  policeCertificate: {
    name: 'Certificat de police',
    summary: 'Un certificat par pays où vous avez vécu 6 mois de suite ou plus depuis vos 18 ans (10 dernières années).',
    blocks: [
      { kind: 'text', text: 'Chaque personne de 18 ans ou plus doit fournir un certificat de police (casier judiciaire) de chaque pays où elle a vécu 6 mois de suite ou plus au cours des 10 dernières années. Le temps passé au Canada et avant 18 ans ne compte pas.' },
      { kind: 'list', title: 'Les règles de date', items: [
        'Pays où vous vivez aujourd’hui : le certificat doit dater de moins de 6 mois au dépôt.',
        'Autres pays : il doit avoir été délivré après votre dernier séjour de 6 mois ou plus dans ce pays.',
        'Téléversez une copie couleur de l’original (pas une copie certifiée).',
      ] },
      { kind: 'note', text: 'Certains pays ne délivrent le certificat que sur demande d’IRCC, et d’autres prennent des mois. Si le vôtre n’arrive pas dans les 60 jours, joignez une lettre d’explication et la preuve de votre demande (reçu, numéro de suivi).' },
      { kind: 'text', text: 'Conseil Stanzy : renseignez-vous dès maintenant sur la démarche de chaque pays. Au Cameroun, c’est l’extrait de casier judiciaire (bulletin n° 3) ; demandez-le après l’ITA pour qu’il ait moins de 6 mois au dépôt. Pour les autres pays, lancez la demande tôt.' },
      { kind: 'link', label: 'Certificats de police (IRCC)', href: `${IRCC}/services/immigrer-canada/entree-express/documents/certificats-police.html` },
      { kind: 'link', label: 'Comment obtenir un certificat, pays par pays (IRCC)', href: `${IRCC}/services/demande/medical-police/certificats-police/comment.html` },
    ],
  },
  medicalExam: {
    name: 'Examen médical',
    summary: 'Chez un médecin désigné par IRCC, après l’ITA et avant le dépôt.',
    blocks: [
      { kind: 'text', text: 'Les candidats Entrée Express passent l’examen médical avant de déposer la demande, après l’ITA. Vous prenez rendez-vous directement avec un médecin désigné par IRCC.' },
      { kind: 'list', title: 'À savoir', items: [
        'Chaque membre de la famille passe l’examen, même un conjoint ou un enfant qui ne vient pas au Canada.',
        'Le médecin vous remet une feuille de confirmation (IMM 1017B) : vous la téléversez avec la demande.',
        'Les résultats sont valides 12 mois.',
        'Apportez votre passeport, vos lunettes et vos carnets de vaccination.',
      ] },
      { kind: 'text', text: 'Conseil Stanzy : repérez dès maintenant le médecin désigné le plus proche et son délai de rendez-vous. Un examen déjà passé il y a moins de 5 ans a un numéro (IME) à indiquer.' },
      { kind: 'link', label: 'Voir le coût de l’examen médical', href: '/outils/budget' },
      { kind: 'link', label: 'Examen médical pour la résidence permanente (IRCC)', href: `${IRCC}/services/demande/medical-police/examens-medicaux/exigences-residents-permanents.html` },
    ],
  },
  jobOfferLetter: {
    name: 'Offre d’emploi écrite',
    summary: 'L’offre de l’employeur canadien, avec l’EIMT si elle en a une.',
    blocks: [
      { kind: 'text', text: 'Une offre d’emploi valide peut donner des points, selon les règles du CRS en vigueur. Elle doit être écrite, à temps plein, non saisonnière, pour au moins un an, et appuyée par une étude d’impact sur le marché du travail (EIMT) sauf exemption.' },
      { kind: 'list', title: 'La lettre d’offre contient', items: [
        'Le papier à en-tête de l’employeur, avec ses coordonnées et la signature d’une personne autorisée.',
        'Le titre du poste, les tâches et le code CNP.',
        'Le salaire, les avantages, les heures par semaine et la date de début.',
        'La durée (au moins un an après la résidence permanente).',
      ] },
      { kind: 'list', title: 'Avec la lettre', items: [
        'Une copie de l’EIMT positive, ou la preuve de l’exemption (votre permis de travail fermé, par exemple).',
      ] },
      { kind: 'link', label: 'Offre d’emploi (IRCC)', href: `${IRCC}/services/immigrer-canada/entree-express/documents/offre-emploi.html` },
    ],
  },
  nominationCertificate: {
    name: 'Certificat de nomination provinciale',
    summary: 'La nomination de la province, acceptée dans votre profil.',
    blocks: [
      { kind: 'text', text: 'Une nomination provinciale liée à Entrée Express donne 600 points. Vous l’acceptez dans votre profil, puis vous joignez le certificat ou la lettre de la province à la demande.' },
      { kind: 'note', text: 'La nomination a une date d’expiration. Votre demande doit être déposée avant cette date.' },
    ],
  },
  qualificationCertificate: {
    name: 'Certificat de qualification',
    summary: 'Le certificat d’une province ou d’un territoire dans votre métier.',
    blocks: [
      { kind: 'text', text: 'Le certificat de qualification, délivré par une province ou un territoire canadien, prouve que vous êtes qualifié dans un métier spécialisé. Il donne des points et peut rendre admissible au Programme des travailleurs de métiers spécialisés.' },
      { kind: 'list', title: 'À préparer', items: ['Une copie du certificat, avec son numéro et sa date.'] },
    ],
  },
  siblingProof: {
    name: 'Preuve d’un frère ou d’une sœur au Canada',
    summary: 'Son statut au Canada et la preuve de votre lien.',
    blocks: [
      { kind: 'text', text: 'Un frère ou une sœur de 18 ans ou plus qui vit au Canada et y est citoyen ou résident permanent donne 15 points. Il faut prouver son statut, son adresse au Canada et votre lien de parenté.' },
      { kind: 'list', title: 'À préparer', items: [
        'Une copie de sa carte de citoyenneté, de son passeport canadien ou de sa carte de résident permanent.',
        'Une preuve d’adresse au Canada (facture, bail).',
        'Vos deux actes de naissance, qui montrent au moins un parent en commun (ou les actes d’adoption).',
      ] },
    ],
  },
  explanationLetter: {
    name: 'Lettre d’explication',
    summary: 'Pour expliquer tout ce qui peut surprendre l’agent.',
    blocks: [
      { kind: 'text', text: 'Une lettre d’explication répond à une question avant que l’agent la pose. Elle est utile dès qu’un document manque ou qu’une information peut sembler incohérente.' },
      { kind: 'list', title: 'Exemples', items: [
        'Une période sans emploi dans votre historique.',
        'Un employeur qui refuse de donner une lettre, ou une entreprise fermée.',
        'Un nom écrit différemment selon les documents.',
        'Un certificat de police demandé mais pas encore reçu.',
        'Un gros dépôt sur votre compte.',
      ] },
      { kind: 'text', text: 'Conseil Stanzy : restez court, factuel et appuyé par des preuves. Une lettre par sujet, téléversée dans le champ du document concerné.' },
      { kind: 'cta', label: 'Faire relire mon dossier par Stanzy', href: '/services/verification' },
    ],
  },
};
