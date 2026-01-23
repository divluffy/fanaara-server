when add new column for and table

npx prisma migrate dev -n add_user_avatar
npx prisma migrate dev -n add_user_dob


=====





nest g resource programs

npx prisma migrate dev -n init_auth


nest g module health --no-spec
nest g controller health --no-spec
nest g service health --no-spec


nest g module prisma
nest g service prisma --flat --no-spec

nest g module redis
nest g service redis --flat --no-spec

nest g module auth
nest g controller auth --no-spec
nest g service auth --no-spec

nest g module programs
nest g controller programs --no-spec
nest g service programs --no-spec


<!-- // delte prisma tables and start again -->
npx prisma migrate reset --force
npx prisma generate
npx prisma migrate dev --name init

