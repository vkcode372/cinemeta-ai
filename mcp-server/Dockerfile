FROM node:22-alpine
WORKDIR /app
COPY . .
RUN npm ci --include=dev
RUN npm run build --prefix mcp-server
ENV NODE_ENV=production
EXPOSE 4100
CMD ["npm", "run", "start", "--prefix", "mcp-server"]
