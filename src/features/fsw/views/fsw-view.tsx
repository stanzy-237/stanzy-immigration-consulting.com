import { ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { FswCalculator } from "@/features/fsw/components/fsw-calculator";
import { SiteFooter } from "@/features/landing/components/site-footer";
import { SiteNav } from "@/features/landing/components/site-nav";
import { NextStepsGuide } from "@/features/shared/components/next-steps-guide";

/** The Calculateur 67 points page: header, calculator and "À savoir" band. */
export function FswView(): ReactNode {
  const t = useTranslations("Fsw");
  return (
    <>
      <SiteNav />
      <main className="bg-off-white">
        <header className="border-b border-fog bg-white">
          <div className="mx-auto max-w-6xl px-5 pb-12 pt-14 sm:px-8 lg:pb-16 lg:pt-20">
            <p className="mb-5 font-label text-rouge">{t("eyebrow")}</p>
            <h1 className="font-heading text-h2 font-bold leading-tight text-navy-deep sm:text-h1">
              {t("title")}{" "}
              <span className="text-rouge">{t("titleAccent")}</span>
            </h1>
            <p className="mt-6 max-w-2xl text-body-lg text-slate">
              {t("lead")}
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-4">
              <span className="inline-flex items-center gap-2 rounded-full bg-blush px-3 py-2 text-body-sm font-semibold text-rouge">
                <ShieldCheck aria-hidden={true} className="size-4" />
                {t("threshold")}
              </span>
              <span className="text-body-sm text-steel-blue">
                {t("notCrs")}
              </span>
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8 lg:py-14">
          <FswCalculator />
        </div>

        <NextStepsGuide
          id="fsw"
          title={t("guide.title")}
          text={t("guide.text")}
          secondary={{ href: "/outils/crs", label: t("guide.secondary") }}
        />
      </main>
      <SiteFooter />
    </>
  );
}
