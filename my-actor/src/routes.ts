import { Dataset, createPuppeteerRouter } from 'crawlee';
import { Actor } from 'apify';
import Anthropic from '@anthropic-ai/sdk';

// Define our analysis output type
interface BusinessAnalysis {
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

// Initialize Anthropic client
const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY!,
});

// Helper function to analyze text with Claude
async function analyzeWithClaude(text: string): Promise<BusinessAnalysis> {
    const prompt = `
Analyze this business website text and extract key information. 
Website text: "${text.slice(0, 15000)}"

Return a JSON object with:
- title: The business name/title
- businessType: The type/category of business
- observations: Key observations about their offerings, approach, or unique aspects
- contactInfo: Any contact information found (email, phone, address)
- socialMedia: Any social media links found

Format the response as valid parseable JSON.`;

    const response = await anthropic.messages.create({
        model: 'claude-3-sonnet-20240229',
        max_tokens: 1024,
        temperature: 0.5,
        system: "You are an expert at analyzing business websites and extracting key information. Always return valid JSON.",
        messages: [
            {
                role: 'user',
                content: prompt,
            }
        ]
    });

    try {
        return JSON.parse(response.content[0].text) as BusinessAnalysis;
    } catch (e) {
        console.error('Failed to parse Claude response:', e);
        throw new Error('Failed to parse Claude analysis');
    }
}

// Create and export the router
export const router = createPuppeteerRouter();

// Add the default handler for processing business pages
router.addDefaultHandler(async ({ page, request, log, enqueueLinks }) => {
    // First, enqueue all links from the same domain for crawling
    await enqueueLinks({
        globs: [`${new URL(request.url).origin}/*`], // Only follow links from same domain
        transformRequestFunction: (req) => {
            // Exclude common file types we don't want to crawl
            if (req.url.match(/\.(jpg|jpeg|png|gif|pdf|doc|docx|zip)$/i)) {
                return false;
            }
            return req;
        }
    });
    log.info(`Processing ${request.url}...`);

    // Wait for content to load
    await page.waitForNetworkIdle();

    // Extract all visible text
    const text = await page.evaluate(() => {
        const walker = document.createTreeWalker(
            document.body,
            NodeFilter.SHOW_TEXT,
            {
                acceptNode: (node) => {
                    // Only accept visible text nodes
                    const element = node.parentElement;
                    if (!element) return NodeFilter.FILTER_REJECT;
                    
                    const style = window.getComputedStyle(element);
                    const isVisible = style.display !== 'none' && 
                                    style.visibility !== 'hidden' &&
                                    style.opacity !== '0';
                    
                    return isVisible ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
                }
            }
        );

        let text = '';
        let node;
        while ((node = walker.nextNode())) {
            const trimmed = node.textContent?.trim();
            if (trimmed) {
                text += trimmed + ' ';
            }
        }
        return text;
    });

    try {
        // Analyze with Claude
        const analysis = await analyzeWithClaude(text);
        
        // Capture screenshot if enabled
        let screenshot;
        if (Actor.getInput<Input>()?.includeScreenshots) {
            screenshot = await page.screenshot({
                type: 'jpeg',
                quality: 80,
                fullPage: true
            });
            // Save screenshot to key-value store
            const screenshotKey = `screenshot-${request.id}`;
            await Actor.setValue(screenshotKey, screenshot, { contentType: 'image/jpeg' });
        }

        // Push the results to the dataset
        await Dataset.pushData({
            url: request.url,
            analysis,
            timestamp: new Date().toISOString(),
            screenshotId: screenshot ? request.id : undefined
        });

        log.info('Successfully analyzed page', { url: request.url });
    } catch (error) {
        log.error('Failed to analyze page', { url: request.url, error: (error as Error).message });
        throw error;
    }
});