#!/usr/bin/env node
import { writeFileSync } from 'node:fs';

const FALLBACK_ORIGIN = 'https://smotrim.net';
const STREAM_API = 'https://aqeleulwobgamdffkfri.supabase.co/functions/v1/public-channels';
const IPTV_CHANNELS_API = 'https://iptv-org.github.io/api/channels.json';
const ALLOWED_OWNERS = ['oinktech', 'Twixoff', 'ТВКАНАЛЫ'];

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
  { path: '/tv', priority: '0.9', changefreq: 'daily' },
  { path: '/radio', priority: '0.9', changefreq: 'daily' },
  { path: '/iptv', priority: '0.9', changefreq: 'daily' },
  { path: '/embed.html', priority: '0.7', changefreq: 'weekly' },
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

function slugify(str = '') {
  return str.toLowerCase()
    .replace(/[а-яёА-ЯЁ]/g, ch => ({'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ё':'yo','ж':'zh','з':'z','и':'i','й':'y','к':'k','л':'l','м':'m','н':'n','о':'o','п':'p','р':'r','с':'s','т':'t','у':'u','ф':'f','х':'h','ц':'ts','ч':'ch','ш':'sh','щ':'sch','ъ':'','ы':'y','ь':'','э':'e','ю':'yu','я':'ya'}[ch] || ch))
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function buildChannelsSitemap() {
  let channels = [];
  let page = 1;
  try {
    while (page <= 20) {
      const res = await fetch(`${STREAM_API}?page=${page}&limit=100`);
      const json = await res.json();
      channels = channels.concat(json.data || []);
      if (page >= (json.pagination?.total_pages || 1)) break;
      page += 1;
    }
  } catch (error) {
    console.warn('Channel sitemap fallback (network error):', error.message);
  }
  const filtered = channels.filter(ch => ALLOWED_OWNERS.some(owner => owner.toLowerCase() === (ch.owner?.username || '').toLowerCase()));
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${filtered.map(ch => `  <url>\n    <loc>${origin}/watch/${encodeURIComponent(slugify(ch.title || ch.id || 'channel'))}</loc>\n    <lastmod>${(ch.updated_at || '').slice(0, 10) || today}</lastmod>\n    <changefreq>always</changefreq>\n    <priority>0.8</priority>\n  </url>`).join('\n')}\n</urlset>\n`;
  writeFileSync('sitemap-channels.xml', xml);
  return filtered.length;
}

async function buildIptvSitemap() {
  let list = [];
  try {
    const res = await fetch(IPTV_CHANNELS_API);
    const channels = await res.json();
    list = (channels || []).slice(0, 5000);
  } catch (error) {
    console.warn('IPTV sitemap fallback (network error):', error.message);
  }
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${list.map(ch => `  <url>\n    <loc>${origin}/iptv/${encodeURIComponent(slugify(ch.name || ch.id || 'iptv'))}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.6</priority>\n  </url>`).join('\n')}\n</urlset>\n`;
  writeFileSync('sitemap-iptv.xml', xml);
  return list.length;
}

const streamCount = await buildChannelsSitemap();
const iptvCount = await buildIptvSitemap();

console.log(`Generated SEO files for: ${origin}`);
console.log(`Channels: ${streamCount}, IPTV: ${iptvCount}`);
