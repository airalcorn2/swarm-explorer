import type { Filters } from "../types";
import MultiSelect from "./MultiSelect";

interface Props {
  categories: string[];
  filters: Filters;
  onChange: (patch: Partial<Filters>) => void;
}

export default function CategoryFilter({
  categories,
  filters,
  onChange,
}: Props) {
  return (
    <MultiSelect
      label="Category"
      options={categories}
      value={filters.categories}
      onChange={(cats) => onChange({ categories: cats })}
    />
  );
}
