import { ArrowUpRight } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { Link } from "@/i18n/navigation";

import { TOOLS, type Tool } from "@/features/landing/data/tools";

function cardClasses(variant: Tool["variant"]): string {
  // Shared card chrome: pulled from `.sn-tc` in the MagicPath design
  // (white bg, rounded 20px, 1.5px border #E2E8F0, 28px pad, hover lift).
  const base =
    "group relative isolate flex flex-col overflow-hidden rounded-[20px] bg-white p-7 no-underline transition-all duration-200 ease-out " +
    "border-[1.5px] border-[#E2E8F0] " +
    "hover:-translate-y-1 hover:border-navy-deep hover:border-2 hover:shadow-[0_12px_36px_rgba(13,31,78,0.13)]";
  if (variant === "featured") {
    return (
      `${base} border-navy-deep border-2 shadow-[0_8px_28px_rgba(13,31,78,0.12)] ` +
      // Wide span on mobile breakpoints handled at grid level, not here.
      ""
    );
  }
  if (variant === "wide") {
    return `${base} md:col-span-2`;
  }
  return base;
}

type CardProps = {
  tool: Tool;
  nameLabel: string;
  descLabel: string;
  freeLabel: string;
  badgeLabels: ReadonlyArray<string>;
  cardAriaLabel: string;
};

function ToolCard({
  tool,
  nameLabel,
  descLabel,
  freeLabel,
  badgeLabels,
  cardAriaLabel,
}: CardProps): ReactNode {
  const Icon = tool.icon;
  const isFeatured = tool.variant === "featured";
  return (
    <Link
      href={tool.href}
      aria-label={cardAriaLabel}
      className={cardClasses(tool.variant)}
    >
      {/* Accent top bar — visible on featured + on hover. */}
      <span
        aria-hidden={true}
        className={
          "pointer-events-none absolute inset-x-0 top-0 h-1 rounded-t-2xl] bg-[linear-gradient(90deg,#CC1627,#0D1F4E)] transition-opacity duration-200 " +
          (isFeatured ? "opacity-100" : "opacity-0 group-hover:opacity-100")
        }
      />

      {/* Circular arrow puck — top-right. Always on for featured; appears on hover otherwise. */}
      <span
        aria-hidden={true}
        className={
          "pointer-events-none absolute right-5.5 top-5.5 flex h-8.5 w-8.5 items-center justify-center rounded-full transition-all duration-200 " +
          (isFeatured
            ? "scale-100 rotate-0 opacity-100 bg-navy-deep group-hover:bg-rouge"
            : "scale-[0.6] -rotate-45 opacity-0 bg-navy-deep group-hover:scale-100 group-hover:rotate-0 group-hover:opacity-100 group-hover:bg-rouge")
        }
      >
        <ArrowUpRight className="h-4 w-4 text-white" strokeWidth={2.5} />
      </span>

      {/* Icon + pill share a row: icon vertically centered on the left,
          Gratuit pill flush to the top on the right. Pill fades on hover so
          the arrow puck can take its place. Featured cards drop the pill
          (arrow is always on) but keep the row for a stable icon rhythm. */}
      <div className="mb-[18px] flex items-start justify-between">
        <span
          aria-hidden={true}
          className={
            'flex h-11 w-11 shrink-0 items-center justify-center self-center rounded-xl transition-colors duration-200 ' +
            (isFeatured
              ? 'bg-rouge text-white group-hover:bg-rouge'
              : 'bg-[#E8EDF5] text-navy-deep group-hover:bg-navy-deep group-hover:text-white')
          }
        >
          <Icon className="h-[22px] w-[22px]" strokeWidth={2} />
        </span>
        {!isFeatured ? (
          <span className="rounded-full border border-[#EE8A93] bg-[#FCEDEF] px-2 py-0.75 font-sans text-[10px] font-bold uppercase tracking-[0.1em] text-rouge transition-opacity duration-150 group-hover:opacity-0">
            {freeLabel}
          </span>
        ) : null}
      </div>

      {/* Name. Extra right padding reserves room for the arrow puck. */}
      <p
        className={
          "font-heading text-[17px] font-bold leading-[1.25] text-navy-deep " +
          (isFeatured ? "pr-[50px]" : "pr-11")
        }
      >
        {nameLabel}
      </p>

      {/* Description. */}
      <p
        className={
          "mt-2.5 flex-1 text-[14px] leading-[1.65] text-[#4A5568] " +
          (tool.variant === "wide" ? "max-w-[480px]" : "")
        }
      >
        {descLabel}
      </p>

      {/* Badges row. */}
      <ul className="mt-[22px] flex flex-wrap items-center gap-1.5">
        {badgeLabels.map(
          (label: string): ReactNode => (
            <li
              key={label}
              className={
                "inline-flex h-[26px] items-center gap-[5px] rounded-full px-2.5 font-sans text-[11px] font-semibold text-navy-deep transition-colors duration-150 " +
                (isFeatured
                  ? "border border-[rgba(13,31,78,0.15)] bg-[rgba(13,31,78,0.07)]"
                  : "border border-[#CBD5E0] bg-[#E8EDF5] group-hover:bg-[#F7F8FC]")
              }
            >
              <span
                aria-hidden={true}
                className="h-[5px] w-[5px] shrink-0 rounded-full bg-rouge"
              />
              {label}
            </li>
          ),
        )}
      </ul>
    </Link>
  );
}

