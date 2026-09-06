import type { LocationOptions } from "../filters";
import type { Filters } from "../types";
import MultiSelect from "./MultiSelect";

interface Props {
  options: LocationOptions;
  filters: Filters;
  onChange: (patch: Partial<Filters>) => void;
}

/**
 * City / state / country multi-selects. Option lists cascade: picking a country
 * narrows the state and city lists to values that co-occur with it in the data
 * (see `deriveLocationOptions`).
 */
export default function LocationFilters({ options, filters, onChange }: Props) {
  return (
    <>
      <MultiSelect
        label="Country"
        options={options.countries}
        value={filters.countries}
        onChange={(countries) => onChange({ countries })}
      />
      <MultiSelect
        label="State / region"
        options={options.states}
        value={filters.states}
        onChange={(states) => onChange({ states })}
      />
      <MultiSelect
        label="City"
        options={options.cities}
        value={filters.cities}
        onChange={(cities) => onChange({ cities })}
      />
    </>
  );
}
