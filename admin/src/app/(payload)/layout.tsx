/* THIS FILE WAS GENERATED AUTOMATICALLY BY PAYLOAD. */
/* Changed from the generated file: the shell's stylesheets and the Google Fonts links below. */
import config from '@payload-config'
import '@payloadcms/next/css'
import type { ServerFunctionClient } from 'payload'
import { handleServerFunctions, RootLayout } from '@payloadcms/next/layouts'
import React from 'react'

import { importMap } from './admin/importMap.js'
import './shell.scss'
import './payload-collections.scss'

/**
 * Be Vietnam Pro, the admin's one typeface (see `--gg-font` in shell.scss), straight from Google
 * Fonts: weights 400–700, every subset Google serves for it (vietnamese included, picked per
 * glyph by `unicode-range`).
 */
const GOOGLE_FONTS =
  'https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700&display=swap'

type Args = {
  children: React.ReactNode
}

const serverFunction: ServerFunctionClient = async function (args) {
  'use server'
  return handleServerFunctions({
    ...args,
    config,
    importMap,
  })
}

// React 19 hoists these <link>s into <head>; Payload's RootLayout renders the document itself, so
// there is no <head> of ours to put them in
const Layout = ({ children }: Args) => (
  <RootLayout config={config} importMap={importMap} serverFunction={serverFunction}>
    <link href="https://fonts.googleapis.com" rel="preconnect" />
    <link crossOrigin="" href="https://fonts.gstatic.com" rel="preconnect" />
    <link href={GOOGLE_FONTS} precedence="default" rel="stylesheet" />
    {children}
  </RootLayout>
)

export default Layout
