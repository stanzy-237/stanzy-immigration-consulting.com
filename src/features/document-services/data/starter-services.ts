import type { DocumentId } from '@/features/checklist/lib/build-checklist';
import type { Prerequisite, ServiceInput, Texts } from '@/features/document-services/lib/service-schema';

/**
 * The Services documentaires Stanzy starts with (#80), written once so the
 * consultant doesn't retype them: names, conditions and contract, in French
 * and English. No price: they are added inactive, and the consultant sets
 * each price in the Tableau de bord before turning it on.
 */
export type StarterService = Omit<ServiceInput, 'active' | 'price'>;

const file = (key: string, fr: string, en: string, kind: DocumentId | null = null): Prerequisite => ({
  key,
  fr,
  en,
  type: 'file',
  kind,
  when: null,
});

/**
 * What the bank needs for a proof of funds: a photo (any, no IRCC rules),
 * a signature on a blank page, where the Client lives and a payslip; with a
 * donation, the donor's photo too. The questionnaire asks the rest (NIU,
 * emergency contacts, the donor).
 */
const PROOF_OF_FUNDS: Prerequisite[] = [
  file('photo', 'Photo', 'Photo', 'photo'),
  { key: 'signature', fr: 'Signature numérique', en: 'Digital signature', type: 'signature', kind: null, when: null },
  file('plan-de-localisation', 'Plan de localisation', 'Location map'),
  file('bulletin-de-paie', 'Bulletin de paie', 'Payslip', 'payslips'),
  { ...file('photo-donateur', 'Photo du donateur', 'Donor’s photo'), when: 'donation' },
];

/** The police certificate's documents (also in the migration that brought prerequisites). */
const POLICE: Prerequisite[] = [
  file('cni', 'Carte nationale d’identité (CNI)', 'National ID card (CNI)'),
  file('passeport', 'Passeport', 'Passport', 'passport'),
  file('acte-de-naissance', 'Acte de naissance', 'Birth certificate', 'birthCertificate'),
  file('bulletin-n-3', 'Bulletin n° 3 (extrait de casier judiciaire)', 'Bulletin no. 3 (criminal record extract)'),
];

const contract = (fr: string, en: string): Texts => ({
  fr: `# Objet
Stanzy Immigration Consulting (le Prestataire) s’engage envers {client} (le Client) à obtenir le document suivant : {service}.

${fr}

# Prix et paiement
Le prix est de {prix}, payable selon l’échéancier suivant : {echeancier}. Le travail commence à réception du paiement prévu à la signature.

# Engagements du Client
- Fournir des informations exactes et les pièces demandées dans les délais.
- Signaler tout changement de situation pouvant toucher le document.

# Limites
Le Prestataire agit avec diligence mais ne répond pas des délais ou décisions des administrations et organismes tiers. Le document est remis tel que délivré par l’organisme compétent.

# Annulation
Le Client peut annuler avant le début des démarches et être remboursé, déduction faite des frais déjà engagés. Une fois les démarches engagées, le prix reste dû.

Contrat n° {numero}, établi le {date}.`,
  en: `# Purpose
Stanzy Immigration Consulting (the Provider) undertakes to {client} (the Client) to obtain the following document: {service}.

${en}

# Price and payment
The price is {prix}, payable on the following schedule: {echeancier}. Work starts once the payment due at signing is received.

# The Client’s commitments
- Give accurate information and the documents asked for, on time.
- Report any change of situation that could affect the document.

# Limits
The Provider acts with diligence but is not liable for the delays or decisions of authorities and third parties. The document is delivered as issued by the competent body.

# Cancellation
The Client may cancel before the steps begin and be refunded, less costs already incurred. Once the steps have begun, the price remains due.

Contract no. {numero}, made on {date}.`,
});

const kinds = (...ids: DocumentId[]) => ids;

/**
 * How Stanzy builds a proof of funds, from the consultant's « Budget
 * prévisionnel » (no rates here: each service's price lives in the
 * catalogue): two accounts, for traceability, the bank one at UBA when Stanzy
 * provides the funds, else at the Client's bank.
 */
