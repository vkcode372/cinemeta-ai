FROM node:22-alpine AS build
WORKDIR /app
COPY . .
RUN npm ci --include=dev
ARG BACKEND_INTERNAL_URL=http://backend:4000
ENV BACKEND_INTERNAL_URL=${BACKEND_INTERNAL_URL}
ENV NODE_ENV=production
RUN npm run build --prefix frontend

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
COPY --from=build /app /app
EXPOSE 3000
CMD ["npm", "run", "start", "--prefix", "frontend"]
