// Input type for the actor
export interface ActorInput {
    startUrls: Array<{ url: string }>;
    maxPagesToCrawl?: number;
    includeScreenshots?: boolean;
}

// Business analysis result type
export interface BusinessAnalysis {
    title: string;
    businessType: string;
    observations: string[];
    contactInfo?: {
        email?: string;
        phone?: string;
        address?: string;
    };
    socialMedia?: {
        [platform: string]: string;
    };
}

// Dataset item type
export interface DatasetItem {
    url: string;
    analysis: BusinessAnalysis;
    timestamp: string;
    screenshotId?: string;
}

// Actor result type
export interface ActorResult {
    status: 'SUCCEEDED' | 'FAILED';
    error?: string;
    pagesProcessed: number;
    errors: number;
    endTime: string;
    totalPagesCrawled: number;
    failedRequests: number;
    retries: number;
    crawlingTime?: number;
}