const proofOfFundsService = (bank: { fr: string; en: string }) => ({
  fr: `# Prestation
Le Prestataire constitue une preuve de fonds conforme aux exigences d’Immigration, Réfugiés et Citoyenneté Canada (IRCC). Il travaille avec deux comptes, pour la traçabilité, la crédibilité et la conformité des fonds.

# 1. Compte en microfinance
Documents remis :
- Fiche d’ouverture du compte
- Attestation de domiciliation bancaire
- Attestation de solde bancaire
- Historique du compte
- Attestation de non-endettement
- Ordre de virement de compte à compte

# 2. Compte bancaire
Pour une meilleure transférabilité des fonds, un virement est effectué du compte de la microfinance vers un compte bancaire. ${bank.fr}
Documents remis :
- Relevé d’identité bancaire (RIB)
- Attestation de solde bancaire
- Historique du compte

# Délai
Environ 3 semaines après l’extraction du Client du bassin de l’Entrée express. La procédure ne débute qu’après cette extraction. Les délais sont indicatifs et peuvent varier selon les administrations concernées.

# Observations
- Tous les documents remis sont préparés conformément aux exigences d’IRCC.
- Toute prestation supplémentaire non mentionnée au présent contrat fait l’objet d’un devis complémentaire.`,
  en: `# Service
The Provider builds a proof of funds meeting the requirements of Immigration, Refugees and Citizenship Canada (IRCC). It works with two accounts, for the traceability, credibility and compliance of the funds.

# 1. Microfinance account
Documents delivered:
- Account opening form
- Bank domiciliation certificate
- Bank balance certificate
- Account history
- Certificate of no debt
- Account-to-account transfer order

# 2. Bank account
For better transferability of the funds, a transfer is made from the microfinance account to a bank account. ${bank.en}
Documents delivered:
- Bank details (RIB)
- Bank balance certificate
- Account history

# Turnaround
About 3 weeks after the Client is drawn from the Express Entry pool. The procedure only starts after that draw. Timings are indicative and may vary with the authorities involved.

# Notes
- All documents delivered are prepared to IRCC’s requirements.
- Any further service not mentioned in this contract is quoted separately.`,
});

const PROOF_OF_FUNDS_TURNAROUND = { fr: 'Environ 3 semaines après le démarrage de la procédure', en: 'About 3 weeks once the procedure starts' };

