import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import type { Product } from '../../engine/types'
import { db } from '../../db/db'
import { ProductRow } from './ProductRow'
import { ProductDetailSheet } from './ProductDetailSheet'
import {
  AdapalenePhaseSettings,
  AppearanceBackupSettings,
  QuotaSettings,
  ScheduleSettings,
  WeatherSettings,
} from './settings/SettingsSections'

const CATEGORY_ORDER = [
  'cleanser',
  'toner',
  'hydrator',
  'active',
  'moisturiser',
  'mask',
  'spot',
  'patch',
  'spf',
  'cover',
  'lip',
  'hair',
  'styling',
  'fragrance',
  'deodorant',
  'body',
  'tool',
]

const CATEGORY_LABELS: Record<string, string> = {
  cleanser: 'Cleansers',
  toner: 'Toners',
  hydrator: 'Hydrators',
  active: 'Actives',
  moisturiser: 'Moisturisers',
  mask: 'Masks',
  spot: 'Spot treatment',
  patch: 'Patches',
  spf: 'SPF',
  cover: 'Coverage',
  lip: 'Lip',
  hair: 'Hair',
  styling: 'Styling',
  fragrance: 'Fragrance',
  deodorant: 'Deodorant',
  body: 'Body',
  tool: 'Tools',
}

export function LibraryScreen() {
  const products = useLiveQuery(() => db.products.toArray(), [])
  const settings = useLiveQuery(async () => (await db.settings.get('singleton'))?.value, [])
  const [detail, setDetail] = useState<Product | null>(null)

  if (!products || !settings) return null

  const byCategory = new Map<string, Product[]>()
  for (const product of products) {
    byCategory.set(product.category, [...(byCategory.get(product.category) ?? []), product])
  }

  return (
    <div>
      <h1 className="large-title">Library</h1>
      <p className="title-sub">Your roster and the dials behind the engine.</p>

      {CATEGORY_ORDER.filter((c) => byCategory.has(c)).map((category) => (
        <section key={category}>
          <h2 className="hx-section">{CATEGORY_LABELS[category] ?? category}</h2>
          <div className="card">
            {byCategory.get(category)?.map((product) => (
              <ProductRow
                key={product.id}
                product={product}
                onOpen={() => setDetail(product)}
              />
            ))}
          </div>
        </section>
      ))}

      <h2 className="hx-section">Settings</h2>
      <AdapalenePhaseSettings settings={settings} />
      <QuotaSettings settings={settings} />
      <ScheduleSettings settings={settings} />
      <WeatherSettings settings={settings} />
      <AppearanceBackupSettings settings={settings} />

      {detail && <ProductDetailSheet product={detail} onClose={() => setDetail(null)} />}
    </div>
  )
}
