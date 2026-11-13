import { test, expect, Page } from '@playwright/test'

const CARD = { rep: /Territory/i, admin: /All accounts, users and reports/i, service: /All orders, to confirm and deliver/i }
const signIn = async (page: Page, who: keyof typeof CARD) => { await page.goto('/'); await page.getByText(CARD[who]).first().click(); await expect(page.getByText(CARD[who])).toHaveCount(0) }
const signOut = async (page: Page) => { await page.getByRole('button', { name: /Sign out/ }).first().click(); await expect(page.getByText(CARD.admin).first()).toBeVisible() }

test.describe('sign-in and home screens', () => {
  test('a rep lands on Today', async ({ page }) => { await signIn(page, 'rep'); await expect(page.getByText(/Good (morning|afternoon|evening)/)).toBeVisible() })
  test('management lands on the Dashboard', async ({ page }) => { await signIn(page, 'admin'); await expect(page.getByRole('heading', { name: /Dashboard|Overview/i }).first()).toBeVisible() })
  test('customer service lands on Orders and cannot create one', async ({ page }) => {
    await signIn(page, 'service')
    await expect(page.getByRole('heading', { name: 'Orders' }).first()).toBeVisible()
    await expect(page.getByRole('button', { name: /New order/ })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /Log visit/ })).toHaveCount(0)
  })
})

