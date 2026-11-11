FROM node:20-slim

WORKDIR /app

# مقدارهای NEXT_PUBLIC موقع build داخل کد قرار می‌گیرند
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_MEDIA_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_MEDIA_URL=$NEXT_PUBLIC_MEDIA_URL \
    NEXT_TELEMETRY_DISABLED=1

# میرور ابرها
RUN npm config set registry https://mirror.abrha.net/repository/npm/

COPY package*.json ./
RUN npm install --no-audit --no-fund

COPY . .
RUN npm run build

EXPOSE 3000
CMD ["npm", "start"]
