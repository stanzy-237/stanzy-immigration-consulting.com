import {
  ADDITIONAL_CAP,
  ADDITIONAL_POINTS,
  AGE_POINTS,
  CANADIAN_WORK_POINTS,
  EDUCATION_POINTS,
  FIRST_LANGUAGE_POINTS,
  HIGH_WAGE_JOB_OFFER_POINTS,
  HIGH_WAGE_WORK_POINTS,
  LABOUR_MARKET_INTEGRATION_CAP,
  SECOND_LANGUAGE_CAP,
  SECOND_LANGUAGE_POINTS,
  SPOUSE_CANADIAN_WORK_POINTS,
  SPOUSE_EDUCATION_POINTS,
  SPOUSE_LANGUAGE_CAP,
  SPOUSE_LANGUAGE_POINTS,
  TRANSFER_CAP,
  TRANSFER_CERTIFICATE_POINTS,
  TRANSFER_EDUCATION_POINTS,
  TRANSFER_EDUCATION_ROW,
  TRANSFER_FOREIGN_WORK_POINTS,
  TRANSFER_GROUP_CAP,
  type HighWageLevel,
} from '@/features/crs/data/crs-criteria';
import type { EducationLevel } from '@/features/shared/data/education-levels';
import { TEST_SPECS } from '@/features/shared/data/language-tests';
import {
  ABILITIES,
  clbLevelFor,
  type ClbLevels,
  type LanguageResult,
} from '@/features/shared/lib/language-levels';
import { isPartnered, type MaritalStatus } from '@/features/shared/lib/marital-status';
import type { RulesVersion } from '@/features/shared/lib/rules-version';

export type SpouseProfile = {
  isCanadianCitizenOrPR: boolean;
  accompanying: boolean;
  education: EducationLevel;
  /** Years of skilled Canadian work experience; 5 means 5 or more. */
  canadianWorkYears: number;
  language: LanguageResult | null;
};

export type CrsProfile = {
  maritalStatus: MaritalStatus;
  /** Only read when married or common-law. */
  spouse?: SpouseProfile;
  age: number;
  education: EducationLevel;
  firstLanguage: LanguageResult | null;
  secondLanguage: LanguageResult | null;
  /** Years of skilled Canadian work experience; 5 means 5 or more. */
  canadianWorkYears: number;
  /** Years of skilled foreign work experience; 3 means 3 or more. */
  foreignWorkYears: number;
  certificateOfQualification: boolean;
  canadianStudy: 'none' | 'oneOrTwoYears' | 'threePlusYears';
  provincialNomination: boolean;
  siblingInCanada: boolean;
  /** From 2026-11-03: 12+ months of Canadian work in a high-wage occupation, by wage level. */
  highWageWork: HighWageLevel;
  /** From 2026-11-03: a qualifying job offer in a high-wage occupation, by wage level. */
  highWageJobOffer: HighWageLevel;
};

export type CrsIssue = {
  /** Dotted path to the answer to fix, e.g. `firstLanguage.speaking`. */
  field: string;
  code: 'SCORE_OUT_OF_RANGE' | 'SAME_LANGUAGE' | 'AGE_OUT_OF_RANGE';
};

export type CrsBreakdown = {
  rules: RulesVersion;
  total: number;
  core: {
    age: number;
    education: number;
    firstLanguage: number;
    secondLanguage: number;
    /** What the Canadian work line adds to A: duration points, or the whole labour market integration factor. */
    canadianWork: number;
    /** From 2026-11-03 only; null under earlier rules. */
    labourMarketIntegration: {
      canadianWork: number;
      highWageWork: number;
      jobOffer: number;
      total: number;
    } | null;
    total: number;
  };
  spouse: { education: number; language: number; canadianWork: number; total: number };
  transferability: { education: number; foreignWork: number; certificate: number; total: number };
  additional: {
    provincialNomination: number;
    sibling: number;
    canadianStudy: number;
    french: number;
    total: number;
  };
  /** The most each part can reach for this candidate under these rules. */
  maxima: { core: number; spouse: number; transferability: number; additional: number };
  /** The CLB/NCLC levels the engine derived from each set of results. */
  levels: { first: ClbLevels | null; second: ClbLevels | null; spouse: ClbLevels | null };
};

export type CrsResult = { ok: true; breakdown: CrsBreakdown } | { ok: false; issues: CrsIssue[] };

const sum = (values: number[]): number => values.reduce((a, b) => a + b, 0);
const capYears = (years: number, max: number): number => Math.min(Math.max(Math.floor(years), 0), max);

