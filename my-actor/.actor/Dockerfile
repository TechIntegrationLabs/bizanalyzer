# Builder stage
FROM apify/actor-node-puppeteer-chrome:20 AS builder

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

# Copy package files
COPY --chown=myuser package*.json ./

# Install production dependencies
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

# IMPORTANT: Create a main.js file that requires our compiled TypeScript
RUN echo "import('./dist/main.js');" > main.js

# Run the actor
CMD npm run start:prod