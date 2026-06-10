function validate(schema) {
  return (req, _res, next) => {
    const result = schema.safeParse({
      body: req.body ?? {},
      query: req.query ?? {},
      params: req.params ?? {},
    });

    if (!result.success) {
      const err = new Error('Validation failed');
      err.statusCode = 400;
      err.details = result.error.flatten();
      return next(err);
    }

    req.validated = result.data;
    return next();
  };
}

module.exports = validate;
