/**
 * Response Formatter Utility
 * Provides standardized helper structures for API responses.
 */
export const successResponse = (data, message = 'Success') => ({
  success: true,
  message,
  data,
});

export const errorResponse = (message = 'An error occurred', errors = null) => ({
  success: false,
  message,
  ...(errors ? { errors } : {}),
});
