import {
  ArrowUpRight,
  CalendarCheck,
  Heart,
  Mail,
  MapPin,
  Phone,
} from "lucide-react";
import { CanadaFlagIcon } from "@/features/landing/components/brand-icons";
import { useTranslations } from "next-intl";
import Image from "next/image";

import { Link } from "@/i18n/navigation";
import {
  FOOTER_CONTACT,
  FOOTER_CONTENT_LINKS,
  FOOTER_LEGAL_LINKS,
  FOOTER_SERVICE_LINKS,
  FOOTER_SOCIALS,
  FOOTER_TOOL_LINKS,
  type FooterLink,
} from "@/features/landing/data/footer";

export function SiteFooter() {
  const t = useTranslations("Home.Footer");
  const tTools = useTranslations("Home.Footer.Tools");
  const tServices = useTranslations("Home.Footer.Services");
  const tContent = useTranslations("Home.Footer.content");
  const tLegal = useTranslations("Home.Footer.legal");
  const tSocial = useTranslations("Home.Footer.Social");
  const tContact = useTranslations("Home.Footer.contact");

  const year = new Date().getFullYear();

  return (
    <footer
      aria-label={t("ariaLabel")}
      className="bg-navy-deep text-white mt-24 w-full"
    >
      <div className="mx-auto flex max-w-[1280px] flex-col gap-12 px-4 py-16 md:px-6">
        <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-12">
          {/* Brand column */}
          <div className="lg:col-span-4 flex flex-col gap-6">
            <Eyebrow>{t("brandEyebrow")}</Eyebrow>
            <Link
              href="/"
              aria-label={t("brandEyebrow")}
              className="inline-flex"
            >
              <span className="relative inline-flex h-32 w-32 overflow-hidden rounded-full bg-white shadow-lg ring-4 ring-white/10">
                <Image
                  src="/Logo-white-background.svg"
                  alt={t("brandEyebrow")}
                  fill
                  className="scale-125 object-contain p-0"
                />
              </span>
            </Link>
            <p className="text-white/70 text-sm max-w-sm leading-relaxed">
              {t("tagline")}
            </p>
            <ul className="flex gap-3">
              {FOOTER_SOCIALS.map((s) => (
                <li key={s.key}>
                  <a
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={tSocial(s.key)}
                    className="hover:bg-white inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white transition-colors"
                  >
                    <Image
                      src={s.iconSrc}
                      alt=""
                      width={20}
                      height={20}
                      className="h-5 w-5"
                    />
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Tools column */}
          <FooterColumn title={t("columns.tools")} className="lg:col-span-2">
            {FOOTER_TOOL_LINKS.map((link) => (
              <FooterLinkRow
                key={link.key}
                link={link}
                label={tTools(link.labelKey)}
              />
            ))}
          </FooterColumn>

          {/* Services + nested Contenu column (matches design) */}
          <FooterColumn title={t("columns.services")} className="lg:col-span-3">
            {FOOTER_SERVICE_LINKS.map((link) => (
              <FooterLinkRow
                key={link.key}
                link={link}
                label={tServices(link.labelKey)}
              />
            ))}
            <li className="pt-4">
              <Eyebrow as="h4">{t("columns.content")}</Eyebrow>
            </li>
            {FOOTER_CONTENT_LINKS.map((link) => (
              <FooterLinkRow
                key={link.key}
                link={link}
                label={tContent(link.labelKey)}
              />
            ))}
          </FooterColumn>

          {/* Contact column */}
          <div className="lg:col-span-3 flex flex-col gap-5 text-sm">
            <Eyebrow>{t("columns.contact")}</Eyebrow>
            <ul className="flex flex-col gap-4">
              <ContactRow
                icon={Mail}
                label={tContact("emailLabel")}
                value={tContact("emailValue")}
                href={FOOTER_CONTACT.email}
              />
              <ContactRow
                icon={Phone}
                label={tContact("phoneLabel")}
                value={tContact("phoneValue")}
                href={FOOTER_CONTACT.phone}
              />
              <ContactRow
                icon={MapPin}
                label={tContact("regionLabel")}
                value={tContact("regionValue")}
              />
            </ul>
            <Link
              href={FOOTER_CONTACT.bookingHref}
              className="text-rouge inline-flex items-center gap-2 text-sm font-semibold hover:text-rouge/80"
            >
              <CalendarCheck aria-hidden className="h-4 w-4" />
              {tContact("book")}
            </Link>
          </div>
        </div>

        <div className="border-t border-white/10 pt-6 flex flex-col gap-4 text-sm text-white/60 md:flex-row md:items-center md:justify-between">
          <p className="inline-flex flex-wrap items-center gap-x-2">
            <span>{t("copyright", { year })}</span>
            <span>—</span>
            <span className="inline-flex items-center gap-1.5">
              {t("madeWith")}
              <Heart
                aria-hidden
                className="text-rouge h-3.5 w-3.5 fill-current"
              />
              {t("madeWithTail")}
            </span>
          </p>
          <ul className="flex flex-wrap gap-x-6 gap-y-2">
            {FOOTER_LEGAL_LINKS.map((link) => (
              <li key={link.key}>
                <Link href={link.href} className="hover:text-white">
                  {tLegal(link.labelKey)}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="-mt-2 flex flex-col gap-3">
          <span className="inline-flex items-center gap-1.5 self-start text-xs text-white/60">
            <CanadaFlagIcon className="h-3.5 w-5 rounded-[2px]" />
            {t("canadaBadge")}
          </span>
          <p className="text-white/50 text-xs max-w-3xl leading-relaxed">
            {t("disclaimer")}
          </p>
        </div>
      </div>
    </footer>
  );
}

function Eyebrow({
  children,
  as: Tag = "h3",
}: {
  children: React.ReactNode;
  as?: "h3" | "h4";
}) {
  return (
    <Tag className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/90">
      <span aria-hidden className="bg-rouge h-0.5 w-6" />
      {children}
    </Tag>
  );
}

function FooterColumn({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-col gap-4 text-sm ${className ?? ""}`}>
      <Eyebrow>{title}</Eyebrow>
      <ul className="flex flex-col gap-3">{children}</ul>
    </div>
  );
}

function FooterLinkRow({ link, label }: { link: FooterLink; label: string }) {
  const className =
    "inline-flex items-center gap-1 text-white/70 hover:text-white";
  if (link.external) {
    return (
      <li>
        <a
          href={link.href}
          target="_blank"
          rel="noopener noreferrer"
          className={className}
        >
          {label}
          <ArrowUpRight aria-hidden className="h-3.5 w-3.5" />
        </a>
      </li>
    );
  }
  return (
    <li>
      <Link href={link.href} className={className}>
        {label}
      </Link>
    </li>
  );
}

function ContactRow({
  icon: Icon,
  label,
  value,
  href,
}: {
  icon: typeof Mail;
  label: string;
  value: string;
  href?: string;
}) {
  const body = (
    <div className="flex flex-col">
      <span className="text-[0.68rem] font-semibold uppercase tracking-wider text-white/50">
        {label}
      </span>
      <span className="text-white/85 break-all">{value}</span>
    </div>
  );
  return (
    <li className="flex items-start gap-3">
      <span className="bg-white/5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg">
        <Icon aria-hidden className="h-4 w-4" />
      </span>
      {href ? (
        <a href={href} className="hover:text-white">
          {body}
        </a>
      ) : (
        body
      )}
    </li>
  );
}
