type PortalIconProps = {
  name: string;
  className?: string;
};

export function PortalIcon({ name, className }: PortalIconProps) {
  const classes = ["material-symbols-rounded", className].filter(Boolean).join(" ");

  return <span className={classes} aria-hidden="true">{name}</span>;
}
