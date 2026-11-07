"use client";

import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { ArrowLeft, Plus, Save, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
// The dashboard runs on admin.<site>: plain links to its short paths (see dashboard-host).
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState, type FormEvent, type ReactNode } from "react";

import { QueryBoundary } from "@/components/query-boundary";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast";
import { DOCUMENT_GUIDES } from "@/features/checklist/data/document-guides";
import { DOCUMENTS } from "@/features/checklist/lib/build-checklist";
import { CONTRACT_BLANKS } from "@/features/contracts/lib/contract-schema";
import {
  CONTRACT_MAX,
  NAME_MAX,
  PERCENT_MAX,
  PREREQUISITE_TYPES,
  prerequisiteKey,
  QUESTIONNAIRES,
  serviceInput,
  TEXT_MAX,
  type Questionnaire,
  type ServiceInput,
  type Texts,
} from "@/features/document-services/lib/service-schema";
import { toLocale } from "@/i18n/routing";
import { useTRPC } from "@/trpc/client";

const field =
  "h-11 w-full rounded-xl border-2 border-fog-light bg-white px-3.5 text-sm font-normal text-navy-deep focus:border-navy-deep focus:outline-none";
const area =
  "w-full rounded-xl border-2 border-fog-light bg-white px-3.5 py-2.5 text-sm font-normal text-navy-deep focus:border-navy-deep focus:outline-none";
const card =
  "grid gap-4 rounded-2xl border border-fog-light bg-white p-5 shadow-sm";

const EMPTY: ServiceInput = {
  slug: "",
  active: false,
  name: { fr: "", en: "" },
  summary: { fr: "", en: "" },
  provides: { fr: "", en: "" },
  turnaround: { fr: "", en: "" },
  turnaroundDays: null,
  conditions: { fr: "", en: "" },
  contractTitle: { fr: "", en: "" },
  contractBody: { fr: "", en: "" },
  priceKind: "FIXED",
  price: 0,
  unit: { fr: "", en: "" },
  documentKinds: [],
  prerequisites: [],
  questionnaire: null,
};

/** Keys for the prerequisites added in the form, from their French names; those saved keep theirs (files hang on them). */
const withKeys = (
  items: ServiceInput["prerequisites"],
): ServiceInput["prerequisites"] => {
  const taken = new Set(items.map((item) => item.key).filter(Boolean));
  return items.map((item) => {
    if (item.key) return item;
    const base = prerequisiteKey(item.fr);
    let key = base;
    for (let n = 2; taken.has(key); n++) key = `${base.slice(0, 36)}-${n}`;
    taken.add(key);
    return { ...item, key };
  });
};

type TextKey = {
  [K in keyof ServiceInput]: ServiceInput[K] extends Texts ? K : never;
}[keyof ServiceInput];

/**
 * One Service documentaire in the Tableau de bord (#80), new or to change:
 * its texts in French and English, its contract, its price (in FCFA, or a
 * share of the funds to justify), the Checklist documents it gets, and
 * whether Clients see it.
 */
export function ServiceEditView({ id }: { id: string | null }): ReactNode {
  const t = useTranslations("DocumentServices.edit");
  return (
    <div className="mx-auto grid grid-cols-1 max-w-4xl gap-6">
      <div>
        <Link
          href="/services"
          className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-slate hover:text-navy-deep"
        >
          <ArrowLeft aria-hidden={true} className="size-4" />
          {t("back")}
        </Link>
        <h1 className="font-heading text-2xl font-bold text-navy-deep md:text-3xl">
          {id ? t("title") : t("newTitle")}
        </h1>
      </div>
      {id ? (
        <QueryBoundary fallback={<EditSkeleton />}>
          <Existing id={id} />
        </QueryBoundary>
      ) : (
        <ServiceForm id={null} initial={EMPTY} />
      )}
    </div>
  );
}

function Existing({ id }: { id: string }): ReactNode {
  const trpc = useTRPC();
  const { data } = useSuspenseQuery(
    trpc.documentServices.dashboard.get.queryOptions({ id }),
  );
  // Its texts are JSON in the database; the form's own parse keeps only its fields.
  return <ServiceForm id={id} initial={data as unknown as ServiceInput} />;
}

