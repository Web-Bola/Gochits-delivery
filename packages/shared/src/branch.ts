/** One row of resolve_branches(lat, lng). Mirrors the SQL function output. */
export interface BranchOption {
  branch_id: string;
  branch_name: string;
  zone_id: string;
  zone_name: string;
  fee_tetri: number | null;
  min_order_tetri: number;
  free_from_tetri: number | null;
  extra_minutes: number;
  distance_m: number | null;
  can_order: boolean;
  cod_enabled: boolean;
}

/** Order for the picker: orderable branches first, then nearest. Which one is preselected is D-OVERLAP. */
export function sortBranchOptions(options: readonly BranchOption[]): BranchOption[] {
  return [...options].sort((a, b) => {
    if (a.can_order !== b.can_order) return a.can_order ? -1 : 1;
    return (a.distance_m ?? Number.POSITIVE_INFINITY) - (b.distance_m ?? Number.POSITIVE_INFINITY);
  });
}

export function nearestOrderable(options: readonly BranchOption[]): BranchOption | undefined {
  return sortBranchOptions(options).find((o) => o.can_order);
}
