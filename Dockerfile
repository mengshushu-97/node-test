FROM harbor.local/library/node:20-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json .npmrc ./
RUN npm ci --omit=dev

COPY src ./src
COPY scripts ./scripts

RUN chmod +x /app/scripts/start.sh

USER node
EXPOSE 3000

CMD ["/app/scripts/start.sh"]