export function ToolsGrid(): ReactNode {
  const t = useTranslations("Home.ToolsGrid");
  const tItems = useTranslations("Home.ToolsGrid.Items");
  const tBadges = useTranslations("Home.ToolsGrid.Badges");

  return (
    <section
      aria-labelledby="tools-grid-title"
      className="bg-[#F7F8FC] px-5 py-14 md:px-7 md:py-[88px]"
    >
      <div className="mx-auto max-w-[1280px]">
        {/* Eyebrow pill — matches the Hero marker (short rouge line, vertically centered). */}
        <div className="mb-[22px] inline-flex items-center gap-2 rounded-full border-[1.5px] border-[#EE8A93] bg-[#FCEDEF] px-3.5 py-[5px]">
          <span
            aria-hidden={true}
            className="h-1 w-[18px] shrink-0 self-center rounded-full bg-rouge"
          />
          <span className="font-sans text-[11px] font-semibold uppercase tracking-[0.14em] text-rouge">
            {t("eyebrow")}
          </span>
        </div>

        {/* Title */}
        <h2
          id="tools-grid-title"
          className="mb-2.5 font-heading text-[clamp(34px,4vw,52px)] font-bold leading-[1.05] tracking-[-0.03em] text-navy-deep"
        >
          {t("titleLead")}
          <br />
          <span className="text-rouge">{t("titleAccent")}</span>
        </h2>

        {/* Subtitle */}
        <p className="mb-[52px] max-w-[520px] text-[17px] leading-[1.6] text-[#4A5568]">
          {t("subtitle")}
        </p>

        {/* Mosaic grid: 3-col desktop, 2-col ≥md, 1-col mobile. Wide cards span 2 cols at md+. */}
        <ul className="grid grid-cols-1 gap-3.5 md:grid-cols-2 lg:grid-cols-3">
          {TOOLS.map(
            (tool: Tool): ReactNode => (
              <li
                key={tool.slug}
                className={tool.variant === "wide" ? "md:col-span-2" : ""}
              >
                <ToolCard
                  tool={tool}
                  nameLabel={tItems(tool.nameKey)}
                  descLabel={tItems(tool.descKey)}
                  freeLabel={tBadges(tool.freeKey)}
                  badgeLabels={tool.badgeKeys.map((k: string): string =>
                    tBadges(k),
                  )}
                  cardAriaLabel={t("cardAriaLabel", {
                    name: tItems(tool.nameKey),
                  })}
                />
              </li>
            ),
          )}
        </ul>

        {/* Footer line */}
        <div className="mt-10 flex items-center justify-center border-t border-[#E2E8F0] pt-8 text-center">
          <p className="text-[15px] text-[#4A5568]">
            <strong className="font-semibold text-navy-deep">
              {t("footerLead")}
            </strong>
            {t("footerTail")}
          </p>
        </div>
      </div>
    </section>
  );
}
