

git add .
git commit -m 'gg'
git push origin main




<!-- // delte prisma tables and start again -->
npx prisma migrate reset --force
npx prisma generate
npx prisma migrate dev --name init


