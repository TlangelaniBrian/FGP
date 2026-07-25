import { formatZar } from "../../../../lib/format";

export interface OwnedListingInput {
  address: string | null;
  suburb: string | null;
  sizeSqm: number | null;
  price: number | null;
}

export interface OwnedListingFact {
  label: "Address" | "Land size" | "Price" | "Price / m²";
  value: string;
}

export type ParcelIntelligenceViewMode = "loading" | "error" | "not-found" | "ready";

function formatArea(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${Math.round(value).toLocaleString("en-ZA").replaceAll("\u00a0", " ")} m²`;
}

function ownedAddress(address: string | null, suburb: string | null): string {
  const parts = [address, suburb].filter((part, index, values): part is string => (
    Boolean(part) && values.indexOf(part) === index
  ));
  return parts.join(" · ") || "Not supplied";
}

export function buildOwnedListingFacts(ownedListing: OwnedListingInput): OwnedListingFact[] {
  const pricePerSqm = ownedListing.price != null
    && Number.isFinite(ownedListing.price)
    && ownedListing.sizeSqm != null
    && Number.isFinite(ownedListing.sizeSqm)
    && ownedListing.sizeSqm > 0
    ? ownedListing.price / ownedListing.sizeSqm
    : null;

  return [
    { label: "Address", value: ownedAddress(ownedListing.address, ownedListing.suburb) },
    { label: "Land size", value: formatArea(ownedListing.sizeSqm) },
    { label: "Price", value: ownedListing.price == null || !Number.isFinite(ownedListing.price) ? "—" : formatZar(ownedListing.price) },
    { label: "Price / m²", value: pricePerSqm == null ? "—" : formatZar(pricePerSqm) },
  ];
}

export function buildParcelIntelligenceView({
  requestStatus,
  analysisFound,
  ownedListing,
}: {
  requestStatus: "loading" | "ready" | "error";
  analysisFound: boolean | null;
  ownedListing: OwnedListingInput;
}): {
  mode: ParcelIntelligenceViewMode;
  showOwnedFacts: boolean;
  ownedFacts: OwnedListingFact[];
} {
  const mode: ParcelIntelligenceViewMode = requestStatus === "loading"
    ? "loading"
    : requestStatus === "error"
      ? "error"
      : analysisFound
        ? "ready"
        : "not-found";

  return {
    mode,
    showOwnedFacts: mode !== "loading",
    ownedFacts: buildOwnedListingFacts(ownedListing),
  };
}
