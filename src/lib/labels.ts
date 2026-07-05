import type { AdapalenePhase, NightType, SkinState, Zone } from '../engine/types'

export const NIGHT_LABELS: Record<NightType, string> = {
  bha: 'BHA night',
  tn: 'TN night',
  adapalene: 'Adapalene night',
  clay: 'Clay night',
  vc100: 'VC100 mask night',
  simple: 'Simple night',
  benzac: 'Benzac night',
}

export const ZONE_LABELS: Record<Zone, string> = {
  forehead: 'Forehead',
  nose: 'Nose',
  'cheek-l': 'Cheek L',
  'cheek-r': 'Cheek R',
  'jaw-l': 'Jaw L',
  'jaw-r': 'Jaw R',
  chin: 'Chin',
  'below-ear-l': 'Below ear L',
  'below-ear-r': 'Below ear R',
  'preauricular-l': 'Front of ear L',
  'preauricular-r': 'Front of ear R',
  neck: 'Neck',
}

export const SKIN_LABELS: Record<SkinState, string> = {
  clear: 'Clear',
  'dry-tight-cheeks': 'Dry cheeks',
  oily: 'Oily',
  'new-spot': 'New spot',
  'red-lump': 'Red lump',
  'new-pih': 'New dark mark',
  irritated: 'Irritated',
  'purge-activity': 'Purge activity',
  'true-breakout': 'True breakout',
}

export const PHASE_LABELS: Record<AdapalenePhase, string> = {
  'patch-test': 'Patch test',
  preauricular: 'Preauricular strips',
  'one-cheek': 'One cheek',
  'full-face-1x': 'Full face · 1×/week',
  'full-face-2x': 'Full face · 2×/week',
  'full-face-3x': 'Full face · 3×/week',
  established: 'Established',
}

export const SPOT_TYPE_LABELS: Record<string, string> = {
  spot: 'Spot',
  boil: 'Boil',
  'closed-lump': 'Closed lump',
}
