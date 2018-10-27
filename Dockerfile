FROM node:stretch
WORKDIR /app
COPY package*.json ./
RUN npm install pm2 -g
RUN npm install --only=production
COPY . /app
CMD ["npm", "start"]