FROM node:20-bookworm-slim
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
# SECURITY FIX (vibeguard #12): the app runs as the unprivileged `node` user that the base image already provides,
# not as root, so a flaw in the app can not act with root rights inside the container.
WORKDIR /app
RUN chown node:node /app
ENV NEXT_TELEMETRY_DISABLED=1
USER node
# `npm ci` installs exactly what package-lock.json says (the lockfile is committed).
COPY --chown=node:node package.json package-lock.json ./
RUN npm ci
COPY --chown=node:node . .
RUN npm run build
ENV NODE_ENV=production
EXPOSE 3000
# Applies migrations and DB constraints on every start (both are idempotent), then serves the app.
CMD ["sh", "-c", "npx prisma migrate deploy && npm run db:constraints && npm start"]
