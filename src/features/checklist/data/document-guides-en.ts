import type { DocumentGuides } from '@/features/checklist/data/document-guides';
import { FUNDS_PER_EXTRA_PERSON, FUNDS_TABLE } from '@/features/budget/data/fees';
import { TCF_ACADEMY_URL } from '@/features/shared/data/links';

const IRCC = 'https://www.canada.ca/en/immigration-refugees-citizenship';
const EE_DOCUMENTS = `${IRCC}/services/immigrate-canada/express-entry/documents.html`;
const cad = (amount: number) => `CAD ${amount.toLocaleString('en-CA')}`;

/** The Checklist's « En savoir plus » guides, in English (see the French ones). */
export const DOCUMENT_GUIDES_EN: DocumentGuides = {
  passport: {
    name: 'Passport',
    summary: 'The identity pages, in colour, for everyone on the application.',
    blocks: [
      { kind: 'text', text: 'IRCC checks your identity and citizenship with your passport. You upload a clear colour copy of the personal information page (photo, name, date of birth, number, issue and expiry dates).' },
      { kind: 'list', title: 'To prepare', items: [
        'The identity page of each valid passport, in colour and in full (all 4 corners visible).',
        'Pages with a visa, a stamp or a note, if you travelled or lived abroad: they confirm your travel history.',
        'If your name changed (marriage, court decision), the document that proves it.',
      ] },
      { kind: 'note', text: 'Renew your passport if it expires within 6 months. The permanent resident visa can’t be valid longer than the passport: a passport that expires soon can delay the end of your file.' },
      { kind: 'text', text: 'Stanzy’s advice: renewing takes months in some countries. Check the expiry date of every passport in the family now.' },
      { kind: 'link', label: 'Express Entry documents (IRCC)', href: EE_DOCUMENTS },
    ],
  },
  photo: {
    name: 'Digital photo',
    summary: 'A recent photo to IRCC’s specifications, for each person.',
    blocks: [
      { kind: 'text', text: 'The permanent residence application asks for a digital photo of each person. It is also used for your permanent resident card: a refused photo delays the card.' },
      { kind: 'list', title: 'What IRCC checks', items: [
        'A recent photo, taken by a photographer who knows IRCC’s requirements.',
        'A plain, light background, face straight on, neutral expression, eyes open, mouth closed.',
        'No glasses, and no head covering except for religious reasons (the whole face must show).',
        'A sharp image, not retouched or filtered.',
      ] },
      { kind: 'text', text: 'Stanzy’s advice: show the photographer IRCC’s permanent residence photo specifications and ask for the digital file, not just the print.' },
      { kind: 'link', label: 'Express Entry documents (IRCC)', href: EE_DOCUMENTS },
    ],
  },
  birthCertificate: {
    name: 'Birth certificate',
    summary: 'Mandatory for children; useful for you and your spouse.',
    blocks: [
      { kind: 'text', text: 'A birth certificate proves identity and, for a child, the link to their parents. IRCC requires one for each dependent child; for you and your spouse, it confirms your date of birth and your parents’ names.' },
      { kind: 'list', title: 'To prepare', items: [
        'A full copy of the certificate, showing both parents’ names.',
        'For a recent certificate (reconstituted or issued by court decision), keep the decision too.',
        'A certified translation if it is in neither English nor French.',
      ] },
      { kind: 'note', text: 'If a child comes to Canada without the other parent, prepare that parent’s written consent or the custody decision: IRCC asks for it.' },
      { kind: 'text', text: 'Stanzy’s advice: check that names and dates are spelled the same on the certificate, the passport and your diplomas. A difference is easier to fix before the ITA, or to explain in a letter.' },
    ],
  },
  marriageCertificate: {
    name: 'Marriage certificate',
    summary: 'Proof of your marriage.',
    blocks: [
      { kind: 'text', text: 'If you are married, IRCC asks for proof of the marriage, even if your spouse isn’t coming to Canada. A religious or customary marriage must be recognized by the law of the country where it took place.' },
      { kind: 'list', title: 'To prepare', items: [
        'The marriage certificate issued by the civil registry.',
        'A certified translation if it is in neither English nor French.',
      ] },
      { kind: 'note', text: 'Separated but still married? The marriage still exists for IRCC: declare it and keep the certificate, with a letter explaining the separation.' },
      { kind: 'text', text: 'Stanzy’s advice: your marital status must be the same everywhere (profile, forms, documents). A marriage after you created your profile must be declared in it right away.' },
    ],
  },
  commonLawProof: {
    name: 'Proof of common-law partnership',
    summary: 'Form IMM 5409 and proof of 12 months living together.',
    blocks: [
      { kind: 'text', text: 'For IRCC, a common-law partnership means living together as a couple for at least 12 months in a row. You prove it with a declaration and documents.' },
      { kind: 'list', title: 'To prepare', items: [
        'Form IMM 5409 (Statutory Declaration of Common-law Union), signed by both partners.',
        'Proof of a shared address for 12 months: a lease or deed in both names, bills, official mail at the same address.',
        'Proof of life as a couple: a joint bank account, insurance naming each other, photos, trips together.',
      ] },
      { kind: 'text', text: 'Stanzy’s advice: gather proof covering the whole period, month after month. A few well-dated documents beat many photos.' },
      { kind: 'link', label: 'Form IMM 5409 (IRCC)', href: `${IRCC}/services/application/application-forms-guides/imm5409.html` },
    ],
  },
  previousUnionProof: {
    name: 'End of a previous union',
    summary: 'Divorce, death or annulment of a marriage or common-law union.',
    blocks: [
      { kind: 'text', text: 'If you were married or in a common-law union before, IRCC wants to know how it ended. Without this document, a new marriage can be questioned.' },
      { kind: 'list', title: 'Depending on your situation', items: [
        'Divorce: the final divorce decree or certificate.',
        'Widowed: the former spouse’s death certificate.',
        'Annulment: the annulment decision.',
        'End of a common-law union: a declaration or proof of the separation (separate addresses, for example).',
      ] },
      { kind: 'text', text: 'Stanzy’s advice: declare every previous union in the forms, even short ones. A forgotten union is a misrepresentation.' },
    ],
  },
  personalHistory: {
    name: 'Personal history and addresses (10 years)',
    summary: 'Activities and addresses month by month, with no gaps.',
    blocks: [
      { kind: 'text', text: 'After the ITA, you fill in Schedule A (Background / Declaration) online. It asks what you did and where you lived over the last 10 years (or since you turned 18), with no gaps at all.' },
      { kind: 'list', title: 'To prepare now', items: [
        'Each activity, with start and end dates (month and year): studies, jobs, unemployment, job search, travel, leave…',
        'Each address where you lived, with the dates.',
        'Trips outside your country of residence.',
        'Any membership in organizations, military service or government jobs.',
      ] },
      { kind: 'note', text: 'A period without activity must still be declared (“unemployed”, “looking for work”). Dates must match your employment letters and diplomas exactly.' },
      { kind: 'text', text: 'Stanzy’s advice: build this table in a file today. It is the part that takes longest after the ITA, and the most common source of inconsistencies.' },
    ],
  },
  familyInformation: {
    name: 'Family information',
    summary: 'Parents, siblings, children: names, dates of birth, addresses.',
    blocks: [
      { kind: 'text', text: 'The Additional Family Information form (IMM 5406) asks about your whole close family, whether they come to Canada or not.' },
      { kind: 'list', title: 'For each person', items: [
        'Your parents, your spouse, your children (even adult or married), your brothers and sisters (half-siblings included).',
        'Full name, date and country of birth, marital status, current address, occupation.',
        'For someone who died: the date and place of death.',
      ] },
      { kind: 'text', text: 'Stanzy’s advice: ask your family for this before the ITA, especially exact dates of birth. Don’t leave out any child: a child not declared can’t be sponsored later.' },
    ],
  },
  representativeForm: {
    name: 'Use of a representative',
    summary: 'Form IMM 5476, if a consultant or lawyer represents you.',
    blocks: [
      { kind: 'text', text: 'If a regulated consultant (RCIC) or a lawyer acts for you with IRCC, form IMM 5476 authorizes them. You and the representative both sign it.' },
      { kind: 'note', text: 'A paid representative must be authorized (a member of the College of Immigration and Citizenship Consultants, or of a law society). Check their membership number.' },
      { kind: 'link', label: 'Form IMM 5476 (IRCC)', href: `${IRCC}/services/application/application-forms-guides/imm5476.html` },
    ],
  },
  languageResults: {
    name: 'Language test results',
    summary: 'TEF Canada, TCF Canada, IELTS General, CELPIP General or PTE Core, under 2 years old.',
    blocks: [
      { kind: 'text', text: 'Your results prove your level in English or French. They must be less than 2 years old on the day you create your profile and on the day you submit the permanent residence application.' },
      { kind: 'list', title: 'Accepted tests', items: [
        'French: TEF Canada or TCF Canada.',
        'English: IELTS General Training, CELPIP General or PTE Core.',
      ] },
      { kind: 'list', title: 'To prepare', items: [
        'The results report, with the test report form or certificate number.',
        'For TEF Canada, use the scores in the “Équivalence ancien score” column.',
      ] },
      { kind: 'note', text: 'Results that have expired when you submit get the application refused. If yours expire soon, retake the test or decline the invitation to return to the pool.' },
      { kind: 'link', label: 'Work out my NCLC / CLB level', href: '/outils/nclc-clb' },
      { kind: 'cta', label: 'Prepare the TCF Canada with TCF Express Academy', href: TCF_ACADEMY_URL },
      { kind: 'link', label: 'Language tests (IRCC)', href: `${IRCC}/services/immigrate-canada/express-entry/documents/language-test.html` },
    ],
  },
  secondLanguageResults: {
    name: 'Second official language results',
    summary: 'The test in the other language (English or French), if it earns points.',
    blocks: [
      { kind: 'text', text: 'If you claim points for your second official language, IRCC asks for those results too, with the same rules: an accepted test, under 2 years old when you submit.' },
      { kind: 'text', text: 'Stanzy’s advice: good French earns extra points, and draws for French speakers happen regularly.' },
      { kind: 'link', label: 'Work out my NCLC / CLB level', href: '/outils/nclc-clb' },
    ],
  },
  eca: {
    name: 'Educational credential assessment (ECA)',
    summary: 'An ECA report for your diploma from outside Canada, under 5 years old.',
    blocks: [
      { kind: 'text', text: 'An ECA says which Canadian credential your foreign diploma equals. It is mandatory for the Federal Skilled Worker Program and to earn points for studies outside Canada.' },
      { kind: 'list', title: 'Designated organizations', items: [
        'World Education Services (WES)',
        'International Qualifications Assessment Service (IQAS)',
        'International Credential Assessment Service of Canada (ICAS)',
        'Comparative Education Service (University of Toronto)',
        'International Credential Evaluation Service (BCIT)',
        'Doctors and pharmacists: the Medical Council of Canada or the Pharmacy Examining Board of Canada.',
      ] },
      { kind: 'note', text: 'The report must be under 5 years old when you submit the application. Have your highest diploma assessed; with two diplomas (for transferability points), have both assessed.' },
      { kind: 'text', text: 'Stanzy’s advice: an ECA often takes several weeks, as your university must send your transcripts straight to the organization. Start early.' },
      { kind: 'cta', label: 'Stanzy handles your ECA (WES, IQAS)', href: '/services/ede' },
      { kind: 'link', label: 'Educational credential assessment (IRCC)', href: `${IRCC}/services/immigrate-canada/express-entry/documents/education-assessment.html` },
    ],
  },
  foreignDiplomas: {
    name: 'Diplomas and transcripts',
    summary: 'The diplomas the ECA assessed, with their transcripts.',
    blocks: [
      { kind: 'text', text: 'The ECA is enough for points, but the officer may want to see the diplomas themselves. Having them ready avoids a delay if you’re asked.' },
      { kind: 'list', title: 'To prepare', items: [
        'A copy of each assessed diploma.',
        'Transcripts for every year.',
        'A certified translation if they are in neither English nor French.',
      ] },
    ],
  },
  canadianDiploma: {
    name: 'Canadian diploma',
    summary: 'Diploma and transcripts from a Canadian institution.',
    blocks: [
      { kind: 'text', text: 'A Canadian diploma needs no ECA. You prove your studies in Canada with the institution’s documents.' },
      { kind: 'list', title: 'To prepare', items: [
        'The diploma or certificate.',
        'Official transcripts, showing the program’s length and that you completed it.',
        'For Canadian study points: proof you studied full time in Canada (transcripts are often enough).',
      ] },
    ],
  },
  referenceLetters: {
    name: 'Employer reference letters',
    summary: 'One letter per declared job, with the details IRCC requires.',
    blocks: [
      { kind: 'text', text: 'This is the main proof of your work experience. You need a letter for each job that earns you points or makes you eligible. An incomplete letter is one of the first reasons for refusal.' },
      { kind: 'list', title: 'What the letter must include', items: [
        'The company’s letterhead, with its address, phone number and email.',
        'The name, title and signature of your supervisor or the human resources officer.',
        'Your exact employment dates (start and end, or “to date”).',
        'Each position you held in the company, with its dates.',
        'Your main duties and responsibilities in each position.',
        'The number of hours worked per week.',
        'Your annual salary and benefits.',
      ] },
      { kind: 'note', text: 'Your duties must match the lead statement and most of the main duties of your NOC code. They must be in your own or your employer’s words: don’t copy the NOC text word for word.' },
      { kind: 'text', text: 'Stanzy’s advice: ask for your letters now, even for past jobs. A closed company, a supervisor who left or a slow employer can block your file during the 60 days. If an employer refuses, keep proof of your requests and add a letter of explanation with other proof (contract, payslips).' },
      { kind: 'cta', label: 'Have Stanzy check my letters', href: '/services/verification' },
      { kind: 'link', label: 'Express Entry documents (IRCC)', href: EE_DOCUMENTS },
    ],
  },
  selfEmployedProof: {
    name: 'Proof of self-employment',
    summary: 'Business registration, contracts, invoices, tax returns.',
    blocks: [
      { kind: 'text', text: 'If you work for yourself, nobody can write you an employer letter. You prove your activity with official and third-party documents. A description you write yourself isn’t enough.' },
      { kind: 'list', title: 'To prepare', items: [
        'The business registration (trade register, tax identification number).',
        'Contracts and invoices with your clients, over the whole declared period.',
        'Letters from clients describing the work you did for them.',
        'Tax returns and receipts for the activity.',
        'Bank statements showing client payments.',
      ] },
      { kind: 'note', text: 'Note: self-employed work in Canada doesn’t count for the Canadian Experience Class.' },
    ],
  },
  workPermit: {
    name: 'Canadian work permit',
    summary: 'Your work permits, for all your experience in Canada.',
    blocks: [
      { kind: 'text', text: 'Your experience in Canada must have been gained with authorization to work. IRCC checks that you were allowed to work for the whole declared period.' },
      { kind: 'list', title: 'To prepare', items: [
        'Each work permit (and extension) covering the declared period.',
        'If you are on maintained status, proof of the extension application.',
      ] },
      { kind: 'note', text: 'Work done while studying full time doesn’t count as experience for the Canadian Experience Class.' },
      { kind: 'link', label: 'Canadian Experience Class (IRCC)', href: `${IRCC}/services/immigrate-canada/express-entry/who-can-apply/canadian-experience-class.html` },
    ],
  },
  payslips: {
    name: 'Payslips',
    summary: 'A few payslips per job, across the whole period.',
    blocks: [
      { kind: 'text', text: 'Payslips confirm what your reference letter says: the position, the employer, the salary and the dates. They make your experience hard to question.' },
      { kind: 'list', title: 'To prepare', items: [
        'Payslips spread over the whole period: the first month, a few months in the middle, the last month.',
        'The same employer name and salary as in the letter.',
      ] },
      { kind: 'text', text: 'Stanzy’s advice: if the company doesn’t issue payslips, statements of the account your salary goes into and a social security record replace them.' },
    ],
  },
  employmentContract: {
    name: 'Employment contract',
    summary: 'The contract or hiring letter, and any amendments.',
    blocks: [
      { kind: 'text', text: 'The contract confirms the hiring date, the position and the starting salary. It backs up the reference letter, especially if the employer changed name or the supervisor left.' },
      { kind: 'list', title: 'To prepare', items: [
        'The employment contract or the signed offer letter.',
        'Amendments or promotion letters, if they change the position or salary.',
        'The certificate of employment, if the job has ended.',
      ] },
    ],
  },
  socialSecurity: {
    name: 'Social security record',
    summary: 'In Cameroon, the CNPS certificate or statement; elsewhere, the equivalent body.',
    blocks: [
      { kind: 'text', text: 'A record from the social security body proves, through a public institution, that you were registered and that contributions were paid for your job.' },
      { kind: 'list', title: 'Examples', items: [
        'Cameroon: the CNPS registration certificate and contributions statement.',
        'Côte d’Ivoire: CNPS; Senegal: IPRES / CSS; France: career statement (Assurance retraite).',
        'In Canada: T4 slips and notices of assessment (see “Canadian tax records”).',
      ] },
      { kind: 'text', text: 'Stanzy’s advice: this is one of the strongest proofs of your experience abroad. If your contributions don’t cover the whole period, explain it in a letter.' },
    ],
  },
  salaryStatements: {
    name: 'Salary account statements',
    summary: 'Bank statements showing your salary deposits.',
    blocks: [
      { kind: 'text', text: 'Statements of the account your salary goes into show regular payments from your employer. They back up the payslips and the reference letter.' },
      { kind: 'list', title: 'To prepare', items: [
        'Statements for a few months spread over each job.',
        'The deposits should show the employer’s name and match the declared salary.',
      ] },
    ],
  },
  canadianTaxRecords: {
    name: 'Canadian tax records',
    summary: 'T4 slips and CRA notices of assessment.',
    blocks: [
      { kind: 'text', text: 'For experience in Canada, each employer’s T4 slips and the Canada Revenue Agency (CRA) notices of assessment confirm your income year by year.' },
      { kind: 'list', title: 'To prepare', items: [
        'T4 slips for each declared year of work.',
        'The matching notices of assessment (downloadable from CRA My Account).',
      ] },
    ],
  },
  resume: {
    name: 'Resume',
    summary: 'A resume with exactly the same dates and positions.',
    blocks: [
      { kind: 'text', text: 'IRCC doesn’t always require it, but a clear resume helps the officer follow your path. It must say the same as your profile, your letters and your personal history.' },
      { kind: 'list', title: 'To check', items: [
        'The same dates (month and year) as in the reference letters.',
        'The same job titles.',
        'No gaps, as in the personal history.',
      ] },
    ],
  },
  bankLetter: {
    name: 'Official bank letter (proof of funds)',
    summary: 'A letter from each bank, with the average balance over the last 6 months.',
    blocks: [
      { kind: 'text', text: 'For the Federal Skilled Worker or Skilled Trades programs, you must prove you have enough money to settle. The money must be available when you apply and when the visa is issued.' },
      { kind: 'table', caption: 'Minimum funds (IRCC)', head: ['Family size', 'Amount'], rows: [
        ...FUNDS_TABLE.map((amount, i): [string, string] => [`${i + 1} person${i ? 's' : ''}`, cad(amount)]),
        ['Each extra person', cad(FUNDS_PER_EXTRA_PERSON)],
      ] },
      { kind: 'list', title: 'What the letter must include', items: [
        'The bank’s letterhead, with its address, phone number and email.',
        'Your name.',
        'Your outstanding debts (loans, credit cards).',
        'For each account: the number, the date it was opened, the current balance and the average balance over the last 6 months.',
      ] },
      { kind: 'note', text: 'Family size counts your spouse and dependent children, even if they aren’t coming. Real estate or money borrowed from someone doesn’t count.' },
      { kind: 'text', text: 'Stanzy’s advice: grow the balance steadily rather than with one large deposit just before the ITA, and keep proof of where each large amount came from.' },
      { kind: 'link', label: 'See the funds to prove for my family', href: '/outils/budget' },
      { kind: 'link', label: 'Proof of funds (IRCC)', href: `${IRCC}/services/immigrate-canada/express-entry/documents/proof-funds.html` },
    ],
  },
  fundsExemptionLetter: {
    name: 'Proof of funds exemption letter',
    summary: 'A letter explaining why you don’t have to prove funds.',
    blocks: [
      { kind: 'text', text: 'You don’t have to prove funds if you are invited under the Canadian Experience Class, or if you are authorized to work in Canada and have a valid job offer. The portal still asks for a document in the “proof of funds” field.' },
      { kind: 'list', title: 'The letter says', items: [
        'The program you were invited under.',
        'Why you are exempt (Canadian experience, or a work permit and a job offer).',
        'Your name, the date and your signature.',
      ] },
      { kind: 'note', text: 'If you could be invited under another program (skilled workers), keep a bank letter ready anyway.' },
    ],
  },
  bankStatements: {
    name: 'Bank statements for the last 6 months',
    summary: 'Statements showing the history of your funds.',
    blocks: [
      { kind: 'text', text: 'The bank letter gives an average balance; statements show how the money built up. They let you answer fast if the officer asks about a deposit.' },
      { kind: 'list', title: 'To prepare', items: [
        'Statements for the last 6 months of each declared account.',
        'For each large deposit: its proof (sale of property, savings, bonus, gift with the giver’s proof).',
      ] },
    ],
  },
  policeCertificate: {
    name: 'Police certificate',
    summary: 'One for each country where you lived 6 months in a row or more since age 18 (last 10 years).',
    blocks: [
      { kind: 'text', text: 'Everyone 18 or older must provide a police certificate (criminal record check) from each country where they lived 6 months in a row or more in the last 10 years. Time in Canada and before age 18 doesn’t count.' },
      { kind: 'list', title: 'Date rules', items: [
        'The country where you live now: the certificate must be under 6 months old when you submit.',
        'Other countries: it must have been issued after your last stay of 6 months or more there.',
        'Upload a colour copy of the original (not a certified copy).',
      ] },
      { kind: 'note', text: 'Some countries only issue the certificate at IRCC’s request, and others take months. If yours doesn’t arrive within the 60 days, add a letter of explanation and proof of your request (receipt, tracking number).' },
      { kind: 'text', text: 'Stanzy’s advice: look up each country’s process now. In Cameroon it is the criminal record extract (bulletin n° 3); request it after the ITA so it is under 6 months old when you submit. For other countries, start early.' },
      { kind: 'link', label: 'Police certificates (IRCC)', href: `${IRCC}/services/immigrate-canada/express-entry/documents/police-certificates.html` },
      { kind: 'link', label: 'How to get a certificate, country by country (IRCC)', href: `${IRCC}/services/application/medical-police/police-certificates/how.html` },
    ],
  },
  medicalExam: {
    name: 'Medical exam',
    summary: 'With an IRCC panel physician, after the ITA and before you submit.',
    blocks: [
      { kind: 'text', text: 'Express Entry candidates take the medical exam before submitting the application, after the ITA. You book it directly with an IRCC panel physician.' },
      { kind: 'list', title: 'Good to know', items: [
        'Every family member takes the exam, even a spouse or child who isn’t coming to Canada.',
        'The physician gives you a confirmation sheet (IMM 1017B): you upload it with the application.',
        'Results are valid for 12 months.',
        'Bring your passport, your glasses and your vaccination records.',
      ] },
      { kind: 'text', text: 'Stanzy’s advice: find the nearest panel physician and their booking delay now. An exam taken in the last 5 years has a number (IME) to give.' },
      { kind: 'link', label: 'See the cost of the medical exam', href: '/outils/budget' },
      { kind: 'link', label: 'Medical exam for permanent residence (IRCC)', href: `${IRCC}/services/application/medical-police/medical-exams/requirements-permanent-residents.html` },
    ],
  },
  jobOfferLetter: {
    name: 'Written job offer',
    summary: 'The Canadian employer’s offer, with the LMIA if it has one.',
    blocks: [
      { kind: 'text', text: 'A valid job offer can earn points, under the CRS rules in force. It must be written, full time, non-seasonal, for at least one year, and supported by a Labour Market Impact Assessment (LMIA) unless exempt.' },
      { kind: 'list', title: 'The offer letter includes', items: [
        'The employer’s letterhead, with contact details and the signature of an authorized person.',
        'The job title, duties and NOC code.',
        'The salary, benefits, weekly hours and start date.',
        'The length (at least one year after permanent residence).',
      ] },
      { kind: 'list', title: 'With the letter', items: [
        'A copy of the positive LMIA, or proof of the exemption (your employer-specific work permit, for example).',
      ] },
      { kind: 'link', label: 'Job offer (IRCC)', href: `${IRCC}/services/immigrate-canada/express-entry/documents/job-offer.html` },
    ],
  },
  nominationCertificate: {
    name: 'Provincial nomination certificate',
    summary: 'The province’s nomination, accepted in your profile.',
    blocks: [
      { kind: 'text', text: 'A provincial nomination linked to Express Entry is worth 600 points. You accept it in your profile, then add the province’s certificate or letter to the application.' },
      { kind: 'note', text: 'The nomination has an expiry date. Your application must be submitted before it.' },
    ],
  },
  qualificationCertificate: {
    name: 'Certificate of qualification',
    summary: 'A province’s or territory’s certificate in your trade.',
    blocks: [
      { kind: 'text', text: 'A certificate of qualification, issued by a Canadian province or territory, proves you are qualified in a skilled trade. It earns points and can make you eligible for the Federal Skilled Trades Program.' },
      { kind: 'list', title: 'To prepare', items: ['A copy of the certificate, with its number and date.'] },
    ],
  },
  siblingProof: {
    name: 'Proof of a brother or sister in Canada',
    summary: 'Their status in Canada and proof of your relationship.',
    blocks: [
      { kind: 'text', text: 'A brother or sister aged 18 or older who lives in Canada as a citizen or permanent resident is worth 15 points. You prove their status, their address in Canada and your relationship.' },
      { kind: 'list', title: 'To prepare', items: [
        'A copy of their citizenship card, Canadian passport or permanent resident card.',
        'Proof of their address in Canada (a bill, a lease).',
        'Both your birth certificates, showing at least one parent in common (or the adoption records).',
      ] },
    ],
  },
  explanationLetter: {
    name: 'Letter of explanation',
    summary: 'To explain anything that could surprise the officer.',
    blocks: [
      { kind: 'text', text: 'A letter of explanation answers a question before the officer asks it. It helps whenever a document is missing or something could look inconsistent.' },
      { kind: 'list', title: 'Examples', items: [
        'A period without work in your history.',
        'An employer who won’t give a letter, or a company that closed.',
        'A name spelled differently across documents.',
        'A police certificate requested but not yet received.',
        'A large deposit in your account.',
      ] },
      { kind: 'text', text: 'Stanzy’s advice: keep it short, factual and backed by proof. One letter per topic, uploaded in the field of the document it concerns.' },
      { kind: 'cta', label: 'Have Stanzy review my file', href: '/services/verification' },
    ],
  },
};
