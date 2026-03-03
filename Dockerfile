FROM node:22-alpine

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install

RUN npm install -g nodemon

COPY . .

RUN addgroup -S app && adduser -S app -G app
USER app

EXPOSE 3001

CMD ["node", "server.js"]