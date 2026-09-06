import Slider from "rc-slider";
import "rc-slider/assets/index.css";
import { formatDate } from "../filters";

interface Props {
  min: number; // unix seconds
  max: number; // unix seconds
  value: [number, number];
  onChange: (range: [number, number]) => void;
}

const DAY = 86400;

export default function DateRangeSlider({ min, max, value, onChange }: Props) {
  return (
    <div className="control">
      <div className="control-head">
        <span className="control-label">Date range</span>
        <span className="control-value">
          {formatDate(value[0])} &ndash; {formatDate(value[1])}
        </span>
      </div>
      <Slider
        range
        min={min}
        max={max}
        step={DAY}
        value={value}
        allowCross={false}
        onChange={(v) => {
          if (Array.isArray(v)) onChange([v[0], v[1]] as [number, number]);
        }}
      />
    </div>
  );
}
