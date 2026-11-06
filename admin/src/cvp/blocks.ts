import type { Block, Field } from 'payload'

import { cvpMapping, extraJsonField } from './fields'

/**
 * The blocks of a landing page's `components` (front-end/layouts/template.hbs renders them in
 * order, one partial each in front-end/components). Every key the pages' JSON uses has a field,
 * so editors see forms, not JSON; `htmlId` is the JSON's `id` (Payload keeps `id` for its rows).
 *
 * Images are picked from the page's images or uploaded (ImageField), links picked from the
 * popups, pages and promotions (LinkField): both still store the path the JSON has, so the data
 * files and the build are unchanged. Presentation keys (CSS classes, raw JSON) sit in a collapsed
 * "Nâng cao" section. A field's place in its block is its key's place in the JSON written back
 * (cvp/fields.ts), so wrapping fields in sections never moves one.
 */

// Each block's header: its kind and a summary (admin/components/cvp/CvpRowLabel.tsx); no "block name",
// which the JSON does not have
const blockAdmin: Block['admin'] = {
  disableBlockName: true,
  components: { Label: '/admin/components/cvp/CvpRowLabel#CvpRowLabel' },
}

/** The block's sketch in "Thêm khối" (public/blocks/<slug>.svg), so an editor sees what each one is */
const sketch = (slug: string, what: string): Pick<Block, 'imageURL' | 'imageAltText'> => ({
  imageURL: `/blocks/${slug}.svg`,
  imageAltText: what,
})

const IMAGE_HINT = 'Chọn trong ảnh của trang, hoặc tải ảnh mới lên (vào Thư viện media).'

const text = (name: string, label: string, description?: string): Field => ({
  name,
  label,
  type: 'text',
  ...(description ? { admin: { description } } : {}),
})

/**
 * An image, picked or uploaded; stored as its path (`./assets/title.png`). A page's images are its
 * folder's (the form's `page`); a list item's are its list's, given as `folder`.
 */
export const image = (
  name: string,
  label: string,
  description = IMAGE_HINT,
  folder?: { page: string; file: string },
): Field => ({
  name,
  label,
  type: 'text',
  admin: {
    description,
    components: {
      Field: folder
        ? { path: '/admin/components/cvp/fields/ImageField#ImageField', clientProps: folder }
        : '/admin/components/cvp/fields/ImageField#ImageField',
    },
  },
})

/** Text the page prints as HTML, written with a toolbar (HtmlField); stored as the HTML */
export const html = (name: string, label: string, description?: string): Field => ({
  name,
  label,
  type: 'textarea',
  admin: {
    ...(description ? { description } : {}),
    components: { Field: '/admin/components/cvp/fields/HtmlField#HtmlField' },
  },
})

type LinkKind = 'popup' | 'popupLink' | 'scroll'

/** A link picked from the popups, pages and promotions (LinkField); stored as the path it was */
const link = (name: string, label: string, kind: LinkKind, description?: string): Field => ({
  name,
  label,
  type: 'text',
  admin: {
    ...(description ? { description } : {}),
    components: {
      Field: { path: '/admin/components/cvp/fields/LinkField#LinkField', clientProps: { kind } },
    },
  },
})

/** Fields for whoever builds the page's look, out of an editor's way */
const advanced = (fields: Field[], label = 'Nâng cao (CSS, dành cho dev)'): Field => ({
  type: 'collapsible',
  label,
  admin: { initCollapsed: true },
  fields,
})

const POPUP_HINT =
  'Popup mở ra khi bấm: Hỏi đáp của trang, một nội dung popup (điều khoản, biểu phí…), một trang hay danh sách ưu đãi.'

const htmlId: Field = {
  name: 'htmlId',
  label: 'Mã phần tử (id)',
  type: 'text',
  custom: cvpMapping({ dataKey: 'id' }),
  admin: {
    description: 'Đặt tên cho phần này (VD intro) để mục menu "Cuộn tới" chọn được nó.',
  },
}

const className = text('className', 'CSS class')

