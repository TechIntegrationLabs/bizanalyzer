FROM apify/actor-node-puppeteer-chrome:20 AS builder

# Add build argument for monorepo support
ARG ACTOR_PATH_IN_DOCKER_CONTEXT

# Copy package files
COPY --chown=myuser ${ACTOR_PATH_IN_DOCKER_CONTEXT}package*.json ./

# Install all dependencies
RUN npm install --include=dev --audit=false

# Copy source files using the build argument
COPY --chown=myuser ${ACTOR_PATH_IN_DOCKER_CONTEXT} ./

# Build TypeScript project
RUN npm run build

# Final image
FROM apify/actor-node-puppeteer-chrome:20

# Add build argument for monorepo support in final stage
ARG ACTOR_PATH_IN_DOCKER_CONTEXT

# Copy package files
COPY --chown=myuser ${ACTOR_PATH_IN_DOCKER_CONTEXT}package*.json ./

# Install production dependencies
RUN npm --quiet set progress=false \
    && npm install --omit=dev --omit=optional

# Copy built files from builder
COPY --from=builder --chown=myuser /home/myuser/dist ./dist

# Set up entry point
RUN echo "import('./dist/main.js');" > main.js

# Set environment variable
ARG ANTHROPIC_API_KEY
ENV ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}

# Run the actor
CMD npm run start:prod