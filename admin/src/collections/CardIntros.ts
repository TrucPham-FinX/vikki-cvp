import type { CollectionConfig } from 'payload'

import { CATALOG_LIST, signedIn } from '../cvp/access'
import { html, image } from '../cvp/blocks'
import { cvpMapping, extraJsonField } from '../cvp/fields'
import { cvpPreview } from '../cvp/previewConfig'
import { choice, sortOrderField } from './Promotions'

/**
 * Giới thiệu thẻ: the items of front-end/data/card-intro/list.json, each one's page
 * card-intro/<id>.html (the "Giới thiệu" popup of the card pages).
 */
export const CardIntros: CollectionConfig = {
  slug: 'card-intros',
  labels: {
    singular: { vi: 'Giới thiệu thẻ', en: 'Card intro' },
    plural: { vi: 'Giới thiệu thẻ', en: 'Card intros' },
  },
  defaultSort: 'sortOrder',
  admin: {
    group: false,
    components: { views: { list: { Component: CATALOG_LIST } } },
    // The page beside the form, and "Xem trước" in a new tab (cvp/previewConfig.ts)
    ...cvpPreview('card-intros'),
    useAsTitle: 'name',
    defaultColumns: ['cardId', 'name', 'cardGroup', 'sortOrder'],
  },
  access: { read: signedIn, create: signedIn, update: signedIn, delete: signedIn },
  versions: { maxPerDoc: 20 },
  fields: [
    {
      type: 'row',
      fields: [
        {
          name: 'cardId',
          label: 'Mã trang',
          type: 'text',
          required: true,
          unique: true,
          custom: cvpMapping({ dataKey: 'id' }),
          admin: { width: '40%', description: 'Tên file: card-intro/<mã>.html, VD vikki-go-plus.' },
          validate: (value: unknown) =>
            typeof value === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)
              ? true
              : 'Chữ thường không dấu, số và dấu gạch ngang.',
        },
        { name: 'name', label: 'Tên thẻ', type: 'text', required: true, admin: { width: '60%' } },
      ],
    },
    { type: 'row', fields: [choice('cardGroup', 'Nhóm thẻ', { width: '50%' })] },
    image('thumbnail', 'Ảnh', 'Chọn trong ảnh của các thẻ, hoặc tải ảnh mới lên (vào Thư viện media).', {
      page: 'card-intro',
      file: 'list.json',
    }),
    html('longDesc', 'Nội dung'),
    sortOrderField,
    extraJsonField({ name: 'extra', label: 'Thuộc tính khác (JSON)', position: 'sidebar' }),
  ],
}