test.describe('menus match the role', () => {
  test('a rep sees a short menu with More behind a toggle', async ({ page }) => {
    await signIn(page, 'rep')
    const side = page.locator('aside nav, nav').first()
    await expect(side.getByRole('link', { name: 'My Accounts' })).toBeVisible()
    await expect(side.getByRole('link', { name: 'Orders' })).toBeVisible()
    await expect(side.getByRole('link', { name: 'User Management' })).toHaveCount(0)
    await expect(side.getByRole('link', { name: 'Route Planner' })).toHaveCount(0)
    await side.getByRole('button', { name: /More/ }).click()
    await expect(side.getByRole('link', { name: 'Route Planner' })).toBeVisible()
  })
  test('management sees admin tools', async ({ page }) => {
    await signIn(page, 'admin')
    await expect(page.getByRole('link', { name: 'User Management' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Audit Log' })).toBeVisible()
  })
  test('management can see who signed in, and when', async ({ page }) => {
    await signIn(page, 'rep'); await signOut(page)
    await signIn(page, 'admin')
    await page.getByRole('link', { name: 'Audit Log' }).click()
    await expect(page.getByText(/Who has been in today/)).toBeVisible()
    await page.locator('select.input').first().selectOption('LOGIN')
    await expect(page.locator('tbody tr').filter({ hasText: 'Signed in' }).first()).toBeVisible()
    expect(await page.locator('tbody tr').filter({ hasText: 'Signed in' }).count()).toBeGreaterThanOrEqual(2)
  })
  test('a rep who opens an admin address is sent away', async ({ page }) => {
    await signIn(page, 'rep'); await page.goto('/users')
    await expect(page.getByRole('heading', { name: 'User Management' })).toHaveCount(0)
  })
})

test.describe('the order journey: rep takes an order, customer service confirms it', () => {
  test('end to end', async ({ page }) => {
    // rep places an order
    await signIn(page, 'rep'); await page.goto('/orders')
    await page.getByRole('button', { name: /New order/ }).click()
    const dlg = page.getByRole('dialog').or(page.locator('[role=dialog], .fixed').filter({ hasText: 'New order' })).first()
    await dlg.locator('select').first().selectOption({ index: 1 })
    const price = dlg.locator('select').filter({ hasText: 'Choose…' }).first()
    await price.selectOption({ index: 1 })
    await dlg.getByRole('button', { name: /^\s*Add\s*$/ }).click()
    await dlg.getByRole('button', { name: 'Submit order' }).click()
    await expect(page.getByText(/Order submitted/i)).toBeVisible()
    await signOut(page)
    // customer service opens it and confirms
    await page.getByText(CARD.service).first().click()
    await page.locator('tbody tr').first().getByRole('button').first().click()
    await expect(page.getByText(/Order total/)).toBeVisible()
    await page.locator('select.input').last().selectOption('Confirmed')
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByText('Confirmed').first()).toBeVisible()
  })
})

test.describe('a rep changes a submitted order', () => {
  test('edit is saved, flagged for customer service, and locked once confirmed', async ({ page }) => {
    await signIn(page, 'rep'); await page.goto('/orders')
    await page.getByRole('button', { name: /New order/ }).click()
    const dlg = page.locator('[role=dialog], .fixed').filter({ hasText: 'New order' }).first()
    await dlg.locator('select').first().selectOption({ index: 1 })
    await dlg.locator('select').filter({ hasText: 'Choose…' }).first().selectOption({ index: 1 })
    await dlg.getByRole('button', { name: /^\s*Add\s*$/ }).click()
    await dlg.getByRole('button', { name: 'Submit order' }).click()
    await expect(page.getByText(/Order submitted/i)).toBeVisible()
    // reopen it and change the quantity
    await page.locator('tbody tr').first().getByRole('button', { name: 'Edit' }).click()
    const edit = page.locator('[role=dialog], .fixed').filter({ hasText: 'Save changes' }).first()
    await edit.locator('input[type=number]').first().fill('7')
    await edit.getByRole('button', { name: 'Save changes' }).click()
    await expect(page.getByText('Order updated')).toBeVisible()
    await expect(page.locator('tbody tr').first().getByText('Edited')).toBeVisible()
    await signOut(page)
    // customer service sees the warning, confirms; the rep can then no longer edit
    await page.getByText(CARD.service).first().click()
    await page.locator('tbody tr').first().getByRole('button', { name: 'View' }).click()
    await expect(page.getByText(/The rep changed this order/)).toBeVisible()
    await page.locator('select.input').last().selectOption('Confirmed')
    await page.getByRole('button', { name: 'Save' }).click()
    await signOut(page)
    await page.getByText(CARD.rep).first().click(); await page.goto('/orders')
    await expect(page.locator('tbody tr').first().getByRole('button', { name: 'View' })).toBeVisible()
  })
})

test.describe('office exports to Sage, rep is told', () => {
  test('confirm, export a Sage file, and the rep gets a notification', async ({ page }) => {
    await signIn(page, 'rep'); await page.goto('/orders')
    await page.getByRole('button', { name: /New order/ }).click()
    const dlg = page.locator('[role=dialog], .fixed').filter({ hasText: 'New order' }).first()
    await dlg.locator('select').first().selectOption({ index: 1 })
    await dlg.locator('select').filter({ hasText: 'Choose…' }).first().selectOption({ index: 1 })
    await dlg.getByRole('button', { name: /^\s*Add\s*$/ }).click()
    await dlg.getByRole('button', { name: 'Submit order' }).click()
    await expect(page.getByText(/Order submitted/i)).toBeVisible()
    await page.goto('/')   // the rep is on Today (not looking at Orders) when the office confirms
    await signOut(page)
    await page.getByText(CARD.service).first().click()
    await page.locator('tbody tr').first().getByRole('button', { name: 'View' }).click()
    await page.locator('select.input').last().selectOption('Confirmed')
    await page.getByRole('button', { name: 'Save' }).click()
    await page.getByRole('button', { name: 'Show list' }).click()
    await expect(page.getByText(/Ready|Will be skipped/).first()).toBeVisible()
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export for Sage' }).click()])
    expect(download.suggestedFilename()).toMatch(/^pg-sage-orders-\d+\.csv$/)
    await expect(page.locator('tbody tr').first().getByText('In Sage')).toBeVisible()
    await signOut(page)
    await page.getByText(CARD.rep).first().click()
    await page.getByRole('button', { name: /Notifications/ }).first().click()
    await expect(page.getByText(/ confirmed$/).first()).toBeVisible()
  })
})

test.describe('logging a visit @phone', () => {
  test('a rep logs a visit from the phone bottom bar', async ({ page }) => {
    await signIn(page, 'rep')
    await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Log a visit' }).click()
    await page.getByPlaceholder('Search your accounts…').fill('a')
    await page.locator('button:has(span.font-medium)').first().click()
    await page.getByRole('button', { name: 'Interested', exact: true }).click()
    await page.getByRole('button', { name: 'Save visit' }).click()
    await expect(page.getByText(/Visit logged/)).toBeVisible()
  })
})

test.describe('data stays put', () => {
  test('an order survives a page reload (demo storage)', async ({ page }) => {
    await signIn(page, 'admin'); await page.goto('/orders')
    const n = await page.locator('tbody tr').count(); expect(n).toBeGreaterThan(0)
    await page.reload(); await expect(page.locator('tbody tr')).toHaveCount(n)
  })
})
