FROM node:20-alpine as build
WORKDIR /app
COPY package.json package.lock.josn  ./
RUN npm ci
COPY . .
RUN npm run build

#serve

FROM nginx : alpine

COPY --from=build /app/dist   /usr/share/nginx/html
EXPOSE 80