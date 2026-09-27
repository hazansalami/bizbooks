import Link from "next/link";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "light" | "sun";
const variants: Record<Variant, string> = {
  primary: "bg-brand text-white hover:bg-brand-deep",
  secondary: "bg-paper text-ink border border-line-strong hover:border-ink",
  ghost: "text-ink hover:bg-line/60",
  danger: "bg-danger text-white hover:brightness-95",
  light: "bg-white text-brand-deep hover:bg-brand-wash",
  sun: "bg-sun text-ink hover:brightness-95",
};
const sizes = {
  sm: "min-h-9 px-3 text-sm",
  md: "min-h-11 px-5 text-[0.95rem]",
  lg: "min-h-13 px-6 text-base",
};

export function buttonClass(variant: Variant = "primary", size: keyof typeof sizes = "md", extra?: string) {
  return cn(
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-semibold transition-colors duration-150 cursor-pointer select-none disabled:opacity-60 disabled:cursor-not-allowed",
    variants[variant],
    sizes[size],
    extra,
  );
}

export function ButtonLink({
  href, variant, size, className, children, ...rest
}: { href: string; variant?: Variant; size?: keyof typeof sizes; className?: string; children: React.ReactNode } & Omit<React.ComponentProps<typeof Link>, "href" | "className">) {
  return (
    <Link href={href} className={buttonClass(variant, size, className)} {...rest}>
      {children}
    </Link>
  );
}

const tones = {
  neutral: "bg-line/70 text-ink-soft",
  brand: "bg-brand-wash text-brand-deep",
  sun: "bg-sun-wash text-sun-ink",
  danger: "bg-danger-wash text-danger",
  info: "bg-info-wash text-info",
};
export type Tone = keyof typeof tones;

export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap", tones[tone], className)}>
      {children}
    </span>
  );
}

export function Panel({ className, children, as: Tag = "section" }: { className?: string; children: React.ReactNode; as?: "section" | "div" | "article" }) {
  return <Tag className={cn("rounded-2xl bg-paper border border-line", className)}>{children}</Tag>;
}

export function Field({
  label, name, hint, error, required, children, className,
}: { label: string; name: string; hint?: React.ReactNode; error?: string; required?: boolean; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={name} className="text-sm font-semibold text-ink">
        {label}
        {!required && <span className="ml-1 font-normal text-muted">(optional)</span>}
      </label>
      {children}
      {hint && !error && <p id={`${name}-hint`} className="text-sm text-muted">{hint}</p>}
      {error && <p id={`${name}-error`} role="alert" className="text-sm font-medium text-danger">{error}</p>}
    </div>
  );
}

export const inputClass =
  "w-full min-h-12 rounded-xl border border-line-strong bg-paper px-3.5 text-base text-ink placeholder:text-muted/70 transition-colors focus:border-brand focus:outline-none focus:ring-3 focus:ring-brand/20 aria-invalid:border-danger";

export function Input({ name, error, className, ...rest }: React.ComponentProps<"input"> & { name: string; error?: string }) {
  return (
    <input
      id={name}
      name={name}
      aria-invalid={error ? true : undefined}
      aria-describedby={error ? `${name}-error` : `${name}-hint`}
      className={cn(inputClass, className)}
      {...rest}
    />
  );
}

export function Select({ name, error, className, children, ...rest }: React.ComponentProps<"select"> & { name: string; error?: string }) {
  return (
    <select
      id={name}
      name={name}
      aria-invalid={error ? true : undefined}
      className={cn(inputClass, "appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%235e6a64%22 stroke-width=%222.5%22><path d=%22m6 9 6 6 6-6%22/></svg>')] bg-[position:right_14px_center] bg-no-repeat pr-10", className)}
      {...rest}
    >
      {children}
    </select>
  );
}

export function Textarea({ name, error, className, ...rest }: React.ComponentProps<"textarea"> & { name: string; error?: string }) {
  return (
    <textarea
      id={name}
      name={name}
      aria-invalid={error ? true : undefined}
      className={cn(inputClass, "min-h-24 py-3 leading-relaxed", className)}
      {...rest}
    />
  );
}

export function Notice({ tone = "info", title, children, className }: { tone?: "info" | "brand" | "sun" | "danger"; title?: string; children?: React.ReactNode; className?: string }) {
  const styles = {
    info: "bg-info-wash border-info/20 text-info",
    brand: "bg-brand-wash border-brand/20 text-brand-deep",
    sun: "bg-sun-wash border-sun/40 text-sun-ink",
    danger: "bg-danger-wash border-danger/20 text-danger",
  };
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cn("rounded-xl border px-4 py-3 text-sm leading-relaxed", styles[tone], className)}>
      {title && <p className="font-semibold">{title}</p>}
      {children && <div className={title ? "mt-0.5" : ""}>{children}</div>}
    </div>
  );
}

export function PageHeader({ title, description, actions, back }: { title: string; description?: React.ReactNode; actions?: React.ReactNode; back?: { href: string; label: string } }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {back && (
          <Link href={back.href} className="mb-2 inline-flex min-h-9 items-center text-sm font-semibold text-muted hover:text-ink">
            ← {back.label}
          </Link>
        )}
        <h1 className="text-2xl sm:text-3xl">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

export function EmptyState({ icon, title, body, action }: { icon?: React.ReactNode; title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-line-strong bg-paper px-6 py-12 text-center">
      {icon && <div className="mb-3 grid size-12 place-items-center rounded-full bg-brand-wash text-brand">{icon}</div>}
      <h2 className="text-lg">{title}</h2>
      <p className="mt-1 max-w-sm text-muted">{body}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Stat({ label, value, hint, tone = "neutral" }: { label: string; value: string; hint?: React.ReactNode; tone?: "neutral" | "brand" | "sun" | "danger" }) {
  const bar = { neutral: "bg-line-strong", brand: "bg-brand", sun: "bg-sun", danger: "bg-danger" }[tone];
  return (
    <div className="relative overflow-hidden rounded-2xl border border-line bg-paper p-4 sm:p-5">
      <span aria-hidden className={cn("absolute inset-y-0 left-0 w-1", bar)} />
      <p className="text-sm font-medium text-muted">{label}</p>
      <p className="num mt-1 text-2xl font-bold tracking-tight sm:text-[1.7rem]">{value}</p>
      {hint && <p className="mt-1 text-sm text-muted">{hint}</p>}
    </div>
  );
}
