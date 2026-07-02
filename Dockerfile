FROM node:20-bookworm-slim

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY src ./src
COPY scripts ./scripts

RUN chmod +x /app/scripts/start.sh

USER node
EXPOSE 3000

CMD ["/app/scripts/start.sh"]
