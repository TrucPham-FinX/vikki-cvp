import fs from 'fs'
import path from 'path'

import { S3, type S3ClientConfig } from '@aws-sdk/client-s3'
import { fromHttp } from '@aws-sdk/credential-provider-http'
import { fromTokenFile } from '@aws-sdk/credential-provider-web-identity'
import { cloudStoragePlugin } from '@payloadcms/plugin-cloud-storage'
import type { Adapter } from '@payloadcms/plugin-cloud-storage/types'
import { getStorageFilePath, sanitizePrefix } from '@payloadcms/plugin-cloud-storage/utilities'
import { s3Storage } from '@payloadcms/storage-s3'
import type { Plugin } from 'payload'

/**
 * Where the media library (collections/CvpMedia.ts) keeps its files: on disk in admin/media while
 * developing, or in S3 once `AWS_S3_BUCKET` is set — configured as galaxy-g-digital-center does
 * it (src/services/storage.ts there): the same variables, the same credential order (the pod's IAM
 * role, then a key pair, then the SDK's own chain), the same key layout under `media/<owner>/`.
 *
 * Either way a file is stored under its page's folder, `<page>/<folder>/<filename>` (the upload's
 * `prefix`, set by cvp/media.ts): `qa.svg` of two pages are two files, each keeping the name its
 * page's data uses. In S3 that is `media/<owner>/cvp/<page>/<folder>/<filename>`; `cvp` is this
 * admin's feature segment beside Digital Center's `library`, `page`…, so one bucket can hold both
 * and a policy or lifecycle rule can single it out.
 */

export const MEDIA_SLUG = 'cvp-media'

/** The disk store: admin/media (npm scripts, `next dev` and `payload run` start in admin/) */
export const MEDIA_DIR = path.resolve(process.cwd(), 'media')

/** Digital Center's collection prefix; the owner and `cvp` follow */
const S3_ROOT = 'media'
const FEATURE = 'cvp'

type KeyPair = { accessKeyId: string; secretAccessKey: string }
type Identity = KeyPair & { sessionToken?: string; expiration?: Date }
type IdentityProvider = (props?: Record<string, unknown>) => Promise<Identity>

/** The IAM role EKS gives the pod: IRSA (`AWS_ROLE_ARN` + token file) or Pod Identity */
export type IamRole = 'irsa' | 'pod-identity'
type CredentialSource = IamRole | 'access-key' | 'sdk-default'

export type StorageConfig = {
  bucket: string
  region: string
  /** An S3-compatible endpoint (MinIO, R2); empty for AWS itself */
  endpoint?: string
  forcePathStyle: boolean
  credentialSource: CredentialSource
  accessKeyId?: string
  secretAccessKey?: string
  /** A role and a full key pair: the pair is used when STS rejects the role */
  fallbackKeys?: KeyPair
  acl?: 'private' | 'public-read'
  /** Lifetime of a presigned download, in seconds */
  signedUrlTtl: number
  owner: string
}

type Env = Record<string, string | undefined>