export const STARTER_SERVICES: StarterService[] = [
  {
    slug: 'preuve-de-fonds',
    name: { fr: 'Preuve de fonds (vous avez les fonds)', en: 'Proof of funds (you have the funds)' },
    summary: {
      fr: 'Vous disposez déjà des fonds requis pour votre demande de résidence permanente au Canada ? Stanzy structure votre preuve de fonds : un dépôt initial en microfinance, suivi d’un transfert vers le compte bancaire de votre choix. Dites adieu aux risques de refus liés à la transférabilité des fonds !\n\nNous constituons avec vous un dossier complet de preuve de fonds :\n• les justificatifs bancaires nécessaires ;\n• la traçabilité et la justification de la source des fonds ;\n• la cohérence des mouvements financiers ;\n• une documentation structurée, conforme aux exigences d’IRCC.\n\nAvec Stanzy, votre preuve de fonds ne se limite pas à un solde bancaire : elle repose sur un dossier documenté et cohérent.',
      en: 'You already have the funds required for your Canadian permanent residence application? Stanzy structures your proof of funds: an initial deposit in microfinance, followed by a transfer to the bank account of your choice. Say goodbye to refusals over the transferability of funds!\n\nWe build a complete proof of funds file with you:\n• the bank documents required;\n• the traceability and justification of the source of funds;\n• consistent financial movements;\n• structured documentation that meets IRCC’s requirements.\n\nWith Stanzy, your proof of funds is more than a bank balance: it rests on a documented, consistent file.',
    },
    provides: {
      fr: 'Votre pièce d’identité, la taille de votre famille, la date prévue de votre profil ou de votre ITA, et la banque vers laquelle transférer les fonds.',
      en: 'Your ID, your family size, the expected date of your profile or ITA, and the bank to transfer the funds to.',
    },
    turnaround: PROOF_OF_FUNDS_TURNAROUND,
    turnaroundDays: 21,
    conditions: {
      fr: 'La procédure débute uniquement après le versement des honoraires. Ces honoraires, un pourcentage du montant à justifier, couvrent tout le processus de constitution et de sécurisation de la preuve de fonds. Les fonds doivent être à votre nom et disponibles.',
      en: 'The procedure only starts once the fee is paid. The fee, a percentage of the amount to justify, covers the whole process of building and securing the proof of funds. The funds must be in your name and available.',
    },
    contractTitle: { fr: 'Contrat de service : preuve de fonds', en: 'Service contract: proof of funds' },
    contractBody: (({ fr, en }) => contract(fr, en))(
      proofOfFundsService({
        fr: 'Le Client fournissant lui-même les fonds, le virement est effectué vers la banque de son choix.',
        en: 'As the Client provides the funds, the transfer is made to the bank of their choice.',
      }),
    ),
    priceKind: 'PERCENT',
    unit: { fr: 'par dossier, en % du montant à justifier', en: 'per file, as a % of the amount to justify' },
    documentKinds: kinds('bankLetter', 'bankStatements'),
    prerequisites: PROOF_OF_FUNDS,
    questionnaire: 'proofOfFunds',
  },
  {
    slug: 'preuve-de-fonds-sans-fonds',
    name: { fr: 'Preuve de fonds (vous n’avez pas les fonds)', en: 'Proof of funds (you don’t have the funds)' },
    summary: {
      fr: 'Vous ne disposez pas des fonds requis pour votre demande de résidence permanente au Canada ? Stanzy les met à votre disposition, avec une preuve de fonds structurée : un dépôt initial en microfinance, suivi d’un transfert bancaire vers un compte UBA. Dites adieu aux risques de refus liés à la transférabilité des fonds !\n\nNous constituons avec vous un dossier complet de preuve de fonds :\n• les justificatifs bancaires nécessaires ;\n• la traçabilité et la justification de la source des fonds ;\n• la cohérence des mouvements financiers ;\n• une documentation structurée, conforme aux exigences d’IRCC.\n\nAvec Stanzy, votre preuve de fonds ne se limite pas à un solde bancaire : elle repose sur un dossier documenté et cohérent.',
      en: 'You don’t have the funds required for your Canadian permanent residence application? Stanzy provides them, with a structured proof of funds: an initial deposit in microfinance, followed by a bank transfer to a UBA account. Say goodbye to refusals over the transferability of funds!\n\nWe build a complete proof of funds file with you:\n• the bank documents required;\n• the traceability and justification of the source of funds;\n• consistent financial movements;\n• structured documentation that meets IRCC’s requirements.\n\nWith Stanzy, your proof of funds is more than a bank balance: it rests on a documented, consistent file.',
    },
    provides: {
      fr: 'Votre pièce d’identité, la taille de votre famille et la date prévue de votre profil ou de votre ITA.',
      en: 'Your ID, your family size and the expected date of your profile or ITA.',
    },
    turnaround: PROOF_OF_FUNDS_TURNAROUND,
    turnaroundDays: 21,
    conditions: {
      fr: 'La procédure débute uniquement après le versement des honoraires. Ces honoraires, un pourcentage du montant à justifier, comprennent la mise à disposition des fonds ainsi que tout le processus de constitution et de sécurisation de la preuve de fonds. Si vous avez déjà un compte UBA, il doit être fermé : un nouveau compte est ouvert à votre nom.',
      en: 'The procedure only starts once the fee is paid. The fee, a percentage of the amount to justify, covers providing the funds and the whole process of building and securing the proof of funds. If you already have a UBA account, it must be closed: a new account is opened in your name.',
    },
    contractTitle: { fr: 'Contrat de service : preuve de fonds (montage)', en: 'Service contract: proof of funds (arranged)' },
    contractBody: (({ fr, en }) => contract(fr, en))(
      proofOfFundsService({
        fr: 'Le Prestataire fournissant les fonds, le compte est ouvert à UBA. Le prix comprend la mise à disposition des fonds et tout le processus de constitution et de sécurisation de la preuve de fonds.',
        en: 'As the Provider provides the funds, the account is opened at UBA. The price covers providing the funds and the whole process of building and securing the proof of funds.',
      }),
    ),
    priceKind: 'PERCENT',
    unit: { fr: 'par dossier, en % du montant à justifier', en: 'per file, as a % of the amount to justify' },
    documentKinds: kinds('bankLetter', 'bankStatements'),
    prerequisites: PROOF_OF_FUNDS,
    questionnaire: 'proofOfFundsNoFunds',
  },
  {
    slug: 'certificat-de-police',
    name: { fr: 'Certificat de police', en: 'Police certificate' },
    summary: {
      fr: 'Stanzy fait la demande de votre extrait de casier judiciaire et le suit jusqu’à la remise, traduction comprise si besoin.',
      en: 'Stanzy applies for your criminal record extract and follows it to delivery, translation included if needed.',
    },
    provides: {
      fr: 'Votre pièce d’identité, votre acte de naissance et la liste des pays où vous avez vécu 6 mois ou plus depuis vos 18 ans.',
      en: 'Your ID, your birth certificate and the list of countries where you lived 6 months or more since age 18.',
    },
    turnaround: { fr: '5 à 15 jours ouvrables', en: '5 to 15 business days' },
    turnaroundDays: null,
    conditions: {
      fr: 'Un certificat par pays et par personne. Les délais dépendent des autorités de chaque pays.',
      en: 'One certificate per country and per person. Timing depends on each country’s authorities.',
    },
    contractTitle: { fr: 'Contrat de service : certificat de police', en: 'Service contract: police certificate' },
    contractBody: contract(
      '# Prestation\nLe Prestataire dépose la demande de certificat de police au nom du Client, en assure le suivi et lui remet le certificat délivré.',
      '# Service\nThe Provider files the police certificate application in the Client’s name, follows it up and delivers the certificate issued.',
    ),
    priceKind: 'FIXED',
    unit: { fr: 'par pays et par personne', en: 'per country and per person' },
    documentKinds: kinds('policeCertificate'),
    prerequisites: POLICE,
    questionnaire: null,
  },
  {
    slug: 'attestation-cnps',
    name: { fr: 'Attestation CNPS', en: 'CNPS certificate' },
    summary: {
      fr: 'L’attestation d’immatriculation et de cotisations CNPS qui prouve votre expérience de travail au Cameroun.',
      en: 'The CNPS registration and contributions certificate that proves your work experience in Cameroon.',
    },
    provides: {
      fr: 'Votre numéro CNPS (si vous l’avez), le nom de votre employeur et vos dates d’emploi.',
      en: 'Your CNPS number (if you have it), your employer’s name and your dates of employment.',
    },
    turnaround: { fr: '7 à 14 jours ouvrables', en: '7 to 14 business days' },
    turnaroundDays: null,
    conditions: {
      fr: 'Réservé aux emplois chez un employeur affilié à la CNPS. Sinon, le service n’est pas disponible.',
      en: 'Only for jobs with an employer affiliated with the CNPS. Otherwise, the service isn’t available.',
    },
    contractTitle: { fr: 'Contrat de service : attestation CNPS', en: 'Service contract: CNPS certificate' },
    contractBody: contract(
      '# Prestation\nLe Prestataire obtient auprès de la CNPS l’attestation d’immatriculation et de cotisations du Client pour l’emploi indiqué.',
      '# Service\nThe Provider obtains from the CNPS the Client’s registration and contributions certificate for the job given.',
    ),
    priceKind: 'FIXED',
    unit: { fr: 'par emploi', en: 'per job' },
    documentKinds: kinds('socialSecurity'),
    prerequisites: [],
    questionnaire: null,
  },
  {
    slug: 'compte-salaire',
    name: { fr: 'Compte salaire', en: 'Salary account' },
    summary: {
      fr: 'Les relevés du compte où votre salaire est versé, présentés comme IRCC les attend pour confirmer votre emploi.',
      en: 'Statements of the account your salary is paid into, presented as IRCC expects to confirm your job.',
    },
    provides: {
      fr: 'Le nom de votre banque, le nom de votre employeur et vos dates d’emploi.',
      en: 'Your bank’s name, your employer’s name and your dates of employment.',
    },
    turnaround: { fr: '7 à 14 jours ouvrables', en: '7 to 14 business days' },
    turnaroundDays: null,
    conditions: {
      fr: 'Un service par emploi. Le salaire doit être versé sur un compte bancaire à votre nom.',
      en: 'One service per job. The salary must be paid into a bank account in your name.',
    },
    contractTitle: { fr: 'Contrat de service : compte salaire', en: 'Service contract: salary account' },
    contractBody: contract(
      '# Prestation\nLe Prestataire obtient auprès de la banque du Client les relevés du compte salaire pour l’emploi indiqué.',
      '# Service\nThe Provider obtains from the Client’s bank the salary account statements for the job given.',
    ),
    priceKind: 'FIXED',
    unit: { fr: 'par emploi', en: 'per job' },
    documentKinds: kinds('salaryStatements', 'payslips'),
    prerequisites: [],
    questionnaire: null,
  },
  {
    slug: 'attestation-conformite-fiscale',
    name: { fr: 'ACF (Attestation de conformité fiscale)', en: 'ACF (tax compliance certificate)' },
    summary: {
      fr: 'L’attestation de conformité fiscale délivrée par les impôts, qui appuie une activité ou un emploi déclaré.',
      en: 'The tax compliance certificate issued by the tax office, supporting a declared activity or job.',
    },
    provides: {
      fr: 'Votre numéro d’identifiant unique (NIU) et le nom de l’entreprise ou de l’activité.',
      en: 'Your taxpayer number (NIU) and the name of the business or activity.',
    },
    turnaround: { fr: '5 à 10 jours ouvrables', en: '5 to 10 business days' },
    turnaroundDays: null,
    conditions: {
      fr: 'Le contribuable doit être à jour de ses obligations fiscales.',
      en: 'The taxpayer must be up to date with their tax obligations.',
    },
    contractTitle: { fr: 'Contrat de service : attestation de conformité fiscale', en: 'Service contract: tax compliance certificate' },
    contractBody: contract(
      '# Prestation\nLe Prestataire obtient auprès de l’administration fiscale l’attestation de conformité fiscale pour le contribuable indiqué.',
      '# Service\nThe Provider obtains from the tax administration the tax compliance certificate for the taxpayer given.',
    ),
    priceKind: 'FIXED',
    unit: { fr: 'par attestation', en: 'per certificate' },
    documentKinds: kinds('selfEmployedProof'),
    prerequisites: [],
    questionnaire: null,
  },
  {
    slug: 'pack-experience-pro',
    name: { fr: 'Pack expérience pro (CNPS + compte salaire)', en: 'Work experience pack (CNPS + salary account)' },
    summary: {
      fr: 'L’attestation CNPS et le compte salaire ensemble, pour prouver un emploi de bout en bout. Remplace les deux services pour cet emploi.',
      en: 'The CNPS certificate and the salary account together, to prove a job end to end. Replaces both services for that job.',
    },
    provides: {
      fr: 'Votre numéro CNPS (si vous l’avez), le nom de votre employeur et de votre banque, et vos dates d’emploi.',
      en: 'Your CNPS number (if you have it), your employer’s and bank’s names, and your dates of employment.',
    },
    turnaround: { fr: '10 à 20 jours ouvrables', en: '10 to 20 business days' },
    turnaroundDays: null,
    conditions: {
      fr: 'Réservé aux emplois chez un employeur affilié à la CNPS. Un pack par emploi.',
      en: 'Only for jobs with an employer affiliated with the CNPS. One pack per job.',
    },
    contractTitle: { fr: 'Contrat de service : pack expérience pro', en: 'Service contract: work experience pack' },
    contractBody: contract(
      '# Prestation\nLe Prestataire obtient l’attestation CNPS et les relevés du compte salaire du Client pour l’emploi indiqué.',
      '# Service\nThe Provider obtains the Client’s CNPS certificate and salary account statements for the job given.',
    ),
    priceKind: 'FIXED',
    unit: { fr: 'par emploi', en: 'per job' },
    documentKinds: kinds('socialSecurity', 'salaryStatements'),
    prerequisites: [],
    questionnaire: null,
  },
];
