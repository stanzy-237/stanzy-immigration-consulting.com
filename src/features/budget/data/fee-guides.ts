import { BIOMETRICS_FAMILY_CAP, OFFICIAL_FEES } from '@/features/budget/data/fees';
import { TCF_ACADEMY_URL } from '@/features/shared/data/links';
import type { Locale } from '@/i18n/routing';

/**
 * The « En savoir plus » guides of the estimator: what each cost is, when and
 * how it is paid, and the steps behind it. Content, not code: each guide is a
 * list of blocks, so the consultant can later edit them from the admin
 * dashboard (#68) once they move to the database. Amounts come from the same
 * constants as the estimator, so a fee change never leaves a guide behind.
 *
 * Images: only images Stanzy owns or has permission to use.
 */
export type GuideBlock =
  | { kind: 'text'; text: string }
  | { kind: 'list'; title?: string; items: string[] }
  /** Highlighted, e.g. a warning or Stanzy's own offer. */
  | { kind: 'note'; text: string }
  /** `href` starting with « / » is a page of this site, in the visitor's language. */
  | { kind: 'link'; label: string; href: string }
  /** A button, e.g. « Me contacter sur WhatsApp » (tone `whatsapp`) or a Stanzy service. */
  | { kind: 'cta'; label: string; href: string; tone?: 'whatsapp' };

export type FeeGuide = {
  blocks: GuideBlock[];
  image?: { src: string; alt: string };
};

/** Estimator lines that have a guide; the child's fee shares the adult one. */
export const GUIDE_FOR = {
  processing: 'processing',
  childProcessing: 'processing',
  rprf: 'rprf',
  biometrics: 'biometrics',
  eca: 'eca',
  languageTest: 'languageTest',
  medical: 'medical',
  police: 'police',
  passport: 'passport',
} as const;
export type GuideKey = (typeof GUIDE_FOR)[keyof typeof GUIDE_FOR];

const IRCC_FEES_FR = 'https://ircc.canada.ca/francais/information/frais/frais.asp';
const IRCC_FEES_EN = 'https://ircc.canada.ca/english/information/fees/fees.asp';
const BIOMETRICS_FR = 'https://www.canada.ca/fr/immigration-refugies-citoyennete/campagnes/biometrie.html';
const BIOMETRICS_EN = 'https://www.canada.ca/en/immigration-refugees-citizenship/campaigns/biometrics.html';
const PANEL_PHYSICIANS_FR = 'https://secure.cic.gc.ca/PanelPhysicianMedecinDesigne/fr/Accueil';
const PANEL_PHYSICIANS_EN = 'https://secure.cic.gc.ca/PanelPhysicianMedecinDesigne/en/Home';

/** Cameroon: the IOM runs the immigration medicals; booking is online. */
const IOM_MEDICAL_BOOKING = 'https://mymedical.iom.int/apps/omas/#_frmHomeV2';
/** Cameroon: biometrics are collected at VFS Global; booking is online. */
const VFS_BIOMETRICS_BOOKING =
  'https://www.vfsglobal.ca/IRCC-AppointmentWave1/Account/RegisteredLogin?q=shSA0YnE4pLF9Xzwon/x/CQ1P0LBKn66dLdNUfueK+z6PKDIRlw2IQmnt5xZX+Fo2ufIrALrv2nK6ON1FZloVg==';
/** Stanzy's EDE service (WES, IQAS) page. */
const EDE_SERVICE = '/services/ede';
/** The Cameroonian state universities whose graduates Stanzy's EDE service covers. */
const EDE_UNIVERSITIES = ['Dschang', 'Yaoundé I', 'Yaoundé II', 'Buea', 'Bamenda', 'Maroua', 'Ngaoundéré'];

/** Stanzy's WhatsApp, with the police-certificate request typed in. */
const WHATSAPP_POLICE = `https://wa.me/message/H3LTKVCVL6GAL1?text=${encodeURIComponent(
  'Je suis intéressé par le certificat de police',
)}`;

const NBSP = ' ';
const cad = (amount: number) => `${amount}${NBSP}$ CA`;
const cadEn = (amount: number) => `CAD${NBSP}${amount}`;

