// For local development environment variables
import 'dotenv/config';

// Core imports
import { Actor } from 'apify';
import { PuppeteerCrawler } from 'crawlee';
import { router } from './routes.js';

// Initialize the Actor
await Actor.init();

// Define our input interface matching input_schema.json
interface Input {
    startUrls: Array<{ url: string }>;
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

// Create a proxy configuration
const proxyConfiguration = await Actor.createProxyConfiguration({
    groups: ['RESIDENTIAL'], // Use residential proxy group
    countryCode: 'US',      // Use US proxies
});

// Configure the crawler
const crawler = new PuppeteerCrawler({
    proxyConfiguration,
    maxRequestsPerCrawl: maxPagesToCrawl,
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
            ],
            defaultViewport: {
                width: 1920,
                height: 1080,
            },
        },
    },

    // Browser pool configuration
    browserPoolOptions: {
        maxOpenPagesPerBrowser: 1,
        retireInstanceAfterRequestCount: 50,
    },

    // Request handling configuration
    maxRequestRetries: 3,
    requestHandlerTimeoutSecs: 90,
    navigationTimeoutSecs: 60,
});

// Store initial configuration
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
    await Actor.setValue('CRAWLER_RESULT', {
        status: 'SUCCEEDED',
        pagesProcessed: crawler.stats.state.requestsFinished,
        errors: crawler.stats.state.requestsFailed,
        endTime: new Date().toISOString(),
    });
} catch (error) {
    // Store error state
    await Actor.setValue('CRAWLER_RESULT', {
        status: 'FAILED',
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        pagesProcessed: crawler.stats.state.requestsFinished,
        errors: crawler.stats.state.requestsFailed,
        endTime: new Date().toISOString(),
    });
    
    throw error;
}

// Exit gracefully
await Actor.exit();