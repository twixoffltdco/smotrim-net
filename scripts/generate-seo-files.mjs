#!/usr/bin/env node
import { writeFileSync } from 'node:fs';

const FALLBACK_ORIGIN = 'https://smotrim.tatnet.app';

function normalizeOrigin(value) {
  if (!value) return FALLBACK_ORIGIN;
  const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  return withProtocol.replace(/\/+$/, '');
}

const origin = normalizeOrigin(
  process.env.SITE_ORIGIN
  || process.env.URL
  || process.env.DEPLOY_PRIME_URL
  || process.env.VERCEL_URL
);
const today = new Date().toISOString().slice(0, 10);

const staticPages = [
  { path: '/', priority: '1.0', changefreq: 'daily' },
  { path: '/about.html', priority: '0.5', changefreq: 'monthly' },
  { path: '/contacts.html', priority: '0.4', changefreq: 'monthly' },
  { path: '/terms.html', priority: '0.3', changefreq: 'monthly' },
  { path: '/privacy.html', priority: '0.3', changefreq: 'monthly' },
];

const robotsTxt = `User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /admin/\nDisallow: /*.json$\n\n# Yandex\nUser-agent: Yandex\nAllow: /\nCrawl-delay: 1\nDisallow: /api/\nDisallow: /admin/\n\n# Google\nUser-agent: Googlebot\nAllow: /\nCrawl-delay: 0\n\n# Bing\nUser-agent: Bingbot\nAllow: /\nCrawl-delay: 1\n\nSitemap: ${origin}/sitemap.xml\n`;

const sitemapIndexXml = `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <sitemap>\n    <loc>${origin}/sitemap-main.xml</loc>\n    <lastmod>${today}</lastmod>\n  </sitemap>\n  <sitemap>\n    <loc>${origin}/sitemap-channels.xml</loc>\n    <lastmod>${today}</lastmod>\n  </sitemap>\n  <sitemap>\n    <loc>${origin}/sitemap-iptv.xml</loc>\n    <lastmod>${today}</lastmod>\n  </sitemap>\n</sitemapindex>\n`;

const sitemapMainXml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${staticPages.map(({ path, priority, changefreq }) => `\n  <url>\n    <loc>${origin}${path}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`).join('')}\n\n</urlset>\n`;

writeFileSync('robots.txt', robotsTxt);
writeFileSync('sitemap.xml', sitemapIndexXml);
writeFileSync('sitemap-main.xml', sitemapMainXml);

console.log(`Generated SEO files for: ${origin}`);
