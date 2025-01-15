# Builder stage
FROM apify/actor-node-puppeteer-chrome:20 AS builder

# Check preinstalled packages
RUN npm ls crawlee apify puppeteer playwright

# Copy package files
COPY --chown=myuser package*.json ./

# Install all dependencies including dev dependencies
RUN npm install --include=dev --audit=false

# Copy source files
COPY --chown=myuser . ./

# Build TypeScript project
RUN npm run build

# Final stage
FROM apify/actor-node-puppeteer-chrome:20

# Check preinstalled packages
RUN npm ls crawlee apify puppeteer playwright

# Copy package files
COPY --chown=myuser package*.json ./

# Install production dependencies
# Note: @anthropic-ai/sdk is required in production
RUN npm --quiet set progress=false \
    && npm install --omit=dev --omit=optional \
    && echo "Installed NPM packages:" \
    && (npm list --omit=dev --all || true) \
    && echo "Node.js version:" \
    && node --version \
    && echo "NPM version:" \
    && npm --version \
    && rm -r ~/.npm

# Copy built files from builder
COPY --from=builder --chown=myuser /home/myuser/dist ./dist

# Copy remaining source files
COPY --chown=myuser . ./

# Health check to ensure Chrome is available
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD node -e "const p=require('puppeteer');(async () => { const b = await p.launch(); await b.close(); })()"

# Run with XVFB for headful capability
CMD ./start_xvfb_and_run_cmd.sh && npm run start:prod --silent