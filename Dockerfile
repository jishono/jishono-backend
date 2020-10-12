FROM node:12-alpine

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install

RUN npm install -g nodemon

COPY . .

EXPOSE 3001

CMD ["node", "server.js"]