const imageGroup = (name: string, label: string): Field => ({
  name,
  label,
  type: 'group',
  fields: [image('src', 'Ảnh')],
})

const button = (name: string, label: string, withTitle = false): Field => ({
  name,
  label,
  type: 'group',
  fields: [
    ...(withTitle ? [text('title', 'Tiêu đề popup')] : []),
    text('text', 'Chữ trên nút'),
    link('popup', 'Mở popup', 'popup', POPUP_HINT),
  ],
})

/** An array row's header: a summary of the row */
export const rowLabel = { components: { RowLabel: '/admin/components/cvp/CvpRowLabel#CvpRowLabel' } }

export const ActivationBlock: Block = {
  slug: 'activation',
  ...sketch('activation', 'Ảnh tiêu đề, ảnh nội dung và các nút biểu phí / điều khoản'),
  labels: { singular: 'Kích hoạt / nút pháp lý', plural: 'Kích hoạt / nút pháp lý' },
  admin: blockAdmin,
  fields: [
    advanced([
      {
        type: 'row',
        fields: [
          { ...text('bgClass', 'Nền (class)'), admin: { width: '50%' } } as Field,
          { ...className, admin: { width: '50%' } } as Field,
        ],
      },
    ]),
    imageGroup('title', 'Ảnh tiêu đề'),
    imageGroup('image', 'Ảnh nội dung'),
    button('feeButton', 'Nút biểu phí'),
    button('termsButton', 'Nút điều khoản'),
    button('termsButtonFullW', 'Nút điều khoản (rộng hết dòng)', true),
  ],
}

export const ImageSectionBlock: Block = {
  slug: 'imageSection',
  ...sketch('imageSection', 'Một ảnh rộng hết trang'),
  labels: { singular: 'Ảnh', plural: 'Ảnh' },
  admin: blockAdmin,
  fields: [
    { ...image('src', 'Ảnh'), required: true } as Field,
    htmlId,
    advanced([
      className,
      text('cellClassName', 'Class ô chứa'),
      text('imgClassName', 'Class ảnh'),
      text('loading', 'Hiện ảnh chờ', 'Chữ "true" để hiện ảnh chờ trong lúc tải.'),
      text('loadingClassName', 'Class ảnh chờ'),
    ]),
  ],
}

export const FlexBlock: Block = {
  slug: 'flex',
  ...sketch('flex', 'Danh sách đối tác: logo, tên và nút'),
  labels: { singular: 'Đối tác', plural: 'Đối tác' },
  admin: blockAdmin,
  fields: [
    advanced([className]),
    {
      name: 'partners',
      label: 'Đối tác',
      labels: { singular: 'Đối tác', plural: 'Đối tác' },
      type: 'array',
      admin: rowLabel,
      fields: [
        {
          type: 'row',
          fields: [
            {
              name: 'partnerId',
              label: 'Mã',
              type: 'text',
              custom: cvpMapping({ dataKey: 'id' }),
              admin: { width: '30%' },
            },
            { ...text('name', 'Tên'), admin: { width: '70%' } } as Field,
          ],
        },
        text('sub', 'Dòng phụ'),
        image('logo', 'Logo'),
        image('logoActive', 'Logo khi đã có thẻ'),
        image('logoInactive', 'Logo khi chưa có thẻ'),
        text('link', 'Liên kết trong app', 'Đường dẫn app mở khi bấm, VD /partner/vikki.'),
        text('actionText', 'Chữ trên nút'),
      ],
    },
  ],
}

export const QaBlock: Block = {
  slug: 'qa',
  ...sketch('qa', 'Danh sách câu hỏi thường gặp, bấm để mở câu trả lời'),
  labels: { singular: 'Câu hỏi thường gặp', plural: 'Câu hỏi thường gặp' },
  admin: blockAdmin,
  fields: [
    imageGroup('title', 'Ảnh tiêu đề'),
    {
      name: 'items',
      label: 'Câu hỏi',
      labels: { singular: 'Câu hỏi', plural: 'Câu hỏi' },
      type: 'array',
      admin: rowLabel,
      fields: [text('title', 'Câu hỏi'), html('content', 'Trả lời')],
    },
    { name: 'button', label: 'Nút "Xem thêm"', type: 'group', fields: [text('text', 'Chữ trên nút')] },
  ],
}

