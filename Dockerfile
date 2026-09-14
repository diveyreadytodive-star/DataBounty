FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY server/package.json server/package.json
COPY app/package.json app/package.json
RUN npm ci
COPY . .
ARG VITE_DRAFTPROOF_PACKAGE_ID=0xca75e449585b717ae2f7ae7bb9902a89873087fdc51f4639349a9b98cee019c3
ARG VITE_SEAL_KEY_SERVER_IDS=0xb012378c9f3799fb5b1a7083da74a4069e3c3f1c93de0b27212a5799ce1e1e98
ARG VITE_SEAL_AGGREGATOR_URL=https://seal-aggregator-testnet.mystenlabs.com
ARG VITE_WALRUS_AGGREGATOR_URL=https://aggregator.walrus-testnet.walrus.space
ENV VITE_DRAFTPROOF_PACKAGE_ID=${VITE_DRAFTPROOF_PACKAGE_ID} \
    VITE_SEAL_KEY_SERVER_IDS=${VITE_SEAL_KEY_SERVER_IDS} \
    VITE_SEAL_AGGREGATOR_URL=${VITE_SEAL_AGGREGATOR_URL} \
    VITE_WALRUS_AGGREGATOR_URL=${VITE_WALRUS_AGGREGATOR_URL}
RUN npm run build

FROM node:24-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/server ./server
COPY --from=build /app/app ./app
RUN mkdir -p /data
VOLUME ["/data"]
EXPOSE 3000
CMD ["node", "server/dist/index.js"]
