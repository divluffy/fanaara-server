import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { isBlockedEmail } from './email-blocklist.util';

@ValidatorConstraint({ name: 'IsNotTempEmail', async: false })
class IsNotTempEmailConstraint implements ValidatorConstraintInterface {
  validate(value: unknown) {
    if (typeof value !== 'string') return false;
    return !isBlockedEmail(value);
  }

  defaultMessage(args: ValidationArguments) {
    return 'messages.signup.email.temp_not_allowed';
  }
}

export function IsNotTempEmail(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'IsNotTempEmail',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: IsNotTempEmailConstraint,
    });
  };
}
