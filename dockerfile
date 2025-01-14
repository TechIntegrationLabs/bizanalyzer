FROM apify/actor-node:20

# Set the working directory
WORKDIR /usr/src/app

# Copy package.json and package-lock.json (if it exists)
COPY package*.json ./

# Install NPM packages
RUN npm install --include=dev

# Copy source code
COPY . .

# Build TypeScript code
RUN npm run build

# Run the actor
CMD npm run start