// Load environment variables from .env file in development
import 'dotenv/config';

// Apify SDK - toolkit for building Apify Actors
import { Actor } from 'apify';
// Web scraping and browser automation library
import { PuppeteerCrawler, Request, Configuration, ProxyConfiguration } from 'crawlee';
import { router } from './routes.js';

// The init() call configures the Actor for its environment. 
await Actor.init();

// Define our input interface matching input_schema.json
interface Input {
    startUrls: Request[];
    maxPagesToCrawl?: number;
    includeScreenshots?: boolean;
}

// Get and validate input with defaults
const {
    startUrls = [],
    maxPagesToCrawl = 1,
    includeScreenshots = false,
} = await Actor.getInput<Input>() ?? {};

// Validate input
if (!startUrls.length) {
    throw new Error('At least one URL must be provided in the startUrls array');
}

// Validate required environment variables
const anthropicApiKey = await Actor.getEnv().ANTHROPIC_API_KEY;
if (!anthropicApiKey) {
    throw new Error('ANTHROPIC_API_KEY must be set in actor secrets');
}

// Create a proxy configuration that will rotate proxies from Apify Proxy
const proxyConfiguration = await Actor.createProxyConfiguration({
    // Optional custom configuration
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
    
    // Configure how the browser should be launched
    launchContext: {
        launchOptions: {
            headless: true, // Run in headless mode
            args: [
                '--disable-gpu', // Mitigates GPU crashes in Docker
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage', // Prevents out of memory errors
                '--disable-accelerated-2d-canvas',
                '--disable-web-security', // Allows cross-origin requests
                '--disable-features=IsolateOrigins,site-per-process', // Helps with frames
            ],
            defaultViewport: {
                width: 1920,
                height: 1080,
            },
        },
    },

    // Configure browser pool
    browserPoolOptions: {
        maxOpenPagesPerBrowser: 1, // Limit pages per browser for stability
        retireInstanceAfterRequestCount: 50, // Retire browser after 50 requests
    },

    // Configure how to handle failed requests
    maxRequestRetries: 3,
    requestHandlerTimeoutSecs: 90,
    navigationTimeoutSecs: 60,

    // Automatically handle browser errors
    browserCrashHandler: async ({ page, requestQueue, session }) => {
        // Implement custom crash handling if needed
        console.log('Browser crashed, request will be retried automatically');
    },
});

// Add event handlers for the crawler
crawler.on('sessionFailed', () => {
    console.log('Session failed, will be retried with a new proxy');
});

// Store the crawler configuration in the actor state
// This is useful for debugging and monitoring
await Actor.setValue('crawlerConfig', {
    maxPagesToCrawl,
    includeScreenshots,
    proxyConfig: proxyConfiguration?.toString(),
    startTime: new Date().toISOString(),
});

try {
    // Run the crawler with the start URLs
    await crawler.run(startUrls);
} catch (error) {
    // Log any errors that occurred during the crawl
    console.error('Crawler failed:', error);
    throw error;
} finally {
    // Store final statistics
    await Actor.setValue('stats', {
        endTime: new Date().toISOString(),
        pagesProcessed: crawler.stats.state.requestsFinished,
        errors: crawler.stats.state.requestsFailed,
    });
}

// Gracefully exit the Actor process
await Actor.exit();