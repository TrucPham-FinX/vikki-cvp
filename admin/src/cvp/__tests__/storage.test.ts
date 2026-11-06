import fs from 'fs'
import os from 'os'
import path from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { importPublishedAssets, mediaPrefix } from '../media'
import { getStorageConfig, maskAccessKey, s3CollectionPrefix, withKeyFallback } from '../storage'

describe('where the media library keeps its files (storage)', () => {
  it('stays on the disk until a bucket is named, whatever keys the shell has', () => {
    expect(getStorageConfig({})).toBeNull()
    expect(getStorageConfig({ AWS_ACCESS_KEY_ID: 'AKIAXXXXXXXXXXXXXXXX', AWS_SECRET_ACCESS_KEY: 's' })).toBeNull()
  })

  it('refuses a half-made S3 configuration at start', () => {
    expect(() => getStorageConfig({ AWS_S3_BUCKET: 'gg-dev-media' })).toThrow(/AWS_S3_REGION/)
    expect(() =>
      getStorageConfig({ AWS_S3_BUCKET: 'b', AWS_S3_REGION: 'ap-southeast-1', AWS_ACCESS_KEY_ID: 'AKIA1234' }),
    ).toThrow(/AWS_SECRET_ACCESS_KEY/)
    expect(() => getStorageConfig({ AWS_S3_BUCKET: 'b', AWS_S3_REGION: 'r', AWS_S3_ACL: 'public' })).toThrow(/AWS_S3_ACL/)
    expect(() => getStorageConfig({ AWS_S3_BUCKET: 'b', AWS_S3_REGION: 'r', AWS_S3_SIGNED_URL_TTL: '5' })).toThrow(
      /AWS_S3_SIGNED_URL_TTL/,
    )
    expect(() => getStorageConfig({ AWS_S3_BUCKET: 'b', AWS_S3_REGION: 'r', AWS_S3_MEDIA_OWNER: 'Acme' })).toThrow(
      /AWS_S3_MEDIA_OWNER/,
    )
  })

  it('takes credentials in g-digital-center’s order: the pod’s role, then a key pair, then the SDK', () => {
    const base = { AWS_S3_BUCKET: 'gg-dev-media', AWS_S3_REGION: 'ap-southeast-1' }
    expect(getStorageConfig(base)?.credentialSource).toBe('sdk-default')
    const keys = { AWS_ACCESS_KEY_ID: 'AKIAIOSFODNN7EXAMPLE', AWS_SECRET_ACCESS_KEY: 'secret' }
    expect(getStorageConfig({ ...base, ...keys })).toMatchObject({ credentialSource: 'access-key', accessKeyId: keys.AWS_ACCESS_KEY_ID })
    const irsa = { AWS_ROLE_ARN: 'arn:aws:iam::1:role/x', AWS_WEB_IDENTITY_TOKEN_FILE: '/var/run/token' }
    expect(getStorageConfig({ ...base, ...irsa, ...keys })).toMatchObject({
      credentialSource: 'irsa',
      accessKeyId: undefined,
      fallbackKeys: { accessKeyId: keys.AWS_ACCESS_KEY_ID, secretAccessKey: 'secret' },
    })
    expect(getStorageConfig({ ...base, AWS_CONTAINER_CREDENTIALS_FULL_URI: 'http://169.254.170.23/v1' })?.credentialSource).toBe(
      'pod-identity',
    )
  })

  it('keys every file under media/<owner>/cvp/, beside Digital Center’s own features', () => {
    expect(s3CollectionPrefix({ owner: 'platform' })).toBe('media/platform/cvp')
    expect(getStorageConfig({ AWS_S3_BUCKET: 'b', AWS_S3_REGION: 'r', AWS_S3_MEDIA_OWNER: 'tenant/vikki' })?.owner).toBe(
      'tenant/vikki',
    )
    expect(mediaPrefix('vikki-go-plus-cvp', 'assets/vi')).toBe('vikki-go-plus-cvp/assets/vi')
  })

  it('falls back to the key pair only when STS rejects the role', async () => {
    const keys = { accessKeyId: 'AKIAIOSFODNN7EXAMPLE', secretAccessKey: 's' }
    const warn = vi.fn()
    const rejected = withKeyFallback(
      async () => {
        throw Object.assign(new Error('bad token'), { name: 'InvalidIdentityTokenException' })
      },
      keys,
      warn,
    )
    expect(await rejected()).toBe(keys)
    expect(warn.mock.calls[0]?.[0]).toContain('AKIA****MPLE')
    const offline = withKeyFallback(
      async () => {
        throw Object.assign(new Error('timeout'), { name: 'TimeoutError' })
      },
      keys,
      warn,
    )
    await expect(offline()).rejects.toThrow('timeout')
    expect(maskAccessKey('short')).toBe('****')
  })
})

describe('putting the published images into the library (media)', () => {
  let root: string
  const before = process.env.CVP_REPO_ROOT

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'cvp-import-'))
    process.env.CVP_REPO_ROOT = root
    const assets = path.join(root, 'vikki-cvp', 'p', 'assets')
    fs.mkdirSync(path.join(assets, 'vi'), { recursive: true })
    fs.writeFileSync(path.join(assets, 'title.png'), 'title')
    fs.writeFileSync(path.join(assets, 'qa.svg'), '<svg/>')
    fs.writeFileSync(path.join(assets, 'video.mp4'), 'video')
    fs.writeFileSync(path.join(assets, 'vi', 'banner.jpg'), 'vi')
  })

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true })
    if (before === undefined) delete process.env.CVP_REPO_ROOT
    else process.env.CVP_REPO_ROOT = before
  })

  const fakePayload = (existing: { page: string; folder: string; filename: string }[]) => {
    const create = vi.fn(async (args: unknown) => args)
    const payload = { find: vi.fn(async () => ({ docs: existing })), create }
    return { payload: payload as never, create }
  }

  it('adds each image under its own page, folder and name, and leaves what the library has', async () => {
    const { payload, create } = fakePayload([{ page: 'p', folder: 'assets', filename: 'qa.svg' }])
    const report = await importPublishedAssets(payload, { pages: ['p'] })
    expect(report.added.sort()).toEqual(['p/assets/title.png', 'p/assets/vi/banner.jpg'])
    expect(report.existing).toBe(1)
    expect(report.skipped).toEqual(['p/assets/video.mp4'])
    const made = create.mock.calls.map(([args]) => {
      const { data, file } = args as { data: { page: string; folder: string }; file: { name: string; mimetype: string } }
      return `${data.page}|${data.folder}|${file.name}|${file.mimetype}`
    })
    expect(made.sort()).toEqual(['p|assets/vi|banner.jpg|image/jpeg', 'p|assets|title.png|image/png'])
  })

  it('takes videos when asked, and writes nothing on a dry run', async () => {
    const { payload, create } = fakePayload([])
    const report = await importPublishedAssets(payload, { pages: ['p'], videos: true, dryRun: true })
    expect(report.added).toContain('p/assets/video.mp4')
    expect(create).not.toHaveBeenCalled()
  })
})
