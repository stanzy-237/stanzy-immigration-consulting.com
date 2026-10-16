import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { setRequestLocale } from 'next-intl/server';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';

import type { LocaleParams } from '@/i18n/routing';

const SHOWCASE_ENABLED =
  process.env.NODE_ENV !== 'production' ||
  process.env.NEXT_PUBLIC_ENABLE_DESIGN_SHOWCASE === '1';

export const metadata: Metadata = {
  title: 'Design System · Stanzy',
  robots: { index: false, follow: false },
};

export default async function DesignShowcasePage({
  params,
}: {
  params: LocaleParams;
}) {
  if (!SHOWCASE_ENABLED) notFound();

  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main className="mx-auto max-w-6xl space-y-16 px-6 py-16">
      <header className="space-y-3">
        <p className="font-label text-text-muted">Stanzy Design System</p>
        <h1 className="text-5xl font-bold tracking-tight text-ink">
          Design showcase
        </h1>
        <p className="max-w-2xl text-lg text-slate">
          Every primitive, every state. Mirrors the MagicPath{' '}
          <strong>Stanzy Design System</strong> project. Light mode only.
          Noindex. Env-gated on production.
        </p>
      </header>

      <Section title="Colour tokens" eyebrow="01 · Palette">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {SWATCHES.map(({ name, hex, fg }) => (
            <Swatch key={name} name={name} hex={hex} fg={fg} />
          ))}
        </div>
      </Section>

      <Section title="Typography" eyebrow="02 · Type scale">
        <div className="space-y-4">
          {TYPE_SCALE.map(({ label, token, lineHeight, weight, family }) => (
            <p
              key={label}
              style={{
                fontSize: `var(--text-${token})`,
                lineHeight,
                fontWeight: weight,
              }}
              className={family}
            >
              {label}
            </p>
          ))}
          <p className="font-label text-text">
            Label · Plus Jakarta Sans 11 uppercase
          </p>
        </div>
      </Section>

      <Section title="Buttons" eyebrow="03 · Actions">
        <div className="flex flex-wrap items-center gap-3">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="link">Link</Button>
          <Button variant="destructive">Destructive</Button>
          <Button disabled>Disabled</Button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button size="xs">XS</Button>
          <Button size="sm">Small</Button>
          <Button size="default">Default</Button>
          <Button size="lg">Large</Button>
        </div>
      </Section>

      <Section title="Form fields" eyebrow="04 · Inputs">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="demo-email" className="font-label">
              Email
            </Label>
            <Input id="demo-email" type="email" placeholder="you@example.com" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="demo-disabled" className="font-label">
              Disabled
            </Label>
            <Input id="demo-disabled" disabled placeholder="Disabled" />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="demo-notes" className="font-label">
              Notes
            </Label>
            <Textarea id="demo-notes" placeholder="Write a note…" />
          </div>
          <div className="flex items-center gap-3">
            <Checkbox id="demo-check" />
            <Label htmlFor="demo-check">I accept the terms</Label>
          </div>
          <div className="flex items-center gap-3">
            <Switch id="demo-switch" />
            <Label htmlFor="demo-switch">Enable notifications</Label>
          </div>
          <div className="md:col-span-2">
            <RadioGroup defaultValue="a" className="flex gap-6">
              <div className="flex items-center gap-2">
                <RadioGroupItem value="a" id="r-a" />
                <Label htmlFor="r-a">Option A</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="b" id="r-b" />
                <Label htmlFor="r-b">Option B</Label>
              </div>
            </RadioGroup>
          </div>
        </div>
      </Section>

      <Section title="Badges" eyebrow="05 · Pills / tags">
        <div className="flex flex-wrap items-center gap-2">
          <Badge>Default</Badge>
          <Badge variant="secondary">Secondary</Badge>
          <Badge variant="outline">Outline</Badge>
          <Badge variant="destructive">Destructive</Badge>
        </div>
      </Section>

      <Section title="Cards" eyebrow="06 · Surfaces">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Calculateur CRS</CardTitle>
              <CardDescription>
                Évaluez votre score en quelques minutes.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate">
                Le calculateur CRS évalue votre profil Entrée Express selon le
                modèle officiel.
              </p>
            </CardContent>
            <CardFooter>
              <Button size="sm">Commencer</Button>
            </CardFooter>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Dernier tirage</CardTitle>
              <CardDescription>Mis à jour il y a 2 h</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="font-heading text-4xl text-rouge">511</p>
              <p className="text-sm text-slate">
                CRS minimum · 1 500 ITA émises
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Mon Parcours</CardTitle>
              <CardDescription>3 étapes enregistrées</CardDescription>
            </CardHeader>
            <CardContent>
              <Progress value={40} />
            </CardContent>
          </Card>
        </div>
      </Section>

      <Section title="Alerts" eyebrow="07 · Feedback">
        <div className="grid gap-4 md:grid-cols-2">
          <Alert>
            <AlertTitle>Information</AlertTitle>
            <AlertDescription>
              Les tirages Entrée Express ont lieu toutes les 2 semaines.
            </AlertDescription>
          </Alert>
          <Alert
            style={{
              backgroundColor: 'var(--blush)',
              borderColor: 'var(--rouge)',
            }}
          >
            <AlertTitle>Document manquant</AlertTitle>
            <AlertDescription>
              Veuillez joindre votre passeport pour continuer.
            </AlertDescription>
          </Alert>
        </div>
      </Section>

      <Section title="Avatars, loaders" eyebrow="08 · Misc">
        <div className="flex flex-wrap items-center gap-6">
          <Avatar>
            <AvatarFallback>SI</AvatarFallback>
          </Avatar>
          <Spinner />
          <div className="w-40 space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </div>
      </Section>

      <Separator />
      <footer className="pb-16 text-sm text-slate">
        Need to add or change a token? Edit{' '}
        <code className="rounded bg-ice-blue px-1.5 py-0.5">
          src/app/globals.css
        </code>
        . Primitives live in{' '}
        <code className="rounded bg-ice-blue px-1.5 py-0.5">
          src/components/ui/
        </code>
        .
      </footer>
    </main>
  );
}

