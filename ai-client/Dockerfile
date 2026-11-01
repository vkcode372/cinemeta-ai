FROM node:22-alpine
WORKDIR /app
COPY . .
RUN npm ci --include=dev
RUN npm run build --prefix ai-client
ENV NODE_ENV=production
EXPOSE 4200
CMD ["npm", "run", "start:server", "--prefix", "ai-client"]
