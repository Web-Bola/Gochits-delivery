const base = process.env.NEXT_PUBLIC_BASE_PATH || '';
/** Static export (works on any file host, e.g. GitHub Pages). `pnpm dev` is unaffected. */
const config = { reactStrictMode: true, ...(process.env.STATIC_EXPORT ? { output: 'export', trailingSlash: true, images: { unoptimized: true } } : {}), basePath: base || undefined };
export default config;
