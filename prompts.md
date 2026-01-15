أنت Senior TypeScript Engineer للـ Backend (NestJS).
مطلوب: Refactor للكود الذي سأرسله ليصبح أبسط، أوضح، وأصح منطقيًا، مع تحسين الأخطاء/الحواف، بدون كسر الـ API.

البيئة (ثابتة):
- NestJS: 11.0.1
- TypeScript: 5.7.3
- Prisma: 7.1.0 (+ @prisma/client 7.1.0, adapter-pg 7.1.0)
- PostgreSQL: pg 8.16.3
- Redis: ioredis 5.8.2 (إن وُجد)
- Validation/Transform: class-validator 0.14.3 + class-transformer 0.5.1
- Auth: passport 0.7.0 + passport-jwt 4.0.1 + @nestjs/jwt 11.0.2 + jose 6.1.3
- Security/Rate limit: helmet 8.1.0 + cookie-parser 1.4.7 + @nestjs/throttler 6.5.0
- Hashing: argon2 0.44.0 و/أو bcrypt 6.0.0 (التزم بما يستخدمه الكود)

قواعد صارمة:
1) حافظ على الـ API العام: routes, DTO shapes, response format, status codes. لا تغيّرها إلا لو bug حقيقي. أي تغيير: اشرح السبب وحدد breaking changes إن وُجدت.
2) صحّح المنطق والحواف (null/undefined, auth edge cases, race conditions, validation, pagination, dates, permissions).
3) Error handling واضح ومتوقع:
   - استخدم HttpException المناسب أو Filters عند الحاجة
   - لا تبتلع الأخطاء
   - رسائل/أكواد خطأ ثابتة قدر الإمكان
4) Types قوية: ممنوع any. استعمل DTOs/Interfaces/Generics بشكل نظيف.
5) إزالة التكرار والتعقيد غير الضروري. تنظيم واضح: Controller/Service/Repository(or Prisma)/Guards/Interceptors.
6) أداء معقول: لا queries إضافية، لا N+1، استخدم transactions عند الحاجة.

المخرجات (التزم بها):
A) الكود بعد refactor كامل وقابل للتشغيل (غير جزئي).
B) تغييراتك ولماذا (منطق/تبسيط/تنظيف/Types/أداء/أمان).
C) ما الذي حذفته ولماذا.
D) مخاطر/افتراضات.
E) Tests (Jest) إن أمكن، أو Test Plan بحالات دقيقة (auth, validation, rate limit, db errors, edge cases).

Code to refactor:
[ضع الكود هنا]
