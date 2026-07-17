import { useMemo } from 'react'
import type { VenueNode, VenueEdge } from '../api/client'

// SVG canvas dimensions (coordinate space matches venue_data.py x/y values)
const SVG_W = 1000
const SVG_H = 800
const PADDING_X = 80
const PADDING_Y = 80

// Node type → color mapping
const NODE_COLORS: Record<string, string> = {
  gate:      '#3d7eff',
  concourse: '#7aa7ff',
  section:   '#22c55e',
  amenity:   '#fbbf24',
  transport: '#a78bfa',
}

const NODE_RADIUS: Record<string, number> = {
  gate:      14,
  concourse: 10,
  section:   9,
  amenity:   8,
  transport: 11,
}

interface Props {
  nodes: VenueNode[]
  highlightedPath: string[]
  edges?: VenueEdge[]
}

function pathEdges(path: string[]): Array<[string, string]> {
  const edgesList: Array<[string, string]> = []
  for (let i = 0; i < path.length - 1; i++) {
    edgesList.push([path[i], path[i + 1]])
  }
  return edgesList
}

export function VenueGraphMap({ nodes, highlightedPath, edges }: Props) {
  const nodeMap = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes])
  const pathEdgesList = useMemo(() => pathEdges(highlightedPath), [highlightedPath])

  if (nodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-brand-400 text-sm">
        Loading venue map…
      </div>
    )
  }

  return (
    <div
      className="relative w-full rounded-xl overflow-hidden"
      role="img"
      aria-label="Venue graph map showing nodes and highlighted route"
    >
      <svg
        viewBox={`-${PADDING_X} -${PADDING_Y} ${SVG_W + PADDING_X * 2} ${SVG_H + PADDING_Y * 2}`}
        className="w-full h-full"
        style={{ background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)' }}
        aria-hidden="true"
      >
        {/* Background grid */}
        <defs>
          <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
            <path d="M 50 0 L 0 0 0 50" fill="none" stroke="rgba(61,126,255,0.08)" strokeWidth="1"/>
          </pattern>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
            <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          <filter id="glow-soft">
            <feDropShadow dx="0" dy="1" stdDeviation="2" floodColor="#fbbf24" floodOpacity="0.25"/>
          </filter>
          <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
            <polygon points="0 0, 8 3, 0 6" fill="#fbbf24" />
          </marker>
        </defs>
        <rect
          x={-PADDING_X}
          y={-PADDING_Y}
          width={SVG_W + PADDING_X * 2}
          height={SVG_H + PADDING_Y * 2}
          fill="url(#grid)"
        />

        {/* ── Stadium Seating Bowl Tiers ────────────────────────────────── */}
        {/* Outer Ring boundary */}
        <ellipse cx={500} cy={400} rx={375} ry={315}
          fill="none" stroke="rgba(15,23,42,0.07)" strokeWidth="3" />
        
        {/* Upper Bowl Tier */}
        <ellipse cx={500} cy={400} rx={320} ry={260}
          fill="none" stroke="rgba(15,23,42,0.04)" strokeWidth="24" strokeDasharray="15 5" />
        
        {/* Mid Tier Divider */}
        <ellipse cx={500} cy={400} rx={270} ry={215}
          fill="none" stroke="rgba(15,23,42,0.08)" strokeWidth="2" />
        
        {/* Lower Bowl Tier */}
        <ellipse cx={500} cy={400} rx={220} ry={170}
          fill="none" stroke="rgba(15,23,42,0.05)" strokeWidth="16" />

        {/* Radial seating sector / aisle lines */}
        {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((angle) => {
          const rad = (angle * Math.PI) / 180
          const x1 = 500 + Math.cos(rad) * 110
          const y1 = 400 + Math.sin(rad) * 80
          const x2 = 500 + Math.cos(rad) * 365
          const y2 = 400 + Math.sin(rad) * 305
          return (
            <line
              key={`aisle-${angle}`}
              x1={x1} y1={y1} x2={x2} y2={y2}
              stroke="rgba(15,23,42,0.03)"
              strokeWidth="1.5"
            />
          )
        })}

        {/* ── Football/Soccer Pitch (Center Field) ────────────────────────── */}
        <g opacity="0.8">
          {/* Grass pitch */}
          <rect x={410} y={340} width={180} height={120} rx={4}
            fill="rgba(34,197,94,0.06)" stroke="rgba(34,197,94,0.3)" strokeWidth="1.5" />
          {/* Halfway line */}
          <line x1={500} y1={340} x2={500} y2={460} stroke="rgba(34,197,94,0.3)" strokeWidth="1.5" />
          {/* Center circle */}
          <circle cx={500} cy={400} r={25} fill="none" stroke="rgba(34,197,94,0.3)" strokeWidth="1.5" />
          {/* Penalty boxes */}
          <rect x={410} y={370} width={20} height={60} fill="none" stroke="rgba(34,197,94,0.3)" strokeWidth="1.5" />
          <rect x={570} y={370} width={20} height={60} fill="none" stroke="rgba(34,197,94,0.3)" strokeWidth="1.5" />
        </g>

        {/* ── Compass & Scale Indicators ─────────────────────────────────── */}
        {/* Scale bar */}
        <g transform="translate(45, 745)" opacity="0.65">
          <line x1={0} y1={0} x2={100} y2={0} stroke="#475569" strokeWidth="2" />
          <line x1={0} y1={-4} x2={0} y2={4} stroke="#475569" strokeWidth="2" />
          <line x1={50} y1={-2} x2={50} y2={2} stroke="#475569" strokeWidth="1.5" />
          <line x1={100} y1={-4} x2={100} y2={4} stroke="#475569" strokeWidth="2" />
          <text x={50} y={-8} textAnchor="middle" fontSize="10" fontWeight="bold" fill="#475569">100 Meters</text>
        </g>

        {/* Compass rose */}
        <g transform="translate(950, 745)" opacity="0.65">
          <line x1={0} y1={-12} x2={0} y2={12} stroke="#475569" strokeWidth="1.5" />
          <line x1={-12} y1={0} x2={12} y2={0} stroke="#475569" strokeWidth="1.5" />
          <polygon points="0,-16 -4,-4 4,-4" fill="#475569" />
          <text x={0} y={-20} textAnchor="middle" fontSize="9" fontWeight="900" fill="#475569">N</text>
        </g>


        {/* All edges (connecting lines between adjacent nodes) */}
        {edges && edges.length > 0 ? (
          edges.map((edge) => {
            const fn = nodeMap.get(edge.from)
            const tn = nodeMap.get(edge.to)
            if (!fn || !tn) return null
            return (
              <line
                key={`edge-${edge.from}-${edge.to}`}
                x1={fn.x} y1={fn.y} x2={tn.x} y2={tn.y}
                stroke="rgba(15,23,42,0.08)" strokeWidth="1.5"
              />
            )
          })
        ) : (
          // fallback to concourse proximity lines
          nodes
            .filter((n) => n.type === 'concourse')
            .flatMap((n, _i, arr) =>
              arr
                .filter((m) => {
                  const dx = Math.abs(m.x - n.x), dy = Math.abs(m.y - n.y)
                  return m.id !== n.id && Math.sqrt(dx * dx + dy * dy) < 250
                })
                .map((m) => (
                  <line
                    key={`${n.id}-${m.id}`}
                    x1={n.x} y1={n.y} x2={m.x} y2={m.y}
                    stroke="rgba(15,23,42,0.06)" strokeWidth="1"
                  />
                ))
            )
        )}

        {/* Highlighted path edges */}
        {pathEdgesList.map(([from, to]) => {
          const fn = nodeMap.get(from)
          const tn = nodeMap.get(to)
          if (!fn || !tn) return null
          return (
            <line
              key={`path-${from}-${to}`}
              x1={fn.x} y1={fn.y} x2={tn.x} y2={tn.y}
              stroke="#fbbf24"
              strokeWidth="4.5"
              strokeLinecap="round"
              filter="url(#glow)"
              className="motion-safe:animate-pulse-slow"
            />
          )
        })}

        {/* Highlighted path edge distance labels */}
        {pathEdgesList.map(([from, to]) => {
          const fn = nodeMap.get(from)
          const tn = nodeMap.get(to)
          if (!fn || !tn) return null

          // Find exact distance from edges prop or calculate Euclidean fallback
          const exactEdge = edges?.find(
            (e) => (e.from === from && e.to === to) || (e.from === to && e.to === from)
          )
          const distance = exactEdge ? exactEdge.distance_m : Math.round(Math.sqrt(Math.pow(tn.x - fn.x, 2) + Math.pow(tn.y - fn.y, 2)) * 0.5)

          const midX = (fn.x + tn.x) / 2
          const midY = (fn.y + tn.y) / 2

          return (
            <g key={`label-${from}-${to}`}>
              {/* Premium rounded badge with gold outline */}
              <rect
                x={midX - 22}
                y={midY - 10}
                width="44"
                height="20"
                rx="6"
                fill="#ffffff"
                stroke="#d97706"
                strokeWidth="1.5"
                filter="url(#glow-soft)"
              />
              <text
                x={midX}
                y={midY + 4}
                textAnchor="middle"
                fontSize="10"
                fontWeight="bold"
                fill="#b45309"
                fontFamily="Inter, sans-serif"
              >
                {distance}m
              </text>
            </g>
          )
        })}

        {/* All nodes */}
        {nodes.map((node) => {
          const isOnPath = highlightedPath.includes(node.id)
          const isEndpoint =
            node.id === highlightedPath[0] ||
            node.id === highlightedPath[highlightedPath.length - 1]
          const color = isEndpoint ? '#fbbf24' : isOnPath ? '#f59e0b' : NODE_COLORS[node.type] ?? '#7aa7ff'
          const r = isEndpoint ? 16 : NODE_RADIUS[node.type] ?? 9

          return (
            <g key={node.id} className="group cursor-pointer">
              <title>{`${node.name} (${node.type.toUpperCase()})`}</title>
              {/* Glow ring for highlighted nodes */}
              {isOnPath && (
                <circle cx={node.x} cy={node.y} r={r + 6}
                  fill={isEndpoint ? 'rgba(251,191,36,0.2)' : 'rgba(245,158,11,0.15)'}/>
              )}
              <circle
                cx={node.x} cy={node.y} r={r}
                fill={color}
                stroke={isEndpoint ? '#d97706' : 'rgba(15,23,42,0.15)'}
                strokeWidth={isEndpoint ? 2 : 1}
                filter={isOnPath ? 'url(#glow)' : undefined}
              />
              {/* Label for important nodes */}
              {(node.type === 'gate' || isEndpoint || node.type === 'transport') && (
                <text
                  x={node.x}
                  y={node.y + r + 13}
                  textAnchor="middle"
                  fontSize="10"
                  fill="#334155"
                  fontFamily="Inter, sans-serif"
                  fontWeight="500"
                >
                  {node.name.split(' ').slice(0, 2).join(' ')}
                </text>
              )}
            </g>
          )
        })}
      </svg>

      {/* Legend */}
      <div className="absolute bottom-2 left-2 flex flex-wrap gap-2 text-xs">
        {Object.entries(NODE_COLORS).map(([type, color]) => (
          <span key={type} className="flex items-center gap-1 bg-surface-900/80 rounded px-1.5 py-0.5">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} aria-hidden="true"/>
            <span className="text-brand-300 capitalize">{type}</span>
          </span>
        ))}
        <span className="flex items-center gap-1 bg-surface-900/80 rounded px-1.5 py-0.5">
          <span className="h-2 w-2 rounded-full bg-gold-400" aria-hidden="true"/>
          <span className="text-brand-300">Route</span>
        </span>
      </div>
    </div>
  )
}

