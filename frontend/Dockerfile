FROM node:22-alpine

# The npm bundled with the base image ships dependencies with known HIGH CVEs
# (brace-expansion, pacote, sigstore...). npm 12 carries fixed versions.
RUN npm install -g npm@12.1.0 --no-audit --no-fund

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .

# Non-root runtime user: vite writes its dep cache under /app/node_modules/.vite.
RUN chown -R node:node /app
USER node

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
