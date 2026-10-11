const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);

  if (!result.success) {
    // We send the first error message back to the frontend
    return res.status(400).json({
      message: result.error.issues[0].message,
    });
  }

  // If valid, attach the cleaned data to req.body and move to the controller
  req.body = result.data;
  next();
};

module.exports = validate;