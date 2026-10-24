import {
  ADAPTABILITY_MAX,
  ADAPTABILITY_POINTS,
  agePoints,
  ARRANGED_EMPLOYMENT_POINTS,
  EDUCATION_POINTS,
  FIRST_LANGUAGE_MIN_CLB,
  FIRST_LANGUAGE_POINTS,
  FSW_PASS_MARK,
  SECOND_LANGUAGE_MIN_CLB,
  SECOND_LANGUAGE_POINTS,
  SPOUSE_LANGUAGE_MIN_CLB,
  workPoints,
} from '@/features/fsw/data/fsw-criteria';
import type { EducationLevel } from '@/features/shared/data/education-levels';
import {
  ABILITIES,
  type ClbLevels,
  type LanguageResult,
} from '@/features/shared/lib/language-levels';
import { isPartnered, type MaritalStatus } from '@/features/shared/lib/marital-status';
import { checkCandidate, levelsWithIssues, type CalculatorIssue } from '@/features/shared/lib/answer-checks';
import type { RulesVersion } from '@/features/shared/lib/rules-version';

/** IRCC's four situations in which a job offer earns arranged-employment points (before 2026-11-03). */
export type LmiaSituation = 'none' | 'lmiaWorkPermit' | 'lmiaExemptWorkPermit' | 'lmiaOffer' | 'lmiaOfferNewEmployer';

export type FswSpouse = {
  accompanying: boolean;
  isCanadianCitizenOrPR: boolean;
  /** Any official language; CLB 4+ in all four earns adaptability points. */
  language: LanguageResult | null;
  studiedInCanada: boolean;
  workedInCanada: boolean;
};

export type FswProfile = {
  maritalStatus: MaritalStatus;
  /** Only read when married or common-law. */
  spouse?: FswSpouse;
  age: number;
  education: EducationLevel;
  firstLanguage: LanguageResult | null;
  secondLanguage: LanguageResult | null;
  /** Years of continuous skilled (TEER 0–3) work in the last 10 years; 6 means 6 or more. */
  skilledWorkYears: number;
  /** A valid offer: full-time, non-seasonal, at least one year, TEER 0–3. */
  jobOffer: { valid: boolean; lmiaSituation: LmiaSituation };
  /** 2+ academic years of full-time study in Canada. */
  studiedInCanada: boolean;
  /** 1+ year of full-time TEER 0–3 work in Canada. */
  workedInCanada: boolean;
  /** A parent, grandparent, child, grandchild, sibling, aunt/uncle or niece/nephew in Canada, 18+, citizen or PR. */
  relativeInCanada: boolean;
};

export type FswAssessment = {
  rules: RulesVersion;
  total: number;
  factors: {
    language: number;
    education: number;
    work: number;
    age: number;
    arrangedEmployment: number;
    adaptability: number;
  };
  /** IRCC's minimum requirements; all must hold, on top of the 67 points. */
  requirements: { firstLanguageClb7: boolean; oneYearOfWork: boolean; credential: boolean };
  eligible: boolean;
  /** Points missing to reach 67 (0 once reached). */
  pointsShort: number;
  /** The CLB/NCLC levels the engine derived from each set of results. */
  levels: { first: ClbLevels | null; second: ClbLevels | null; spouse: ClbLevels | null };
};

export type FswResult = { ok: true; assessment: FswAssessment } | { ok: false; issues: CalculatorIssue[] };

const allAtLeast = (levels: ClbLevels | null, min: number): boolean =>
  levels !== null && ABILITIES.every((a) => levels[a] >= min);


/** The spouse counts only when married or common-law, coming along, and not a citizen or PR. */
function accompanyingSpouse(profile: FswProfile): FswSpouse | null {
  const { spouse } = profile;
  return isPartnered(profile.maritalStatus) && spouse?.accompanying && !spouse.isCanadianCitizenOrPR
    ? spouse
    : null;
}

/**
 * 5. A valid offer earns the points; before 2026-11-03 only in one of IRCC's
 * four LMIA situations, from then on no LMIA is needed.
 */
