FROM node:18-alpine AS builder
WORKDIR /bot
RUN apk add --no-cache python3 g++ make
COPY . .
RUN npm ci
RUN npm run build
RUN npm prune --production
RUN apk del python3 g++ make && rm -rf /var/cache/apk/*

FROM node:18-alpine AS runner
WORKDIR /bot
COPY --from=builder /bot/node_modules ./node_modules
COPY --from=builder /bot/dist ./
VOLUME /bot/botInfo

CMD [ "node", "entry.js" ]
