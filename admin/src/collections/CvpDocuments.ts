import type { CollectionConfig } from 'payload'

import { CATALOG_LIST, signedIn } from '../cvp/access'
import { cvpPreview } from '../cvp/previewConfig'
import { extraJsonField } from '../cvp/fields'
import { identityFields, setKey } from '../cvp/identity'
import { DOCUMENT_LAYOUTS } from '../cvp/repo-data'

/**
 * Popup content: the CVP's documents (Điều khoản & điều kiện, Biểu phí, Thể lệ…), the JSON of
 * front-end/data/<page>/tc.json, fee.json… that the static, fee and legal-document layouts render.
 * Their sections, articles, lists and tables nest without a fixed depth, so the body is kept as
 * JSON text, edited as a form (JsonFormField): folding sections, rich text, tables as grids.
 */
export const CvpDocuments: CollectionConfig = {
  slug: 'cvp-documents',
  labels: {
    singular: { vi: 'Nội dung popup', en: 'Popup content' },
    plural: { vi: 'Nội dung popup', en: 'Popup content' },
  },
  admin: {
    group: false,
    components: { views: { list: { Component: CATALOG_LIST } } },
    // The page beside the form, and "Xem trước" in a new tab (cvp/previewConfig.ts)
    ...cvpPreview('cvp-documents'),
    useAsTitle: 'key',
    defaultColumns: ['key', 'title', 'layout', 'languages', 'updatedAt'],
    listSearchableFields: ['key', 'title'],
    description:
      'Điều khoản, biểu phí, thể lệ… mà các nút của trang CVP mở trong popup (VD /vikki-cvp/<trang>/tc.html).',
  },
  access: { read: signedIn, create: signedIn, update: signedIn, delete: signedIn },
  versions: { maxPerDoc: 30 },
  hooks: { beforeValidate: [setKey] },
  fields: [
    ...identityFields('document'),
    {
      type: 'row',
      fields: [
        {
          name: 'title',
          label: 'Tiêu đề trang (<title>)',
          type: 'text',
          localized: true,
          admin: { width: '60%' },
        },
        {
          name: 'layout',
          label: 'Kiểu trang',
          type: 'select',
          required: true,
          localized: true,
          options: [
            { value: 'static', label: 'Điều khoản (static): phần → mục gập mở' },
            { value: 'fee', label: 'Biểu phí (fee): bảng liền mạch' },
            { value: 'legal-document', label: 'Văn bản pháp lý (legal-document)' },
          ].filter((option) => DOCUMENT_LAYOUTS.includes(option.value)),
          admin: { width: '40%' },
        },
      ],
    },
    extraJsonField({
      name: 'content',
      label: 'Nội dung',
      required: true,
      localized: true,
      shape: 'document',
      description:
        'Đầu trang, các phần → điều → nội dung (đoạn văn, tiêu đề phụ, danh sách, bảng); biểu phí là các nội dung nối tiếp. Bấm một mục để mở ra sửa; "JSON" để xem dữ liệu gốc.',
    }),
  ],
}
