FROM mcr.microsoft.com/playwright:v1.55.0-noble

WORKDIR /app

COPY package*.json ./

RUN npm install --omit=dev \
  && apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg \
  && rm -rf /var/lib/apt/lists/*

COPY . .

ENV NODE_ENV=production
ENV PORT=10000
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

RUN mkdir -p /data/whatsapp-sessions /data/generated-videos

EXPOSE 10000

CMD ["npm", "start"]
