import { western, type Step } from "./curriculum";
export function Staff({ steps, current }: { steps: Step[]; current: number }) {
  const notes = steps.flatMap((s) => [s.midi, ...(s.chord || [])]);
  const hasBass = notes.some((m) => m < 60),
    hasTreble = notes.some((m) => m >= 60);
  const grand = hasBass && hasTreble,
    width = Math.max(480, steps.length * 64 + 65),
    height = grand ? 275 : 155;
  const position = (m: number) =>
    Math.floor(m / 12) * 7 + [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6][m % 12];
  const staff = (bass: boolean, offset: number) => (
    <g key={offset}>
      {[0, 1, 2, 3, 4].map((i) => (
        <line
          key={i}
          stroke="#bcc7c3"
          x1="15"
          x2={width - 5}
          y1={45 + i * 12 + offset}
          y2={45 + i * 12 + offset}
        />
      ))}
      <text x="15" y={91 + offset} fontSize="62">
        {bass ? "𝄢" : "𝄞"}
      </text>
    </g>
  );
  return (
    <svg
      className="staff"
      viewBox={`0 0 ${width} ${height}`}
      style={{ maxHeight: grand ? 310 : 190 }}
      role="img"
      aria-label="نت‌ها روی خطوط حامل، ترتیب از چپ به راست"
    >
      {hasTreble && staff(false, 0)}
      {hasBass && staff(true, grand ? 125 : 0)}
      {steps.map((s, i) => (
        <g key={i}>
          {[s.midi, ...(s.chord || [])].map((m, j) => {
            const bass = m < 60,
              offset = bass && grand ? 125 : 0,
              y = 93 - (position(m) - (bass ? 25 : 37)) * 6 + offset,
              x = 76 + i * 64,
              color = i === current ? "#168461" : "#253b34";
            const ledger = [];
            for (let p = 105 + offset; p <= y; p += 12) ledger.push(p);
            for (let p = 33 + offset; p >= y; p -= 12) ledger.push(p);
            const dotted = [0.75, 1.5, 3].includes(s.beats);
            return (
              <g key={j} fill={color}>
                {ledger.map((p) => (
                  <line
                    key={p}
                    stroke={color}
                    x1={x - 14}
                    x2={x + 14}
                    y1={p}
                    y2={p}
                  />
                ))}
                {[1, 3, 6, 8, 10].includes(m % 12) && (
                  <text x={x - 24} y={y + 5} fontSize="18">
                    ♯
                  </text>
                )}
                <ellipse
                  cx={x}
                  cy={y}
                  rx="8"
                  ry="5.5"
                  transform={`rotate(-18 ${x} ${y})`}
                  fill={s.beats >= 2 ? "white" : color}
                  stroke={color}
                  strokeWidth="2"
                />
                {s.beats < 4 && (
                  <line
                    x1={x + 7}
                    x2={x + 7}
                    y1={y}
                    y2={y - 30}
                    stroke={color}
                    strokeWidth="2"
                  />
                )}
                {s.beats < 1 && (
                  <path
                    d={`M ${x + 7} ${y - 30} q 15 8 4 18`}
                    fill="none"
                    stroke={color}
                    strokeWidth="3"
                  />
                )}
                {s.beats < 0.5 && (
                  <path
                    d={`M ${x + 7} ${y - 24} q 15 8 4 18`}
                    fill="none"
                    stroke={color}
                    strokeWidth="3"
                  />
                )}
                {dotted && <circle cx={x + 16} cy={y - 2} r="2" />}
              </g>
            );
          })}
          <text
            x={76 + i * 64}
            y={height - 8}
            fontSize="11"
            textAnchor="middle"
            fill="#607869"
          >
            {western(s.midi)}
            {s.chord?.length ? " + " + s.chord.map(western).join(" ") : ""}
          </text>
        </g>
      ))}
    </svg>
  );
}
