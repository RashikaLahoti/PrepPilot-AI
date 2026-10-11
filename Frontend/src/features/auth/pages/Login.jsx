import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router";
import "../auth.form.scss";
import { useAuth } from "../hooks/useAuth";
import { notify } from "../../../utils/toast";
import { getErrorMessage } from "../../../utils/errorHandler";
import { isValidEmail } from "../../../utils/validation";

const Login = () => {
  const { user, loading, handleLogin } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({ email: false, password: false });

  // Redirect if already authenticated
  useEffect(() => {
    if (!loading && user) {
      navigate("/", { replace: true });
    }
  }, [user, loading, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    const trimmedEmail = email.trim();
    const newErrors = { email: false, password: false };

    // Validation A & B: Missing credentials
    if (!trimmedEmail && !password) {
      newErrors.email = true;
      newErrors.password = true;
      setErrors(newErrors);
      notify.error("Please enter your email and password.");
      return;
    }

    if (!trimmedEmail) {
      newErrors.email = true;
      setErrors(newErrors);
      notify.error("Email is required.");
      return;
    }

    // Validation C: Email format validation
    if (!isValidEmail(trimmedEmail)) {
      newErrors.email = true;
      setErrors(newErrors);
      notify.error("Please enter a valid email address.");
      return;
    }

    if (!password) {
      newErrors.password = true;
      setErrors(newErrors);
      notify.error("Password is required.");
      return;
    }

    setErrors({ email: false, password: false });
    setIsSubmitting(true);

    try {
      await handleLogin({ email: trimmedEmail, password });
      // Successful login: preserve session and navigate to home without error toast
      navigate("/", { replace: true });
    } catch (err) {
      const errorMsg = getErrorMessage(err, "Invalid email or password.");
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
              <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" />
            </svg>
          </div>
          <h1 className="auth-header__title">Welcome Back</h1>
          <p className="auth-header__subtitle">
            Sign in to continue your interview prep journey.
          </p>
        </div>

        <form onSubmit={handleSubmit} noValidate>
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
              autoComplete="current-password"
              disabled={isSubmitting}
              className={errors.password ? "input-error" : ""}
              placeholder="Enter password"
            />
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="button primary-button"
          >
            {isSubmitting ? "Signing In..." : "Sign In"}
          </button>
        </form>
        <p className="auth-footer-text">
          Don't have an account? <Link to={"/register"}>Create one</Link>
        </p>
      </div>
    </main>
  );
};

export default Login;
