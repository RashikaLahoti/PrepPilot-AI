/**
 * Safely extracts a clean, human-readable error message from an API or runtime error.
 * Prevents technical implementation details, stack traces, and database internals
 * from leaking to the end user.
 *
 * @param {any} error - The caught error object
 * @param {string} fallbackMessage - Default message if no specific error message can be resolved
 * @returns {string} User-friendly error message
 */
export const getErrorMessage = (
  error,
  fallbackMessage = "An unexpected error occurred. Please try again."
) => {
  if (!error) return fallbackMessage;

  // Network / server connection unreachable
  if (
    error.code === "ERR_NETWORK" ||
    error.message === "Network Error" ||
    (!error.response && error.request)
  ) {
    return "Unable to connect to the server. Please try again.";
  }

  // Backend returned a specific message in response payload
  if (error.response?.data?.message) {
    const backendMsg = error.response.data.message;
    // Guard against potential raw DB / stack traces in backendMsg
    if (
      typeof backendMsg === "string" &&
      !backendMsg.includes("CastError") &&
      !backendMsg.includes("MongoServerError") &&
      !backendMsg.includes("ValidationError:")
    ) {
      return backendMsg;
    }
  }

  // Status code fallbacks
  const status = error.response?.status;
  if (status === 401) {
    return "Invalid email or password.";
  }
  if (status === 403) {
    return "You are not authorized to perform this action.";
  }
  if (status === 404) {
    return "The requested resource could not be found.";
  }
  if (status === 413) {
    return "The uploaded file is too large.";
  }
  if (status >= 500) {
    return "Unable to connect to the server. Please try again.";
  }

  // String error
  if (typeof error === "string") {
    return error;
  }

  // Standard Error instance message (excluding Axios technical message strings)
  if (
    error.message &&
    typeof error.message === "string" &&
    !error.message.includes("Request failed with status code") &&
    !error.message.includes("AxiosError")
  ) {
    return error.message;
  }

  return fallbackMessage;
};

export default getErrorMessage;
