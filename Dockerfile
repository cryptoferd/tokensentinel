FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
COPY apps/scanner/package.json apps/scanner/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/package*.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/scanner/dist ./apps/scanner/dist
COPY --from=build /app/apps/scanner/package.json ./apps/scanner/package.json
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/packages/shared/package.json ./packages/shared/package.json
EXPOSE 8787
CMD ["node","apps/scanner/dist/index.js"]
