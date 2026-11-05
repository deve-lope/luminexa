FROM node:20-alpine AS build

WORKDIR /app

# Empty REACT_APP_API_URL = same-origin requests via nginx proxy to Django.
ARG REACT_APP_API_URL=
ARG REACT_APP_PUBLIC_URL=http://localhost:3000
ARG REACT_APP_GA_MEASUREMENT_ID=
ARG REACT_APP_CF_BEACON_TOKEN=
ENV REACT_APP_API_URL=$REACT_APP_API_URL
ENV REACT_APP_PUBLIC_URL=$REACT_APP_PUBLIC_URL
ENV REACT_APP_GA_MEASUREMENT_ID=$REACT_APP_GA_MEASUREMENT_ID
ENV REACT_APP_CF_BEACON_TOKEN=$REACT_APP_CF_BEACON_TOKEN

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

FROM nginx:alpine

COPY --from=build /app/build /usr/share/nginx/html
COPY nginx.default.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
