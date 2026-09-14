FROM node:24-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install --no-audit --no-fund
ARG MODE=vm
COPY . .
RUN npm run build -- --mode ${MODE}

FROM nginx:1.30.3-alpine

COPY deploy/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html

ENV VITE_API_BASE_URL=""
ENV BACKEND_URL=http://10.100.0.23:9000
ENV PORT=8080

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/health" || exit 1

CMD ["nginx", "-g", "daemon off;"]
