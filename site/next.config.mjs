import path from 'node:path';
import { createMDX } from 'fumadocs-mdx/next';

// SITE_URL is the public URL, path included; its path becomes the base path.
const base = new URL(process.env.SITE_URL || 'https://brazilian-utils.github.io/api-validator').pathname.replace(/\/$/, '');

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
