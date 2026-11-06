import type { CollectionConfig, Field } from 'payload'

import { CATALOG_LIST, signedIn } from '../cvp/access'
import { html, image } from '../cvp/blocks'
import { cvpMapping, extraJsonField } from '../cvp/fields'
import { cvpPreview } from '../cvp/previewConfig'

/** A list item's images are in its list's folder: vikki-cvp/promotion/assets/ */
const PROMOTION_IMAGES = { page: 'promotion', file: 'list.json' }
const IMAGE_HINT = 'Chọn trong ảnh của ưu đãi, hoặc tải ảnh mới lên (vào Thư viện media).'

/** A code picked from those in use (ChoiceField, cvp/codes.ts), or a new one typed */
export const choice = (
  name: 'promotionCate' | 'promotionGroup' | 'cardGroup',
  label: string,
  options: { many?: boolean; width?: string; description?: string } = {},
): Field => ({
  name,
  label,
  type: 'text',
  admin: {
    ...(options.width ? { width: options.width } : {}),
    ...(options.description ? { description: options.description } : {}),
    components: {
      Field: {
        path: '/admin/components/cvp/fields/ChoiceField#ChoiceField',
        clientProps: { choice: name, many: options.many ?? false },
      },
    },
  },
})

const date = (name: string, label: string, width = '25%'): Field => ({
  name,
  label,
  type: 'date',
  admin: { width, date: { pickerAppearance: 'dayAndTime' } },
})

/** Where an item sits in its list (list.json keeps them in order); not in the JSON itself */
export const sortOrderField: Field = {
  name: 'sortOrder',
  label: 'Thứ tự',
  type: 'number',
  index: true,
  custom: cvpMapping({ exclude: true }),
  admin: { position: 'sidebar', description: 'Nhỏ đứng trước trong danh sách.' },
}

/**
 * Ưu đãi: the items of front-end/data/promotion/list.json. promotion/list.html lists them (filtered
 * by ?category=) and promotion/<id>.html is each one's page. Replaces the Excel import.
 */
export const Promotions: CollectionConfig = {
  slug: 'promotions',
  labels: {
    singular: { vi: 'Ưu đãi', en: 'Promotion' },
    plural: { vi: 'Ưu đãi', en: 'Promotions' },
  },
  defaultSort: 'sortOrder',
  admin: {
    group: false,
    components: { views: { list: { Component: CATALOG_LIST } } },
    // The page beside the form, and "Xem trước" in a new tab (cvp/previewConfig.ts)
    ...cvpPreview('promotions'),
    useAsTitle: 'name',
    defaultColumns: ['promoId', 'name', 'promotionCate', 'startDate', 'endDate', 'sortOrder'],
    listSearchableFields: ['promoId', 'name', 'promotionCode'],
  },
  access: { read: signedIn, create: signedIn, update: signedIn, delete: signedIn },
  versions: { maxPerDoc: 20 },
  fields: [
    {
      type: 'row',
      fields: [
        {
          name: 'promoId',
          label: 'Mã trang',
          type: 'text',
          required: true,
          unique: true,
          custom: cvpMapping({ dataKey: 'id' }),
          admin: { width: '30%', description: 'Tên file: promotion/<mã>.html, VD promo-114.' },
          validate: (value: unknown) =>
            typeof value === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)
              ? true
              : 'Chữ thường không dấu, số và dấu gạch ngang.',
        },
        { name: 'name', label: 'Tên ưu đãi', type: 'text', required: true, admin: { width: '70%' } },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'shortDesc', label: 'Mô tả ngắn', type: 'text', admin: { width: '50%' } },
        { name: 'extraData', label: 'Dòng thời gian', type: 'text', admin: { width: '50%' } },
      ],
    },
    html('longDesc', 'Nội dung'),
    image('thumbnail', 'Ảnh thu nhỏ', IMAGE_HINT, PROMOTION_IMAGES),
    image('mainImg', 'Ảnh chính', IMAGE_HINT, PROMOTION_IMAGES),
    {
      type: 'row',
      fields: [
        choice('promotionCate', 'Danh mục', {
          many: true,
          width: '60%',
          description: 'Ưu đãi hiện trong danh sách của từng danh mục (link ?category=…).',
        }),
        choice('promotionGroup', 'Nhóm', { width: '40%' }),
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'promotionCode', label: 'Mã ưu đãi', type: 'text', admin: { width: '50%' } },
        { name: 'isHotDeal', label: 'Hot deal', type: 'checkbox', admin: { width: '50%' } },
      ],
    },
    {
      type: 'row',
      fields: [
        date('startDate', 'Bắt đầu'),
        date('endDate', 'Kết thúc'),
        date('createdDate', 'Ngày tạo'),
        date('updatedDate', 'Ngày cập nhật'),
      ],
    },
    sortOrderField,
    extraJsonField({ name: 'extra', label: 'Thuộc tính khác (JSON)', position: 'sidebar' }),
  ],
}
