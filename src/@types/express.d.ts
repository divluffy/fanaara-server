import 'express';
import { AuthenticatedUser } from './auth';

declare module 'express' {
  interface Request {
    user?: AuthenticatedUser;
  }
}
