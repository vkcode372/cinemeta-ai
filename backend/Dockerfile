FROM node:22-alpine
WORKDIR /app
COPY . .
RUN npm ci --include=dev
RUN npm run build --prefix backend \
    && (test -f backend/dist/index.js || test -f backend/dist/src/index.js)
ENV NODE_ENV=production
EXPOSE 4000
CMD ["sh", "-c", "cd /app/backend && npx sequelize-cli db:migrate && npx sequelize-cli db:seed:all && node dist/src/index.js"]
