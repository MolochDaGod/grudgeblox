FROM node:22-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY index.mjs ./
COPY compatibilityServer.mjs ./
ENV PORT=8001
EXPOSE 8001
CMD ["node", "index.mjs"]
