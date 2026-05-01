FROM mcr.microsoft.com/playwright:v1.55.0-noble

WORKDIR /app

COPY package*.json ./

RUN npm install --omit=dev \
  && apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg \
  && rm -rf /var/lib/apt/lists/*

COPY . .

ENV NODE_ENV=production
ENV PORT=4001
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
ENV ENABLE_WEBSITE_VIDEO=false

RUN mkdir -p /data/whatsapp-sessions /data/generated-videos

EXPOSE 4001

CMD ["npm", "start"]
