

git add .
git commit -m 'gg'
git push origin main




<!-- // delte prisma tables and start again -->
npx prisma migrate reset --force
npx prisma generate
npx prisma migrate dev --name init




Generate + Migration

بعد تعديل schema:

للـ dev السريع (بدون migrations):
npx prisma db push
npx prisma generate


للأفضل إنتاجيًا (مع migrations):
npx prisma migrate dev -n creator_comics
npx prisma generate
