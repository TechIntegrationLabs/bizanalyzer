// For local development environment variables
import 'dotenv/config';

// Core imports
import { Actor } from 'apify';
import { PuppeteerCrawler } from 'crawlee';
import { router } from './routes.js';
import { ActorInput, ActorResult } from './types.js';

// Initialize the Actor
await Actor.init();

// Get and validate input with defaults
const {
    startUrls = [],
    maxPagesToCrawl = 1,
    includeScreenshots = false,
} = await Actor.getInput<ActorInput>() ?? {};

// Validate input
if (!startUrls.length) {
    throw new Error('At least one URL must be provided in the startUrls array');
}

// Validate required environment variables
if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY must be set in actor secrets');
}

// Create a proxy configuration
const proxyConfiguration = await Actor.createProxyConfiguration({
    groups: ['RESIDENTIAL'], // Use residential proxy group
    countryCode: 'US',      // Use US proxies
});

// Configure the crawler
const crawler = new PuppeteerCrawler({
    // Use the proxy configuration
    proxyConfiguration,
    
    // Maximum number of pages to process
    maxRequestsPerCrawl: maxPagesToCrawl,
    
    // Use our router for handling requests
    requestHandler: router,
    
    // Configure browser launch
    launchContext: {
        launchOptions: {
            headless: true,
            args: [
                '--disable-gpu',
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--disable-web-security',
                '--disable-features=IsolateOrigins,site-per-process',
            ],
            defaultViewport: {
                width: 1920,
                height: 1080,
            },
        },
    },

    // Browser pool configuration
    browserPoolOptions: {
        maxOpenPagesPerBrowser: 1,  // Limit pages per browser for stability
    },

    // Configure how to handle failed requests
    maxRequestRetries: 3,
    requestHandlerTimeoutSecs: 90,
    navigationTimeoutSecs: 60,
});

// Store initial configuration in the actor state
await Actor.setValue('config', {
    maxPagesToCrawl,
    includeScreenshots,
    proxyConfig: proxyConfiguration?.toString(),
    startTime: new Date().toISOString(),
    startUrls: startUrls.map(u => u.url),
});

try {
    // Convert input URLs to the format crawler expects
    const crawlerUrls = startUrls.map(({ url }) => url);
    
    // Run the crawler
    await crawler.run(crawlerUrls);

    // Store final success state
    const result: ActorResult = {
        status: 'SUCCEEDED',
        pagesProcessed: crawler.stats.state.requestsFinished,
        errors: crawler.stats.state.requestsFailed,
        endTime: new Date().toISOString(),
        totalPagesCrawled: crawler.stats.state.requestsFinished,
        failedRequests: crawler.stats.state.requestsFailed,
        retries: crawler.stats.state.requestRetries,
        crawlingTime: Date.now() - new Date((await Actor.getValue<{ startTime: string }>('config'))?.startTime || Date.now()).getTime(),
    };
    await Actor.setValue('CRAWLER_RESULT', result);

} catch (error) {
    // Store error state
    const result: ActorResult = {
        status: 'FAILED',
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        pagesProcessed: crawler.stats.state.requestsFinished,
        errors: crawler.stats.state.requestsFailed,
        endTime: new Date().toISOString(),
        totalPagesCrawled: crawler.stats.state.requestsFinished,
        failedRequests: crawler.stats.state.requestsFailed,
        retries: crawler.stats.state.requestRetries,
    };
    await Actor.setValue('CRAWLER_RESULT', result);
    
    throw error;
} finally {
    // Store final statistics
    await Actor.setValue('stats', {
        endTime: new Date().toISOString(),
        pagesProcessed: crawler.stats.state.requestsFinished,
        errors: crawler.stats.state.requestsFailed,
        retries: crawler.stats.state.requestRetries,
    });
}

// Exit gracefully
await Actor.exit();