import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router";
import { useAuth } from "../hooks/useAuth";
import "../auth.form.scss";
import { notify } from "../../../utils/toast";
import { getErrorMessage } from "../../../utils/errorHandler";
import {
  isValidEmail,
  validatePassword,
  validateUsername,
} from "../../../utils/validation";

const Register = () => {
  const navigate = useNavigate();
  const { user, loading, handleRegister } = useAuth();

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({
    username: false,
    email: false,
    password: false,
  });

  // Redirect if already authenticated
  useEffect(() => {
    if (!loading && user) {
      navigate("/", { replace: true });
    }
  }, [user, loading, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    const trimmedUsername = username.trim();
    const trimmedEmail = email.trim();
    const newErrors = { username: false, email: false, password: false };

    // Validate Username
    const usernameValidation = validateUsername(trimmedUsername);
    if (!usernameValidation.isValid) {
      newErrors.username = true;
      setErrors(newErrors);
      notify.error(usernameValidation.message);
      return;
    }

    // Validate Email
    if (!trimmedEmail) {
      newErrors.email = true;
      setErrors(newErrors);
      notify.error("Email is required.");
      return;
    }
    if (!isValidEmail(trimmedEmail)) {
      newErrors.email = true;
      setErrors(newErrors);
      notify.error("Please enter a valid email address.");
      return;
    }

    // Validate Password
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      newErrors.password = true;
      setErrors(newErrors);
      notify.error(passwordValidation.message);
      return;
    }

    setErrors({ username: false, email: false, password: false });
    setIsSubmitting(true);

    try {
      await handleRegister({
        username: trimmedUsername,
        email: trimmedEmail,
        password,
      });
      notify.success("Account created successfully! Welcome to PrepPilot AI.");
      navigate("/", { replace: true });
    } catch (err) {
      const errorMsg = getErrorMessage(err, "Registration failed. Please try again.");
      notify.error(errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <main>
        <h1>Loading...</h1>
      </main>
    );
  }

  return (
    <main>
      <div className="form-container">
        {/* Auth Header */}
        <div className="auth-header">
          <div className="auth-header__logo">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9 11l3 3L22 4" />
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
            </svg>
          </div>
          <h1 className="auth-header__title">Create Your Account</h1>
          <p className="auth-header__subtitle">
            Join PrepPilot AI and start acing your interviews.
          </p>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className="input-group">
            <label htmlFor="username">Username</label>
            <input
              onChange={(e) => {
                setUsername(e.target.value);
                if (errors.username) {
                  setErrors((prev) => ({ ...prev, username: false }));
                }
              }}
              value={username}
              type="text"
              id="username"
              name="username"
              autoComplete="username"
              disabled={isSubmitting}
              className={errors.username ? "input-error" : ""}
              placeholder="Choose a username (min 3 chars)"
            />
          </div>
          <div className="input-group">
            <label htmlFor="email">Email</label>
            <input
              onChange={(e) => {
                setEmail(e.target.value);
                if (errors.email) {
                  setErrors((prev) => ({ ...prev, email: false }));
                }
              }}
              value={email}
              type="email"
              id="email"
              name="email"
              autoComplete="email"
              disabled={isSubmitting}
              className={errors.email ? "input-error" : ""}
              placeholder="Enter email address"
            />
          </div>
          <div className="input-group">
            <label htmlFor="password">Password</label>
            <input
              onChange={(e) => {
                setPassword(e.target.value);
                if (errors.password) {
                  setErrors((prev) => ({ ...prev, password: false }));
                }
              }}
              value={password}
              type="password"
              id="password"
              name="password"
              autoComplete="new-password"
              disabled={isSubmitting}
              className={errors.password ? "input-error" : ""}
              placeholder="Create a password (min 6 chars, 1 number)"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="button primary-button"
          >
            {isSubmitting ? "Creating Account..." : "Get Started"}
          </button>
        </form>

        <p className="auth-footer-text">
          Already have an account? <Link to={"/login"}>Sign in</Link>
        </p>
      </div>
    </main>
  );
};

export default Register;
