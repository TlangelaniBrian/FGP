const zarNumberFormatter = new Intl.NumberFormat("en-ZA", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatZar(value: number): string {
  const amount = zarNumberFormatter.formatToParts(value).map((part) => {
    if (part.type === "group") return " ";
    if (part.type === "decimal") return ".";
    return part.value;
  }).join("");

  return `R ${amount}`;
}
