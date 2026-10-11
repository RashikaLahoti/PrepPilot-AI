import toast from "react-hot-toast";

/**
 * Reusable notification helper around react-hot-toast.
 * Implements deduplication (via id option) so duplicate toasts
 * are not stacked when requests fail or buttons are clicked repeatedly.
 */
export const notify = {
  success: (message, options = {}) => {
    return toast.success(message, {
      id: options.id || message,
      ...options,
    });
  },

  error: (message, options = {}) => {
    return toast.error(message, {
      id: options.id || message,
      ...options,
    });
  },

  info: (message, options = {}) => {
    return toast(message, {
      id: options.id || message,
      icon: "ℹ️",
      ...options,
    });
  },

  loading: (message, options = {}) => {
    return toast.loading(message, {
      id: options.id,
      ...options,
    });
  },

  dismiss: (toastId) => {
    if (toastId) {
      toast.dismiss(toastId);
    } else {
      toast.dismiss();
    }
  },
};

export default notify;