function arrangedEmploymentPoints(offer: FswProfile['jobOffer'], rules: RulesVersion): number {
  if (!offer.valid) return 0;
  if (rules === '2025-03-25' && offer.lmiaSituation === 'none') return 0;
  return ARRANGED_EMPLOYMENT_POINTS;
}

/** 6. Adaptability, the spouse's items counting only when the spouse comes along; capped at 10. */
function adaptabilityPoints(
  profile: FswProfile,
  partner: FswSpouse | null,
  spouseLanguage: ClbLevels | null,
  hasArrangedEmployment: boolean,
): number {
  const items = [
    partner && allAtLeast(spouseLanguage, SPOUSE_LANGUAGE_MIN_CLB) ? ADAPTABILITY_POINTS.spouseLanguage : 0,
    profile.studiedInCanada ? ADAPTABILITY_POINTS.studiedInCanada : 0,
    partner?.studiedInCanada ? ADAPTABILITY_POINTS.spouseStudiedInCanada : 0,
    profile.workedInCanada ? ADAPTABILITY_POINTS.workedInCanada : 0,
    partner?.workedInCanada ? ADAPTABILITY_POINTS.spouseWorkedInCanada : 0,
    hasArrangedEmployment ? ADAPTABILITY_POINTS.arrangedEmployment : 0,
    profile.relativeInCanada ? ADAPTABILITY_POINTS.relativeInCanada : 0,
  ];
  return Math.min(ADAPTABILITY_MAX, items.reduce((a, b) => a + b, 0));
}

/**
 * Scores `profile` on the Federal Skilled Worker grid under `rules`: the
 * total out of 100, each factor, the minimum requirements, and whether the
 * candidate is eligible (67 points or more and every requirement met).
 */
export function assessFsw(profile: FswProfile, options: { rules: RulesVersion }): FswResult {
  const issues: CalculatorIssue[] = [];
  checkCandidate(profile, issues);
  const first = levelsWithIssues(profile.firstLanguage, 'firstLanguage', issues);
  const second = levelsWithIssues(profile.secondLanguage, 'secondLanguage', issues);
  const partner = accompanyingSpouse(profile);
  const spouseLanguage = partner ? levelsWithIssues(partner.language, 'spouse.language', issues) : null;
  if (issues.length > 0) return { ok: false, issues };

  const firstLanguageClb7 = allAtLeast(first, FIRST_LANGUAGE_MIN_CLB);
  const firstPoints = first
    ? ABILITIES.reduce((sum, a) => {
        const level = first[a];
        return sum + (level >= FIRST_LANGUAGE_MIN_CLB ? FIRST_LANGUAGE_POINTS[Math.min(level, 9) as 7 | 8 | 9] : 0);
      }, 0)
    : 0;
  const secondPoints = allAtLeast(second, SECOND_LANGUAGE_MIN_CLB)
    ? SECOND_LANGUAGE_POINTS
    : 0;
  const language = firstPoints + secondPoints;

  const factors = {
    language,
    education: EDUCATION_POINTS[profile.education],
    work: workPoints(profile.skilledWorkYears),
    age: agePoints(profile.age),
    arrangedEmployment: arrangedEmploymentPoints(profile.jobOffer, options.rules),
    adaptability: 0,
  };
  factors.adaptability = adaptabilityPoints(profile, partner, spouseLanguage, factors.arrangedEmployment > 0);
  const total = Object.values(factors).reduce((a, b) => a + b, 0);
  const requirements = {
    firstLanguageClb7,
    oneYearOfWork: profile.skilledWorkYears >= 1,
    credential: profile.education !== 'lessThanSecondary',
  };

  return {
    ok: true,
    assessment: {
      rules: options.rules,
      total,
      factors,
      requirements,
      eligible: total >= FSW_PASS_MARK && Object.values(requirements).every(Boolean),
      pointsShort: Math.max(0, FSW_PASS_MARK - total),
      levels: { first, second, spouse: spouseLanguage },
    },
  };
}
