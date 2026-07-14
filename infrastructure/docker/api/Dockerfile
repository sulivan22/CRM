FROM node:22-alpine

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

WORKDIR /app

RUN corepack enable

COPY . .

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @crm/database db:generate
RUN pnpm --filter @crm/api build

USER node

EXPOSE 3001

CMD ["sh", "-c", "pnpm --filter @crm/database db:migrate && pnpm --filter @crm/api start"]
