import type { GlobalConfig } from 'payload'

import { signedIn } from '../cvp/access'

/**
 * The rest of the two list files, beside their items (collections Promotions and CardIntros):
 * front-end/data/promotion/list.json and card-intro/list.json, e.g. {"layout": "promotion"}.
 */
export const CvpLists: GlobalConfig = {
  slug: 'cvp-lists',
  label: { vi: 'Cài đặt danh sách', en: 'List settings' },
  admin: { group: false },
  access: { read: signedIn, update: signedIn },
  fields: [
    {
      name: 'promotionList',
      label: 'promotion/list.json (trừ items)',
      type: 'json',
    },
    {
      name: 'cardIntroList',
      label: 'card-intro/list.json (trừ items)',
      type: 'json',
    },
  ],
}