/** Converts a set of results to levels, recording each impossible score as an issue. */
function levelsFor(
  result: LanguageResult | null | undefined,
  field: string,
  issues: CrsIssue[],
): ClbLevels | null {
  if (!result) return null;
  const levels = {} as ClbLevels;
  for (const ability of ABILITIES) {
    const level = clbLevelFor(result.test, ability, result.scores[ability]);
    if (level === null) issues.push({ field: `${field}.${ability}`, code: 'SCORE_OUT_OF_RANGE' });
    levels[ability] = level ?? 0;
  }
  return levels;
}

const perAbility = (levels: ClbLevels | null, points: readonly number[]): number =>
  levels ? sum(ABILITIES.map((a) => points[levels[a]] ?? 0)) : 0;

const minLevel = (levels: ClbLevels | null): number =>
  levels ? Math.min(...ABILITIES.map((a) => levels[a])) : 0;

/** [lower, upper] column: all four abilities at `lower`+ (some under `upper`), or all at `upper`+. */
function languageColumn(levels: ClbLevels | null, lower: number, upper: number): 0 | 1 | 2 {
  const min = minLevel(levels);
  return min >= upper ? 2 : min >= lower ? 1 : 0;
}

/** Canadian work column for transferability: 1 year (lower) or 2+ (upper). */
const canadianWorkColumn = (years: number): 0 | 1 | 2 => (years >= 2 ? 2 : years >= 1 ? 1 : 0);

const pick = (grid: readonly number[], column: 0 | 1 | 2): number =>
  column === 0 ? 0 : (grid[column - 1] ?? 0);

/** The spouse counts only when married or common-law, not a citizen or PR, and coming along. */
function accompanyingSpouse(profile: CrsProfile): SpouseProfile | null {
  const { spouse } = profile;
  return isPartnered(profile.maritalStatus) && spouse && spouse.accompanying && !spouse.isCanadianCitizenOrPR ? spouse : null;
}

/** D. French: NCLC 7+ on all four, plus 25 or 50 depending on English. */
function frenchPoints(tests: { result: LanguageResult | null; levels: ClbLevels | null }[]): number {
  const byLanguage = (language: 'en' | 'fr'): ClbLevels | null =>
    tests.find((t) => t.result && TEST_SPECS[t.result.test].language === language)?.levels ?? null;
  const french = byLanguage('fr');
  if (!french || minLevel(french) < 7) return 0;
  const english = byLanguage('en');
  return english && minLevel(english) >= 5
    ? ADDITIONAL_POINTS.french.strongEnglish
    : ADDITIONAL_POINTS.french.weakEnglish;
}

/**
 * The CRS score IRCC would give `profile` under `rules`: the total and every
 * factor that makes it up, or the answers that need fixing first.
 */
