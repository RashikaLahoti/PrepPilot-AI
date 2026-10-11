/**
 * Validates that an email has a standard email format.
 * Matches user@domain.tld with standard character set.
 */
export const isValidEmail = (email) => {
  if (!email || typeof email !== "string") return false;
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email.trim());
};

/**
 * Validates password format according to backend rules:
 * - At least 6 characters
 * - Max 20 characters
 * - Contains at least one number
 */
export const validatePassword = (password) => {
  if (!password) {
    return { isValid: false, message: "Password is required." };
  }
  if (password.length < 6) {
    return { isValid: false, message: "Password must be at least 6 characters." };
  }
  if (password.length > 20) {
    return { isValid: false, message: "Password cannot exceed 20 characters." };
  }
  if (!/[0-9]/.test(password)) {
    return { isValid: false, message: "Password must contain at least one number." };
  }
  return { isValid: true, message: "" };
};

/**
 * Validates username according to backend rules:
 * - 3 to 20 characters
 * - Letters, numbers, underscores only
 */
export const validateUsername = (username) => {
  if (!username || !username.trim()) {
    return { isValid: false, message: "Username is required." };
  }
  const trimmed = username.trim();
  if (trimmed.length < 3) {
    return { isValid: false, message: "Username must be at least 3 characters." };
  }
  if (trimmed.length > 20) {
    return { isValid: false, message: "Username cannot exceed 20 characters." };
  }
  if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) {
    return { isValid: false, message: "Username can only contain letters, numbers, and underscores." };
  }
  return { isValid: true, message: "" };
};