const clean = (value: string | undefined) => {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

const DEFAULT_SIGNED_URL_TTL = 300

export function detectIamRole(env: Env = process.env): IamRole | null {
  if (clean(env.AWS_ROLE_ARN) && clean(env.AWS_WEB_IDENTITY_TOKEN_FILE)) return 'irsa'
  if (clean(env.AWS_CONTAINER_CREDENTIALS_FULL_URI)) return 'pod-identity'
  return null
}

/** `platform` or `tenant/<slug>`, as Digital Center checks it: a wrong owner would sit in every key */
const OWNER_SHAPE = /^(platform|tenant\/[a-z0-9][a-z0-9-]{0,62})$/

/**
 * The S3 settings from the environment, or null for the disk. The bucket alone switches S3 on:
 * a key pair left in a developer's shell for another tool does not. A half-made configuration
 * throws at start, before any upload goes astray.
 */
export function getStorageConfig(env: Env = process.env): StorageConfig | null {
  const bucket = clean(env.AWS_S3_BUCKET)
  if (!bucket) return null
  const region = clean(env.AWS_S3_REGION)
  const endpoint = clean(env.AWS_S3_ENDPOINT_URL)
  const role = detectIamRole(env)
  const envKeyId = clean(env.AWS_ACCESS_KEY_ID)
  const envSecret = clean(env.AWS_SECRET_ACCESS_KEY)
  // With a role the pair is never the main source; half a pair cannot be a fallback
  const accessKeyId = role ? undefined : envKeyId
  const secretAccessKey = role ? undefined : envSecret
  const fallbackKeys = role && envKeyId && envSecret ? { accessKeyId: envKeyId, secretAccessKey: envSecret } : undefined

  const missing: string[] = []
  if (!region) missing.push('AWS_S3_REGION')
  if (Boolean(accessKeyId) !== Boolean(secretAccessKey)) {
    missing.push(accessKeyId ? 'AWS_SECRET_ACCESS_KEY' : 'AWS_ACCESS_KEY_ID')
  }
  if (missing.length || !region) {
    throw new Error(
      `S3 storage is partially configured. Missing: ${missing.join(', ')}. ` +
        'Set them, or unset AWS_S3_BUCKET to keep the media library in admin/media.',
    )
  }

  const acl = clean(env.AWS_S3_ACL)
  if (acl && acl !== 'private' && acl !== 'public-read') {
    throw new Error(`AWS_S3_ACL must be "private" or "public-read", got "${acl}".`)
  }

  const ttlRaw = clean(env.AWS_S3_SIGNED_URL_TTL)
  const ttl = ttlRaw ? Number(ttlRaw) : DEFAULT_SIGNED_URL_TTL
  if (!Number.isInteger(ttl) || ttl < 30 || ttl > 3600) {
    throw new Error(`AWS_S3_SIGNED_URL_TTL must be a whole number of seconds between 30 and 3600, got "${ttlRaw}".`)
  }

  const owner = clean(env.AWS_S3_MEDIA_OWNER) ?? 'platform'
  if (!OWNER_SHAPE.test(owner)) {
    throw new Error(`AWS_S3_MEDIA_OWNER must be "platform" or "tenant/<slug>", got "${owner}".`)
  }

  const forcePathStyle = clean(env.AWS_S3_FORCE_PATH_STYLE)
  return {
    bucket,
    region,
    endpoint,
    forcePathStyle: forcePathStyle ? forcePathStyle === 'true' : Boolean(endpoint),
    credentialSource: role ?? (accessKeyId ? 'access-key' : 'sdk-default'),
    accessKeyId,
    secretAccessKey,
    ...(fallbackKeys ? { fallbackKeys } : {}),
    ...(acl ? { acl: acl as StorageConfig['acl'] } : {}),
    signedUrlTtl: ttl,
    owner,
  }
}

/** The part of every key before a file's own `<page>/<folder>/<filename>`: `media/<owner>/cvp` */
export const s3CollectionPrefix = (config: Pick<StorageConfig, 'owner'>) => `${S3_ROOT}/${config.owner}/${FEATURE}`

// STS answered, and the answer is no: asking again gives the same until someone fixes IAM
const ROLE_REJECTED = new Set([
  'InvalidIdentityTokenException',
  'InvalidIdentityToken',
  'IDPRejectedClaimException',
  'IDPRejectedClaim',
  'AccessDenied',
  'AccessDeniedException',
  'ENOENT',
  'EACCES',
])

type AwsError = { name?: string; code?: string; Code?: string; message?: string } | null

const isRoleRejected = (error: unknown) => {
  const e = error as AwsError
  return [e?.name, e?.code, e?.Code].some((id) => id !== undefined && ROLE_REJECTED.has(id))
}

/** A masked access key for logs (`AKIA****MPLE`); a secret is never logged */
export function maskAccessKey(key: string | undefined): string {
  const trimmed = key?.trim()
  if (!trimmed) return 'unset'
  if (trimmed.length <= 8) return '****'
  return `${trimmed.slice(0, 4)}****${trimmed.slice(-4)}`
}

/**
 * The role first; the env's key pair once STS rejects the role, until the process restarts. Any
 * other failure (network, STS 5xx) goes out as it is: the SDK asks the role again next time.
 */
export function withKeyFallback(
  role: IdentityProvider,
  keys: KeyPair | undefined,
  warn: (message: string) => void = console.warn,
): IdentityProvider {
  if (!keys) return role
  let rejected = false
  return async (props) => {
    if (rejected) return keys
    try {
      return await role(props)
    } catch (error) {
      if (!isRoleRejected(error)) throw error
      rejected = true
      const e = error as AwsError
      warn(
        `[cvp-media] IAM role rejected (${e?.name ?? e?.code ?? 'Error'}: ${e?.message ?? String(error)}). ` +
          `Using AWS_ACCESS_KEY_ID ${maskAccessKey(keys.accessKeyId)} until the next restart.`,
      )
      return keys
    }
  }
}

/**
 * The S3 client's credentials. A role's provider is named outright: the SDK's default chain reads
 * `AWS_ACCESS_KEY_ID` before the web identity, so a pair left in a Secret would win over the role.
 */
export function s3Credentials(config: StorageConfig) {
  switch (config.credentialSource) {
    case 'irsa':
      return withKeyFallback(fromTokenFile({ clientConfig: { region: config.region } }), config.fallbackKeys)
    case 'pod-identity':
      return withKeyFallback(fromHttp(), config.fallbackKeys)
    case 'access-key':
      return config.accessKeyId && config.secretAccessKey
        ? { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey }
        : undefined
    case 'sdk-default':
      return undefined
  }
}

function clientConfig(config: StorageConfig): S3ClientConfig {
  const credentials = s3Credentials(config)
  return {
    region: config.region,
    ...(config.endpoint ? { endpoint: config.endpoint } : {}),
    forcePathStyle: config.forcePathStyle,
    ...(credentials ? { credentials } : {}),
  }
}

/** `child` under `parent`, or null when it would leave it */
function within(parent: string, child: string): string | null {
  const resolved = path.resolve(parent, child)
  return resolved.startsWith(`${parent}${path.sep}`) ? resolved : null
}

const TYPES: Record<string, string> = {
  '.gif': 'image/gif',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.mp4': 'video/mp4',
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webm': 'video/webm',
  '.webp': 'image/webp',
}

/**
 * The disk store: each file at admin/media/<prefix>/<filename>, as S3 would key it. Served by
 * Payload's own file route (`/api/cvp-media/file/<name>?prefix=…`), after its access check.
 */
const diskAdapter: Adapter = ({ collection }) => ({
  name: 'cvp-disk',
  handleUpload: async ({ file, storageFilePath }) => {
    const target = within(MEDIA_DIR, storageFilePath)
    if (!target) throw new Error(`Refusing to store a media file outside admin/media: ${storageFilePath}`)
    await fs.promises.mkdir(path.dirname(target), { recursive: true })
    if (file.tempFilePath) await fs.promises.copyFile(file.tempFilePath, target)
    else await fs.promises.writeFile(target, file.buffer)
  },
  handleDelete: async ({ storageFilePath }) => {
    const target = within(MEDIA_DIR, storageFilePath)
    if (target) await fs.promises.rm(target, { force: true })
  },
  staticHandler: async (req, { doc, params }) => {
    const key = await getStorageFilePath({
      collection,
      collectionPrefix: '',
      doc: doc as never,
      filename: params.filename,
      prefixQueryParam: params.prefix,
      req,
      useCompositePrefixes: true,
    })
    const file = within(MEDIA_DIR, key)
    const body = file ? await fs.promises.readFile(file).catch(() => null) : null
    if (!body) return new Response('Not found', { status: 404 })
    const type = TYPES[path.extname(params.filename).toLowerCase()] ?? 'application/octet-stream'
    return new Response(new Uint8Array(body), {
      headers: {
        'Cache-Control': 'private, max-age=300',
        'Content-Type': type,
        'X-Content-Type-Options': 'nosniff',
        // An SVG is a document that can run script: never as a page of the admin's origin
        ...(type === 'image/svg+xml' ? { 'Content-Security-Policy': "script-src 'none'; sandbox" } : {}),
      },
    })
  },
})

/**
 * The storage plugin: S3 when configured, else the disk adapter. Both keep the `prefix` column
 * (composite: the stored prefix is the file's `<page>/<folder>`, the store's own root goes before
 * it), so switching a deployment from one to the other changes no row.
 */
export function mediaStoragePlugin(): Plugin {
  const config = getStorageConfig()
  if (!config) {
    return cloudStoragePlugin({
      alwaysInsertFields: true,
      useCompositePrefixes: true,
      collections: { [MEDIA_SLUG]: { adapter: diskAdapter, disableLocalStorage: true } },
    })
  }
  return s3Storage({
    enabled: true,
    alwaysInsertFields: true,
    useCompositePrefixes: true,
    bucket: config.bucket,
    ...(config.acl ? { acl: config.acl } : {}),
    // `signedDownloads` per collection: at the root an object entry ignores it (Digital Center's note).
    // An SVG is streamed through Payload rather than redirected, so it keeps the response's headers
    collections: {
      [MEDIA_SLUG]: {
        prefix: s3CollectionPrefix(config),
        signedDownloads: {
          expiresIn: config.signedUrlTtl,
          shouldUseSignedURL: ({ filename }) => !/\.svg$/i.test(filename),
        },
      },
    },
    config: clientConfig(config),
  })
}

let client: S3 | null = null

/** The bytes of a library file (its `prefix` and `filename`), from the disk or the bucket; null when gone */
export async function readStoredFile(doc: { prefix?: unknown; filename?: unknown }): Promise<Buffer | null> {
  const filename = typeof doc.filename === 'string' ? doc.filename : ''
  if (!filename) return null
  const prefix = sanitizePrefix(typeof doc.prefix === 'string' ? doc.prefix : '')
  const config = getStorageConfig()
  if (!config) {
    const file = within(MEDIA_DIR, path.posix.join(prefix, filename))
    return file ? fs.promises.readFile(file).catch(() => null) : null
  }
  client ??= new S3(clientConfig(config))
  try {
    const object = await client.getObject({
      Bucket: config.bucket,
      Key: path.posix.join(s3CollectionPrefix(config), prefix, filename),
    })
    const bytes = await object.Body?.transformToByteArray()
    return bytes ? Buffer.from(bytes) : null
  } catch (error) {
    if ((error as AwsError)?.name === 'NoSuchKey') return null
    throw error
  }
}

/** One line for the start-up log: which store, without reading the environment by hand */
export function storageNote(): string {
  const config = getStorageConfig()
  if (!config) return `[cvp-media] disk (${MEDIA_DIR})`
  const keys =
    config.credentialSource === 'access-key'
      ? ` accessKeyId=${maskAccessKey(config.accessKeyId)}`
      : config.fallbackKeys
        ? ` fallback=${maskAccessKey(config.fallbackKeys.accessKeyId)}`
        : ''
  return (
    `[cvp-media] S3 bucket "${config.bucket}" (${config.endpoint || config.region}) · ` +
    `keys under ${s3CollectionPrefix(config)}/ · creds=${config.credentialSource}${keys} · ` +
    `signed URL ${config.signedUrlTtl}s`
  )
}