const { processing, childProcessing, rprf, biometrics } = OFFICIAL_FEES;

export const FEE_GUIDES: Record<Locale, Record<GuideKey, FeeGuide>> = {
  fr: {
    processing: {
      blocks: [
        {
          kind: 'text',
          text: `Les frais qu’IRCC demande pour étudier votre demande de résidence permanente\u202f: ${cad(processing.amount)} par adulte (vous et votre époux ou conjoint de fait) et ${cad(childProcessing.amount)} par enfant à charge.`,
        },
        {
          kind: 'list',
          title: 'Bon à savoir',
          items: [
            'Ils se paient en ligne, par carte, quand vous soumettez votre demande, dans les 60 jours qui suivent l’ITA.',
            'Ils ne sont plus remboursés une fois le traitement de la demande commencé.',
            'Montants en vigueur depuis le 30 avril 2026.',
          ],
        },
        { kind: 'link', label: 'La grille officielle des frais d’IRCC', href: IRCC_FEES_FR },
      ],
    },
    rprf: {
      blocks: [
        {
          kind: 'text',
          text: `Les frais relatifs au droit de résidence permanente (FRDRP, ou RPRF en anglais)\u202f: ${cad(rprf.amount)} par adulte. Les enfants à charge n’en paient pas.`,
        },
        {
          kind: 'list',
          title: 'Bon à savoir',
          items: [
            'Vous pouvez les payer avec la demande, ou attendre qu’IRCC vous les demande, avant la confirmation de résidence permanente (COPR).',
            'S’ils sont payés et que la demande est refusée ou retirée, ils vous sont remboursés.',
          ],
        },
        { kind: 'note', text: 'Les payer dès la soumission évite d’attendre cette demande d’IRCC à la fin du dossier.' },
        { kind: 'link', label: 'La grille officielle des frais d’IRCC', href: IRCC_FEES_FR },
      ],
    },
    biometrics: {
      blocks: [
        {
          kind: 'text',
          text: 'Vos empreintes digitales et votre photo, prises dans un centre de collecte agréé par IRCC, sur rendez-vous.',
        },
        {
          kind: 'list',
          title: 'Les frais',
          items: [
            `${cad(biometrics.amount)} par personne, ${cad(BIOMETRICS_FAMILY_CAP)} au maximum par famille qui fait sa demande ensemble.`,
            'Ils sont payés avec les frais de la demande, au moment de la soumission. Rien à payer au centre de collecte.',
          ],
        },
        {
          kind: 'list',
          title: 'Comment ça se passe',
          items: [
            'Après la soumission, IRCC vous envoie une lettre d’instructions pour la biométrie.',
            'Vous avez 30 jours pour vous présenter au centre de collecte, sur rendez-vous.',
            'Apportez la lettre d’instructions, la lettre de rendez-vous, le formulaire de consentement rempli en majuscules et votre passeport valide.',
            'Vos données biométriques restent valides 10 ans\u202f: si vous en avez donné il y a moins de 10 ans, vous n’avez pas à recommencer.',
          ],
        },
        {
          kind: 'note',
          text: 'Au Cameroun, la collecte se fait au centre VFS Global\u202f: prenez rendez-vous en ligne, votre lettre d’instructions en main.',
        },
        { kind: 'cta', label: 'Prendre rendez-vous pour la biométrie (VFS Global)', href: VFS_BIOMETRICS_BOOKING },
        { kind: 'link', label: 'Les données biométriques sur le site d’IRCC', href: BIOMETRICS_FR },
      ],
    },
    medical: {
      blocks: [
        {
          kind: 'text',
          text: 'L’examen médical est obligatoire pour vous et pour chaque membre de votre famille, même ceux qui ne vous accompagnent pas au Canada.',
        },
        {
          kind: 'list',
          title: 'Quand et où',
          items: [
            'Attendez les instructions d’IRCC\u202f: elles arrivent après la soumission de votre demande. Vous avez en général 30 jours pour passer l’examen.',
            'Il se fait uniquement chez un médecin désigné par IRCC. Votre médecin de famille ne peut pas le faire s’il ne figure pas sur la liste.',
            'Le résultat est valide 12 mois.',
          ],
        },
        {
          kind: 'list',
          title: 'À apporter',
          items: [
            'Le passeport valide de chaque membre de la famille',
            'La lettre d’instructions médicales d’IRCC',
            'La lettre de rendez-vous de la clinique',
            'Le reçu de paiement, si la clinique se fait payer à l’avance',
          ],
        },
        {
          kind: 'list',
          title: 'Le jour du rendez-vous',
          items: ['Arrivez 15 minutes en avance.', 'Évitez les vêtements blancs.', 'Portez un masque si la clinique le demande.'],
        },
        {
          kind: 'note',
          text: 'Au Cameroun, la visite médicale est assurée par l’OIM (Organisation internationale pour les migrations)\u202f: réservez votre rendez-vous en ligne. Ailleurs, le prix est fixé par la clinique et varie d’un médecin à l’autre.',
        },
        { kind: 'cta', label: 'Réserver ma visite médicale (OIM)', href: IOM_MEDICAL_BOOKING },
        { kind: 'link', label: 'Trouver un médecin désigné (outil d’IRCC)', href: PANEL_PHYSICIANS_FR },
      ],
    },
    police: {
      blocks: [
        {
          kind: 'text',
          text: 'IRCC demande un certificat de police pour chaque pays où vous avez vécu 6 mois de suite ou plus depuis vos 18 ans, à vous et à votre époux ou conjoint de fait.',
        },
        {
          kind: 'list',
          title: 'Au Cameroun, en deux étapes',
          items: [
            'Demandez l’extrait de casier judiciaire au tribunal de première instance de votre lieu de naissance.',
            'Avec cet extrait, demandez le certificat de police à la Direction de la police judiciaire, à Yaoundé.',
          ],
        },
        {
          kind: 'note',
          text: 'Uniquement pour le Cameroun\u202f: vous n’êtes pas à Yaoundé\u202f? Contactez-moi, je m’occupe d’obtenir votre certificat de police.',
        },
        {
          kind: 'list',
          title: 'Dossier à fournir',
          items: ['Acte de naissance', 'CNI (carte nationale d’identité)', `Bulletin n°${NBSP}3`, 'Passeport'],
        },
        { kind: 'cta', label: 'Me contacter sur WhatsApp', href: WHATSAPP_POLICE, tone: 'whatsapp' },
      ],
    },
    eca: {
      blocks: [
        {
          kind: 'text',
          text: 'L’évaluation des diplômes d’études (EDE) prouve à IRCC que votre diplôme étranger vaut un diplôme canadien. Elle est faite par un organisme désigné, comme WES ou IQAS.',
        },
        {
          kind: 'list',
          title: 'Bon à savoir',
          items: [
            'Elle est exigée pour les Travailleurs qualifiés (fédéral) et pour compter vos études étrangères dans le score CRS.',
            'Elle reste valide 5 ans à partir de sa date de délivrance.',
            'Comptez plusieurs semaines\u202f: votre université doit envoyer elle-même vos relevés à l’organisme.',
          ],
        },
        {
          kind: 'note',
          text: `Uniquement pour les candidats camerounais\u202f: je m’occupe de votre évaluation WES ou IQAS pour les diplômes des universités de ${EDE_UNIVERSITIES.slice(0, -1).join(', ')} et ${EDE_UNIVERSITIES.at(-1)}.`,
        },
        { kind: 'cta', label: 'Découvrir le service EDE', href: EDE_SERVICE },
      ],
    },
    languageTest: {
      blocks: [
        {
          kind: 'text',
          text: 'IRCC n’accepte que certains tests\u202f: TEF Canada ou TCF Canada pour le français, IELTS General Training ou CELPIP-General pour l’anglais.',
        },
        {
          kind: 'list',
          title: 'Bon à savoir',
          items: [
            'Les résultats sont valides 2 ans\u202f: ils doivent l’être encore le jour où vous soumettez votre demande.',
            'Chaque compétence (oral, écrit, compréhension, expression) compte\u202f: c’est la plus faible qui décide de votre admissibilité.',
          ],
        },
        {
          kind: 'note',
          text: 'Vous passez le TCF Canada\u202f? Préparez-vous sur TCF Express Academy, notre plateforme\u202f: exercices, examens blancs et coaching personnalisé.',
        },
        { kind: 'cta', label: 'Me préparer sur TCF Express Academy', href: TCF_ACADEMY_URL },
      ],
    },
    passport: {
      blocks: [
        {
          kind: 'text',
          text: 'Un passeport valide est indispensable tout au long de la procédure\u202f: pour la biométrie, la visite médicale, puis à la fin, quand IRCC vous le demande pour y apposer votre visa de résident permanent.',
        },
        {
          kind: 'list',
          title: 'Bon à savoir',
          items: [
            'Votre visa de résident permanent ne peut pas aller au-delà de la date d’expiration du passeport.',
            'Chaque membre de la famille a besoin du sien, enfants compris.',
          ],
        },
        { kind: 'note', text: 'Renouvelez-le avant de soumettre la demande s’il expire dans moins d’un an.' },
      ],
    },
  },
  en: {
    processing: {
      blocks: [
        {
          kind: 'text',
          text: `What IRCC charges to process your permanent residence application: ${cadEn(processing.amount)} per adult (you and your spouse or common-law partner) and ${cadEn(childProcessing.amount)} per dependent child.`,
        },
        {
          kind: 'list',
          title: 'Good to know',
          items: [
            'Paid online, by card, when you submit your application, within 60 days of your ITA.',
            'Not refunded once processing has started.',
            'Amounts in force since 30 April 2026.',
          ],
        },
        { kind: 'link', label: 'IRCC’s official fee list', href: IRCC_FEES_EN },
      ],
    },
    rprf: {
      blocks: [
        {
          kind: 'text',
          text: `The right of permanent residence fee (RPRF): ${cadEn(rprf.amount)} per adult. Dependent children don’t pay it.`,
        },
        {
          kind: 'list',
          title: 'Good to know',
          items: [
            'You can pay it with your application, or wait until IRCC asks for it, before your confirmation of permanent residence (COPR).',
            'If you paid it and the application is refused or withdrawn, it is refunded.',
          ],
        },
        { kind: 'note', text: 'Paying it when you submit saves waiting for IRCC’s request at the end.' },
        { kind: 'link', label: 'IRCC’s official fee list', href: IRCC_FEES_EN },
      ],
    },
    biometrics: {
      blocks: [
        {
          kind: 'text',
          text: 'Your fingerprints and photo, taken at a collection centre IRCC approves, by appointment.',
        },
        {
          kind: 'list',
          title: 'The fee',
          items: [
            `${cadEn(biometrics.amount)} per person, at most ${cadEn(BIOMETRICS_FAMILY_CAP)} for a family applying together.`,
            'Paid with your application fees, when you submit. Nothing to pay at the collection centre.',
          ],
        },
        {
          kind: 'list',
          title: 'How it goes',
          items: [
            'After you submit, IRCC sends you a biometric instruction letter.',
            'You have 30 days to go to the collection centre, by appointment.',
            'Bring the instruction letter, your appointment letter, the consent form filled in capital letters and your valid passport.',
            'Your biometrics stay valid for 10 years: if you gave them less than 10 years ago, you don’t give them again.',
          ],
        },
        {
          kind: 'note',
          text: 'In Cameroon, biometrics are collected at the VFS Global centre: book online, with your instruction letter at hand.',
        },
        { kind: 'cta', label: 'Book a biometrics appointment (VFS Global)', href: VFS_BIOMETRICS_BOOKING },
        { kind: 'link', label: 'Biometrics on IRCC’s website', href: BIOMETRICS_EN },
      ],
    },
    medical: {
      blocks: [
        {
          kind: 'text',
          text: 'The medical exam is required for you and every member of your family, even those not coming with you to Canada.',
        },
        {
          kind: 'list',
          title: 'When and where',
          items: [
            'Wait for IRCC’s instructions: they come after you submit your application. You usually have 30 days to take the exam.',
            'Only a panel physician approved by IRCC can do it. Your family doctor can’t unless they are on the list.',
            'The result is valid for 12 months.',
          ],
        },
        {
          kind: 'list',
          title: 'What to bring',
          items: [
            'A valid passport for each family member',
            'IRCC’s medical instructions letter',
            'The clinic’s appointment letter',
            'The payment receipt, if the clinic asks for payment in advance',
          ],
        },
        {
          kind: 'list',
          title: 'On the day',
          items: ['Arrive 15 minutes early.', 'Avoid white clothes.', 'Wear a mask if the clinic asks.'],
        },
        {
          kind: 'note',
          text: 'In Cameroon, the medical exam is done by the IOM (International Organization for Migration): book your appointment online. Elsewhere, the clinic sets the price, and it varies from one physician to another.',
        },
        { kind: 'cta', label: 'Book my medical exam (IOM)', href: IOM_MEDICAL_BOOKING },
        { kind: 'link', label: 'Find a panel physician (IRCC tool)', href: PANEL_PHYSICIANS_EN },
      ],
    },
    police: {
      blocks: [
        {
          kind: 'text',
          text: 'IRCC asks for a police certificate for every country where you lived 6 months in a row or more since you turned 18, for you and your spouse or common-law partner.',
        },
        {
          kind: 'list',
          title: 'In Cameroon, in two steps',
          items: [
            'Request your criminal record extract from the court of first instance (tribunal de première instance) where you were born.',
            'With that extract, apply for the police certificate at the Direction de la police judiciaire in Yaoundé.',
          ],
        },
        {
          kind: 'note',
          text: 'Cameroon only: not in Yaoundé? Contact me and I’ll get your police certificate for you.',
        },
        {
          kind: 'list',
          title: 'Documents to provide',
          items: ['Birth certificate (acte de naissance)', 'National ID card (CNI)', `Bulletin n°${NBSP}3`, 'Passport'],
        },
        { kind: 'cta', label: 'Contact me on WhatsApp', href: WHATSAPP_POLICE, tone: 'whatsapp' },
      ],
    },
    eca: {
      blocks: [
        {
          kind: 'text',
          text: 'An educational credential assessment (ECA) shows IRCC what your foreign diploma is worth in Canada. A designated organisation does it, such as WES or IQAS.',
        },
        {
          kind: 'list',
          title: 'Good to know',
          items: [
            'It is required for the Federal Skilled Worker program and to count your foreign education in your CRS score.',
            'It stays valid for 5 years from the date it was issued.',
            'Allow several weeks: your university must send your transcripts to the organisation itself.',
          ],
        },
        {
          kind: 'note',
          text: `For Cameroonian candidates only: I handle your WES or IQAS assessment for diplomas from the universities of ${EDE_UNIVERSITIES.slice(0, -1).join(', ')} and ${EDE_UNIVERSITIES.at(-1)}.`,
        },
        { kind: 'cta', label: 'See the EDE service', href: EDE_SERVICE },
      ],
    },
    languageTest: {
      blocks: [
        {
          kind: 'text',
          text: 'IRCC accepts only certain tests: TEF Canada or TCF Canada for French, IELTS General Training or CELPIP-General for English.',
        },
        {
          kind: 'list',
          title: 'Good to know',
          items: [
            'Results are valid for 2 years: they must still be valid on the day you submit your application.',
            'Every skill (listening, reading, speaking, writing) counts: the weakest one decides your eligibility.',
          ],
        },
        {
          kind: 'note',
          text: 'Taking the TCF Canada? Prepare on TCF Express Academy, our platform: exercises, mock exams and personalised coaching.',
        },
        { kind: 'cta', label: 'Prepare on TCF Express Academy', href: TCF_ACADEMY_URL },
      ],
    },
    passport: {
      blocks: [
        {
          kind: 'text',
          text: 'You need a valid passport throughout: for biometrics, the medical exam, and at the end, when IRCC asks for it to place your permanent resident visa in it.',
        },
        {
          kind: 'list',
          title: 'Good to know',
          items: [
            'Your permanent resident visa can’t run past your passport’s expiry date.',
            'Every family member needs their own, children included.',
          ],
        },
        { kind: 'note', text: 'Renew it before you submit if it expires within a year.' },
      ],
    },
  },
};
