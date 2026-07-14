FROM node:22-alpine

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

WORKDIR /app

RUN corepack enable

COPY . .

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @crm/web build

USER node

EXPOSE 3000

CMD ["pnpm", "--filter", "@crm/web", "start"]
