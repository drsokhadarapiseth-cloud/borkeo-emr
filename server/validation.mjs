/**
 * Borkeo EMR - Zero-dependency Lightweight Schema Validator
 */

class ValidationError extends Error {
  constructor(message, details = []) {
    super(message);
    this.name = 'ValidationError';
    this.status = 400;
    this.details = details;
  }
}

export function createValidationError(errors) {
  const message = errors.length > 0 ? `Validation failed: ${errors[0]}` : 'Validation failed.';
  return new ValidationError(message, errors);
}

export const v = {
  string(options = {}) {
    return {
      type: 'string',
      validate(val, path) {
        if (typeof val !== 'string') {
          return { valid: false, error: `${path || 'value'} must be a string.` };
        }
        let processed = options.trim ? val.trim() : val;
        if (options.nonEmpty && processed.length === 0) {
          return { valid: false, error: `${path || 'value'} cannot be empty.` };
        }
        if (typeof options.min === 'number' && processed.length < options.min) {
          return { valid: false, error: `${path || 'value'} must have at least ${options.min} characters.` };
        }
        if (typeof options.max === 'number' && processed.length > options.max) {
          return { valid: false, error: `${path || 'value'} must have at most ${options.max} characters.` };
        }
        if (options.pattern && !options.pattern.test(processed)) {
          return { valid: false, error: options.patternMessage || `${path || 'value'} has invalid format.` };
        }
        return { valid: true, value: processed };
      },
    };
  },

  number(options = {}) {
    return {
      type: 'number',
      validate(val, path) {
        if (typeof val !== 'number' || Number.isNaN(val) || !Number.isFinite(val)) {
          return { valid: false, error: `${path || 'value'} must be a valid finite number.` };
        }
        if (options.integer && !Number.isInteger(val)) {
          return { valid: false, error: `${path || 'value'} must be an integer.` };
        }
        if (typeof options.min === 'number' && val < options.min) {
          return { valid: false, error: `${path || 'value'} must be at least ${options.min}.` };
        }
        if (typeof options.max === 'number' && val > options.max) {
          return { valid: false, error: `${path || 'value'} must be at most ${options.max}.` };
        }
        return { valid: true, value: val };
      },
    };
  },

  boolean() {
    return {
      type: 'boolean',
      validate(val, path) {
        if (typeof val !== 'boolean') {
          return { valid: false, error: `${path || 'value'} must be a boolean.` };
        }
        return { valid: true, value: val };
      },
    };
  },

  enum(allowedValues) {
    const set = new Set(allowedValues);
    return {
      type: 'enum',
      validate(val, path) {
        if (!set.has(val)) {
          return { valid: false, error: `${path || 'value'} must be one of: ${allowedValues.join(', ')}.` };
        }
        return { valid: true, value: val };
      },
    };
  },

  optional(schema) {
    return {
      type: 'optional',
      validate(val, path) {
        if (val === undefined) {
          return { valid: true, value: undefined };
        }
        return schema.validate(val, path);
      },
    };
  },

  nullable(schema) {
    return {
      type: 'nullable',
      validate(val, path) {
        if (val === null || val === undefined) {
          return { valid: true, value: val };
        }
        return schema.validate(val, path);
      },
    };
  },

  array(itemSchema, options = {}) {
    return {
      type: 'array',
      validate(val, path) {
        if (!Array.isArray(val)) {
          return { valid: false, error: `${path || 'value'} must be an array.` };
        }
        if (typeof options.min === 'number' && val.length < options.min) {
          return { valid: false, error: `${path || 'value'} must contain at least ${options.min} items.` };
        }
        if (typeof options.max === 'number' && val.length > options.max) {
          return { valid: false, error: `${path || 'value'} must contain at most ${options.max} items.` };
        }
        const sanitized = [];
        for (let i = 0; i < val.length; i++) {
          const itemRes = itemSchema.validate(val[i], `${path}[${i}]`);
          if (!itemRes.valid) return itemRes;
          sanitized.push(itemRes.value);
        }
        return { valid: true, value: sanitized };
      },
    };
  },

  record(keySchema, valSchema) {
    return {
      type: 'record',
      validate(val, path) {
        if (typeof val !== 'object' || val === null || Array.isArray(val)) {
          return { valid: false, error: `${path || 'value'} must be an object.` };
        }
        const sanitized = {};
        for (const [k, v] of Object.entries(val)) {
          const keyRes = keySchema.validate(k, `${path}.key(${k})`);
          if (!keyRes.valid) return keyRes;
          const valRes = valSchema.validate(v, `${path}.${k}`);
          if (!valRes.valid) return valRes;
          sanitized[keyRes.value] = valRes.value;
        }
        return { valid: true, value: sanitized };
      },
    };
  },

  any() {
    return {
      type: 'any',
      validate(val) {
        return { valid: true, value: val };
      },
    };
  },

  union(...schemas) {
    return {
      type: 'union',
      validate(val, path) {
        for (const schema of schemas) {
          const res = schema.validate(val, path);
          if (res.valid) return res;
        }
        return { valid: false, error: `${path || 'value'} did not match any of the allowed schemas.` };
      },
    };
  },

  object(shape, options = {}) {
    return {
      type: 'object',
      validate(val, path = '') {
        if (typeof val !== 'object' || val === null || Array.isArray(val)) {
          return { valid: false, error: `${path || 'value'} must be an object.` };
        }
        const sanitized = {};
        const errors = [];
        const shapeKeys = new Set(Object.keys(shape));

        if (!options.allowUnknown) {
          for (const key of Object.keys(val)) {
            if (!shapeKeys.has(key)) {
              errors.push(`${path ? `${path}.${key}` : key} is not an allowed field.`);
            }
          }
        }

        for (const [key, schema] of Object.entries(shape)) {
          const fieldPath = path ? `${path}.${key}` : key;
          const res = schema.validate(val[key], fieldPath);
          if (!res.valid) {
            errors.push(res.error);
          } else if (res.value !== undefined) {
            sanitized[key] = res.value;
          }
        }

        if (errors.length > 0) {
          return { valid: false, errors, error: errors[0] };
        }

        if (options.allowUnknown) {
          for (const [key, v] of Object.entries(val)) {
            if (!shapeKeys.has(key)) {
              sanitized[key] = v;
            }
          }
        }

        return { valid: true, value: sanitized };
      },
    };
  },
};

