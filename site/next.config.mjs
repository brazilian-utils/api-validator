import path from 'node:path';
import { createMDX } from 'fumadocs-mdx/next';

// SITE_URL is the public (canonical) URL, path included; its path becomes the base path. Vercel
// serves every deployment at the root of its own domain, so there the base path is empty; the
// canonical links still point at SITE_URL.
const base = process.env.VERCEL ? '' : new URL(process.env.SITE_URL || 'https://brazilian-utils.github.io/doc').pathname.replace(/\/$/, '');

/** @type {import('next').NextConfig} */
const config = {
  output: 'export',
  trailingSlash: true,
  basePath: base || undefined,
  images: { unoptimized: true },
  env: { NEXT_PUBLIC_BASE: base },
  turbopack: { root: path.resolve('.') },
  experimental: { globalNotFound: true },
};

export default createMDX()(config);
