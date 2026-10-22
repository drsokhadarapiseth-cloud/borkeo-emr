# Borkeo EMR - online server image (Railway, Render, Fly.io).
# node:sqlite needs Node.js 24. The project has no npm packages.
# Patient data never goes into the image: the database, uploads and backups are
# written to DATA_DIR, which must be a permanent volume mounted at /data.
FROM node:24-slim

WORKDIR /app
COPY . .

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3001 \
    DATA_DIR=/data

RUN mkdir -p /data
VOLUME ["/data"]
EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3001)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server/server.mjs"]
