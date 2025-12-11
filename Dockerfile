FROM node:latest

WORKDIR /app

COPY . /app

RUN apt-get update && apt-get install -y \
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    libpangocairo-1.0-0 \
    libpango-1.0-0 \
    libgtk-3-0 \
    libx11-xcb1 \
    libxshmfence1 \
    libxext6 \
    libx11-6 \
    libxtst6 \
    libnss3-tools \
    fonts-liberation \
    libappindicator3-1 \
    libatspi2.0-0 \
    lsb-release \
    xdg-utils \
    wget

RUN npm install
RUN npm install playwright
RUN npx playwright install

EXPOSE 4000

CMD ["node", "index.js"]



