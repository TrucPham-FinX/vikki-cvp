import type { CollectionConfig } from 'payload'

import { CATALOG_LIST, signedIn } from '../cvp/access'
import { cvpPreview } from '../cvp/previewConfig'
import { html, LANDING_BLOCKS, rowLabel } from '../cvp/blocks'
import { extraJsonField } from '../cvp/fields'
import { identityFields, setKey } from '../cvp/identity'

/** The layouts in front-end/layouts a page's JSON can name; none is base.hbs */
export const PAGE_LAYOUTS = ['template', 'base', 'blank', 'safe-plus-detail', 'promotion']

// What each layout is, for an editor choosing one
const LAYOUT_NAMES: Record<string, string> = {
  template: 'Dựng từ các khối',
  base: 'Trang tự viết',
  blank: 'Trang trắng',
  'safe-plus-detail': 'Chi tiết gói Vikki Safe+',
  promotion: 'Trang ưu đãi',
}

/**
 * CVP pages: the JSON of a landing page (front-end/data/<page>/index.json, <page>.json, or
 * {locale}.json per language), which front-end/layouts/template.hbs renders block by block.
 * Keys the forms do not cover (a page's own data, as Vikki Safe+'s plans) stay in "Dữ liệu riêng".
 */
export const CvpPages: CollectionConfig = {
  slug: 'cvp-pages',
  labels: {
    singular: { vi: 'Trang CVP', en: 'CVP page' },
    plural: { vi: 'Trang CVP', en: 'CVP pages' },
  },
  admin: {
    // The sidebar is access/menuCatalog.ts; the list is the CVP list screen
    group: false,
    components: { views: { list: { Component: CATALOG_LIST } } },
    // The page beside the form, and "Xem trước" in a new tab (cvp/previewConfig.ts)
    ...cvpPreview('cvp-pages'),
    useAsTitle: 'key',
    defaultColumns: ['key', 'title', 'languages', 'updatedAt'],
    listSearchableFields: ['key', 'title'],
    description:
      'Trang sản phẩm (landing) của CVP. Mỗi mục là một file dữ liệu; nút "Xuất & build" trên Dashboard ghi lại front-end/data và dựng HTML.',
  },
  access: { read: signedIn, create: signedIn, update: signedIn, delete: signedIn },
  versions: { maxPerDoc: 30 },
  hooks: { beforeValidate: [setKey] },
  fields: [
    ...identityFields('page'),
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Nội dung',
          fields: [
            {
              name: 'title',
              label: 'Tiêu đề trang',
              type: 'text',
              localized: true,
              admin: { description: 'Hiện trên tab trình duyệt và khi chia sẻ link.' },
            },
            {
              name: 'components',
              label: 'Khối nội dung',
              labels: { singular: 'Khối', plural: 'Khối' },
              type: 'blocks',
              localized: true,
              blocks: LANDING_BLOCKS,
              admin: { initCollapsed: true },
            },
          ],
        },
        {
          label: 'Hỏi đáp',
          description: 'Popup "Hỏi đáp" của trang (nút có popup = "qa"). Câu hỏi được đánh số tự động.',
          fields: [
            {
              name: 'qaGroup',
              label: 'Nhóm câu hỏi',
              labels: { singular: 'Nhóm', plural: 'Nhóm' },
              type: 'array',
              localized: true,
              admin: { initCollapsed: true, ...rowLabel },
              fields: [
                { name: 'title', label: 'Tên nhóm', type: 'text' },
                {
                  name: 'children',
                  label: 'Câu hỏi',
                  labels: { singular: 'Câu hỏi', plural: 'Câu hỏi' },
                  type: 'array',
                  admin: { initCollapsed: true, ...rowLabel },
                  fields: [
                    { name: 'title', label: 'Câu hỏi', type: 'text' },
                    html('content', 'Trả lời'),
                  ],
                },
              ],
            },
          ],
        },
        {
          label: 'Cài đặt',
          fields: [
            {
              type: 'row',
              fields: [
                {
                  name: 'layout',
                  label: 'Layout',
                  type: 'select',
                  localized: true,
                  options: PAGE_LAYOUTS.map((value) => ({
                    value,
                    label: `${LAYOUT_NAMES[value] ?? value} (${value})`,
                  })),
                  admin: {
                    width: '50%',
                    description: 'template: dựng từ các khối. Để trống: base (trang tự viết).',
                  },
                },
                {
                  name: 'className',
                  label: 'CSS class của <body>',
                  type: 'text',
                  localized: true,
                  admin: { width: '50%' },
                },
              ],
            },
            {
              type: 'row',
              fields: [
                {
                  name: 'hasTopSpace',
                  label: 'Chừa khoảng trên cùng (thanh trạng thái)',
                  type: 'checkbox',
                  localized: true,
                },
                {
                  name: 'hasBackground',
                  label: 'Có nền',
                  type: 'checkbox',
                  localized: true,
                },
              ],
            },
          ],
        },
        {
          label: 'Nội dung riêng',
          description:
            'Nội dung mà giao diện riêng của trang đọc, ngoài các khối: VD câu hỏi và slider của trang cũ, các gói, bước, quyền lợi của Vikki Safe+, video banner.',
          fields: [
            extraJsonField({
              name: 'extra',
              label: 'Nội dung riêng của trang',
              localized: true,
              description: 'Bấm một mục để mở ra sửa; "JSON" để xem dữ liệu gốc.',
            }),
          ],
        },
      ],
    },
  ],
}
