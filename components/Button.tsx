import { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-forest text-stone hover:bg-forest-light disabled:bg-ink-soft/40 disabled:text-stone/70",
  secondary:
    "bg-transparent border border-forest text-forest hover:bg-forest/5 disabled:border-ink-soft/40 disabled:text-ink-soft/40",
  ghost: "bg-transparent text-ink-soft hover:text-ink disabled:text-ink-soft/40",
  danger:
    "bg-transparent border border-clay/60 text-clay hover:bg-clay/10 disabled:border-ink-soft/40 disabled:text-ink-soft/40",
};

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold tracking-wide transition-colors disabled:cursor-not-allowed ${variantClasses[variant]} ${className}`}
      {...props}
    />
  );
}
