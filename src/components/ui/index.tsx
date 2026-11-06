import type { ButtonHTMLAttributes, HTMLAttributes } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" };
export function Button({ variant = "primary", className = "", type = "button", ...props }: ButtonProps) {
  return <button type={type} className={`button button--${variant} ${className}`.trim()} {...props} />;
}
export function Card({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`card ${className}`.trim()} {...props} />;
}
type BadgeProps = HTMLAttributes<HTMLSpanElement> & { tone?: "neutral" | "accent" };
export function Badge({ tone = "neutral", className = "", ...props }: BadgeProps) {
  return <span className={`badge badge--${tone} ${className}`.trim()} {...props} />;
}
