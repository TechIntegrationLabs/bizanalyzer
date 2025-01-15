import { ApifyEnv } from 'apify';

// Extend ApifyEnv to include our custom environment variables
declare module 'apify' {
    interface ApifyEnv {
        ANTHROPIC_API_KEY: string;
    }
}

// Define our input interface
export interface ActorInput {
    startUrls: Array<{ url: string }>;
    maxPagesToCrawl?: number;
    includeScreenshots?: boolean;
}