import Select from "react-select";

interface Props {
  label: string;
  options: string[];
  value: string[];
  placeholder?: string;
  onChange: (value: string[]) => void;
}

interface Option {
  value: string;
  label: string;
}

// Dark theme for react-select so it sits on the overlay panel.
const styles = {
  control: (base: Record<string, unknown>) => ({
    ...base,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderColor: "rgba(255,255,255,0.15)",
    minHeight: 34,
    boxShadow: "none",
    ":hover": { borderColor: "rgba(255,255,255,0.3)" },
  }),
  menu: (base: Record<string, unknown>) => ({
    ...base,
    backgroundColor: "#1c1f26",
    zIndex: 20,
  }),
  option: (base: Record<string, unknown>, state: { isFocused: boolean }) => ({
    ...base,
    backgroundColor: state.isFocused ? "rgba(122,162,255,0.25)" : "transparent",
    color: "#e8eaed",
    cursor: "pointer",
  }),
  multiValue: (base: Record<string, unknown>) => ({
    ...base,
    backgroundColor: "rgba(122,162,255,0.25)",
  }),
  multiValueLabel: (base: Record<string, unknown>) => ({
    ...base,
    color: "#e8eaed",
  }),
  input: (base: Record<string, unknown>) => ({ ...base, color: "#e8eaed" }),
  placeholder: (base: Record<string, unknown>) => ({
    ...base,
    color: "rgba(255,255,255,0.4)",
  }),
};

export default function MultiSelect({
  label,
  options,
  value,
  placeholder,
  onChange,
}: Props) {
  const opts: Option[] = options.map((o) => ({ value: o, label: o }));
  const selected = opts.filter((o) => value.includes(o.value));

  return (
    <div className="control">
      <div className="control-head">
        <span className="control-label">{label}</span>
        {value.length > 0 && (
          <button className="link-btn" onClick={() => onChange([])}>
            clear
          </button>
        )}
      </div>
      <Select
        isMulti
        options={opts}
        value={selected}
        placeholder={placeholder ?? `Any ${label.toLowerCase()}`}
        onChange={(vals) => onChange((vals as Option[]).map((v) => v.value))}
        styles={styles}
        classNamePrefix="rs"
        menuPlacement="auto"
      />
    </div>
  );
}
