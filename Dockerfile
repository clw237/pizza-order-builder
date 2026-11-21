# One image for both apps; compose.yaml picks the command. Pinned by digest so a rebuild gets the
# same Node (22.23.5) and OS packages.
FROM node:22-bookworm-slim@sha256:e9f565d32859f0cbfb52125eafe8be39390f24dac302dc3cdf566e8ba3ab21ee

WORKDIR /app
RUN chown node:node /app
USER node

# Manifests first, so editing source doesn't re-run npm ci.
COPY --chown=node:node package.json package-lock.json ./
COPY --chown=node:node packages/pricing/package.json packages/pricing/
COPY --chown=node:node apps/service/package.json apps/service/
COPY --chown=node:node apps/web/package.json apps/web/
RUN npm ci --no-audit --no-fund

COPY --chown=node:node . .
