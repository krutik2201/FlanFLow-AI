import { describe, test, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
import { VenueGraphMap } from '../src/components/VenueGraphMap'
import { VenueNode } from '../src/api/client'

const MOCK_NODES: VenueNode[] = [
  { id: 'gate_a', name: 'Gate A (Main Entry)', type: 'gate', x: 500, y: 30 },
  { id: 'sec_101', name: 'Section 101', type: 'section', x: 500, y: 250 },
  { id: 'conc_north', name: 'North Concourse', type: 'concourse', x: 500, y: 160 }
]

describe('VenueGraphMap Component', () => {
  test('renders loading text when nodes list is empty', () => {
    render(<VenueGraphMap nodes={[]} highlightedPath={[]} />)
    expect(screen.getByText(/loading venue map/i)).toBeInTheDocument()
  })

  test('renders SVG element containing nodes when nodes list is supplied', () => {
    const { container } = render(
      <VenueGraphMap nodes={MOCK_NODES} highlightedPath={['gate_a', 'conc_north']} />
    )

    const svg = container.querySelector('svg')
    expect(svg).toBeInTheDocument()

    // Assert that circles representing nodes are rendered
    const circles = container.querySelectorAll('circle')
    // Length is 3 nodes + 2 glow rings for the highlighted path nodes = 5 circles total
    expect(circles.length).toBeGreaterThanOrEqual(3)

    // Assert highlighted path line is rendered
    const lines = container.querySelectorAll('line')
    expect(lines.length).toBeGreaterThanOrEqual(1)
  })
})