export function computeCrs(profile: CrsProfile, options: { rules: RulesVersion }): CrsResult {
  const issues: CrsIssue[] = [];
  if (!Number.isInteger(profile.age) || profile.age < 0 || profile.age > 120) {
    issues.push({ field: 'age', code: 'AGE_OUT_OF_RANGE' });
  }
  const { firstLanguage: firstTest, secondLanguage: secondTest } = profile;
  if (firstTest && secondTest && TEST_SPECS[firstTest.test].language === TEST_SPECS[secondTest.test].language) {
    issues.push({ field: 'secondLanguage', code: 'SAME_LANGUAGE' });
  }
  const partner = accompanyingSpouse(profile);
  const levels = {
    first: levelsFor(profile.firstLanguage, 'firstLanguage', issues),
    second: levelsFor(profile.secondLanguage, 'secondLanguage', issues),
    spouse: partner ? levelsFor(partner.language, 'spouse.language', issues) : null,
  };
  if (issues.length > 0) return { ok: false, issues };

  const column = partner ? 'withSpouse' : 'withoutSpouse';
  const canadianYears = capYears(profile.canadianWorkYears, 5);

  const durationPoints = CANADIAN_WORK_POINTS[column][canadianYears] ?? 0;
  const labourMarketIntegration =
    options.rules === '2026-11-03'
      ? (() => {
          const highWageWork = canadianYears >= 1 ? HIGH_WAGE_WORK_POINTS[profile.highWageWork] : 0;
          const experienceRoute = durationPoints + highWageWork;
          const jobOffer = HIGH_WAGE_JOB_OFFER_POINTS[profile.highWageJobOffer];
          const offerWins = jobOffer > experienceRoute;
          return {
            canadianWork: offerWins ? 0 : durationPoints,
            highWageWork: offerWins ? 0 : highWageWork,
            jobOffer: offerWins ? jobOffer : 0,
            total: Math.min(LABOUR_MARKET_INTEGRATION_CAP[column], Math.max(experienceRoute, jobOffer)),
          };
        })()
      : null;

  const core = {
    age: AGE_POINTS[column][profile.age] ?? 0,
    education: EDUCATION_POINTS[column][profile.education],
    firstLanguage: perAbility(levels.first, FIRST_LANGUAGE_POINTS[column]),
    secondLanguage: Math.min(
      SECOND_LANGUAGE_CAP[column],
      perAbility(levels.second, SECOND_LANGUAGE_POINTS),
    ),
    canadianWork: labourMarketIntegration?.total ?? durationPoints,
    labourMarketIntegration,
    total: 0,
  };
  core.total =
    core.age + core.education + core.firstLanguage + core.secondLanguage + core.canadianWork;

  const spouse = { education: 0, language: 0, canadianWork: 0, total: 0 };
  if (partner) {
    spouse.education = SPOUSE_EDUCATION_POINTS[partner.education];
    spouse.language = Math.min(SPOUSE_LANGUAGE_CAP, perAbility(levels.spouse, SPOUSE_LANGUAGE_POINTS));
    spouse.canadianWork = SPOUSE_CANADIAN_WORK_POINTS[capYears(partner.canadianWorkYears, 5)] ?? 0;
    spouse.total = spouse.education + spouse.language + spouse.canadianWork;
  }

  const languageCol = languageColumn(levels.first, 7, 9);
  const canadianCol = canadianWorkColumn(canadianYears);
  const educationGrid = TRANSFER_EDUCATION_POINTS[TRANSFER_EDUCATION_ROW[profile.education]];
  const foreignYears = capYears(profile.foreignWorkYears, 3);
  const foreignGrid =
    TRANSFER_FOREIGN_WORK_POINTS[
      foreignYears >= 3 ? 'threePlusYears' : foreignYears >= 1 ? 'oneOrTwoYears' : 'none'
    ];
  const education = Math.min(
    TRANSFER_GROUP_CAP,
    pick(educationGrid, languageCol) + pick(educationGrid, canadianCol),
  );
  const foreignWork = Math.min(
    TRANSFER_GROUP_CAP,
    pick(foreignGrid, languageCol) + pick(foreignGrid, canadianCol),
  );
  const certificate = profile.certificateOfQualification
    ? pick(TRANSFER_CERTIFICATE_POINTS, languageColumn(levels.first, 5, 7))
    : 0;
  const transferability = {
    education,
    foreignWork,
    certificate,
    total: Math.min(TRANSFER_CAP, education + foreignWork + certificate),
  };

  const additional = {
    provincialNomination: profile.provincialNomination ? ADDITIONAL_POINTS.provincialNomination : 0,
    sibling: profile.siblingInCanada ? ADDITIONAL_POINTS.siblingInCanada : 0,
    canadianStudy: ADDITIONAL_POINTS.canadianStudy[profile.canadianStudy],
    french: frenchPoints([
      { result: profile.firstLanguage, levels: levels.first },
      { result: profile.secondLanguage, levels: levels.second },
    ]),
    total: 0,
  };
  additional.total = Math.min(
    ADDITIONAL_CAP,
    additional.provincialNomination + additional.sibling + additional.canadianStudy + additional.french,
  );

  return {
    ok: true,
    breakdown: {
      rules: options.rules,
      total: core.total + spouse.total + transferability.total + additional.total,
      core,
      spouse,
      transferability,
      additional,
      maxima: {
        core:
          Math.max(...Object.values(AGE_POINTS[column])) +
          Math.max(...Object.values(EDUCATION_POINTS[column])) +
          4 * Math.max(...FIRST_LANGUAGE_POINTS[column]) +
          SECOND_LANGUAGE_CAP[column] +
          (options.rules === '2026-11-03'
            ? LABOUR_MARKET_INTEGRATION_CAP[column]
            : Math.max(...CANADIAN_WORK_POINTS[column])),
        spouse: partner
          ? Math.max(...Object.values(SPOUSE_EDUCATION_POINTS)) +
            SPOUSE_LANGUAGE_CAP +
            Math.max(...SPOUSE_CANADIAN_WORK_POINTS)
          : 0,
        transferability: TRANSFER_CAP,
        additional: ADDITIONAL_CAP,
      },
      levels,
    },
  };
}
