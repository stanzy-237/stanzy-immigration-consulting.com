import { ArrowUpRight, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, type ReactNode } from "react";

import { TCF_EXPRESS_ACADEMY_URL } from "@/features/crs/data/links";
import type { CrsProfile } from "@/features/crs/lib/compute-crs";
import type { RulesVersion } from "@/features/shared/lib/rules-version";
import { scoreHints } from "@/features/crs/lib/score-hints";
import { Link } from "@/i18n/navigation";

/**
 * The one card beneath the score: what would raise it most (each change
 * priced by the engine), the Pack Stanzy for the TCF Canada, and the
 * disclaimer with a way to book a consultation.
 */
export function ScoreAdvice({
  profile,
  rules,
}: {
  profile: CrsProfile;
  rules: RulesVersion;
}): ReactNode {
  const t = useTranslations("Crs");
  const hints = useMemo(() => scoreHints(profile, rules), [profile, rules]);

  return (
    <section
      aria-labelledby="crs-advice-title"
      className="rounded-2xl border border-fog bg-white p-5 shadow-sm"
    >
      <h2
        id="crs-advice-title"
        className="flex items-center gap-2 font-heading text-h4 font-bold text-navy-deep"
      >
        {t("hints.title")}
      </h2>

      {hints.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {hints.map((hint) => (
            <li
              key={hint.kind}
              className="flex items-baseline justify-between gap-3 text-body-sm text-slate"
            >
              <span>{t(`hints.${hint.kind}`)}</span>
              <strong className="shrink-0 font-heading text-rouge">
                {t("hints.gain", { points: hint.gain })}
              </strong>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-4 rounded-xl bg-blush p-4">
        <p className="text-body-sm text-navy-deep">{t("hints.packText")}</p>
        <a
          href={TCF_EXPRESS_ACADEMY_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-rouge px-4 py-2 text-body-sm font-semibold text-white transition-colors hover:bg-crimson focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rouge"
        >
          {t("hints.packCta")}
          <ArrowUpRight aria-hidden={true} className="size-4" />
        </a>
      </div>

      <div className="mt-4 border-t border-fog pt-4 text-body-sm text-slate">
        <Sparkles aria-hidden={true} className="mb-2 size-4 text-rouge" />
        <p>{t("summary.disclaimer")}</p>
        <Link
          href="/services"
          className="mt-2 inline-block font-semibold text-rouge underline-offset-2 hover:underline"
        >
          {t("summary.consultation")}
        </Link>
      </div>
    </section>
  );
}