export function validate(data, schema) {
  const result = schema.validate(data, '');
  if (!result.valid) {
    const errors = result.errors || (result.error ? [result.error] : ['Validation failed.']);
    return { valid: false, errors, error: errors[0] };
  }
  return { valid: true, data: result.value, value: result.value };
}

export function assertValid(data, schema) {
  const res = validate(data, schema);
  if (!res.valid) {
    throw createValidationError(res.errors);
  }
  return res.data;
}

export const Schemas = {
  login: v.object({
    username: v.string({ min: 3, max: 64, trim: true, nonEmpty: true }),
    password: v.optional(v.string({ max: 256 })),
    totpCode: v.optional(v.string({ max: 10 })),
  }, { allowUnknown: true }),

  changePassword: v.object({
    currentPassword: v.string({ min: 1, max: 256 }),
    newPassword: v.string({ min: 12, max: 256 }),
    confirmation: v.string({ min: 12, max: 256 }),
  }),

  authContext: v.object({
    role: v.string({ min: 1, max: 64, trim: true }),
    wardCode: v.optional(v.string({ max: 64 })),
  }),

  customRole: v.object({
    code: v.string({ min: 2, max: 64 }),
    labelKh: v.string({ min: 1, max: 120, trim: true, nonEmpty: true }),
    labelEn: v.optional(v.string({ max: 120 })),
  }),

  customWard: v.object({
    code: v.string({ min: 2, max: 32 }),
    nameKh: v.string({ min: 1, max: 120, trim: true, nonEmpty: true }),
    nameEn: v.optional(v.string({ max: 120 })),
  }),

  expense: v.object({
    category: v.string({ min: 1, max: 120, trim: true, nonEmpty: true }),
    description: v.string({ min: 1, max: 300, trim: true, nonEmpty: true }),
    amount: v.number({ min: 0.01 }),
    currency: v.enum(['KHR', 'USD']),
    reference: v.optional(v.string({ max: 180 })),
    note: v.optional(v.string({ max: 1000 })),
    spentAt: v.optional(v.union(v.number(), v.string())),
  }),

  voidFinance: v.object({
    kind: v.enum(['charge', 'payment', 'expense', 'invoice']),
    id: v.string({ min: 1, max: 120, trim: true, nonEmpty: true }),
    reason: v.string({ min: 1, max: 500, trim: true, nonEmpty: true }),
  }),

  symptom: v.object({
    nameKh: v.optional(v.string({ max: 240 })),
    nameEn: v.optional(v.string({ max: 240 })),
    text: v.optional(v.string({ max: 240 })),
  }, { allowUnknown: true }),
};

