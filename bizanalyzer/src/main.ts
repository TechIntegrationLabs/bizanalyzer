import { Actor } from 'apify';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import Anthropic from '@anthropic-ai/sdk';

// Add stealth to avoid some anti-bot measures
puppeteer.use(StealthPlugin());

// Define the input type for type safety
interface ActorInput {
    url: string;
}

// Define the output type for LLM analysis
interface LLMOutput {
    title?: string;
    businessType?: string;
    observations?: string[];
    error?: string;
    partialText?: string;
    rawText?: string;
    rawLLM?: string;
}

async function main() {
    await Actor.init();

    try {
        // Get and validate input
        const input = await Actor.getInput<ActorInput>();
        if (!input?.url) {
            throw new Error('No "url" provided in the input. Example: {"url": "https://example.com"}');
        }

        console.log(`Scraping URL: ${input.url}`);

        // Launch Puppeteer
        let browser;
        let scrapedText = '';
        try {
            browser = await puppeteer.launch({
                headless: 'new',
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                ],
            });
            const page = await browser.newPage();
            await page.goto(input.url, { waitUntil: 'networkidle0', timeout: 60000 });

            // Extract all visible text
            scrapedText = await page.evaluate(() => {
                const walker = document.createTreeWalker(
                    document.body,
                    NodeFilter.SHOW_TEXT
                );
                let text = '';
                let node;
                while ((node = walker.nextNode())) {
                    if (node.parentElement && node.parentElement.offsetHeight > 0) {
                        text += node.textContent?.trim() + ' ';
                    }
                }
                return text;
            });
        } finally {
            if (browser) {
                await browser.close();
            }
        }

        // Call Anthropic LLM
        let llmOutput: LLMOutput = {};
        const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
        if (!anthropicApiKey) {
            console.warn('No ANTHROPIC_API_KEY found, returning raw text only.');
            llmOutput = { rawText: scrapedText.slice(0, 300) };
        } else {
            const anthropic = new Anthropic({ apiKey: anthropicApiKey });
            const promptContent = `
We scraped this text from the page:

"${scrapedText.slice(0, 10000)}"

Return a valid JSON analyzing the site:
{
  "title": "",
  "businessType": "",
  "observations": []
}
            `;
            try {
                const response = await anthropic.messages.create({
                    model: 'claude-3-opus-20240229',
                    max_tokens: 1024,
                    messages: [{ 
                        role: 'user',
                        content: promptContent
                    }]
                });
                const raw = response.content[0].text;
                try {
                    llmOutput = JSON.parse(raw);
                } catch {
                    llmOutput = { rawLLM: raw };
                }
            } catch (err) {
                const error = err as Error;
                console.error('Anthropic error:', error);
                llmOutput = { error: error.message, partialText: scrapedText.slice(0, 300) };
            }
        }

        // Store the final result
        console.log('LLM Output:', llmOutput);
        await Actor.pushData(llmOutput);
        
    } catch (err) {
        console.error(err);
        throw err;
    } finally {
        await Actor.exit();
    }
}

// Run the actor
await main();