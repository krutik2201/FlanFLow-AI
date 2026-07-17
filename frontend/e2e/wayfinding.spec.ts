import { test, expect } from '@playwright/test'

const MOCK_NODES = {
  nodes: [
    { id: 'gate_a', name: 'Gate A (Main Entry)', type: 'gate', x: 500, y: 30 },
    { id: 'sec_101', name: 'Section 101', type: 'section', x: 500, y: 250 },
    { id: 'conc_north', name: 'North Concourse', type: 'concourse', x: 500, y: 160 },
    { id: 'elevator_north', name: 'Elevator (North)', type: 'amenity', x: 420, y: 175 }
  ]
}

const MOCK_ROUTE_STANDARD = {
  success: true,
  nodes: ['gate_a', 'conc_north', 'sec_101'],
  node_names: ['Gate A (Main Entry)', 'North Concourse', 'Section 101'],
  total_distance_m: 140,
  estimated_walk_time_s: 140,
  accessibility_accommodations: [],
  phrased_directions: "1. Head to Gate A (Main Entry).\n2. Continue to North Concourse.\n3. Arrive at Section 101.",
  deterministic_directions: "Head towards Gate A...",
  fallback_mode: false,
  mode: 'standard',
  congestion_aware: false
}

const MOCK_ROUTE_ACCESSIBLE = {
  success: true,
  nodes: ['gate_a', 'conc_north', 'elevator_north', 'sec_101'],
  node_names: ['Gate A (Main Entry)', 'North Concourse', 'Elevator (North)', 'Section 101'],
  total_distance_m: 170,
  estimated_walk_time_s: 170,
  accessibility_accommodations: ['Elevator used near Section 101'],
  phrased_directions: "1. Go through Gate A.\n2. Proceed to Elevator (North).\n3. Take the elevator to Section 101.",
  deterministic_directions: "Head towards Gate A step-free...",
  fallback_mode: false,
  mode: 'accessible',
  congestion_aware: false
}

test.describe('Wayfinding Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Intercept wayfinding endpoints with mock data to run fully offline
    await page.route('**/wayfinding/nodes', async (route) => {
      await route.fulfill({ json: MOCK_NODES })
    })

    await page.route('**/wayfinding/route*', async (route) => {
      const url = route.request().url()
      if (url.includes('mode=accessible')) {
        await route.fulfill({ json: MOCK_ROUTE_ACCESSIBLE })
      } else {
        await route.fulfill({ json: MOCK_ROUTE_STANDARD })
      }
    })

    // Also stub telemetry latest endpoint to avoid UI errors
    await page.route('**/ops/telemetry/latest', async (route) => {
      await route.fulfill({ status: 404, json: {} })
    })
  })

  test('select origin/destination, standard route, and phrased directions', async ({ page }) => {
    await page.goto('/')

    // Verify dropdowns exist
    await expect(page.locator('#origin-select')).toBeVisible()
    await expect(page.locator('#destination-select')).toBeVisible()

    // Trigger path finding
    await page.click('#find-route-btn')

    // Check result metrics
    await expect(page.locator('text=Route Found')).toBeVisible()
    await expect(page.locator('text=140m')).toBeVisible()
    await expect(page.locator('text=2m 20s')).toBeVisible() // 140s formatted to 2m 20s

    // Check directions text
    await expect(page.locator('text=Head to Gate A')).toBeVisible()
  })

  test('accessibility mode toggle updates route and shows accommodations', async ({ page }) => {
    await page.goto('/')

    // Toggle accessible mode
    await page.click('#mode-accessible')

    // Find route
    await page.click('#find-route-btn')

    // Verify accessible route nodes and accommodations are present
    await expect(page.locator('text=Route Found')).toBeVisible()
    await expect(page.locator('text=Accessible route')).toBeVisible()
    await expect(page.locator('text=Elevator used near Section 101')).toBeVisible()
    await expect(page.locator('text=Take the elevator')).toBeVisible()
  })
})
