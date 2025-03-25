const fetch = require('node-fetch');
const xml2js = require('xml2js');

const parser = new xml2js.Parser({ explicitArray: false });

/**
 * Fetches and parses an XML sitemap
 * @param {string} sitemapUrl - URL of the sitemap to fetch
 * @returns {Promise<Object>} - Parsed sitemap data
 */
async function fetchSitemap(sitemapUrl) {
  try {
    console.log(`Fetching sitemap: ${sitemapUrl}`);
    const response = await fetch(sitemapUrl);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch sitemap: ${response.status} ${response.statusText}`);
    }
    
    const xmlContent = await response.text();
    const result = await parser.parseStringPromise(xmlContent);
    return result;
  } catch (error) {
    console.error(`Error fetching sitemap ${sitemapUrl}: ${error.message}`);
    throw error;
  }
}

/**
 * Extracts sitemap URLs from a sitemap index
 * @param {Object} sitemapIndex - Parsed sitemap index
 * @returns {Array<string>} - List of sitemap URLs
 */
function extractSitemapsFromIndex(sitemapIndex) {
  if (!sitemapIndex || !sitemapIndex.sitemapindex || !sitemapIndex.sitemapindex.sitemap) {
    return [];
  }
  
  const sitemaps = Array.isArray(sitemapIndex.sitemapindex.sitemap) 
    ? sitemapIndex.sitemapindex.sitemap 
    : [sitemapIndex.sitemapindex.sitemap];
  
  return sitemaps.map(sitemap => sitemap.loc);
}

/**
 * Extracts page URLs from a sitemap
 * @param {Object} sitemap - Parsed sitemap
 * @returns {Array<string>} - List of page URLs
 */
function extractUrlsFromSitemap(sitemap) {
  if (!sitemap || !sitemap.urlset || !sitemap.urlset.url) {
    return [];
  }
  
  const urls = Array.isArray(sitemap.urlset.url) 
    ? sitemap.urlset.url 
    : [sitemap.urlset.url];
  
  return urls.map(url => url.loc);
}

/**
 * Collects all page URLs from a sitemap index
 * @param {string} sitemapIndexUrl - URL of the sitemap index
 * @param {number} maxPages - Maximum number of pages to collect (optional)
 * @returns {Promise<Array<string>>} - List of all page URLs
 */
async function collectPagesFromSitemapIndex(sitemapIndexUrl, maxPages = Infinity) {
  try {
    // Fetch the sitemap index
    const sitemapIndex = await fetchSitemap(sitemapIndexUrl);
    
    // Extract sitemap URLs from the index
    const sitemapUrls = extractSitemapsFromIndex(sitemapIndex);
    
    if (sitemapUrls.length === 0) {
      console.warn('No sitemaps found in the sitemap index');
      // Check if the "index" is actually a regular sitemap
      const urls = extractUrlsFromSitemap(sitemapIndex);
      return urls.slice(0, maxPages);
    }
    
    console.log(`Found ${sitemapUrls.length} sitemaps in the index`);
    
    // Process each sitemap and collect URLs
    const allPages = [];
    for (const sitemapUrl of sitemapUrls) {
      if (allPages.length >= maxPages) {
        break;
      }
      
      try {
        const sitemap = await fetchSitemap(sitemapUrl);
        const urls = extractUrlsFromSitemap(sitemap);
        console.log(`Found ${urls.length} URLs in sitemap ${sitemapUrl}`);
        
        // Add unique URLs to the collection
        for (const url of urls) {
          if (!allPages.includes(url)) {
            allPages.push(url);
            if (allPages.length >= maxPages) {
              break;
            }
          }
        }
      } catch (error) {
        console.error(`Error processing sitemap ${sitemapUrl}: ${error.message}`);
        // Continue with next sitemap
      }
      
      // Add a small delay between requests to be nice to the server
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log(`Collected a total of ${allPages.length} unique URLs`);
    return allPages;
    
  } catch (error) {
    console.error(`Failed to collect pages from sitemap index: ${error.message}`);
    return [];
  }
}

module.exports = {
  collectPagesFromSitemapIndex
}; 