function Section({
  title,
  eyebrow,
  children,
}: {
  title: string;
  eyebrow: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-6">
      <div>
        <p className="font-label text-text-muted">{eyebrow}</p>
        <h2 className="text-text mt-1 text-3xl font-bold">{title}</h2>
      </div>
      {children}
    </section>
  );
}

type Swatch = { name: string; hex: string; fg: 'white' | 'ink' };

const SWATCHES: readonly Swatch[] = [
  { name: 'rouge', hex: '#CC1627', fg: 'white' },
  { name: 'crimson', hex: '#D93344', fg: 'white' },
  { name: 'rose', hex: '#EE8A93', fg: 'ink' },
  { name: 'blush', hex: '#FCEDEF', fg: 'ink' },
  { name: 'navy-deep', hex: '#0D1F4E', fg: 'white' },
  { name: 'navy-80', hex: '#1A3065', fg: 'white' },
  { name: 'steel-blue', hex: '#6B88B5', fg: 'white' },
  { name: 'ice-blue', hex: '#E8EDF5', fg: 'ink' },
  { name: 'off-white', hex: '#F7F8FC', fg: 'ink' },
  { name: 'fog', hex: '#CBD5E0', fg: 'ink' },
  { name: 'slate', hex: '#4A5568', fg: 'white' },
  { name: 'ink', hex: '#0D1F4E', fg: 'white' },
];

type TypeRow = {
  label: string;
  token: 'display' | 'h1' | 'h2' | 'h3' | 'h4' | 'body-lg' | 'body';
  lineHeight: number;
  weight: number;
  family: string;
};

const TYPE_SCALE: readonly TypeRow[] = [
  { label: 'Display · Syne 72', token: 'display', lineHeight: 1, weight: 700, family: 'font-heading' },
  { label: 'H1 · Syne 56', token: 'h1', lineHeight: 1.1, weight: 700, family: 'font-heading' },
  { label: 'H2 · Syne 40', token: 'h2', lineHeight: 1.15, weight: 700, family: 'font-heading' },
  { label: 'H3 · Syne 28', token: 'h3', lineHeight: 1.2, weight: 700, family: 'font-heading' },
  { label: 'H4 · Work Sans 20 Semibold', token: 'h4', lineHeight: 1.3, weight: 600, family: 'font-body' },
  { label: 'Body LG — Work Sans 18', token: 'body-lg', lineHeight: 1.75, weight: 400, family: 'font-body text-text-muted' },
  { label: 'Body — Work Sans 16', token: 'body', lineHeight: 1.75, weight: 400, family: 'font-body text-text-muted' },
];

function Swatch({ name, hex, fg }: Swatch) {
  return (
    <div
      style={{ backgroundColor: `var(--${name})` }}
      className={`flex h-24 flex-col justify-between rounded-lg p-3 shadow-sm text-${fg}`}
    >
      <span className="font-label">{name}</span>
      <span className="font-mono text-xs">{hex}</span>
    </div>
  );
}
