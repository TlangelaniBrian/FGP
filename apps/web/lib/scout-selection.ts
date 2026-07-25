export type ScoutCoordinate = { lat: number; lng: number };

export type ScoutSelectionState = {
  selectedListingId: number | null;
  analysisCoordinate: ScoutCoordinate | null;
};

export const EMPTY_SCOUT_SELECTION: ScoutSelectionState = {
  selectedListingId: null,
  analysisCoordinate: null,
};

export function selectScoutListing(listingId: number): ScoutSelectionState {
  return {
    selectedListingId: listingId,
    analysisCoordinate: null,
  };
}

export function selectScoutAnalysisCoordinate(analysisCoordinate: ScoutCoordinate): ScoutSelectionState {
  return {
    selectedListingId: null,
    analysisCoordinate,
  };
}

export function reconcileScoutSelection(
  selection: ScoutSelectionState,
  visibleListingIds: readonly number[],
): ScoutSelectionState {
  if (selection.selectedListingId === null || visibleListingIds.includes(selection.selectedListingId)) {
    return selection;
  }
  return EMPTY_SCOUT_SELECTION;
}
