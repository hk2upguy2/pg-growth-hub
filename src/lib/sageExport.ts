import type { Account, Order } from '../types'

/**
 * Confirmed orders as a flat CSV for Sage 100 Visual Integrator: one row per order line, the order header repeated on each row.
 * Visual Integrator maps columns by name in its job, so the headers below only need to be matched once when the job is set up.
 * An order is skipped (and reported) when Sage could not take it: no Sage customer number, or a line with no item code.
 */
export const SAGE_COLUMNS = ['SalesOrderNo', 'OrderDate', 'ShipExpireDate', 'CustomerNo', 'CustomerPONo', 'SalesPerson', 'WarehouseCode', 'Comment', 'LineNo', 'ItemCode', 'ItemCodeDesc', 'UnitOfMeasure', 'QuantityOrdered', 'ListPrice', 'DiscountPercent', 'UnitPrice'] as const
export type SageRow = Record<(typeof SAGE_COLUMNS)[number], string | number>

const mdy = (iso?: string | null) => { if (!iso) return ''; const d = new Date(iso.length <= 10 ? iso + 'T00:00:00' : iso); return isNaN(+d) ? '' : `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}` }

export interface SageExport { rows: SageRow[]; exported: Order[]; skipped: { order: Order; reason: string }[] }

export function buildSageExport(orders: Order[], accounts: Account[], repName: (id: string) => string, warehouse = '000'): SageExport {
  const rows: SageRow[] = [], exported: Order[] = [], skipped: SageExport['skipped'] = []
  for (const o of orders) {
    const a = accounts.find(x => x.id === o.accountId)
    if (!a?.sageNo?.trim()) { skipped.push({ order: o, reason: `${a?.name ?? 'This customer'} has no Sage customer number` }); continue }
    const bad = o.lines.find(l => !l.sku?.trim())
    if (bad) { skipped.push({ order: o, reason: `"${bad.product}" has no item code` }); continue }
    o.lines.forEach((l, i) => rows.push({
      SalesOrderNo: o.orderNo, OrderDate: mdy(o.createdAt), ShipExpireDate: mdy(o.deliveryDate), CustomerNo: a.sageNo!.trim(), CustomerPONo: o.orderNo,
      SalesPerson: repName(o.repId), WarehouseCode: warehouse, Comment: o.notes ?? '', LineNo: i + 1, ItemCode: l.sku.trim(), ItemCodeDesc: l.product,
      UnitOfMeasure: l.unit.toUpperCase(), QuantityOrdered: l.qty, ListPrice: l.price, DiscountPercent: l.discountPct,
      UnitPrice: Math.round(l.price * (1 - l.discountPct / 100) * 10000) / 10000,
    }))
    exported.push(o)
  }
  return { rows, exported, skipped }
}
