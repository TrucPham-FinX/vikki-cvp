import path from 'path'

/**
 * The vikki-cvp checkout the admin reads and publishes into: CVP_REPO_ROOT, else the folder above
 * admin/ (npm scripts, `next dev` and `payload run` all start in admin/).
 */
export function repoRoot(): string {
  return path.resolve(process.env.CVP_REPO_ROOT || path.resolve(process.cwd(), '..'))
}

export function repoPaths(root = repoRoot()) {
  return {
    root,
    /** The JSON the build renders (front-end/build.js, DATA) */
    data: path.join(root, 'front-end', 'data'),
    /** One folder of .hbs templates per page */
    pages: path.join(root, 'front-end', 'pages'),
    build: path.join(root, 'front-end', 'build.js'),
    /** What the CDN serves */
    output: path.join(root, 'vikki-cvp'),
    validate: path.join(root, 'core', 'validate.js'),
    manifest: path.join(root, 'core', 'manifest.js'),
  }
}

export type RepoPaths = ReturnType<typeof repoPaths>
