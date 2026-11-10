FROM node:20-bookworm-slim
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY . .
RUN npm run build
ENV NODE_ENV=production
EXPOSE 3000
# Applies migrations and DB constraints on every start (both are idempotent), then serves the app.
CMD ["sh", "-c", "npx prisma migrate deploy && npm run db:constraints && npm start"]
