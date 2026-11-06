import type { CollectionConfig } from 'payload'

import { signedIn } from '../cvp/access'
import { ASSET_FOLDER, PAGE_NAME } from '../cvp/assetPaths'
import { MEDIA_DIR, MEDIA_SLUG, placeUpload } from '../cvp/media'

/**
 * The media library: images and videos for the CVP pages, uploaded here or straight from an image
 * field of a page (admin/components/cvp/fields/ImageField.tsx). Each belongs to a page's folder;
 * "Xuất & build" copies it into vikki-cvp/<page>/<folder>/ (cvp/media.ts), where the page's data
 * names it as `./assets/<file>`. Until then it is kept by cvp/storage.ts (admin/media/ on disk, or
 * S3 when AWS_S3_BUCKET is set) under `<page>/<folder>/`, and the preview shows it from there.
 *
 * A file's page and folder are where it is stored, so they are set when it is uploaded and not
 * changed after: a file for another page is uploaded there.
 */

// Set on create; read-only afterwards (the stored file would stay in the old folder)
const setOnCreate = { create: () => true, update: () => false }
export const CvpMedia: CollectionConfig = {
  slug: MEDIA_SLUG,
  labels: {
    singular: { vi: 'Tệp media', en: 'Media file' },
    plural: { vi: 'Thư viện media', en: 'Media library' },
  },
  admin: {
    // The sidebar is access/menuCatalog.ts
    group: false,
    useAsTitle: 'filename',
    defaultColumns: ['filename', 'page', 'folder', 'updatedAt'],
    listSearchableFields: ['filename', 'page'],
    description:
      'Ảnh và video của các trang CVP. Tải lên ở đây, hoặc ngay trong ô ảnh khi sửa trang. Nút "Xuất & build" chép tệp vào vikki-cvp/<trang>/<thư mục>/; trùng tên với ảnh đã có thì tệp mới được đổi tên (ảnh-1.png), không ghi đè.',
    components: {
      // Where the files are kept, and the import of the published images (cvp/media.ts)
      beforeListTable: ['/admin/components/cvp/media/MediaLibraryBar#MediaLibraryBar'],
    },
  },
  access: { read: signedIn, create: signedIn, update: signedIn, delete: signedIn },
  upload: {
    staticDir: MEDIA_DIR,
    // A name is unique in its page's folder, not in the whole library: `qa.svg` of two pages are two
    // files (stored apart, cvp/storage.ts), each with the name its page's data uses
    filenameCompoundIndex: ['filename', 'prefix'],
    mimeTypes: ['image/*', 'video/mp4', 'video/webm', 'application/pdf'],
    // The pages use each file as it is: no sizes, crops or focal points to keep
    crop: false,
    focalPoint: false,
  },
  hooks: { beforeOperation: [placeUpload] },
  fields: [
    {
      name: 'page',
      label: 'Trang',
      type: 'text',
      required: true,
      index: true,
      access: setOnCreate,
      admin: {
        description: 'Thư mục của trang dùng tệp này, VD vikki-go-plus-cvp. Không đổi được sau khi tải lên.',
        components: { Field: '/admin/components/cvp/fields/PageField#PageField' },
      },
      validate: (value: unknown) =>
        typeof value === 'string' && PAGE_NAME.test(value)
          ? true
          : 'Chữ thường không dấu, số và dấu gạch ngang.',
    },
    {
      name: 'folder',
      label: 'Thư mục',
      type: 'text',
      required: true,
      defaultValue: 'assets',
      index: true,
      access: setOnCreate,
      admin: {
        description:
          'Trong thư mục trang. Thường là assets; ảnh riêng một ngôn ngữ: assets/vi, assets/en. Không đổi được sau khi tải lên.',
      },
      validate: (value: unknown) =>
        typeof value === 'string' && ASSET_FOLDER.test(value)
          ? true
          : 'Bắt đầu bằng assets, VD assets hoặc assets/vi.',
    },
  ],
}
