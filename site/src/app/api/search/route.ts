// The search index, written once at build time (static export) and searched in the browser.
import { createI18nSearchAPI } from 'fumadocs-core/search/server';
import { i18n } from '@/lib/source';
import { searchIndexes } from '@/lib/search-index';

export const revalidate = false;

export const { staticGET: GET } = createI18nSearchAPI('simple', { i18n, indexes: searchIndexes() });
