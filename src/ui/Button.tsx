import type { ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  block?: boolean;
}

export function Button({
  variant = "primary",
  size = "md",
  block,
  className,
  type = "button",
  ...rest
}: ButtonProps) {
  const cls = [
    "btn",
    `btn-${variant}`,
    `btn-${size}`,
    block ? "btn-block" : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");
  return <button type={type} className={cls} {...rest} />;
}
