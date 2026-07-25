export type ListingMarkerDescriptor = {
  id: number;
  address: string | null;
  suburb: string | null;
  feasibilityScore: number | null;
};

type AttributeElement = {
  setAttribute(name: string, value: string): void;
  removeAttribute(name: string): void;
};

type AddableMarker<TMap> = {
  addTo(map: TMap): AddableMarker<TMap>;
  getElement(): AttributeElement;
};

export function listingMarkerAccessibleName(listing: ListingMarkerDescriptor): string {
  const location = listing.address?.trim() || listing.suburb?.trim() || "Untitled listing";
  const score = listing.feasibilityScore === null ? "score not available" : `feasibility score ${listing.feasibilityScore} out of 100`;
  return `Select listing ${listing.id}: ${location}; ${score}`;
}

export function restoreListingMarkerAccessibility(
  element: AttributeElement,
  listing: ListingMarkerDescriptor,
): void {
  const label = listingMarkerAccessibleName(listing);
  element.setAttribute("aria-label", label);
  element.setAttribute("title", label);
  element.setAttribute("data-listing-id", String(listing.id));
}

export function addAccessibleListingMarker<TMap, TMarker extends AddableMarker<TMap>>(
  marker: TMarker,
  map: TMap,
  listing: ListingMarkerDescriptor,
): TMarker {
  const addedMarker = marker.addTo(map) as TMarker;
  restoreListingMarkerAccessibility(addedMarker.getElement(), listing);
  return addedMarker;
}

export function restoreCoordinateMarkerSemantics(element: AttributeElement): void {
  element.removeAttribute("aria-label");
  element.removeAttribute("tabindex");
  element.setAttribute("aria-hidden", "true");
  element.setAttribute("role", "presentation");
}
