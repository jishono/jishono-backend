FROM node:22-alpine

RUN addgroup -S app && adduser -S app -G app

WORKDIR /usr/src/app

COPY --chown=app:app package*.json ./
RUN npm ci --omit=dev

COPY --chown=app:app . .

USER app

EXPOSE 3001
CMD ["node", "server.js"]