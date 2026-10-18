# CRIAR ONGS FICTICIAS
docker exec -e NODE_ENV=development cidoa-back-api-1 bun run scripts/seed-donations.ts

# CRIAR ADMIN
docker exec cidoa-back-api-1 bun run scripts/create-admin.ts Learsiz ''