export const SliderBlock: Block = {
  slug: 'slider',
  ...sketch('slider', 'Các ảnh trượt ngang, có chấm chỉ vị trí'),
  labels: { singular: 'Slider ảnh', plural: 'Slider ảnh' },
  admin: blockAdmin,
  fields: [
    imageGroup('title', 'Ảnh tiêu đề'),
    image('srcTitle', 'Ảnh tiêu đề (kiểu cũ)', 'Chỉ dùng khi trang cũ đã có; trang mới dùng "Ảnh tiêu đề" ở trên.'),
    {
      name: 'items',
      label: 'Slide',
      labels: { singular: 'Slide', plural: 'Slide' },
      type: 'array',
      admin: rowLabel,
      fields: [
        image('src', 'Ảnh'),
        link(
          'popupLink',
          'Mở khi bấm',
          'popupLink',
          'Ưu đãi, nội dung popup, trang… hoặc gõ một địa chỉ web (https://…).',
        ),
        text('popupTitle', 'Tiêu đề popup'),
      ],
    },
    htmlId,
    advanced([
      className,
      extraJsonField({
        name: 'extra',
        label: 'Thuộc tính khác (JSON)',
        description:
          'Các khóa có dấu gạch ngang, VD {"background-color": "#EDF4FF", "hide-pagination": "true"}.',
      }),
    ]),
  ],
}

export const TitleBlock: Block = {
  slug: 'title',
  ...sketch('title', 'Một dòng tiêu đề chữ'),
  labels: { singular: 'Tiêu đề chữ', plural: 'Tiêu đề chữ' },
  admin: blockAdmin,
  fields: [text('title', 'Tiêu đề'), advanced([className])],
}

export const TooltipBlock: Block = {
  slug: 'tooltip',
  ...sketch('tooltip', 'Ảnh tiêu đề kèm nút (i) mở lời giải thích'),
  labels: { singular: 'Tooltip', plural: 'Tooltip' },
  admin: blockAdmin,
  fields: [
    image('srcTitle', 'Ảnh tiêu đề'),
    image('srcTooltipButton', 'Ảnh nút tooltip'),
    { name: 'textTooltip', label: 'Nội dung tooltip', type: 'textarea' },
    htmlId,
    advanced([className]),
  ],
}

export const TopMenuBlock: Block = {
  slug: 'topMenu',
  ...sketch('topMenu', 'Thanh menu đầu trang: icon và chữ, bấm mở popup hoặc cuộn tới'),
  labels: { singular: 'Menu đầu trang', plural: 'Menu đầu trang' },
  admin: blockAdmin,
  fields: [
    {
      name: 'items',
      label: 'Mục menu',
      labels: { singular: 'Mục menu', plural: 'Mục menu' },
      type: 'array',
      admin: rowLabel,
      fields: [
        text('text', 'Chữ'),
        image('iconSrc', 'Icon'),
        link('popup', 'Mở popup', 'popup', `${POPUP_HINT} Để trống nếu mục này cuộn tới một phần của trang.`),
        text('title', 'Tiêu đề popup'),
        link(
          'scroll',
          'Cuộn tới',
          'scroll',
          'Thay cho popup: phần của trang cần cuộn tới (các khối có Mã phần tử).',
        ),
      ],
    },
  ],
}

export const VideoBlock: Block = {
  slug: 'video',
  ...sketch('video', 'Video banner đầu trang, có ảnh chờ'),
  labels: { singular: 'Video banner', plural: 'Video banner' },
  admin: blockAdmin,
  fields: [image('src', 'Ảnh chờ (poster)'), htmlId, advanced([className])],
}

export const LANDING_BLOCKS: Block[] = [
  TopMenuBlock,
  VideoBlock,
  ImageSectionBlock,
  SliderBlock,
  QaBlock,
  ActivationBlock,
  FlexBlock,
  TitleBlock,
  TooltipBlock,
]
