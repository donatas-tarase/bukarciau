// Public paths are code, never editable content.
export const CAMP_SLUG = 'moteru-savaitgalio-stovykla';
export const LEGACY_CAMP_SLUG = 'stovykla-01';
export const CAMP_PATH = `/stovyklos/${CAMP_SLUG}/`;
export const LEGACY_CAMP_PATH = `/stovyklos/${LEGACY_CAMP_SLUG}/`;
export const PAGE_ROUTES = Object.freeze({home: '/', about: '/apie-mus/', contact: '/kontaktai/', camp: CAMP_PATH});
export const SITEMAP_PATHS = Object.freeze(Object.values(PAGE_ROUTES));
export const PAGE_PATHS = Object.freeze([...SITEMAP_PATHS, '/404.html']);

const aliases = (path, status) => Object.fromEntries([path.slice(0, -1), `${path}index.html`].map(alias => [alias, {path, status}]));
const legacyCampAliases = path => Object.fromEntries([path.slice(0, -1), path, `${path}index.html`].map(alias => [alias, {path: CAMP_PATH, status: 301}]));
export const ROUTE_REDIRECTS = Object.freeze({
  '/index.html': {path: '/', status: 308},
  ...aliases(PAGE_ROUTES.about, 308), ...aliases(PAGE_ROUTES.contact, 308), ...aliases(CAMP_PATH, 308),
  ...legacyCampAliases(LEGACY_CAMP_PATH), ...legacyCampAliases('/stovyklos/stovykla-02/')
});

export function canonicalPagePath(pathname) {
  const path = String(pathname || '/').split(/[?#]/, 1)[0];
  if (PAGE_PATHS.includes(path)) return path;
  return Object.hasOwn(ROUTE_REDIRECTS, path) ? ROUTE_REDIRECTS[path].path : null;
}

// Rewrite only retired camp destinations on this site. Other user URLs retain
// their exact value and still pass through the content schema's URL validation.
export function canonicalContentLink(value) {
  if (typeof value !== 'string' || /[\u0000-\u001f\u007f\\]/u.test(value)) return value;
  const local = value.startsWith('/') && !value.startsWith('//');
  if (!local && !/^https:\/\//i.test(value)) return value;
  try {
    const url = new URL(value, 'https://bukarciau.lt');
    if (url.origin !== 'https://bukarciau.lt' || url.username || url.password) return value;
    const redirect = Object.hasOwn(ROUTE_REDIRECTS, url.pathname) ? ROUTE_REDIRECTS[url.pathname] : null;
    if (!redirect || redirect.status !== 301 || redirect.path !== CAMP_PATH) return value;
    url.pathname = CAMP_PATH;
    return local ? `${url.pathname}${url.search}${url.hash}` : url.href;
  } catch { return value; }
}
