// Next.js rules (React, hooks, accessibility via jsx-a11y, Core Web Vitals) for the site's code.
import next from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

const config = [
  { ignores: ['.next/**', 'out/**', 'public/**', '.cache/**', 'next-env.d.ts', '.source/**'] },
  ...next,
  ...nextTs,
  {
    rules: {
      // Data from the contract and the validator's report is untyped JSON.
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
];

export default config;
