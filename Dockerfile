FROM node:20-alpine AS builder

WORKDIR /app

ARG VITE_NUTRITION_API_URL=https://nutrition-api.fitpilot.fit
ARG VITE_TRAINING_API_URL=http://localhost:3000

ENV VITE_NUTRITION_API_URL=$VITE_NUTRITION_API_URL
ENV VITE_TRAINING_API_URL=$VITE_TRAINING_API_URL

COPY package*.json ./

RUN npm ci

COPY . .

RUN npm run build

FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