function ServiceForm({
  id,
  initial,
}: {
  id: string | null;
  initial: ServiceInput;
}): ReactNode {
  const t = useTranslations("DocumentServices.edit");
  const locale = toLocale(useLocale());
  const ids = useId();
  const trpc = useTRPC();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<ServiceInput>(initial);
  // The price as typed: FCFA, or a percentage with decimals (2,5).
  const [price, setPrice] = useState(() =>
    initial.priceKind === "FIXED"
      ? String(initial.price)
      : String(initial.price / 100).replace(".", ","),
  );
  const [invalid, setInvalid] = useState(false);
  const update = (patch: Partial<ServiceInput>) =>
    setForm((current) => ({ ...current, ...patch }));
  const setText = (key: TextKey, lang: keyof Texts, value: string) =>
    setForm((current) => ({
      ...current,
      [key]: { ...current[key], [lang]: value },
    }));

  const save = useMutation(
    trpc.documentServices.dashboard.save.mutationOptions({
      onSuccess: (saved) => {
        void queryClient.invalidateQueries({
          queryKey: trpc.documentServices.pathKey(),
        });
        toast.add({ title: t("saved"), type: "success" });
        if (!id) router.push(`/services/${saved.id}`);
      },
      onError: (error) => {
        const known = t.has(`errors.${error.message}`);
        toast.add({
          title: t(known ? `errors.${error.message}` : "errors.UNKNOWN"),
          type: known ? "warning" : "error",
        });
      },
    }),
  );

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const typed = Number(price.replace(/\s/g, "").replace(",", "."));
    const amount =
      form.priceKind === "FIXED" ? Math.round(typed) : Math.round(typed * 100);
    const parsed = serviceInput.safeParse({
      ...form,
      prerequisites: withKeys(form.prerequisites),
      price: Number.isFinite(amount) ? amount : -1,
    });
    setInvalid(!parsed.success);
    if (parsed.success) save.mutate({ id, service: parsed.data });
  };

  const texts = (
    key: TextKey,
    label: string,
    opts: { max: number; rows?: number },
  ) => (
    <fieldset className="grid grid-cols-1 gap-2">
      <legend className="mb-1 text-sm font-semibold text-navy-deep">
        {label}
      </legend>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {(["fr", "en"] as const).map((lang) => (
          <label
            key={lang}
            htmlFor={`${ids}-${key}-${lang}`}
            className="grid grid-cols-1 gap-1 text-xs font-semibold text-slate"
          >
            {t(`languages.${lang}`)}
            {opts.rows ? (
              <textarea
                id={`${ids}-${key}-${lang}`}
                rows={opts.rows}
                maxLength={opts.max}
                value={form[key][lang]}
                onChange={(event) => setText(key, lang, event.target.value)}
                className={area}
              />
            ) : (
              <input
                id={`${ids}-${key}-${lang}`}
                maxLength={opts.max}
                value={form[key][lang]}
                onChange={(event) => setText(key, lang, event.target.value)}
                className={field}
              />
            )}
          </label>
        ))}
      </div>
    </fieldset>
  );

  return (
    <form onSubmit={submit} noValidate className="grid grid-cols-1 gap-5">
      <section className={card}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label
            htmlFor={`${ids}-slug`}
            className="grid grid-cols-1 gap-1 text-sm font-semibold text-navy-deep"
          >
            {t("slug")}
            <input
              id={`${ids}-slug`}
              value={form.slug}
              onChange={(event) =>
                update({ slug: event.target.value.toLowerCase() })
              }
              aria-describedby={`${ids}-slug-hint`}
              className={field}
            />
            <span
              id={`${ids}-slug-hint`}
              className="text-xs font-normal text-slate"
            >
              {t("slugHint")}
            </span>
          </label>
          <label
            htmlFor={`${ids}-active`}
            className="flex items-center gap-3 self-center text-sm font-semibold text-navy-deep"
          >
            <input
              id={`${ids}-active`}
              type="checkbox"
              checked={form.active}
              onChange={(event) => update({ active: event.target.checked })}
              className="size-5 accent-rouge"
            />
            {t("active")}
          </label>
        </div>
        {texts("name", t("name"), { max: NAME_MAX })}
        {texts("summary", t("summary"), { max: TEXT_MAX, rows: 3 })}
      </section>

      <section className={card}>
        <h2 className="font-heading text-lg font-bold text-navy-deep">
          {t("priceTitle")}
        </h2>
        <div
          role="radiogroup"
          aria-label={t("priceKind")}
          className="flex flex-wrap gap-2"
        >
          {(["FIXED", "PERCENT"] as const).map((kind) => (
            <button
              key={kind}
              type="button"
              role="radio"
              aria-checked={form.priceKind === kind}
              onClick={() => update({ priceKind: kind })}
              className={
                form.priceKind === kind
                  ? "inline-flex h-10 items-center rounded-full bg-navy-deep px-4 text-sm font-semibold text-white"
                  : "inline-flex h-10 items-center rounded-full border border-fog-light bg-white px-4 text-sm font-semibold text-navy-deep hover:border-navy-deep"
              }
            >
              {t(`kinds.${kind}`)}
            </button>
          ))}
        </div>
        <label
          htmlFor={`${ids}-price`}
          className="grid grid-cols-1 max-w-xs gap-1 text-sm font-semibold text-navy-deep"
        >
          {form.priceKind === "FIXED"
            ? t("priceFixed")
            : t("pricePercent", { max: PERCENT_MAX / 100 })}
          <input
            id={`${ids}-price`}
            inputMode="decimal"
            value={price}
            onChange={(event) => setPrice(event.target.value)}
            className={field}
          />
        </label>
        {texts("unit", t("unit"), { max: NAME_MAX })}
      </section>

      <section className={card}>
        <h2 className="font-heading text-lg font-bold text-navy-deep">
          {t("detailsTitle")}
        </h2>
        {texts("provides", t("provides"), { max: TEXT_MAX, rows: 3 })}
        {texts("turnaround", t("turnaround"), { max: NAME_MAX })}
        <label
          htmlFor={`${ids}-days`}
          className="grid gap-1 text-sm font-semibold text-navy-deep"
        >
          {t("turnaroundDays")}
          <span className="w-32">
            <input
              id={`${ids}-days`}
              type="number"
              inputMode="numeric"
              min={1}
              max={365}
              value={form.turnaroundDays ?? ""}
              onChange={(event) =>
                update({
                  turnaroundDays: event.target.value
                    ? Number(event.target.value)
                    : null,
                })
              }
              className={field}
            />
          </span>
          <span className="text-xs font-normal text-slate">
            {t("turnaroundDaysHint")}
          </span>
        </label>
        {texts("conditions", t("conditions"), { max: TEXT_MAX, rows: 3 })}
      </section>

      <section className={card}>
        <h2 className="font-heading text-lg font-bold text-navy-deep">
          {t("contractTitle")}
        </h2>
        <p className="text-sm text-slate">
          {t("blanks", {
            blanks: CONTRACT_BLANKS.map((blank) => `{${blank}}`).join(" "),
          })}
        </p>
        {texts("contractTitle", t("contractName"), { max: NAME_MAX })}
        {texts("contractBody", t("contractBody"), {
          max: CONTRACT_MAX,
          rows: 14,
        })}
      </section>

      <fieldset className={card}>
        <legend className="sr-only">{t("documents")}</legend>
        <p
          aria-hidden={true}
          className="font-heading text-lg font-bold text-navy-deep"
        >
          {t("documents")}
        </p>
        <p className="text-sm text-slate">{t("documentsHint")}</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {DOCUMENTS.map((kind) => (
            <label
              key={kind}
              htmlFor={`${ids}-kind-${kind}`}
              className="flex items-center gap-2 text-sm text-navy-deep"
            >
              <input
                id={`${ids}-kind-${kind}`}
                type="checkbox"
                checked={form.documentKinds.includes(kind)}
                onChange={(event) =>
                  update({
                    documentKinds: event.target.checked
                      ? [...form.documentKinds, kind]
                      : form.documentKinds.filter((other) => other !== kind),
                  })
                }
                className="size-4 accent-rouge"
              />
              {DOCUMENT_GUIDES[locale][kind].name}
            </label>
          ))}
        </div>
      </fieldset>

      <section className={card}>
        <h2 className="font-heading text-lg font-bold text-navy-deep">
          {t("prerequisites")}
        </h2>
        <p className="text-sm text-slate">{t("prerequisitesHint")}</p>
        {form.prerequisites.length === 0 ? (
          <p className="text-sm text-slate">{t("noPrerequisite")}</p>
        ) : null}
        <ol className="grid grid-cols-1 gap-3">
          {form.prerequisites.map((item, index) => {
            const setItem = (patch: Partial<typeof item>) =>
              update({
                prerequisites: form.prerequisites.map((other, at) =>
                  at === index ? { ...other, ...patch } : other,
                ),
              });
            return (
              <li
                key={index}
                className="grid grid-cols-1 gap-2 rounded-xl border border-fog-light p-3 sm:grid-cols-2"
              >
                {(["fr", "en"] as const).map((lang) => (
                  <label
                    key={lang}
                    htmlFor={`${ids}-pre-${index}-${lang}`}
                    className="grid gap-1 text-xs font-semibold text-slate"
                  >
                    {t(`languages.${lang}`)}
                    <input
                      id={`${ids}-pre-${index}-${lang}`}
                      value={item[lang]}
                      maxLength={NAME_MAX}
                      onChange={(event) =>
                        setItem({ [lang]: event.target.value })
                      }
                      className={field}
                    />
                  </label>
                ))}
                <label
                  htmlFor={`${ids}-pre-${index}-type`}
                  className="grid gap-1 text-xs font-semibold text-slate"
                >
                  {t("prerequisiteType")}
                  <select
                    id={`${ids}-pre-${index}-type`}
                    value={item.type}
                    onChange={(event) =>
                      setItem({ type: event.target.value as typeof item.type })
                    }
                    className={field}
                  >
                    {PREREQUISITE_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {t(`prerequisiteTypes.${type}`)}
                      </option>
                    ))}
                  </select>
                </label>
                <label
                  htmlFor={`${ids}-pre-${index}-when`}
                  className="flex items-center gap-2 self-end pb-3 text-sm font-semibold text-navy-deep"
                >
                  <input
                    id={`${ids}-pre-${index}-when`}
                    type="checkbox"
                    checked={item.when === "donation"}
                    onChange={(event) =>
                      setItem({
                        when: event.target.checked ? "donation" : null,
                      })
                    }
                    className="size-5 shrink-0 accent-rouge"
                  />
                  {t("prerequisiteDonation")}
                </label>
                <div className="flex items-end gap-2 sm:col-span-2">
                  <label
                    htmlFor={`${ids}-pre-${index}-kind`}
                    className="grid flex-1 gap-1 text-xs font-semibold text-slate"
                  >
                    {t("prerequisiteKind")}
                    <select
                      id={`${ids}-pre-${index}-kind`}
                      value={item.kind ?? ""}
                      onChange={(event) =>
                        setItem({
                          kind: (event.target.value ||
                            null) as typeof item.kind,
                        })
                      }
                      className={field}
                    >
                      <option value="">{t("noKind")}</option>
                      {DOCUMENTS.map((kind) => (
                        <option key={kind} value={kind}>
                          {DOCUMENT_GUIDES[locale][kind].name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      update({
                        prerequisites: form.prerequisites.filter(
                          (_, at) => at !== index,
                        ),
                      })
                    }
                    aria-label={t("removePrerequisite")}
                    title={t("removePrerequisite")}
                    className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-slate hover:bg-off-white hover:text-rouge"
                  >
                    <Trash2 aria-hidden={true} className="size-4" />
                  </button>
                </div>
              </li>
            );
          })}
        </ol>
        <button
          type="button"
          onClick={() =>
            update({
              prerequisites: [
                ...form.prerequisites,
                {
                  key: "",
                  fr: "",
                  en: "",
                  type: "file",
                  kind: null,
                  when: null,
                },
              ],
            })
          }
          className="inline-flex h-11 w-fit items-center gap-1.5 rounded-full border-2 border-navy-deep px-4 text-sm font-semibold text-navy-deep hover:bg-navy-deep hover:text-white"
        >
          <Plus aria-hidden={true} className="size-4" />
          {t("addPrerequisite")}
        </button>
        <label
          htmlFor={`${ids}-questionnaire`}
          className="grid gap-1 text-sm font-semibold text-navy-deep"
        >
          {t("questionnaire")}
          <select
            id={`${ids}-questionnaire`}
            value={form.questionnaire ?? ""}
            onChange={(event) =>
              update({
                questionnaire: (event.target.value ||
                  null) as Questionnaire | null,
              })
            }
            className={field}
          >
            <option value="">{t("noQuestionnaire")}</option>
            {QUESTIONNAIRES.map((questionnaire) => (
              <option key={questionnaire} value={questionnaire}>
                {t(`questionnaires.${questionnaire}`)}
              </option>
            ))}
          </select>
          <span className="text-xs font-normal text-slate">
            {t("questionnaireHint")}
          </span>
        </label>
      </section>

      {invalid ? (
        <p role="alert" className="text-sm font-medium text-rouge">
          {t("invalid")}
        </p>
      ) : null}
      <div className="sticky bottom-4 flex justify-end">
        <button
          type="submit"
          disabled={save.isPending}
          className="inline-flex h-12 items-center gap-2 rounded-full bg-rouge px-6 text-sm font-semibold text-white shadow-md hover:bg-crimson disabled:opacity-50"
        >
          <Save aria-hidden={true} className="size-4" />
          {save.isPending ? t("saving") : t("save")}
        </button>
      </div>
    </form>
  );
}

function EditSkeleton(): ReactNode {
  const t = useTranslations("DocumentServices.edit");
  return (
    <div role="status" className="grid grid-cols-1 gap-4">
      <span className="sr-only">{t("loading")}</span>
      <Skeleton aria-hidden={true} className="h-48 rounded-2xl" />
      <Skeleton aria-hidden={true} className="h-64 rounded-2xl" />
    </div>
  );
}
