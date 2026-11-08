import { test, expect } from '@playwright/test'

// Real-browser performance on a slowed-down phone (4x slower CPU) with a much bigger customer list than today.
test('the app opens fast on a slow phone, and a 3,000-customer list stays usable @phone', async ({ page, context }) => {
  const cdp = await context.newCDPSession(page)
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })

  const t0 = Date.now()
  await page.goto('/')
  await page.getByText(/Territory/i).first().click()
  await expect(page.getByText(/Good (morning|afternoon|evening)/)).toBeVisible()
  const toToday = Date.now() - t0
  console.log(`PERF open app and reach Today (4x slow CPU): ${toToday} ms`)
  expect(toToday).toBeLessThan(6000)

  // grow the demo database to 3,000 customers, then measure the customer list
  await page.evaluate(() => {
    const key = 'pg-growth-hub:db:v2'
    const db = JSON.parse(localStorage.getItem(key)!)
    const src = db.accounts as Record<string, unknown>[]
    const rep = (db.profiles.find((p: { role: string }) => p.role === 'rep') as { id: string }).id
    db.accounts = Array.from({ length: 3000 }, (_, i) => ({ ...src[i % src.length], id: `big-${i}`, name: `Perf Customer ${i}`, repId: rep, type: 'Retail', status: 'Active' }))
    localStorage.setItem(key, JSON.stringify(db))
  })
  const t1 = Date.now()
  await page.goto('/accounts'); await page.reload()
  await expect(page.getByText(/Perf Customer/).first()).toBeVisible({ timeout: 15000 })
  const list = Date.now() - t1
  console.log(`PERF customer list with 3000 customers (4x slow CPU): ${list} ms`)
  expect(list).toBeLessThan(10000)

  const t2 = Date.now()
  await page.getByPlaceholder(/Search/i).first().fill('Perf Customer 2999')
  await expect(page.getByText('Perf Customer 2999').first()).toBeVisible()
  const search = Date.now() - t2
  console.log(`PERF search in 3000 customers: ${search} ms`)
  expect(search).toBeLessThan(3000)
})
