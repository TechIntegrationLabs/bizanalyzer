FROM apify/actor-node:20

# Copy package.json and package-lock.json to the working directory
COPY package*.json ./

# Install NPM packages
RUN npm install --include=dev

# Copy source code
COPY . ./

# Build TypeScript code
RUN npm run build

# Run the actor
CMD npm run start