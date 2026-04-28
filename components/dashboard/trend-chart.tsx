"use client";

import { useState } from "react";

export interface TrendPoint {
  label: string;       // e.g. "Apr"
  collection_rate: number | null;
  collected: number;
  expected: number;
  paid_count: number;
  total_count: number;
}

interface TrendChartProps {
  data: TrendPoint[];
}

const W = 600;
const H = 140;
const PAD = { top: 16, right: 16, bottom: 32, left: 40 };
const CHART_W = W - PAD.left - PAD.right;
const CHART_H = H - PAD.top - PAD.bottom;

function fmtMoney(n: number) {
  return "R\u00a0" + n.toLocaleString("en-ZA", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export function TrendChart({ data }: TrendChartProps) {
  const [hovered, setHovered] = useState<number | null>(null);

  const points = data.filter(d => d.collection_rate !== null);
  if (points.length === 0) return null;

  const rates = points.map(d => d.collection_rate as number);
  const minRate = Math.max(0, Math.min(...rates) - 10);
  const maxRate = Math.min(100, Math.max(...rates) + 10);

  const xStep = CHART_W / (data.length - 1 || 1);

  const toX = (i: number) => PAD.left + i * xStep;
  const toY = (rate: number) =>
    PAD.top + CHART_H - ((rate - minRate) / (maxRate - minRate)) * CHART_H;

  // Build polyline points for the line (only non-null points)
  const linePoints = data
    .map((d, i) => (d.collection_rate !== null ? `${toX(i)},${toY(d.collection_rate)}` : null))
    .filter(Boolean)
    .join(" ");

  // Area fill path
  const areaPoints = [
    ...data
      .map((d, i) => (d.collection_rate !== null ? `${toX(i)},${toY(d.collection_rate)}` : null))
      .filter(Boolean),
    `${toX(data.length - 1)},${PAD.top + CHART_H}`,
    `${toX(data.findIndex(d => d.collection_rate !== null))},${PAD.top + CHART_H}`,
  ].join(" ");

  // Y axis grid lines
  const yTicks = [0, 25, 50, 75, 100].filter(t => t >= minRate && t <= maxRate);

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ height: 160 }}
        onMouseLeave={() => setHovered(null)}
      >
        <defs>
          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="var(--color-primary, #0DA2E7)" stopOpacity="0.18" />
            <stop offset="100%" stopColor="var(--color-primary, #0DA2E7)" stopOpacity="0.01" />
          </linearGradient>
        </defs>

        {/* Y axis grid lines */}
        {yTicks.map(t => (
          <g key={t}>
            <line
              x1={PAD.left} y1={toY(t)}
              x2={PAD.left + CHART_W} y2={toY(t)}
              stroke="currentColor" strokeOpacity="0.07" strokeWidth="1"
            />
            <text
              x={PAD.left - 6} y={toY(t) + 4}
              fontSize="10" fill="currentColor" opacity="0.4"
              textAnchor="end"
            >{t}%</text>
          </g>
        ))}

        {/* Area fill */}
        {points.length > 1 && (
          <polygon points={areaPoints} fill="url(#areaGrad)" />
        )}

        {/* Line */}
        {points.length > 1 && (
          <polyline
            points={linePoints}
            fill="none"
            stroke="#0DA2E7"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* X labels + dots */}
        {data.map((d, i) => {
          const x = toX(i);
          const hasData = d.collection_rate !== null;
          const y = hasData ? toY(d.collection_rate as number) : PAD.top + CHART_H;
          const isHov = hovered === i;

          return (
            <g key={i}>
              {/* Hover target */}
              <rect
                x={x - xStep / 2} y={PAD.top}
                width={xStep} height={CHART_H + PAD.bottom}
                fill="transparent"
                onMouseEnter={() => hasData && setHovered(i)}
              />

              {/* Dot */}
              {hasData && (
                <>
                  <circle cx={x} cy={y} r={isHov ? 5 : 3.5}
                    fill="#0DA2E7"
                    stroke="white" strokeWidth="1.5"
                    style={{ transition: "r 0.1s" }}
                  />
                  {/* Hover vertical line */}
                  {isHov && (
                    <line x1={x} y1={PAD.top} x2={x} y2={PAD.top + CHART_H}
                      stroke="#0DA2E7" strokeOpacity="0.3" strokeWidth="1" strokeDasharray="3 2"
                    />
                  )}
                </>
              )}

              {/* X label */}
              <text
                x={x} y={H - 6}
                fontSize="10" fill="currentColor" opacity="0.5"
                textAnchor="middle"
              >{d.label}</text>
            </g>
          );
        })}

        {/* Tooltip */}
        {hovered !== null && data[hovered].collection_rate !== null && (() => {
          const d = data[hovered];
          const x = toX(hovered);
          const y = toY(d.collection_rate as number);
          const tipX = x + (hovered > data.length * 0.6 ? -120 : 12);
          const tipY = Math.max(PAD.top, y - 36);
          return (
            <g>
              <rect x={tipX} y={tipY} width={110} height={52}
                rx="6" fill="var(--color-card, white)"
                stroke="currentColor" strokeOpacity="0.12" strokeWidth="1"
                filter="drop-shadow(0 2px 6px rgba(0,0,0,0.10))"
              />
              <text x={tipX + 10} y={tipY + 16} fontSize="11" fontWeight="600" fill="currentColor">
                {d.label}
              </text>
              <text x={tipX + 10} y={tipY + 29} fontSize="10" fill="#0DA2E7" fontWeight="700">
                {d.collection_rate}% collected
              </text>
              <text x={tipX + 10} y={tipY + 42} fontSize="9" fill="currentColor" opacity="0.5">
                {d.paid_count}/{d.total_count} · {fmtMoney(d.collected)}
              </text>
            </g>
          );
        })()}
      </svg>
    </div>
  );
}
