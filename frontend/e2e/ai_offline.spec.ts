import { test, expect } from '@playwright/test'

const MOCK_NODES = {
  nodes: [
    { id: 'gate_a', name: 'Gate A (Main Entry)', type: 'gate', x: 500, y: 30 },
    { id: 'sec_101', name: 'Section 101', type: 'section', x: 500, y: 250 }
  ]
}

const MOCK_ROUTE_OFFLINE = {
  success: true,
  nodes: ['gate_a', 'sec_101'],
  node_names: ['Gate A (Main Entry)', 'Section 101'],
  total_distance_m: 140,
  estimated_walk_time_s: 140,
  accessibility_accommodations: [],
  phrased_directions: "1. Head to Gate A (Main Entry) (140m away).\n2. You have arrived at Section 101.",
  deterministic_directions: "1. Head to Gate A (Main Entry) (140m away).\n2. You have arrived at Section 101.",
  fallback_mode: true,
  mode: 'standard',
  congestion_aware: false
}

test.describe('AI Offline Toggle Flow', () => {
  test('enabling AI Offline toggle forces deterministic directions and shows badge', async ({ page }) => {
    // Intercept API calls
    await page.route('**/wayfinding/nodes', async (route) => {
      await route.fulfill({ json: MOCK_NODES })
    })

    let lastRouteUrl = ''
    await page.route('**/wayfinding/route*', async (route) => {
      lastRouteUrl = route.request().url()
      await route.fulfill({ json: MOCK_ROUTE_OFFLINE })
    })

    await page.route('**/ops/telemetry/latest', async (route) => {
      await route.fulfill({ status: 404, json: {} })
    })

    await page.goto('/')

    // Toggle simulated AI offline
    await page.click('#ai-offline-toggle')

    // Find route
    await page.click('#find-route-btn')

    // Verify correct badge is displayed in the page
    await expect(page.locator('.badge-deterministic')).toBeVisible()

    // Verify url contained the query parameter indicating offline mode to the backend
    expect(lastRouteUrl).toContain('ai_offline=true')
  })
})
